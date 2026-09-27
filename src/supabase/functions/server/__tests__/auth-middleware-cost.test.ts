/**
 * Auth middleware cost — CI ratchet
 * ================================
 *
 * `requireAdmin` is a strict superset of `requireAuth`:
 *
 *   requireAuth   = resolveAuthUser(c) -> next()
 *   requireAdmin  = resolveAuthUser(c) -> role check -> next()
 *
 * So `app.post('/x', requireAuth, requireAdmin, handler)` runs
 * `resolveAuthUser` TWICE, and `resolveAuthUser` is not cheap: it makes a
 * network round trip to the Supabase Auth API (`auth.getUser(token)`) and then
 * a database read (`enforceAccountSecurity` -> `kv.get('security:<id>')`).
 * Chaining the two middlewares therefore costs an extra auth round trip and an
 * extra database read on EVERY request to that route, for an answer it already
 * has.
 *
 * That pairing was on 130 route registrations across 17 modules. It is invisible
 * in review — both names read like they belong, and the responses are
 * byte-identical either way, because both 401s come from the same
 * `resolveAuthUser` and the 403 comes from `requireAdmin` regardless. Only the
 * latency differs, which is exactly the kind of regression that comes back.
 *
 * Hence a ratchet rather than a comment.
 *
 * The cost is now also removed at the source. A guard records the verification
 * it performed (`VERIFIED_AUTH` in auth-mw.ts), and every later guard on the
 * same request — and `getAuthContext` — reuses it for the same bearer token
 * rather than asking Supabase Auth again. That covers the shapes a source scan
 * cannot see: a router-wide `requireAuth` in front of a route's `requireAdmin`,
 * and a guarded handler that also calls `getAuthContext` (the latter used to be
 * a second scan here). The behaviour is pinned below. The ratchet stays: a
 * route that names both guards still reads as if it had two different gates.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/auth-middleware-cost.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'npm:hono';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every server source file, excluding tests. */
function serverSources(dir = SERVER_DIR, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      serverSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** `requireAuth` directly followed by a role guard, in either whitespace form. */
const REDUNDANT_PAIR = /requireAuth,\s*require(?:Admin|SuperAdmin)\b/g;

const IMPORT_STATEMENT = /import\s+(?:type\s+)?\{[^}]*\}\s+from\s+'[^']+';/gs;

/**
 * Strips import statements before matching.
 *
 * WHY: `import { requireAuth, requireAdmin } from './auth-mw.ts';` contains the
 * pair as a substring, and it is perfectly legitimate — plenty of modules apply
 * `requireAuth` to their client-facing routes and `requireAdmin` to their admin
 * ones. Matching raw source flags those files and, worse, a fixer built on the
 * same unmasked regex silently deletes the specifier while call sites still use
 * it. (That is not hypothetical: it happened while writing this ratchet, and the
 * suite caught it.) What we are looking for is a route ARGUMENT LIST, so the
 * import block has to go before the scan.
 */
function scannableBody(source: string): string {
  return source.replace(IMPORT_STATEMENT, '');
}

describe('redundant auth middleware', () => {
  it('is not paired with a role guard on any route registration', () => {
    const offenders: string[] = [];
    for (const file of serverSources()) {
      const matches = scannableBody(readFileSync(file, 'utf8')).match(REDUNDANT_PAIR);
      if (matches) offenders.push(`${file.slice(SERVER_DIR.length + 1)} (${matches.length})`);
    }
    // If this fails: drop the `requireAuth` ARGUMENT (not the import).
    // `requireAdmin` and `requireSuperAdmin` already resolve and set the same
    // context, so the pair reads as two gates where there is one.
    expect(offenders).toEqual([]);
  });

  it('does not flag an import that names both guards', () => {
    const source = [
      "import { requireAuth, requireAdmin } from './auth-mw.ts';",
      "app.get('/mine', requireAuth, handler);",
      "app.get('/all', requireAdmin, handler);",
    ].join('\n');
    expect(scannableBody(source).match(REDUNDANT_PAIR)).toBeNull();
  });

  it('does flag a route registration that chains them', () => {
    const source = [
      "import { requireAuth, requireAdmin } from './auth-mw.ts';",
      "app.get('/all', requireAuth, requireAdmin, handler);",
    ].join('\n');
    expect(scannableBody(source).match(REDUNDANT_PAIR)).toHaveLength(1);
  });

  it('flags the multi-line form the route files actually use', () => {
    const source = [
      'app.post(',
      "  '/run',",
      '  requireAuth,',
      '  requireAdmin,',
      '  handler,',
      ');',
    ].join('\n');
    expect(scannableBody(source).match(REDUNDANT_PAIR)).toHaveLength(1);
  });
});

// ── The behaviour the ratchet protects ─────────────────────────────────────
const supa = vi.hoisted(() => ({ getUser: vi.fn() }));
const kvGet = vi.hoisted(() => vi.fn());

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { getUser: supa.getUser } }),
}));

vi.mock('../kv_store.tsx', () => ({
  get: kvGet,
  set: vi.fn(),
  del: vi.fn(),
  mget: vi.fn(),
  getByPrefix: vi.fn(async () => []),
  listByPrefix: vi.fn(async () => []),
}));

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const { requireAuth, requireAdmin, requirePrimaryAuth, getAuthContext, AuthError } =
  await import('../auth-mw.ts');

