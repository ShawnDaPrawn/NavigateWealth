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
import { announceRatchetSlack } from '../../../../test/ratchet-notice';

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

/** Modules that call `auth.getUser(` — the hand-rolled token verifiers. */
const verifiers = offenders;

describe('every hand-rolled verifier applies the account-security policy', () => {
  /**
   * The count ratchet below caps how many copies exist. It says nothing about
   * whether a copy is CORRECT, and all five were not: none called
   * `enforceAccountSecurity`, so a SUSPENDED or DELETED account kept full
   * access to the AI advisor, the AI intelligence admin routes, the admin
   * security dashboard and the task digest for as long as its JWT stayed valid.
   * Suspending an account never invalidates an already-issued token. That is
   * S14 again, in four more places (P1.2).
   *
   * So: as long as a module verifies tokens itself, it must apply the same
   * account-security policy the canonical path does.
   */
  it('names the verifiers it is checking (analysis sanity check)', () => {
    // If the detector stops finding them, the assertion below passes vacuously.
    expect(verifiers.length).toBeGreaterThan(0);
    expect(verifiers).toContain('fna-auth.ts');
  });

  it('requires enforceAccountSecurity in every module that verifies a token', () => {
    const missing = verifiers.filter(
      (rel) => !readFileSync(join(SERVER_DIR, rel), 'utf8').includes('enforceAccountSecurity'),
    );

    expect(
      missing,
      `These modules verify bearer tokens themselves but never check whether the\n` +
        `account is suspended, deleted or overdue for 2FA. Import\n` +
        `enforceAccountSecurity from auth-mw.ts and call it with the resolved\n` +
        `user id, mapping AuthError to its own statusCode and code — flattening\n` +
        `it into a 401 sends a suspended user round a login loop that cannot\n` +
        `succeed. Better still, delegate to requireAuth/requireAdmin.\n\n` +
        `Missing:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('the anon key is not an admin credential (S1)', () => {
  /**
   * P1.2's original instruction was to delete an anon-key-as-admin branch in
   * `fna-auth.ts`. By the time it came up the branch was already gone — but
   * "already gone" is not a guarantee, and the shape it took (compare the
   * bearer token against an env key, mint a synthetic admin) is easy to
   * reintroduce as a convenience. This is the gate that stops that.
   */
  it('finds the env reads it is scanning for (analysis sanity check)', () => {
    // security-shared legitimately reads the anon key to build a password
    // verifier for signInWithPassword. If this stops matching, the check below
    // is scanning nothing.
    const shared = readFileSync(join(SERVER_DIR, 'security-shared.ts'), 'utf8');
    expect(shared).toContain('SUPABASE_ANON_KEY');
  });

  it('never compares a bearer token against an anon key', () => {
    const offending: string[] = [];
    for (const file of listServerFiles(SERVER_DIR)) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        // A token being tested against an anon key — in either order, and
        // whether by ===, includes, or a constant-time compare.
        if (!/ANON_KEY|anonKey|publicAnonKey/.test(line)) return;
        if (!/\btoken\b|\bauthHeader\b|\bbearer\b/i.test(line)) return;
        offending.push(`${file.slice(SERVER_DIR.length + 1)}:${i + 1}  ${trimmed}`);
      });
    }

    expect(
      offending,
      `A bearer token is being compared against the public anon key. The anon\n` +
        `key is shipped to every browser — treating it as a credential makes\n` +
        `every visitor whatever it authenticates as. That was S1.\n\n` +
        `Found:\n  ${offending.join('\n  ')}`,
    ).toEqual([]);
  });

  it('mints no synthetic admin identity from the FNA gateway', () => {
    // `isSyntheticAdminUser` checks for the literal id 'admin', which only ever
    // existed because the anon-key branch minted one. authenticateUser now
    // returns ids straight from Supabase Auth, which are UUIDs, and
    // FNAAuthUser is constructed nowhere else — so nothing can produce it.
    const fnaAuth = readFileSync(join(SERVER_DIR, 'fna-auth.ts'), 'utf8');
    const constructions = fnaAuth.match(/id:\s*'admin'/g) ?? [];
    expect(constructions, "fna-auth must not construct a user with id 'admin'").toEqual([]);
  });
});

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
      announceRatchetSlack(
        'auth-consolidation',
        offenders.length,
        floor,
        '.auth-implementations-baseline',
        'hand-rolled auth implementations',
      );
    }
  });
});
