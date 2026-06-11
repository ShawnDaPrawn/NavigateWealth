/**
 * Router Auth Guard — CI ratchet (SECURITY-AUDIT P3 #16, the "durable fix")
 * =========================================================================
 *
 * The root cause behind most Critical/High findings in the June 2026 audit
 * was "a router was mounted without auth middleware". The Edge Function
 * gateway runs with verify_jwt=false, so EVERY router must enforce its own
 * auth (session middleware, FNA auth helper, signer tokens, or a shared
 * secret) — or be explicitly, deliberately public.
 *
 * This test makes that rule executable:
 *   1. It parses every `lazy(app, '/path', () => import('./file.ts'))` mount
 *      in the mount-*.ts files.
 *   2. For each mounted module it scans the file AND its local imports
 *      (recursively, up to depth 3) for known auth markers.
 *   3. A module with no auth marker anywhere in its import tree must appear
 *      in PUBLIC_ROUTERS below, with a reason.
 *
 * If you add a new router and this test fails: add auth middleware. Only add
 * the router to PUBLIC_ROUTERS if it is genuinely meant to be reachable by
 * anonymous visitors (e.g. a public lead-gen form), and say why.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Markers that count as "this module enforces auth somewhere":
 * - Session middleware: requireAuth / requireAdmin / requireSuperAdmin
 * - Manual session checks: getAuthContext / authenticateUser / verifyAdmin
 * - Shared-secret guards: constantTimeEqual / CRON auth helpers
 * - Signer-token auth (e-sign): getSignerByToken / validateSignerToken
 */
const AUTH_MARKERS =
  /requireAuth|requireAdmin|requireSuperAdmin|getAuthContext|authenticateUser|verifyAdmin|constantTimeEqual|isAuthorizedPublicationsCron|CRON_SECRET|SERVICE_ROLE_KEY|getSignerByToken|validateSignerToken/;

/**
 * Routers that are allowed to have NO auth marker in their import tree.
 * Every entry needs a reason. Treat additions as security decisions.
 */
const PUBLIC_ROUTERS: Record<string, string> = {
  'rss-proxy.ts':
    'Public RSS proxy for the marketing site; target hosts are exact-match allow-listed and SSRF-guarded (H-2).',
  'fna-routes.ts':
    'Static FNA directory/health listing only — registry metadata, no client data, no mutations.',
};

function listMountedModules(): string[] {
  const mountFiles = readdirSync(SERVER_DIR).filter(
    (f) => f.startsWith('mount-') && f.endsWith('.ts'),
  );
  expect(mountFiles.length).toBeGreaterThanOrEqual(3); // core, fna, modules
  const modules = new Set<string>();
  for (const mf of mountFiles) {
    const src = readFileSync(join(SERVER_DIR, mf), 'utf8');
    for (const m of src.matchAll(/import\('\.\/([^']+)'\)/g)) {
      modules.add(m[1]);
    }
  }
  return [...modules].sort();
}

/** Depth-limited scan of a module + its local ./ imports for auth markers. */
function hasAuthMarker(file: string, depth: number, seen: Set<string>): boolean {
  if (depth < 0 || seen.has(file)) return false;
  seen.add(file);
  const path = join(SERVER_DIR, file);
  if (!existsSync(path)) return false;
  const src = readFileSync(path, 'utf8');
  if (AUTH_MARKERS.test(src)) return true;
  for (const m of src.matchAll(/from '\.\/([^']+)'/g)) {
    if (hasAuthMarker(m[1], depth - 1, seen)) return true;
  }
  return false;
}

describe('router auth guard (SECURITY-AUDIT P3 #16)', () => {
  const modules = listMountedModules();

  it('discovers a sane number of mounted routers', () => {
    expect(modules.length).toBeGreaterThan(50);
  });

  it.each(modules)('%s enforces auth or is explicitly public', (file) => {
    const authed = hasAuthMarker(file, 3, new Set());
    const allowlisted = file in PUBLIC_ROUTERS;

    if (!authed && !allowlisted) {
      expect.fail(
        `${file} is mounted but has no auth marker in its import tree (depth 3). ` +
          `Add requireAuth/requireAdmin (or another marker: ${AUTH_MARKERS.source.slice(0, 80)}…), ` +
          `or — ONLY if this router is genuinely public — add it to PUBLIC_ROUTERS with a reason.`,
      );
    }
    if (authed && allowlisted) {
      expect.fail(
        `${file} is in PUBLIC_ROUTERS but now contains an auth marker — remove the stale allowlist entry.`,
      );
    }
  });

  it('every PUBLIC_ROUTERS entry refers to a mounted module', () => {
    for (const file of Object.keys(PUBLIC_ROUTERS)) {
      expect(modules, `${file} is allowlisted but not mounted`).toContain(file);
    }
  });
});