function mount(...middleware: Parameters<Hono['get']>[1][]) {
  const app = new Hono();
  // @ts-expect-error — spreading middleware into Hono's variadic overloads.
  app.get('/x', ...middleware, (c) => c.json({ ok: true }));
  return app;
}

const call = (app: Hono) => app.request('/x', { headers: { Authorization: 'Bearer t' } });

beforeEach(() => {
  vi.clearAllMocks();
  supa.getUser.mockResolvedValue({
    data: {
      user: { id: 'u-1', email: 'admin@navigatewealth.co', app_metadata: { role: 'admin' } },
    },
    error: null,
  });
  kvGet.mockResolvedValue(null);
});

describe('resolveAuthUser round trips', () => {
  it('requireAdmin alone resolves the caller exactly once', async () => {
    const res = await call(mount(requireAdmin));
    expect(res.status).toBe(200);
    expect(supa.getUser).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('requireAuth before requireAdmin still resolves the caller once', async () => {
    // The second guard reuses the verification the first one recorded.
    const res = await call(mount(requireAuth, requireAdmin));
    expect(res.status).toBe(200);
    expect(supa.getUser).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('resolves once behind a router-wide requireAuth and a route requireAdmin', async () => {
    // The shape a source scan cannot see, and the one documents.tsx and the
    // profile router use for their admin-only routes.
    const app = new Hono();
    app.use('*', requireAuth);
    app.get('/x', requireAdmin, (c) => c.json({ ok: true }));
    const res = await call(app);
    expect(res.status).toBe(200);
    expect(supa.getUser).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('does not let a requirePrimaryAuth pass stand in for the account-state gate', async () => {
    // requirePrimaryAuth skips the gate on purpose (it fronts the 2FA
    // challenge), so a guard after it must run the gate itself.
    kvGet.mockResolvedValue({ suspended: true });
    const res = await call(mount(requirePrimaryAuth, requireAdmin));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('ACCOUNT_SUSPENDED');
    expect(supa.getUser).toHaveBeenCalledTimes(2);
  });

  it('answers an unauthenticated caller identically either way', async () => {
    // The reason the pairing is safe to remove: both 401s come from the same
    // `resolveAuthUser`, so no caller can tell the difference.
    const single = await mount(requireAdmin).request('/x');
    const doubled = await mount(requireAuth, requireAdmin).request('/x');
    expect(single.status).toBe(doubled.status);
    expect(await single.text()).toBe(await doubled.text());
  });

  it('answers a non-admin identically either way', async () => {
    supa.getUser.mockResolvedValue({
      data: { user: { id: 'u-2', email: 'client@example.com', app_metadata: { role: 'client' } } },
      error: null,
    });
    const single = await call(mount(requireAdmin));
    const doubled = await call(mount(requireAuth, requireAdmin));
    expect(single.status).toBe(403);
    expect(single.status).toBe(doubled.status);
    expect(await single.text()).toBe(await doubled.text());
  });

  it('still enforces the account-state gate with the pairing removed', async () => {
    // `enforceAccountSecurity` lives inside `resolveAuthUser`, so removing the
    // duplicate call must not remove the check — only the second copy of it.
    kvGet.mockResolvedValue({ suspended: true });
    const res = await call(mount(requireAdmin));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('ACCOUNT_SUSPENDED');
    expect(kvGet).toHaveBeenCalledTimes(1);
  });
});

describe('getAuthContext behind a guard', () => {
  /** A route whose handler reads the caller the way the e-sign handlers do. */
  function mountReading(...middleware: Parameters<Hono['get']>[1][]) {
    const app = new Hono();
    // @ts-expect-error — spreading middleware into Hono's variadic overloads.
    app.get('/x', ...middleware, async (c) => {
      try {
        const ctx = await getAuthContext(c);
        return c.json({ userId: ctx.userId, role: ctx.role });
      } catch (error) {
        if (error instanceof AuthError) {
          return c.json({ code: error.code }, error.statusCode as 401 | 403);
        }
        throw error;
      }
    });
    return app;
  }

  it('reuses the verification requireAdmin already performed', async () => {
    const res = await call(mountReading(requireAdmin));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'u-1', role: 'admin' });
    expect(supa.getUser).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('reuses the verification requireAuth already performed', async () => {
    const res = await call(mountReading(requireAuth));
    expect(res.status).toBe(200);
    expect(supa.getUser).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('verifies in full with no guard in front', async () => {
    const res = await call(mountReading());
    expect(res.status).toBe(200);
    expect(supa.getUser).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('does not treat a requirePrimaryAuth pass as a full verification', async () => {
    // requirePrimaryAuth skips the account-state gate on purpose (it fronts the
    // 2FA challenge). Reusing its result would hand a suspended account a
    // clean getAuthContext, so the handler's call must run the gate itself.
    kvGet.mockResolvedValue({ suspended: true });
    const res = await call(mountReading(requirePrimaryAuth));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('ACCOUNT_SUSPENDED');
    expect(supa.getUser).toHaveBeenCalledTimes(2);
    expect(kvGet).toHaveBeenCalledTimes(1);
  });

  it('never carries a verification from one request into the next', async () => {
    const app = mountReading(requireAdmin);
    await call(app);
    await call(app);
    expect(supa.getUser).toHaveBeenCalledTimes(2);
    expect(kvGet).toHaveBeenCalledTimes(2);
  });
});
