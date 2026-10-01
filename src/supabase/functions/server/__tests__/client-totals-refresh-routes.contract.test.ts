/**
 * client-totals-refresh-routes.ts — the worker that brings a client's profile
 * totals up to date after their policies were written straight into the
 * database, with the REAL service, repository and `recalculateClientTotals`
 * (and its default schemas) against an in-memory KV and a stand-in for the
 * two SQL functions the worker calls.
 *
 * What is pinned:
 *  - only the cron credential or an admin session reaches the worker;
 *  - a stale client's `user_profile:{id}:client_keys` is recalculated from
 *    the policies as they are now, and the client is recorded as caught up;
 *  - a write that lands while the worker recalculates leaves the client
 *    stale, and the same run catches up with it;
 *  - a run never spins on a report that does not take, stops starting new
 *    clients once its budget is spent, and does nothing when nothing is stale;
 *  - before the migration is applied, the worker reports nothing to do.
 *
 * The stand-in follows the migration's rules (stale while refreshed_seq <
 * dirty_seq, done never moves refreshed_seq backwards); the SQL itself is
 * pinned by the migration's rolled-back smoke test.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { kvStore, request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

interface RefreshRow {
  client_id: string;
  dirty_seq: number;
  refreshed_seq: number;
}

const db = vi.hoisted(() => {
  const state = {
    rows: [] as RefreshRow[],
    missingFunctions: false,
    brokenRpc: null as string | null,
    /** Runs inside `done`, before it applies: a write landing mid-recalculation. */
    beforeDone: null as null | ((clientId: string) => void),
    /** `done` acknowledges but changes nothing. */
    doneIgnored: false,
    calls: [] as string[],
  };
  const stale = (row: RefreshRow) => row.refreshed_seq < row.dirty_seq;

  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    state.calls.push(name);
    if (state.missingFunctions) {
      return { data: null, error: { code: 'PGRST202', message: `Could not find ${name}` } };
    }
    if (state.brokenRpc === name) {
      return {
        data: null,
        error: { code: '57014', message: 'canceling statement due to timeout' },
      };
    }
    switch (name) {
      case 'client_totals_refresh_due': {
        const limit = Number(args.p_limit ?? 25);
        return {
          data: state.rows
            .filter(stale)
            .slice(0, limit)
            .map((row) => ({ client_id: row.client_id, dirty_seq: String(row.dirty_seq) })),
          error: null,
        };
      }
      case 'client_totals_refresh_done': {
        const clientId = String(args.p_client_id);
        state.beforeDone?.(clientId);
        const row = state.rows.find((candidate) => candidate.client_id === clientId);
        if (!row) return { data: false, error: null };
        if (!state.doneIgnored) {
          row.refreshed_seq = Math.max(row.refreshed_seq, Number(args.p_seq));
        }
        return { data: row.refreshed_seq >= row.dirty_seq, error: null };
      }
      default:
        throw new Error(`unexpected rpc ${name}`);
    }
  };

  return { state, client: { rpc } };
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: () => db.client }));
vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  return makeKvMock();
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
const cron = vi.hoisted(() => ({
  isAuthorizedCronRequest: vi.fn(
    async (c: { req: { header: (name: string) => string | undefined } }) =>
      c.req.header('x-nw-cron-auth') === 'the-cron-token',
  ),
}));
vi.mock('../cron-auth.ts', () => cron);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return { requireAdmin: makeRoleGate(['admin', 'super_admin'], 'ADMIN_REQUIRED') };
});

import app from '../client-totals-refresh-routes.ts';
import { refreshStaleClientTotals } from '../client-totals-refresh-service.ts';
import { resetClientTotalsRefreshClient } from '../repositories/client-totals-refresh-repository.ts';

const AGRA_CLIENT = '8c4158a6-d7ea-43bf-8386-af0cabda8eee';
const OTHER_CLIENT = 'client-2';

const runWorker = (headers: Record<string, string> = { 'x-nw-cron-auth': 'the-cron-token' }) =>
  app.request('/process', { method: 'POST', headers });

const totals = (clientId: string) =>
  kvStore.get(`user_profile:${clientId}:client_keys`) as Record<string, number> | undefined;

function retirementPolicy(id: string, currentValue: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    categoryId: 'retirement_pre',
    providerName: 'Allan Gray',
    data: { ret_pre_1: id.toUpperCase(), ret_pre_3: currentValue },
    ...extra,
  };
}

function markStale(clientId: string, dirtySeq = 1, refreshedSeq = 0) {
  db.state.rows.push({ client_id: clientId, dirty_seq: dirtySeq, refreshed_seq: refreshedSeq });
}

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

