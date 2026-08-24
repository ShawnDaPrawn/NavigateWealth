/**
 * Route-granular auth ratchet (Stage A / F3)
 * =========================================
 *
 * Companion to `router-auth-guard.test.ts`, which is MODULE-granular: it passes
 * a module if an auth marker appears anywhere in its import tree. That leaves a
 * real blind spot — a file with twelve routes where eleven call `requireAuth`
 * and one forgets still passes, and so does a NEW unguarded route added to an
 * already-guarded file. `auth-routes.ts` is the clearest example: it passes the
 * module-granular test while containing ten routes with no visible guard.
 *
 * This test closes that gap by counting routes rather than modules. For every
 * `app.get|post|put|patch|delete('/…')` registration in the server tree it asks
 * whether the route is covered by any of:
 *
 *   1. Router-scoped middleware — `app.use('*', requireAuth)`.
 *   2. Path-scoped middleware — `app.use('/links', requireAdmin)` or
 *      `app.use('/links/*', …)`, matched against the route path.
 *   3. Parent inheritance — the file is mounted with `parent.route('/', child)`
 *      by a parent that applied `use('*', <auth>)` first (how the honeycomb and
 *      client-portal families are guarded).
 *   4. In-handler checks — an auth marker inside the handler body, e.g.
 *      `const ctx = await getAuthContext(c)`.
 *
 * WHAT THE COUNT IS, AND IS NOT
 * -----------------------------
 * It is a REVIEW LIST, not a vulnerability count. The baseline legitimately
 * includes public-by-design routes (`/login`, `/signup`, the lead-gen forms)
 * that must never require auth. It is static regex analysis, so it can also
 * miss auth applied through indirection.
 *
 * Its value is the DELTA: a newly-added route with no visible guard raises the
 * count and fails CI, which is exactly the regression the module-granular test
 * cannot catch. Treat a rise as "prove this route should be open", not as
 * "you shipped a vulnerability".
 *
 * SANITY CHECKS ON THE ANALYSIS
 * -----------------------------
 * A ratchet is only worth its floor if the thing doing the counting still
 * works, so three properties are pinned independently of the count.
 *
 * The first version of this file anchored that on the `documents.tsx` IDOR —
 * "the analysis must still re-derive this known true positive". That was the
 * wrong kind of anchor and it broke the first time it mattered: PR #207 FIXED
 * the IDOR (`app.use('*', requireAuth)` plus a path-scoped
 * `requireClientAccess`), and this test failed in CI for doing exactly the
 * right thing. An integrity check must never be anchored on a defect staying
 * unfixed.
 *
 * The anchors below are stable under remediation instead:
 *   - routes that are public BY DEFINITION stay in the list — a `/login` that
 *     required auth would be a bootstrap paradox, and the health probes are
 *     documented in index.tsx as the only deliberately open endpoints;
 *   - `documents.tsx` — now guarded at BOTH router scope and path scope — must
 *     stay OUT of it, which exercises the two hardest resolution rules and
 *     would catch either a regressed guard or a broken analysis;
 *   - the route total stays in a sane range, so the regexes cannot silently
 *     match nothing.
 *
 * WHEN THIS FAILS
 * ---------------
 * Guard the new route (`requireAuth`/`requireAdmin`, router- or path-scoped
 * middleware, or an in-handler check). If the route is deliberately public,
 * lower the burden of proof by saying so in the PR, then re-baseline:
 *   node -e "require('fs').writeFileSync('quality/baselines/route-auth-baseline', <count> + '\n')"
 * Lower the floor whenever routes get guarded — it only ratchets down.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { announceRatchetSlack } from '../../../../test/ratchet-notice';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, 'quality/baselines/route-auth-baseline');

/** Kept in sync with router-auth-guard.test.ts, plus the portal-worker secret guard. */
const AUTH_MARKERS =
  /requireAuth|requireAdmin|requireSuperAdmin|getAuthContext|authenticateUser|verifyAdmin|constantTimeEqual|isAuthorizedPublicationsCron|CRON_SECRET|getSignerByToken|validateSignerToken|requirePortalWorker/;

