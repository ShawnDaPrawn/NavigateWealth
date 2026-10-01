/**
 * integrations-portfolio-agents-routes.ts — route contract tests, with the
 * REAL repository and the REAL agent identification against an in-memory
 * stand-in for `public.portfolio_agent_tokens`.
 *
 * What is pinned is the security contract of one token per agent:
 *  - only a super admin's session reaches the routes; an agent token or a
 *    plain admin does not;
 *  - a token appears once, in the response that issues it, and only its
 *    SHA-256 is stored;
 *  - one live token per name, so a rotation is revoke-then-issue and keeps
 *    the actor;
 *  - a revoked token identifies nobody, and a lookup that fails identifies
 *    nobody (fails closed).
 *
 * The stand-in enforces the table's own rules — the partial unique index on
 * live names, the unique hash, the CHECK on name and hash — and answers with
 * the Postgres error codes the repository branches on.
 */
import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

interface Row {
  id: string;
  agent_name: string;
  token_hash: string;
  created_at: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

/** A minimal PostgREST-shaped query builder over one in-memory table. */
const table = vi.hoisted(() => {
  const state = {
    rows: [] as Record<string, unknown>[],
    failNext: null as null | { message: string; code?: string },
    calls: [] as string[],
    clock: 0,
  };

  const project = (row: Record<string, unknown>, columns: string | null) => {
    if (!columns || columns === '*') return { ...row };
    return Object.fromEntries(
      columns.split(',').map((column) => {
        const key = column.trim();
        return [key, row[key]];
      }),
    );
  };

  function builder(op: 'select' | 'insert' | 'update', payload?: Record<string, unknown>) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let columns: string | null = null;
    let returning = op === 'select';
    let order: { column: string; ascending: boolean } | null = null;
    let limit: number | null = null;

    const run = (mode: 'many' | 'single' | 'maybe') => {
      state.calls.push(op);
      if (state.failNext) {
        const error = state.failNext;
        state.failNext = null;
        return { data: null, error };
      }
      let result: Record<string, unknown>[];
      if (op === 'insert') {
        const row = {
          id: `row-${state.rows.length + 1}`,
          created_at: new Date(Date.UTC(2026, 9, 1, 8, 0, state.clock++)).toISOString(),
          created_by: null,
          last_used_at: null,
          revoked_at: null,
          revoked_by: null,
          ...payload,
        } as Record<string, unknown>;
        if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(String(row.agent_name))) {
          return { data: null, error: { code: '23514', message: 'agent_name check' } };
        }
        if (!/^[0-9a-f]{64}$/.test(String(row.token_hash))) {
          return { data: null, error: { code: '23514', message: 'token_hash check' } };
        }
        const liveNameTaken = state.rows.some(
          (existing) => existing.agent_name === row.agent_name && existing.revoked_at === null,
        );
        const hashTaken = state.rows.some((existing) => existing.token_hash === row.token_hash);
        if (liveNameTaken || hashTaken) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
        state.rows.push(row);
        result = [row];
      } else {
        result = state.rows.filter((row) => filters.every((filter) => filter(row)));
        if (op === 'update') result.forEach((row) => Object.assign(row, payload));
      }
      if (order) {
        const { column, ascending } = order;
        result = [...result].sort(
          (a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1),
        );
      }
      if (limit !== null) result = result.slice(0, limit);
      const data = returning ? result.map((row) => project(row, columns)) : null;
      if (mode === 'many') return { data, error: null };
      if (mode === 'single' && (data ?? []).length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'not one row' } };
      }
      return { data: data?.[0] ?? null, error: null };
    };

    const chain = {
      select(cols?: string) {
        columns = cols ?? '*';
        returning = true;
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      is(column: string, value: null) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      order(column: string, options: { ascending: boolean }) {
        order = { column, ascending: options.ascending };
        return chain;
      },
      limit(count: number) {
        limit = count;
        return chain;
      },
      single: async () => run('single'),
      maybeSingle: async () => run('maybe'),
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(run('many')).then(resolve, reject);
      },
    };
    return chain;
  }

  const client = {
    from: (name: string) => {
      if (name !== 'portfolio_agent_tokens') throw new Error(`unexpected table ${name}`);
      return {
        select: (cols?: string) => builder('select').select(cols),
        insert: (payload: Record<string, unknown>) => builder('insert', payload),
        update: (payload: Record<string, unknown>) => builder('update', payload),
      };
    },
  };
  return { state, client };
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: () => table.client }));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return { requireSuperAdmin: makeRoleGate(['super_admin'], 'FORBIDDEN_SUPER_ADMIN') };
});

