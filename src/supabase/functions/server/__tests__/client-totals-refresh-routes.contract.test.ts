/**
 * client-totals-refresh-routes.ts — the worker that brings a client's profile
 * totals up to date after their policies were written straight into the
 * database, with the REAL service, repository and `computeClientTotals` (and
 * its default schemas) against an in-memory KV and a stand-in for the three
 * SQL functions the worker calls.
 *
 * What is pinned:
 *  - only the cron credential or an admin session reaches the worker;
 *  - a claimed client's totals are worked out from the policies the claim
 *    returned and stored by the database's fenced write, never by the worker
 *    through the KV, and the client is then current;
 *  - a recalculation that fails is recorded and backed off, never reported
 *    current (review finding: a swallowed error used to count as done);
 *  - overlapping runs never work on the same client, and a run whose claim
 *    lapsed stores nothing over the newer totals (review finding: an older
 *    run could overwrite newer totals);
 *  - policies that change after the claim are never totalled into the
 *    profile: the client is taken again with the new ones, in the same run;
 *  - a run never spins on a client, stops starting new clients once its
 *    budget is spent, and does nothing when nothing is stale;
 *  - before the migration is applied, the worker reports nothing to do.
 *
 * The stand-in follows the migration's rules (`client_totals_refresh_claims`):
 * one claim per client, the write fenced on the claim token and on the
 * policies as claimed, the failure recorded only under the claim. The SQL
 * itself is pinned by the migration's rolled-back smoke and race tests.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { clone, kvStore, request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

interface RefreshRow {
  client_id: string;
  dirty_seq: number;
  refreshed_seq: number;
  claim_token: string | null;
  claimed_seq: number | null;
  failures: number;
  backing_off: boolean;
  last_error: string | null;
}

const db = vi.hoisted(() => {
  const state = {
    /** The KV table, which the SQL functions read and write too: the suite's `kvStore`. */
    kv: new Map<string, unknown>(),
    rows: [] as RefreshRow[],
    missingFunctions: false,
    broken: new Set<string>(),
    /** Runs inside `write`, before it checks anything: what happens meanwhile. */
    beforeWrite: null as null | ((row: RefreshRow) => void),
    /** Runs inside `fail`, before it checks anything. */
    beforeFail: null as null | ((row: RefreshRow) => void),
    /** `write` answers 'refreshed' and releases the claim, but stores and records nothing. */
    writeIgnored: false,
    calls: [] as string[],
    /** Every write the worker asked for, stored or not. */
    writes: [] as Array<{ clientId: string; totals: Record<string, number> }>,
    tokens: 0,
  };
  const policiesOf = (clientId: string) => state.kv.get(`policies:client:${clientId}`);
  // The md5 stand-in: equal for equal content, as md5(value::text) is for jsonb.
  const fingerprint = (value: unknown) => (value == null ? null : JSON.stringify(value));
  const release = (row: RefreshRow) => {
    row.claim_token = null;
    row.claimed_seq = null;
  };

  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    state.calls.push(name);
    if (state.missingFunctions) {
      return { data: null, error: { code: 'PGRST202', message: `Could not find ${name}` } };
    }
    if (state.broken.has(name)) {
      return {
        data: null,
        error: { code: '57014', message: 'canceling statement due to timeout' },
      };
    }
    switch (name) {
      case 'client_totals_refresh_claim': {
        const row = state.rows.find(
          (r) => r.refreshed_seq < r.dirty_seq && r.claim_token === null && !r.backing_off,
        );
        if (!row) return { data: [], error: null };
        row.claim_token = `token-${++state.tokens}`;
        row.claimed_seq = row.dirty_seq;
        const policies = policiesOf(row.client_id) ?? null;
        return {
          data: [
            {
              client_id: row.client_id,
              // PostgREST may hand a bigint back as a string.
              dirty_seq: String(row.dirty_seq),
              claim_token: row.claim_token,
              policies: JSON.parse(JSON.stringify(policies)),
              policies_md5: fingerprint(policies),
            },
          ],
          error: null,
        };
      }
      case 'client_totals_refresh_write': {
        const clientId = String(args.p_client_id);
        const totals = args.p_totals as Record<string, number>;
        const row = state.rows.find((r) => r.client_id === clientId);
        if (row) state.beforeWrite?.(row);
        state.writes.push({ clientId, totals });
        if (!row || !args.p_claim_token || row.claim_token !== args.p_claim_token) {
          return { data: 'lost', error: null };
        }
        if (fingerprint(policiesOf(clientId)) !== args.p_policies_md5) {
          release(row);
          return { data: 'superseded', error: null };
        }
        if (state.writeIgnored) {
          release(row);
          return { data: 'refreshed', error: null };
        }
        state.kv.set(`user_profile:${clientId}:client_keys`, totals);
        row.refreshed_seq = Math.max(row.refreshed_seq, row.claimed_seq ?? 0);
        release(row);
        row.failures = 0;
        row.last_error = null;
        return { data: row.refreshed_seq >= row.dirty_seq ? 'refreshed' : 'stale', error: null };
      }
      case 'client_totals_refresh_fail': {
        const row = state.rows.find((r) => r.client_id === String(args.p_client_id));
        if (row) state.beforeFail?.(row);
        if (!row || !args.p_claim_token || row.claim_token !== args.p_claim_token) {
          return { data: false, error: null };
        }
        row.failures++;
        row.last_error = String(args.p_error);
        row.backing_off = true;
        release(row);
        return { data: true, error: null };
      }
      default:
        throw new Error(`unexpected rpc ${name}`);
    }
  };

  return { state, rpc };
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ rpc: db.rpc }),
}));
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

