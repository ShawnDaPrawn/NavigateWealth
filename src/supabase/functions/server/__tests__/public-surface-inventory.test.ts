/**
 * Public-surface inventory (roadmap §7.2 / §7.3)
 * =============================================
 *
 * WHY THIS EXISTS
 * ---------------
 * `route-auth-classification.ts` records which routes are public, but it records
 * them as the sub-router sees them — `auth-signup.ts POST /signup`. The thing
 * that breaks when the public surface is got wrong is a URL:
 * `/make-server-91ed8379/auth-signup/signup`. Nothing joined the two, so the
 * inventory §7.3 needs — "the complete list of URLs that must keep working for
 * an unauthenticated caller" — did not actually exist in a usable form.
 *
 * This joins the classification registry to the 77-entry lazy mount table and
 * asserts the result is coherent, so the flip can be driven from evidence
 * instead of from a hand-written list. The roadmap is explicit that the
 * hand-written list is not to be trusted: "do not flip on this named list
 * alone."
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * It does not flip anything. See the note in the roadmap §7.3 about why
 * `verify_jwt = true` is worth materially less than it looks here: the SPA
 * ships `publicAnonKey`, which IS a valid signed JWT, so the gateway check is
 * satisfied by anyone who reads the bundle. It blocks tokenless probing, not
 * anonymous access.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/public-surface-inventory.test.ts
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_BY_DESIGN_ROUTES } from './route-auth-classification.ts';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '/make-server-91ed8379';

/** `lazy(app, '<mountPath>', () => import('./<file>'))` in the mount registrars. */
const MOUNT_RE = /lazy\(\s*app,\s*'([^']+)',\s*\(\)\s*=>\s*import\('\.\/([^']+)'\)/g;
/** `import <ident> from './<file>'` — to resolve a child router to its file. */
const IMPORT_RE = /import\s+(\w+)\s+from\s+'\.\/([^']+)'/g;
/** `<parent>.route('<path>', <ident>)` — a sub-router mounted inside a parent. */
const ROUTE_RE = /\b\w+\.route\(\s*'([^']*)'\s*,\s*(\w+)\s*\)/g;

/**
 * Two resolution details that a naive join gets wrong, both found by writing
 * this and watching it fail on 28 routes:
 *
 * 1. EXTENSION PROXIES. mount-core mounts `./security.ts`, but the module is
 *    `security.tsx` — `.ts` is a proxy that re-exports it (see the note at the
 *    top of mount-core). Matching on the literal filename misses every such
 *    module.
 * 2. NESTED ROUTERS, ARBITRARILY DEEP. The e-sign and publications families are
 *    not mounted by `lazy()` at all; a lazily-mounted PARENT mounts them with
 *    `app.route('<path>', child)`. An earlier version of this file assumed one
 *    level of nesting and still could not resolve two modules —
 *    `esign-sender-envelope-routes.ts` is three deep (lazy → esign-routes →
 *    esign-sender-routes → it). So this walks to a FIXPOINT rather than a fixed
 *    depth, and cannot be wrong again the next time someone nests one further.
 */
function normalise(file: string): string {
  return file.replace(/\.tsx?$/, '');
}

/** Join URL segments without producing `//` — `.route('/', child)` is common. */
function joinPath(...parts: string[]): string {
  const joined = parts.filter((p) => p && p !== '/').join('');
  return joined.replace(/\/{2,}/g, '/');
}

function mountTable(): Map<string, string[]> {
  const byModule = new Map<string, string[]>();
  const add = (file: string, path: string) => {
    const key = normalise(file);
    if (!byModule.has(key)) byModule.set(key, []);
    if (!byModule.get(key)!.includes(path)) byModule.get(key)!.push(path);
  };

  // Level 1 — the 77 lazy mounts.
  const direct: Array<[string, string]> = [];
  for (const entry of readdirSync(SERVER_DIR)) {
    if (!/^mount-.*\.tsx?$/.test(entry)) continue;
    const src = readFileSync(join(SERVER_DIR, entry), 'utf8');
    for (const m of src.matchAll(MOUNT_RE)) {
      add(m[2], m[1]);
      direct.push([m[2], m[1]]);
    }
  }

  // Level 2..N — sub-routers mounted inside an already-resolved parent, walked
  // to a fixpoint. Each pass resolves routers whose parent became known in the
  // previous pass; it terminates when a pass adds nothing.
  let frontier = direct;
  while (frontier.length > 0) {
    const next: Array<[string, string]> = [];
    for (const [parentFile, parentMount] of frontier) {
      for (const candidate of [parentFile, parentFile.replace(/\.ts$/, '.tsx')]) {
        let src: string;
        try {
          src = readFileSync(join(SERVER_DIR, candidate), 'utf8');
        } catch {
          continue;
        }
        const imports = new Map<string, string>();
        for (const m of src.matchAll(IMPORT_RE)) imports.set(m[1], m[2]);
        for (const m of src.matchAll(ROUTE_RE)) {
          const child = imports.get(m[2]);
          if (!child) continue;
          const childMount = joinPath(parentMount, m[1]);
          const key = normalise(child);
          const known = byModule.get(key);
          if (known?.includes(childMount)) continue; // already resolved — stop
          add(child, childMount);
          next.push([child, childMount]);
        }
      }
    }
    frontier = next;
  }

  return byModule;
}