import app from '../integrations-portfolio-agents-routes.ts';
import { identifyPortfolioAgent } from '../integrations-portfolio-table-auth.ts';
import {
  LAST_USED_REFRESH_MS,
  resetPortfolioAgentClient,
} from '../repositories/portfolio-agent-repository.ts';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const rows = () => table.state.rows as unknown as Row[];

const issue = (name: unknown, as = 'super_admin') =>
  request(app, '/', { method: 'POST', body: { name }, as, user: 'owner-1' });
const revoke = (name: string, as = 'super_admin') =>
  request(app, `/${encodeURIComponent(name)}/revoke`, { method: 'POST', as, user: 'owner-1' });

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

beforeEach(() => {
  table.state.rows = [];
  table.state.failNext = null;
  table.state.calls = [];
  table.state.clock = 0;
  resetPortfolioAgentClient();
});

describe('route inventory', () => {
  it('registers exactly the documented routes', () => {
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    expect(registered.sort()).toEqual(['GET /', 'POST /', 'POST /:name/revoke'].sort());
  });
});

describe('the gate: a super admin session, and nothing else', () => {
  it('turns away a caller with no session', async () => {
    expect((await request(app, '/', { auth: false })).status).toBe(401);
  });

  it('turns away an admin who is not a super admin, and a client', async () => {
    expect((await request(app, '/', { as: 'admin' })).status).toBe(403);
    expect((await issue('grok', 'admin')).status).toBe(403);
    expect((await revoke('grok', 'client')).status).toBe(403);
    expect(rows()).toEqual([]);
  });

  it('does not accept an agent token in place of a session', async () => {
    const issued = await (await issue('grok')).json();
    const res = await app.request('/', { headers: { 'x-nw-portfolio-token': issued.token } });
    expect(res.status).toBe(401);
  });
});

describe('issuing a token', () => {
  it('returns the token once, uncached, and stores only its SHA-256', async () => {
    const res = await issue('grok');
    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.token).toMatch(/^nwpa_[A-Za-z0-9_-]{43}$/);
    expect(body.agent).toEqual({
      name: 'grok',
      createdAt: expect.any(String),
      createdBy: 'admin:owner-1',
      lastUsedAt: null,
      revokedAt: null,
      revokedBy: null,
    });

    expect(rows()).toHaveLength(1);
    expect(rows()[0].token_hash).toBe(sha256(body.token));
    expect(JSON.stringify(rows()[0])).not.toContain(body.token);
  });

  it('issues a different token every time', async () => {
    const first = await (await issue('grok')).json();
    const second = await (await issue('chatgpt')).json();
    expect(first.token).not.toBe(second.token);
  });

  it('lowercases the name, so "Grok " issues grok', async () => {
    const body = await (await issue('  Grok ')).json();
    expect(body.agent.name).toBe('grok');
  });

  it('refuses a malformed or reserved name before touching the table', async () => {
    for (const name of ['g', 'has space', 'a'.repeat(41), '-leading', 'bad/slash', null]) {
      expect((await issue(name)).status).toBe(400);
    }
    const reserved = await issue('development');
    expect(reserved.status).toBe(400);
    expect(JSON.stringify(await reserved.json())).toContain('reserved');
    expect(table.state.calls).toEqual([]);
  });

  it('refuses a second live token for the same name with a 409', async () => {
    await issue('grok');
    const again = await issue('grok');
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'AGENT_TOKEN_EXISTS' });
    expect(rows()).toHaveLength(1);
  });
});

describe('listing tokens', () => {
  it('lists live and revoked tokens newest first, and never a token or a hash', async () => {
    const grok = await (await issue('grok')).json();
    await issue('chatgpt');
    await revoke('grok');

    const res = await request(app, '/', { as: 'super_admin' });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(grok.token);
    expect(text).not.toContain(sha256(grok.token));
    expect(text).not.toContain('token_hash');

    const { agents } = JSON.parse(text);
    expect(agents.map((agent: { name: string }) => agent.name)).toEqual(['chatgpt', 'grok']);
    expect(agents[1]).toMatchObject({ name: 'grok', revokedBy: 'admin:owner-1' });
    expect(agents[1].revokedAt).toEqual(expect.any(String));
  });
});