import * as kv from '../kv_store.tsx';
import app from '../client-totals-refresh-routes.ts';
import {
  refreshStaleClientTotals,
  TOTALS_MAX_TAKES_PER_CLIENT,
} from '../client-totals-refresh-service.ts';
import { resetClientTotalsRefreshClient } from '../repositories/client-totals-refresh-repository.ts';

const AGRA_CLIENT = '8c4158a6-d7ea-43bf-8386-af0cabda8eee';
const OTHER_CLIENT = 'client-2';

const runWorker = (headers: Record<string, string> = { 'x-nw-cron-auth': 'the-cron-token' }) =>
  app.request('/process', { method: 'POST', headers });

const totals = (clientId: string) =>
  kvStore.get(`user_profile:${clientId}:client_keys`) as Record<string, number> | undefined;

const rowOf = (clientId: string) => db.state.rows.find((row) => row.client_id === clientId)!;

const writesFor = (clientId: string) =>
  db.state.writes.filter((write) => write.clientId === clientId).length;

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
  db.state.rows.push({
    client_id: clientId,
    dirty_seq: dirtySeq,
    refreshed_seq: refreshedSeq,
    claim_token: null,
    claimed_seq: null,
    failures: 0,
    backing_off: false,
    last_error: null,
  });
}

/** A write to the client's policies, straight into the database (counted) or through the app (not). */
function writePolicies(clientId: string, policies: unknown, { counted = true } = {}) {
  kvStore.set(`policies:client:${clientId}`, clone(policies));
  if (counted) rowOf(clientId).dirty_seq++;
}

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

beforeEach(() => {
  kvStore.clear();
  // The SQL functions and the KV mock see one store, as they see one table.
  db.state.kv = kvStore;
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
  db.state.broken = new Set();
  db.state.beforeWrite = null;
  db.state.beforeFail = null;
  db.state.writeIgnored = false;
  db.state.calls = [];
  db.state.writes = [];
  cron.isAuthorizedCronRequest.mockClear();
  vi.mocked(kv.get).mockClear();
  vi.mocked(kv.set).mockClear();
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
  it('stores the totals of the policies it claimed, through the fenced write, and the client is current', async () => {
    markStale(AGRA_CLIENT);
    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      refreshed: 1,
      stillStale: 0,
      superseded: 0,
      failed: 0,
      lost: 0,
      clientIds: [AGRA_CLIENT],
    });
    // The archived policy does not count; the bot's new value does.
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(569366.18);
    expect(rowOf(AGRA_CLIENT)).toMatchObject({
      dirty_seq: 1,
      refreshed_seq: 1,
      claim_token: null,
      failures: 0,
    });
    // Only the database stores the totals: the worker reads the policies from
    // its claim and writes nothing through the KV itself.
    expect(vi.mocked(kv.set)).not.toHaveBeenCalled();
    expect(vi.mocked(kv.get).mock.calls.map(([key]) => key)).not.toContain(
      `policies:client:${AGRA_CLIENT}`,
    );
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

  it('does nothing when nothing is stale', async () => {
    markStale(AGRA_CLIENT, 4, 4);
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 0, clientIds: [] });
    expect(db.state.calls).toEqual(['client_totals_refresh_claim']);
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 551894.41 });
  });
});

