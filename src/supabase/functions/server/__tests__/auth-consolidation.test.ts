/**
 * One way to authenticate (Stage B: consolidate auth onto auth-mw)
 * ================================================================
 *
 * WHY THIS RATCHET EXISTS — IT IS NOT ABOUT TIDINESS
 * --------------------------------------------------
 * Every module that verifies a bearer token itself is a place the canonical
 * implementation can drift away from, and one of them HAD drifted into a
 * privilege-escalation hole. `tasks-digest-routes.ts` resolved the caller's
 * role from `user.user_metadata?.role || user.user_metadata?.systemRole` and
 * granted admin on it. `user_metadata` is CLIENT-EDITABLE — any signed-in user
 * can call `supabase.auth.updateUser({ data: { role: 'admin' } })` — so that
 * check could be passed by anyone with an account. `resolveTrustedRole`
 * (constants.ts:132-135) refuses precisely this: `admin` and `super_admin` are
 * in PRIVILEGED_ROLES and are never honoured from user_metadata.
 *
 * The canonical path (`auth-mw.ts`) also applies `enforceAccountSecurity`, so a
 * deleted, suspended or stale-2FA account is rejected. Every hand-rolled copy
 * silently skipped that.
 *
 * So the floor below is a SECURITY ratchet: a new module that verifies tokens
 * itself is a new opportunity to reintroduce exactly this bug.
 *
 * WHEN THIS FAILS
 * ---------------
 * Use `requireAuth` / `requireAdmin` / `requireSuperAdmin` / `getAuthContext`
 * from `auth-mw.ts`. If a module genuinely needs its own scheme (the signer
 * token and the cron shared-secret are legitimately different), say why in the
 * PR and re-baseline.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, '.auth-implementations-baseline');

/** The canonical implementation itself, plus the FNA gateway it fronts. */
const CANONICAL = new Set(['auth-mw.ts']);

function listServerFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      listServerFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const offenders: string[] = [];
for (const file of listServerFiles(SERVER_DIR)) {
  const rel = file.slice(SERVER_DIR.length + 1);
  if (CANONICAL.has(rel)) continue;
  const src = readFileSync(file, 'utf8');
  // Ignore matches inside comments, same guard as the other route analyses.
  for (const m of src.matchAll(/auth\.getUser\(/g)) {
    const line = src.slice(src.lastIndexOf('\n', m.index!) + 1, m.index!).trimStart();
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) continue;
    offenders.push(rel);
    break;
  }
}

describe('auth implementations outside auth-mw', () => {
  it('still finds the canonical implementation (analysis sanity check)', () => {
    // If the detector stops matching auth-mw's own call, it is broken and the
    // floor below is meaningless.
    const canonical = readFileSync(join(SERVER_DIR, 'auth-mw.ts'), 'utf8');
    expect(/auth\.getUser\(/.test(canonical)).toBe(true);
  });

  it('confirms the modules migrated in this change no longer verify tokens themselves', () => {
    for (const migrated of ['applications-routes.ts', 'admin-client-onboarding-routes.ts']) {
      expect(offenders, `${migrated} should now delegate to auth-mw`).not.toContain(migrated);
    }
  });

  it('does not add new hand-rolled auth beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.auth-implementations-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (offenders.length > floor) {
      expect.fail(
        `Modules verifying bearer tokens themselves rose to ${offenders.length} (floor ${floor}).\n` +
          `Use requireAuth / requireAdmin / requireSuperAdmin / getAuthContext from\n` +
          `auth-mw.ts. A hand-rolled copy skips enforceAccountSecurity and is where\n` +
          `the user_metadata privilege-escalation bug came from — see this file's\n` +
          `header. If the module genuinely needs its own scheme, say why in the PR\n` +
          `and re-baseline to ${offenders.length}.\n\nCurrently: ${offenders.join(', ')}`,
      );
    }

    if (offenders.length < floor) {
      console.warn(
        `[auth-consolidation] ${offenders.length} hand-rolled auth implementations, below ` +
          `floor ${floor} — tighten by setting .auth-implementations-baseline to ${offenders.length}.`,
      );
    }
  });
});