/** Hono route registration with a literal path starting `/`. */
const ROUTE_RE = /\b(\w+)\.(get|post|put|patch|delete)\(\s*(['"`])(\/[^'"`]*)\3/g;
/** `app.use('<pattern>', …)` — the pattern may be `*`, `/*`, or a path prefix. */
const USE_RE = /\b(\w+)\.use\(\s*(['"`])([^'"`]*)\2\s*,/g;
const IMPORT_RE = /import\s+(\w+)\s+from\s+'\.\/([^']+)'/g;
const ROUTE_MOUNT_RE = /\b(\w+)\.route\(\s*(['"`])([^'"`]*)\2\s*,\s*(\w+)\s*\)/g;

/**
 * True when `index` falls on a line that is commented out — a JSDoc body
 * (` * routes.post('/login', …)`) or a `//` line.
 *
 * Without this the analysis counts EXAMPLES as routes. It was found the honest
 * way: adding a usage example to `validate.ts`'s docblock pushed the count from
 * 127 to 128 and failed this ratchet, for a route that does not exist. Any
 * commented-out registration had the same effect.
 *
 * Deliberately line-based rather than a comment-stripping pass: stripping `//`
 * with a regex mangles every `https://` in the file, and a real tokenizer is
 * far more machinery than this needs. A route registration is never indented
 * behind a `*` or `//` in real code.
 */
function isOnACommentLine(src: string, index: number): boolean {
  const lineStart = src.lastIndexOf('\n', index) + 1;
  const line = src.slice(lineStart, index).trimStart();
  return line.startsWith('*') || line.startsWith('//') || line.startsWith('/*');
}

/** How far past a registration to look for an in-handler auth check. */
const HANDLER_SCAN_CHARS = 3000;
/** How far past `app.use(` to look for an auth marker in its middleware list. */
const MIDDLEWARE_SCAN_CHARS = 250;

function listServerFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      listServerFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Patterns from `app.use(<pattern>, …auth…)` in one file. */
function guardPatterns(src: string): string[] {
  const patterns: string[] = [];
  for (const m of src.matchAll(USE_RE)) {
    const tail = src.slice(m.index! + m[0].length, m.index! + m[0].length + MIDDLEWARE_SCAN_CHARS);
    if (AUTH_MARKERS.test(tail)) patterns.push(m[3]);
  }
  return patterns;
}

function isCovered(routePath: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    if (p === '*' || p === '/*') return true;
    if (p.endsWith('/*')) return routePath.startsWith(p.slice(0, -2));
    if (p === routePath) return true;
    return routePath.startsWith(`${p.replace(/\/$/, '')}/`);
  });
}

describe('route-granular auth ratchet (Stage A / F3)', () => {
  const files = listServerFiles(SERVER_DIR);
  const sources = new Map<string, string>();
  for (const f of files) sources.set(f, readFileSync(f, 'utf8'));

  /** Child routers mounted by a parent that guards everything with use('*', auth). */
  const parentGuarded = new Set<string>();
  for (const [file, src] of sources) {
    if (!guardPatterns(src).some((p) => p === '*' || p === '/*')) continue;
    const imports = new Map<string, string>();
    for (const m of src.matchAll(IMPORT_RE)) imports.set(m[1], m[2]);
    for (const m of src.matchAll(ROUTE_MOUNT_RE)) {
      const child = imports.get(m[4]);
      if (!child) continue;
      const childPath = join(dirname(file), child);
      if (existsSync(childPath)) parentGuarded.add(childPath);
    }
  }

  const unguarded: string[] = [];
  const analysedFiles = [...sources.keys()];
  /** Route count per file, so an anchor can prove the file it names is real. */
  const routeCounts = new Map<string, number>();
  let totalRoutes = 0;

  for (const [file, src] of sources) {
    const routes = [...src.matchAll(ROUTE_RE)].filter((m) => !isOnACommentLine(src, m.index!));
    if (routes.length === 0) continue;
    routeCounts.set(file.slice(SERVER_DIR.length + 1), routes.length);
    totalRoutes += routes.length;
    if (parentGuarded.has(file)) continue;

    const patterns = guardPatterns(src);
    for (let i = 0; i < routes.length; i += 1) {
      const start = routes[i].index!;
      const end = i + 1 < routes.length ? routes[i + 1].index! : start + HANDLER_SCAN_CHARS;
      const routePath = routes[i][4];
      if (isCovered(routePath, patterns)) continue;
      if (AUTH_MARKERS.test(src.slice(start, end))) continue;
      unguarded.push(
        `${file.slice(SERVER_DIR.length + 1)} ${routes[i][2].toUpperCase()} ${routePath}`,
      );
    }
  }

  it('discovers a sane number of route registrations', () => {
    // Guards against the regexes silently breaking and reporting a vacuous 0 —
    // the failure mode that made the dependency-cruiser gate useless for months.
    expect(totalRoutes).toBeGreaterThan(500);
  });

  it('still reports routes that are public by definition (true positives)', () => {
    // These cannot ever be guarded: a login endpoint behind requireAuth is a
    // bootstrap paradox, and index.tsx documents the health probes as the only
    // endpoints reachable without a bearer token. If the analysis stops
    // reporting them it has gone blind, and the floor below means nothing.
    for (const expected of [
      'auth-routes.ts POST /login-validate',
      'auth-routes.ts POST /signup',
      'index.tsx GET /make-server-91ed8379/health',
    ]) {
      expect(unguarded, `expected the analysis to still report "${expected}"`).toContain(expected);
    }
  });

  it('does not report documents.tsx, which is guarded at router AND path scope', () => {
    // The counterpart true negative. documents.tsx carries
    // `app.use('*', requireAuth)` AND `app.use('/:userId', requireClientAccess)`
    // (PR #207), so it exercises both of the resolution rules most likely to
    // break. A regression here is either a removed guard on client documents —
    // the IDOR reopening — or an analysis that no longer understands scoped
    // middleware. Both must fail CI.
    // Prove the file is actually IN the analysis first. Without this the
    // assertion below passes trivially the moment documents.tsx is renamed,
    // deleted, or stops being scanned — a check that cannot fail is worth less
    // than no check, because it reads as coverage.
    expect(
      analysedFiles.some((f) => f.replaceAll('\\', '/').endsWith('/documents.tsx')),
      'documents.tsx is no longer being analysed — re-point this anchor at whichever module now carries router-scoped AND path-scoped guards',
    ).toBe(true);
    expect(
      routeCounts.get('documents.tsx') ?? 0,
      'documents.tsx no longer registers any routes — re-point this anchor',
    ).toBeGreaterThan(0);

    const leaked = unguarded.filter((entry) => entry.startsWith('documents.tsx '));
    expect(leaked, 'documents.tsx routes lost their guard, or guard resolution broke').toEqual([]);
  });

  it('does not add unguarded routes beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `quality/baselines/route-auth-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (unguarded.length > floor) {
      const added = unguarded.slice(0, 20).join('\n  ');
      expect.fail(
        `Routes with no visible auth rose to ${unguarded.length} (floor ${floor}).\n` +
          `A new route was added without a guard, or an existing guard was removed.\n` +
          `Cover it with requireAuth/requireAdmin (router- or path-scoped middleware, or an\n` +
          `in-handler check). If the route is deliberately public, say why in the PR and\n` +
          `re-baseline quality/baselines/route-auth-baseline to ${unguarded.length}.\n\n` +
          `Currently unguarded (first 20 of ${unguarded.length}):\n  ${added}`,
      );
    }

    if (unguarded.length < floor) {
      announceRatchetSlack(
        'route-auth',
        unguarded.length,
        floor,
        'quality/baselines/route-auth-baseline',
        'unguarded routes',
      );
    }
  });
});