describe('a recalculation that fails is recorded, never reported current', () => {
  it('records a schema read that fails and backs the client off, leaving the totals alone', async () => {
    markStale(AGRA_CLIENT);
    vi.mocked(kv.get).mockRejectedValueOnce(new Error('KV read timed out'));

    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refreshed: 0, failed: 1, clientIds: [] });
    expect(rowOf(AGRA_CLIENT)).toMatchObject({
      refreshed_seq: 0,
      failures: 1,
      backing_off: true,
      claim_token: null,
      last_error: 'could not work out the totals: KV read timed out',
    });
    expect(db.state.calls).not.toContain('client_totals_refresh_write');
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 551894.41 });
  });

  it('records policies that are not a list', async () => {
    markStale(AGRA_CLIENT);
    kvStore.set(`policies:client:${AGRA_CLIENT}`, { not: 'a list' });
    expect(await (await runWorker()).json()).toMatchObject({ failed: 1, refreshed: 0 });
    expect(rowOf(AGRA_CLIENT).last_error).toBe(
      'could not work out the totals: the policies are not a list',
    );
  });

  it('records a write that errors as a failure, not as current', async () => {
    markStale(AGRA_CLIENT);
    db.state.broken = new Set(['client_totals_refresh_write']);
    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refreshed: 0, failed: 1 });
    expect(rowOf(AGRA_CLIENT)).toMatchObject({ refreshed_seq: 0, failures: 1, backing_off: true });
    expect(rowOf(AGRA_CLIENT).last_error).toMatch(/^could not store the totals: /);
  });

  it('counts a failure whose claim had already lapsed as lost, recording nothing', async () => {
    markStale(AGRA_CLIENT);
    vi.mocked(kv.get).mockRejectedValueOnce(new Error('KV read timed out'));
    db.state.beforeFail = (row) => {
      row.claim_token = 'another-run';
    };
    expect(await (await runWorker()).json()).toMatchObject({ failed: 0, lost: 1 });
    expect(rowOf(AGRA_CLIENT)).toMatchObject({ failures: 0, last_error: null });
  });
});