const MOUNTS = mountTable();

/** Routes registered directly on the root app rather than behind a lazy mount. */
const ROOT_MOUNTED = new Set(['create-app.ts']);

interface PublicUrl {
  file: string;
  method: string;
  url: string;
}

function publicUrls(): { urls: PublicUrl[]; unmounted: string[] } {
  const urls: PublicUrl[] = [];
  const unmounted: string[] = [];
  for (const entry of PUBLIC_BY_DESIGN_ROUTES) {
    const [file, method, ...rest] = entry.split(' ');
    const routePath = rest.join(' ');
    if (ROOT_MOUNTED.has(file)) {
      urls.push({ file, method, url: routePath });
      continue;
    }
    const mounts = MOUNTS.get(normalise(file));
    if (!mounts) {
      unmounted.push(entry);
      continue;
    }
    for (const mount of mounts) {
      urls.push({ file, method, url: `${PREFIX}${joinPath(mount, routePath)}` });
    }
  }
  return { urls, unmounted };
}

describe('public-surface inventory', () => {
  const { urls, unmounted } = publicUrls();

  it('discovers the lazy mount table', () => {
    // Guards against the regex silently breaking and reporting an empty map —
    // which would make every assertion below vacuously true.
    expect(MOUNTS.size).toBeGreaterThan(50);
  });

  it('resolves every public route to at least one real URL', () => {
    // A public route whose file is not in the mount table is either dead code or
    // a mount that was renamed without updating the classification. Both make
    // the inventory a lie, and the flip would be planned against a lie.
    expect(
      unmounted,
      `${unmounted.length} public route(s) belong to a file with no lazy mount — ` +
        'the module is unmounted (dead) or was renamed. Fix the mount or the ' +
        'classification before trusting this inventory.',
    ).toEqual([]);
    expect(urls.length).toBeGreaterThanOrEqual(PUBLIC_BY_DESIGN_ROUTES.length);
  });

  it('includes the routes a verify_jwt flip breaks first', () => {
    const all = urls.map((u) => `${u.method} ${u.url}`);
    // Account creation: the SPA posts here before any JWT exists. A flip that
    // forgets it breaks signup outright while every health probe stays green.
    expect(all).toContain('POST /make-server-91ed8379/auth-signup/signup');
    // Login validation: same bootstrap paradox.
    expect(all.some((u) => u.includes('/auth/login-validate'))).toBe(true);
    // Lead generation — the revenue path.
    expect(all.some((u) => u.includes('/contact-form/'))).toBe(true);
    expect(all.some((u) => u.includes('/quote-request/'))).toBe(true);
    // Health, which is what a naive flip would test and wrongly call success.
    expect(all).toContain(`GET ${PREFIX}/health`);
  });

  it('never emits a malformed URL', () => {
    for (const u of urls) {
      expect(u.url.startsWith(PREFIX), `${u.file}: ${u.url}`).toBe(true);
      expect(u.url, `${u.file}: double slash in ${u.url}`).not.toMatch(/[^:]\/\//);
    }
  });

  it('is large enough to be the real surface, not a sample', () => {
    // 85 classified public routes across the mount table. If this collapses to a
    // handful, something upstream silently dropped entries and a flip planned
    // against it would take most of the public site offline.
    expect(urls.length).toBeGreaterThan(60);
  });
});

// A deliberate escape hatch for humans: `NW_PRINT_PUBLIC_SURFACE=1 npx vitest run
// src/supabase/functions/server/__tests__/public-surface-inventory.test.ts`
// prints the resolved inventory. The §7.3 flip should be planned against this
// output, not against a list anyone typed by hand.
describe('inventory dump (opt-in)', () => {
  it('prints the resolved public surface when asked', () => {
    const { urls } = publicUrls();
    if (process.env.NW_PRINT_PUBLIC_SURFACE) {
      const sorted = [...new Set(urls.map((u) => `${u.method} ${u.url}`))].sort();
      console.log(`\n${sorted.length} public URLs:\n${sorted.join('\n')}\n`);
    }
    expect(urls.length).toBeGreaterThan(0);
  });
});
