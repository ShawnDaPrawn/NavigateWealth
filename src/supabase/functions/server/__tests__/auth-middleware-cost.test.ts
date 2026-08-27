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

/**
 * A route registration that chains a role guard AND re-authenticates in the
 * handler body.
 *
 * WHY THIS IS A SECOND PATTERN. `REDUNDANT_PAIR` only sees middleware NAMES
 * chained in an argument list, so it cannot see the other shape of the same
 * waste: `app.get('/x', requireAdmin, async (c) => { const ctx = await
 * getAuthContext(c); ... })`. `requireAdmin` has already validated the token
 * against Supabase Auth, run the account-security lookup and set `user` /
 * `userId` / `userRole` on the context — calling `getAuthContext` after it
 * repeats the network round trip and the store read on EVERY successful
 * request.
 *
 * Not hypothetical: introduced on PR #248 while adding the missing role gate to
 * `GET /envelopes`, reviewed out, and this check added so the next one fails
 * here instead. Read the user with `c.get('user')`.
 *
 * Comment lines are stripped first, for the reason the route-auth detector
 * learned the same night: prose explaining the rule mentions `getAuthContext`,
 * and a detector that reads its own documentation as code is useless.
 */
const GUARDED_ROUTE =
  /\.(?:get|post|put|patch|delete)\(\s*(?:'[^']*'|`[^`]*`)\s*,\s*require(?:Admin|SuperAdmin)\b/g;
/** ANY route registration — used to stop a scan before it reaches the next one. */
const ANY_ROUTE = /\.(?:get|post|put|patch|delete)\(\s*(?:'[^']*'|`[^`]*`)/g;
const HANDLER_SCAN_CHARS = 2500;

/**
 * The handler body for the registration at `start`: up to the NEXT route
 * registration, never past it.
 *
 * A fixed-width window overruns into the following handler and attributes its
 * `getAuthContext` call to the wrong route — which is exactly what happened on
 * the first run of this check: it named a route that had already been fixed,
 * because the next handler down was the real offender.
 */
function handlerBody(src: string, start: number): string {
  ANY_ROUTE.lastIndex = start + 1;
  const next = ANY_ROUTE.exec(src);
  const end = next ? Math.min(next.index, start + HANDLER_SCAN_CHARS) : start + HANDLER_SCAN_CHARS;
  return withoutCommentLines(src.slice(start, end));
}

function withoutCommentLines(slice: string): string {
  return slice
    .split('\n')
    .filter((line) => {
      const t = line.trimStart();
      return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*'));
    })
    .join('\n');
}

describe('re-authentication inside a guarded handler', () => {
  it('no route chains a role guard and then calls getAuthContext', () => {
    const offenders: string[] = [];
    for (const file of serverSources()) {
      const src = scannableBody(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(GUARDED_ROUTE)) {
        if (/\bgetAuthContext\s*\(/.test(handlerBody(src, m.index!))) {
          const line = src.slice(0, m.index!).split('\n').length;
          offenders.push(`${file.slice(SERVER_DIR.length + 1)}:${line}`);
        }
      }
    }
    expect(
      offenders,
      'These routes authenticate twice per request: a role guard already ran ' +
        "`resolveAuthUser` and set the context. Read `c.get('user')` instead of " +
        'calling `getAuthContext(c)` again. Offenders: ' +
        offenders.join(', '),
    ).toEqual([]);
  });

  it('flags the shape it exists to catch, and ignores the fixed one', () => {
    // Without this the check could pass vacuously if the regex stopped matching.
    const bad = [
      "app.get('/envelopes', requireAdmin, async (c) => {",
      '  const ctx = await getAuthContext(c);',
      '  return c.json(ctx);',
      '});',
    ].join('\n');
    const good = [
      "app.get('/envelopes', requireAdmin, async (c) => {",
      "  const user = c.get('user');",
      '  return c.json(user);',
      '});',
    ].join('\n');
    const probe = (src: string) =>
      [...src.matchAll(GUARDED_ROUTE)].some((m) =>
        /\bgetAuthContext\s*\(/.test(handlerBody(src, m.index!)),
      );
    expect(probe(bad)).toBe(true);
    expect(probe(good)).toBe(false);

    // A comment naming the function must not count as a call.
    const commented = [
      "app.get('/envelopes', requireAdmin, async (c) => {",
      '  // Do NOT call getAuthContext(c) here — requireAdmin already did.',
      "  const user = c.get('user');",
      '});',
    ].join('\n');
    expect(probe(commented)).toBe(false);
  });

  it('finds the guarded routes at all, so the scan cannot be vacuous', () => {
    let guarded = 0;
    for (const file of serverSources()) {
      guarded += [...scannableBody(readFileSync(file, 'utf8')).matchAll(GUARDED_ROUTE)].length;
    }
    expect(guarded).toBeGreaterThan(5);
  });
});

describe('redundant auth middleware', () => {
  it('is not paired with a role guard on any route registration', () => {
    const offenders: string[] = [];
    for (const file of serverSources()) {
      const matches = scannableBody(readFileSync(file, 'utf8')).match(REDUNDANT_PAIR);
      if (matches) offenders.push(`${file.slice(SERVER_DIR.length + 1)} (${matches.length})`);
    }
    // If this fails: drop the `requireAuth` ARGUMENT (not the import).
    // `requireAdmin` and `requireSuperAdmin` already resolve and set the same
    // context, and each extra `requireAuth` costs one Supabase Auth round trip
    // plus one database read per request.
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

const { requireAuth, requireAdmin } = await import('../auth-mw.ts');

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

  it('requireAuth before requireAdmin doubles both — this is what the ratchet stops', async () => {
    // Demonstrates the cost rather than asserting a shipped behaviour: no route
    // is registered this way any more, and the source scan above keeps it so.
    const res = await call(mount(requireAuth, requireAdmin));
    expect(res.status).toBe(200);
    expect(supa.getUser).toHaveBeenCalledTimes(2);
    expect(kvGet).toHaveBeenCalledTimes(2);
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