describe('overlapping runs, and policies that change after the claim', () => {
  it('never lets two overlapping runs work on the same client', async () => {
    markStale(AGRA_CLIENT);
    markStale(OTHER_CLIENT);
    const [first, second] = await Promise.all([
      refreshStaleClientTotals(),
      refreshStaleClientTotals(),
    ]);
    expect(first.refreshed + second.refreshed).toBe(2);
    expect([...first.clientIds, ...second.clientIds].sort()).toEqual(
      [AGRA_CLIENT, OTHER_CLIENT].sort(),
    );
    expect(writesFor(AGRA_CLIENT)).toBe(1);
    expect(writesFor(OTHER_CLIENT)).toBe(1);
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(569366.18);
  });

  it('stores nothing over newer totals once its claim has lapsed to another run', async () => {
    markStale(AGRA_CLIENT);
    db.state.beforeWrite = (row) => {
      if (row.claim_token === 'another-run') return;
      // While this run worked, its claim lapsed; another run took the client
      // over, totalled newer policies and stored them.
      writePolicies(AGRA_CLIENT, [retirementPolicy('agra678002', '600000')]);
      kvStore.set(`user_profile:${AGRA_CLIENT}:client_keys`, {
        retirement_fund_value_total: 600000,
      });
      row.claim_token = 'another-run';
      row.refreshed_seq = row.dirty_seq;
    };

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 0, lost: 1 });
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 600000 });
  });

  it('takes the client again with new policies a direct write left after the claim', async () => {
    markStale(AGRA_CLIENT);
    db.state.beforeWrite = () => {
      db.state.beforeWrite = null;
      writePolicies(AGRA_CLIENT, [retirementPolicy('agra678002', '600000')]);
    };

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 1, superseded: 1, stillStale: 0 });
    // The worker offered the totals of the policies it claimed, the fence
    // turned them down, and only the new policies' totals reached the profile.
    expect(db.state.writes.map((write) => write.totals.retirement_fund_value_total)).toEqual([
      569366.18, 600000,
    ]);
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(600000);
    expect(rowOf(AGRA_CLIENT)).toMatchObject({ dirty_seq: 2, refreshed_seq: 2 });
  });

  it('does the same for an app write after the claim, which is not counted', async () => {
    markStale(AGRA_CLIENT);
    db.state.beforeWrite = () => {
      db.state.beforeWrite = null;
      writePolicies(AGRA_CLIENT, [retirementPolicy('agra678002', '575000')], { counted: false });
    };

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 1, superseded: 1 });
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(575000);
    expect(rowOf(AGRA_CLIENT)).toMatchObject({ dirty_seq: 1, refreshed_seq: 1 });
  });

  it('stores totals that still match, and takes a newer same-content write in the same run', async () => {
    markStale(AGRA_CLIENT);
    db.state.beforeWrite = (row) => {
      db.state.beforeWrite = null;
      row.dirty_seq++; // the bot rewrote the same policies
    };

    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: 2, stillStale: 1, superseded: 0 });
    expect(totals(AGRA_CLIENT)?.retirement_fund_value_total).toBe(569366.18);
    expect(rowOf(AGRA_CLIENT)).toMatchObject({ dirty_seq: 2, refreshed_seq: 2 });
  });
});

describe('a run is bounded', () => {
  it('does not spin on a client whose write does not take: it backs it off and stops', async () => {
    markStale(AGRA_CLIENT);
    db.state.writeIgnored = true;
    const body = await (await runWorker()).json();
    expect(body).toMatchObject({ refreshed: TOTALS_MAX_TAKES_PER_CLIENT, failed: 1 });
    expect(writesFor(AGRA_CLIENT)).toBe(TOTALS_MAX_TAKES_PER_CLIENT);
    expect(rowOf(AGRA_CLIENT)).toMatchObject({
      backing_off: true,
      last_error: `taken ${TOTALS_MAX_TAKES_PER_CLIENT} times in one run without settling`,
    });
  });

  it('starts no new client once the budget is spent, and leaves it unclaimed', async () => {
    markStale(AGRA_CLIENT);
    markStale(OTHER_CLIENT);
    // Each look at the clock moves it on 600 ms: the first client starts at
    // 600 ms into a 1 s budget, the second would start at 1.2 s.
    let clock = 0;
    const result = await refreshStaleClientTotals({
      budgetMs: 1000,
      now: () => {
        clock += 600;
        return clock;
      },
    });
    expect(result.clientIds).toEqual([AGRA_CLIENT]);
    expect(rowOf(OTHER_CLIENT)).toMatchObject({ refreshed_seq: 0, claim_token: null });
  });
});

describe('before the migration, and on a database error', () => {
  it('reports nothing to do before the migration is applied', async () => {
    db.state.missingFunctions = true;
    const res = await runWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refreshed: 0 });
  });

  it('answers 500 when a client cannot be claimed, and leaves the totals alone', async () => {
    markStale(AGRA_CLIENT);
    db.state.broken = new Set(['client_totals_refresh_claim']);
    expect((await runWorker()).status).toBe(500);
    expect(totals(AGRA_CLIENT)).toEqual({ retirement_fund_value_total: 551894.41 });
  });

  it('answers 500 when neither the totals nor the failure can be recorded; the claim lapses for the sweep', async () => {
    markStale(AGRA_CLIENT);
    db.state.broken = new Set(['client_totals_refresh_write', 'client_totals_refresh_fail']);
    expect((await runWorker()).status).toBe(500);
    expect(rowOf(AGRA_CLIENT)).toMatchObject({ refreshed_seq: 0, failures: 0 });
    expect(rowOf(AGRA_CLIENT).claim_token).not.toBeNull();
  });
});
