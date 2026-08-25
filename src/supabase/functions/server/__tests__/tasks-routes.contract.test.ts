/**
 * tasks-routes.ts — route contract tests
 * ======================================
 *
 * WHY THIS FAMILY
 * ---------------
 * 247 statements at 0% coverage on a router that is entirely admin-guarded and
 * writes straight to KV. Two things were unpinned and both are the kind that
 * fail silently:
 *
 *   1. The router-scope guard. `app.use('*', requireAdmin)` is one line, and it
 *      is the ONLY thing standing between an anonymous caller and every task
 *      mutation in the product. §5.5 showed how easily a guard that covers
 *      siblings misses a route; here the whole family rides on one statement.
 *   2. `GET /tasks/` returns a service DESCRIPTOR, not a task list, while
 *      `GET /tasks/all` returns the list. That is a genuine footgun — the
 *      route-auth classification records `/` as a module descriptor precisely
 *      because of it — and nothing asserted the two stay distinct.
 *
 * Schemas here are read from `tasks-validation.ts`, not invented (finding A19:
 * a schema written from imagination is a trap that outlives the person who
 * wrote it).
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/tasks-routes.contract.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

vi.mock('../stderr-logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

/**
 * ROLE-AWARE ON PURPOSE. A header-only mock would pass whether the router
 * carried `requireAdmin` or merely `requireAuth`, so it would not pin the
 * admin-only boundary this family's entire perimeter rests on.
 */
const ROLE_BY_TOKEN: Record<string, string> = {
  'admin-token': 'admin',
  'user-token': 'client',
};

vi.mock('../auth-mw.ts', () => ({
  requireAdmin: async (c: any, next: any) => {
    const header = c.req.header('Authorization');
    if (!header) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    }
    const role = ROLE_BY_TOKEN[header.replace(/^Bearer\s+/, '')] ?? 'client';
    if (role !== 'admin' && role !== 'super_admin') {
      return c.json({ error: 'Forbidden: Admin access required', code: 'FORBIDDEN_ADMIN' }, 403);
    }
    c.set('userId', 'admin-user');
    c.set('userRole', role);
    await next();
  },
}));

const store = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => clone(store.get(k) ?? null)),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, clone(v));
  }),
  del: vi.fn(async (k: string) => {
    store.delete(k);
  }),
  getByPrefix: vi.fn(async (prefix: string) => {
    const out: unknown[] = [];
    store.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push(clone(v));
    });
    return out;
  }),
  mget: vi.fn(async (keys: string[]) => keys.map((k) => clone(store.get(k) ?? null))),
}));

const app = (await import('../tasks-routes.ts')).default;

const AUTH = { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' };
const NON_ADMIN = { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' };

/** Minimal payload that CreateTaskSchema actually accepts — every other field defaults. */
const VALID_TASK = { title: 'Review client file', reminder_frequency: null };

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('tasks-routes: the router-scope guard is the whole perimeter', () => {
  it.each([
    ['GET', '/'],
    ['GET', '/all'],
    ['GET', '/stats'],
    ['POST', '/'],
  ])('%s %s is rejected without an Authorization header', async (method, path) => {
    const res = await app.request(path, {
      method,
      ...(method === 'POST'
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(VALID_TASK) }
        : {}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects an authenticated NON-admin with 403 on every verb', async () => {
    // Without this, the 401 cases above pass identically whether the router
    // carries `requireAdmin` or only `requireAuth` — the guard could be
    // downgraded and no test would notice.
    for (const [method, path] of [
      ['GET', '/all'],
      ['GET', '/stats'],
      ['POST', '/'],
    ] as const) {
      const res = await app.request(path, {
        method,
        headers: NON_ADMIN,
        ...(method === 'POST' ? { body: JSON.stringify(VALID_TASK) } : {}),
      });
      expect(res.status, `${method} ${path} let a non-admin through`).toBe(403);
    }
  });

  it('leaks nothing in the rejection body', async () => {
    const res = await app.request('/all');
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(JSON.stringify(body)).not.toMatch(/task:/);
  });
});

describe('tasks-routes: GET / is a descriptor, GET /all is the data', () => {
  it('GET / returns the service descriptor and NOT a task list', async () => {
    store.set('task:1', { id: '1', title: 'Existing', status: 'new', sort_order: 0 });

    const res = await app.request('/', { headers: AUTH });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Pinned as an object, not an array: the classification registry records
    // this route as a module descriptor, and the SPA reads /all for the list.
    expect(Array.isArray(body)).toBe(false);
    expect(body).toEqual({ service: 'tasks', status: 'active', version: '2.0.0' });
  });

  it('GET /all returns the tasks, ordered by sort_order', async () => {
    store.set('task:b', { id: 'b', title: 'Second', status: 'new', sort_order: 5 });
    store.set('task:a', { id: 'a', title: 'First', status: 'new', sort_order: 1 });

    const res = await app.request('/all', { headers: AUTH });

    expect(res.status).toBe(200);
    const tasks = (await res.json()) as Array<{ id: string }>;
    expect(tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('GET /all drops malformed rows instead of 500ing on them', async () => {
    // KV is schemaless, so a partial write from an older shape is reachable in
    // production. The handler filters on id+title; pinned so a refactor that
    // maps before filtering cannot turn one bad row into a broken admin board.
    store.set('task:good', { id: 'good', title: 'Fine', status: 'new', sort_order: 0 });
    store.set('task:bad', { id: 'bad' });
    store.set('task:null', null);

    const res = await app.request('/all', { headers: AUTH });

    expect(res.status).toBe(200);
    const tasks = (await res.json()) as Array<{ id: string }>;
    expect(tasks.map((t) => t.id)).toEqual(['good']);
  });

  it('GET /all returns [] when the store is empty', async () => {
    const res = await app.request('/all', { headers: AUTH });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });
});

describe('tasks-routes: POST / validation comes from CreateTaskSchema', () => {
  it('rejects a task with no title', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ reminder_frequency: null }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'Validation failed' });
  });

  it('rejects a status outside the enum', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify({ ...VALID_TASK, status: 'almost_done' }),
    });
    expect(res.status).toBe(400);
  });

  it('creates a task and persists it under a task: key', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify(VALID_TASK),
    });

    expect([200, 201]).toContain(res.status);
    const keys = [...store.keys()].filter((k) => k.startsWith('task:'));
    expect(keys).toHaveLength(1);
    expect(store.get(keys[0])).toMatchObject({ title: 'Review client file', status: 'new' });
  });

  it('assigns the next sort_order within the target status column', async () => {
    store.set('task:x', { id: 'x', title: 'Existing', status: 'new', sort_order: 4 });
    store.set('task:y', { id: 'y', title: 'Other column', status: 'completed', sort_order: 99 });

    await app.request('/', {
      method: 'POST',
      headers: AUTH,
      body: JSON.stringify(VALID_TASK),
    });

    const created = [...store.values()].find((t: any) => t?.title === 'Review client file') as any;
    // 5, not 100: ordering is per-status, so the unrelated 'completed' column
    // must not push new cards to the bottom of the 'new' column.
    expect(created.sort_order).toBe(5);
  });

  it('rejects a malformed JSON body with 400, not 500', async () => {
    const res = await app.request('/', { method: 'POST', headers: AUTH, body: 'not json' });
    expect(res.status).toBe(400);
  });
});