describe('revoking and rotating', () => {
  it('revokes the live token, keeps the row, and 404s a second revoke', async () => {
    await issue('grok');
    const res = await revoke('grok');
    expect(res.status).toBe(200);
    expect((await res.json()).agent).toMatchObject({ name: 'grok', revokedBy: 'admin:owner-1' });
    expect(rows()).toHaveLength(1);
    expect(rows()[0].revoked_at).toEqual(expect.any(String));

    const again = await revoke('grok');
    expect(again.status).toBe(404);
    expect(await again.json()).toMatchObject({ code: 'AGENT_TOKEN_NOT_FOUND' });
  });

  it('rotates: revoke, then issue the same name a new token', async () => {
    const old = await (await issue('grok')).json();
    await revoke('grok');
    const fresh = await issue('grok');
    expect(fresh.status).toBe(201);
    const { token } = await fresh.json();
    expect(token).not.toBe(old.token);
    expect(rows()).toHaveLength(2);

    expect(await identifyPortfolioAgent(old.token)).toBeNull();
    expect(await identifyPortfolioAgent(token)).toBe('grok');
  });

  it('rejects a malformed name in the path', async () => {
    expect((await revoke('Not Valid!')).status).toBe(400);
  });
});

describe('identifying the agent behind a token', () => {
  it('names the live agent a token belongs to', async () => {
    const { token } = await (await issue('grok')).json();
    expect(await identifyPortfolioAgent(token)).toBe('grok');
    // Surrounding whitespace from a pasted header does not matter.
    expect(await identifyPortfolioAgent(`  ${token} `)).toBe('grok');
  });

  it('accepts the shared token the migration carried over, by its hash', async () => {
    // The migration stored encode(digest(secret, 'sha256'), 'hex').
    const legacy = 'b64SharedSecretFromVault+/AAAAAAAAAAAAAAAAAAAAA=';
    table.state.rows.push({
      id: 'legacy',
      agent_name: 'shared',
      token_hash: sha256(legacy),
      created_at: '2026-09-30T11:40:09.000Z',
      created_by: 'migration',
      last_used_at: null,
      revoked_at: null,
      revoked_by: null,
    });
    expect(await identifyPortfolioAgent(legacy)).toBe('shared');
  });

  it('identifies nobody for an unknown, empty or oversized token', async () => {
    await issue('grok');
    table.state.calls = [];
    expect(await identifyPortfolioAgent('nwpa_guessed')).toBeNull();
    expect(await identifyPortfolioAgent('')).toBeNull();
    expect(await identifyPortfolioAgent('x'.repeat(257))).toBeNull();
    // Only the guess reached the table.
    expect(table.state.calls).toEqual(['select']);
  });

  it('fails closed when the lookup itself fails', async () => {
    const { token } = await (await issue('grok')).json();
    table.state.failNext = { message: 'connection reset' };
    expect(await identifyPortfolioAgent(token)).toBeNull();
  });

  it('records the last use, at most once per refresh window', async () => {
    const { token } = await (await issue('grok')).json();
    table.state.calls = [];

    await identifyPortfolioAgent(token);
    expect(table.state.calls).toEqual(['select', 'update']);
    const firstUse = rows()[0].last_used_at;
    expect(firstUse).toEqual(expect.any(String));

    // Within the window: a read, and no write.
    table.state.calls = [];
    await identifyPortfolioAgent(token);
    expect(table.state.calls).toEqual(['select']);

    // Past the window: written again.
    rows()[0].last_used_at = new Date(Date.now() - LAST_USED_REFRESH_MS - 1000).toISOString();
    table.state.calls = [];
    await identifyPortfolioAgent(token);
    expect(table.state.calls).toEqual(['select', 'update']);
  });

  it('still admits a valid token when recording its use fails', async () => {
    const { token } = await (await issue('grok')).json();
    const realRun = table.client.from;
    let failedUpdate = false;
    table.client.from = ((name: string) => {
      const handle = realRun(name);
      return {
        ...handle,
        update: (payload: Record<string, unknown>) => {
          failedUpdate = true;
          table.state.failNext = { message: 'write timeout' };
          return handle.update(payload);
        },
      };
    }) as typeof realRun;
    try {
      expect(await identifyPortfolioAgent(token)).toBe('grok');
      expect(failedUpdate).toBe(true);
    } finally {
      table.client.from = realRun;
    }
  });
});