beforeEach(() => {
  kvStore.clear();
  // The bot's direct write: the policy says 569,366.18, the profile still the old value.
  kvStore.set(`policies:client:${AGRA_CLIENT}`, [
    retirementPolicy('agra678002', '569366.18'),
    retirementPolicy('archived-one', '1000', { archived: true }),
  ]);
  kvStore.set(`user_profile:${AGRA_CLIENT}:client_keys`, {
    retirement_fund_value_total: 551894.41,
  });
  kvStore.set(`policies:client:${OTHER_CLIENT}`, [retirementPolicy('other', '200')]);
  db.state.rows = [];
  db.state.missingFunctions = false;
  db.state.brokenRpc = null;
  db.state.beforeDone = null;
  db.state.doneIgnored = false;
  db.state.calls = [];
  cron.isAuthorizedCronRequest.mockClear();
  resetClientTotalsRefreshClient();
});

describe('route inventory', () => {
  it('registers only the worker route', () => {
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    expect(registered).toEqual(['POST /process']);
  });
});

describe('the gate: the cron credential, or an admin', () => {
  it('turns away a caller with neither, and a signed-in client, recalculating nothing', async () => {
    markStale(AGRA_CLIENT);
    expect((await runWorker({})).status).toBe(401);
    expect((await runWorker({ 'x-nw-cron-auth': 'wrong' })).status).toBe(401);
    expect((await request(app, '/process', { method: 'POST', as: 'client' })).status).toBe(403);
    expect(db.state.calls).toEqual([]);
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 551894.41 });
  });

  it('lets the cron credential and an admin run it', async () => {
    expect((await runWorker()).status).toBe(200);
    expect((await request(app, '/process', { method: 'POST', as: 'admin' })).status).toBe(200);
  });
});

describe('bringing a profile up to date', () => {
  it('recalculates the totals from the policies as they are now, and records the client caught up', async () => {
    markStale(AGRA_CLIENT);
    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      refreshed: 1,
      stillStale: 0,
      clientIds: [AGRA_CLIENT],
    });
    // The archived policy does not count; the bot's new value does.
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(569366.18);
    expect(db.state.rows[0]).toEqual({ client_id: AGRA_CLIENT, dirty_seq: 1, refreshed_seq: 1 });
  });

  it('refreshes every stale client in one run and leaves an up-to-date one alone', async () => {
    markStale(AGRA_CLIENT);
    markStale(OTHER_CLIENT);
    markStale('client-up-to-date', 3, 3);
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 2, clientIds: [AGRA_CLIENT, OTHER_CLIENT] });
    expect(totals(OTHER_CLIENT)?.retirement_fund_value_total).toBe(200);
    expect(totals('client-up-to-date')).toBeUndefined();
  });

  it('catches up in the same run with a write that lands while it recalculates', async () => {
    markStale(AGRA_CLIENT);
    let landed = false;
    db.state.beforeDone = (clientId) => {
      if (landed || clientId !== AGRA_CLIENT) return;
      landed = true;
      // The bot writes again between the worker's read and its report.
      kvStore.set(`policies:client:${AGRA_CLIENT}`, [retirementPolicy('agra678002', '600000')]);
      db.state.rows[0].dirty_seq = 2;
    };

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 2, stillStale: 1, clientIds: [AGRA_CLIENT] });
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(600000);
    expect(db.state.rows[0]).toMatchObject({ dirty_seq: 2, refreshed_seq: 2 });
  });

  it('does not spin on a report that does not take', async () => {
    markStale(AGRA_CLIENT);
    db.state.doneIgnored = true;
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 1, stillStale: 1 });
    expect(db.state.calls.filter((call) => call === 'client_totals_refresh_done')).toHaveLength(1);
  });

  it('starts no new client once the budget is spent', async () => {
    markStale(AGRA_CLIENT);
    markStale(OTHER_CLIENT);
    let clock = 0;
    const result = await refreshStaleClientTotals({
      budgetMs: 1000,
      now: () => {
        clock += 400;
        return clock;
      },
    });
    expect(result.clientIds).toEqual([AGRA_CLIENT]);
    expect(db.state.rows[1].refreshed_seq).toBe(0);
  });

  it('does nothing when nothing is stale', async () => {
    markStale(AGRA_CLIENT, 4, 4);
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 0, clientIds: [] });
    expect(db.state.calls).toEqual(['client_totals_refresh_due']);
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 551894.41 });
  });
});

describe('before the migration, and on a database error', () => {
  it('reports nothing to do before the migration is applied', async () => {
    db.state.missingFunctions = true;
    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refreshed: 0 });
  });

  it('answers 500 when the stale list cannot be read, and leaves the totals alone', async () => {
    markStale(AGRA_CLIENT);
    db.state.brokenRpc = 'client_totals_refresh_due';
    expect((await runWorker()).status).toBe(500);
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 551894.41 });
  });

  it('answers 500 when a recalculation cannot be recorded; the client stays stale for the sweep', async () => {
    markStale(AGRA_CLIENT);
    db.state.brokenRpc = 'client_totals_refresh_done';
    expect((await runWorker()).status).toBe(500);
    expect(db.state.rows[0].refreshed_seq).toBe(0);
  });
});
