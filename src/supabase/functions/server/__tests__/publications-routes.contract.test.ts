/**
 * publications-routes.tsx — Route Contract / Characterization Tests (Phase 5c)
 * ===========================================================================
 *
 * Locks the HTTP-level contracts of the publications Edge Function's routes
 * BEFORE the Phase 5c decomposition splits this 2,873-line file into mounted
 * sub-apps. Mounts the real Hono app and asserts: the service envelope, that
 * every auth-guarded route still 401s without a Bearer token, and that every
 * route group stays MOUNTED (a dropped sub-app mount would surface as a 404).
 *
 * `deno check` (ratcheted in CI) is the type/ref guard for the extraction;
 * this is the routing/mount guard. Mocks only the IO boundary: in-memory KV,
 * quiet logger, requireAuth/requireAdmin that enforce the Authorization header,
 * pass-through asyncHandler, and stubbed service modules + Supabase + Deno.env.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the Deno global + module stubs BEFORE imports evaluate. vi.hoisted runs
// above all imports.
const { stubModule, objStub } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
  // Module whose every NAMED export resolves to a vi.fn() (for service modules
  // that export plain functions).
  const stubModule = () =>
    new Proxy(
      {},
      {
        get: (_t, p) =>
          p === '__esModule' ? true : typeof p === 'symbol' || p === 'then' ? undefined : vi.fn(),
      },
    );
  // Object whose every METHOD is a vi.fn() (for namespace-object exports used as
  // `TemplateService.get(...)` / `AdminAuditService.x(...)`).
  const objStub = () =>
    new Proxy(
      {},
      { get: (_t, p) => (typeof p === 'symbol' || p === 'then' ? undefined : vi.fn()) },
    );
  return { stubModule, objStub };
});

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => clone(kvStore.get(k) ?? null)),
  set: vi.fn(async (k: string, v: unknown) => {
    kvStore.set(k, clone(v));
  }),
  del: vi.fn(async (k: string) => {
    kvStore.delete(k);
  }),
  mget: vi.fn(async (ks: string[]) => ks.map((k) => clone(kvStore.get(k) ?? null))),
  getByPrefix: vi.fn(async (p: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => k.startsWith(p) && out.push(clone(v)));
    return out;
  }),
  listByPrefix: vi.fn(async (p: string) => {
    const out: { key: string; value: unknown }[] = [];
    kvStore.forEach((v, k) => k.startsWith(p) && out.push({ key: k, value: clone(v) }));
    return out;
  }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

// requireAuth / requireAdmin are Hono middleware; enforce the Authorization
// header so the harness can assert that guarded routes 401 without it.
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'u1');
    c.set('userRole', 'admin');
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'u1');
    c.set('userRole', 'admin');
    await next();
  },
}));

// asyncHandler wraps a handler in try/catch; pass-through is faithful enough
// for the routing/auth contracts under test.
vi.mock('../error.middleware.ts', () => ({ asyncHandler: (fn: any) => fn }));

vi.mock('../email-service.ts', () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));
vi.mock('../article-notification-template.ts', () => ({
  createArticleNotificationEmail: vi.fn(() => ({ subject: '', html: '' })),
}));
vi.mock('../publications-notification-service.ts', () => stubModule());
vi.mock('../publications-email-engagement-service.ts', () => stubModule());
// Vasco's knowledge index follows article publication state via fire-and-forget
// hooks; embedding is not this suite's concern and must not reach the network.
vi.mock('../vasco-index-sync.ts', () => stubModule());
vi.mock('../publications-phase4-service.ts', () => ({
  TemplateService: objStub(),
  VersionService: objStub(),
}));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: objStub() }));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ data: [], error: null }) }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

import publications from '../publications-routes.tsx';

beforeEach(() => {
  kvStore.clear();
});

describe('publications-routes.tsx route contracts', () => {
  it('GET / returns the publications service status envelope', async () => {
    const res = await publications.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ service: 'publications', status: 'active' });
  });

  it('GET /unknown-path returns 404', async () => {
    const res = await publications.request('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });

  // ---- Auth-guarded routes: 401 without an Authorization header. Locks the
  //      invariant that each group is reachable AND guarded, so the Phase 5c
  //      extraction can't silently drop a mount or its requireAuth guard. ----
  const AUTH_GUARDED: ReadonlyArray<readonly [string, string, RequestInit?]> = [
    ['POST', '/articles/a1/reshare', { method: 'POST', body: '{}' }],
    ['GET', '/email-engagement/summary'],
    ['GET', '/articles/a1/email-engagement'],
    ['POST', '/articles/a1/retry-undelivered', { method: 'POST', body: '{}' }],
    ['GET', '/notification-jobs/j1'],
    ['GET', '/notification-campaigns/c1'],
    ['POST', '/notification-jobs/process', { method: 'POST', body: '{}' }],
    ['GET', '/notification-jobs/processor-status'],
    ['GET', '/press/config'],
    ['PUT', '/press/config', { method: 'PUT', body: '{}' }],
    ['GET', '/team/admin'],
    ['POST', '/team/admin', { method: 'POST', body: '{}' }],
    ['PUT', '/team/admin/t1', { method: 'PUT', body: '{}' }],
  ];
  for (const [label, path, init] of AUTH_GUARDED) {
    it(`${label} ${path} returns 401 without an Authorization header`, async () => {
      const res = await publications.request(path, init as RequestInit);
      expect(res.status).toBe(401);
    });
  }

  // ---- Every route group stays MOUNTED. A representative path per group must
  //      not 404 (it may 200/400/500 depending on shallow mocks — the point is
  //      the route is registered, i.e. its sub-app mount survived). ----
  const MOUNTED: ReadonlyArray<readonly [string, string]> = [
    ['GET', '/categories'],
    ['GET', '/types'],
    ['GET', '/articles'],
    ['GET', '/tags'],
    ['GET', '/stats'],
    ['GET', '/templates'],
    ['GET', '/press/stats'],
    ['GET', '/team'],
  ];
  for (const [label, path] of MOUNTED) {
    it(`${label} ${path} is mounted (not 404)`, async () => {
      const res = await publications.request(path);
      expect(res.status).not.toBe(404);
    });
  }
});
