/**
 * Shared-secret checks compare in constant time (audit M-1 / H-13).
 * ================================================================
 *
 * A plain `===` returns at the first byte that differs, so how long a wrong
 * guess takes to fail says how much of it was right. For a static secret that
 * is a byte-at-a-time oracle. The audit's named files were fixed earlier
 * (cron-auth.ts, openclaw, the digests); four more were not: the portal-worker
 * secret — which gates the routes that hand out plaintext insurer-portal
 * credentials — the quality-issues ingest token, and the KV-cleanup,
 * publications and e-sign reminder cron checks.
 *
 * Two checks:
 *   1. Tree-wide, no code compares against a variable holding one of these
 *      secrets with `===` / `!==` (comparing to `''` to test "is it set" is
 *      fine and is excluded).
 *   2. Each file that checks a shared secret uses `constantTimeEqual`, so the
 *      first check cannot pass merely because a comparison was renamed.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Source with comment lines dropped, so prose about `===` does not count. */
const codeOnly = (src: string) =>
  src
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !/^\s*(\*|\/\/|\/\*)/.test(line));

/** Variable names the server uses for a shared secret it checks callers against. */
const SECRET_VARS = [
  'expected',
  'expectedToken',
  'serviceRoleKey',
  'superAdminPw',
  'sharedCronToken',
];
const names = SECRET_VARS.join('|');
const DIRECT_COMPARE = new RegExp(
  // `typeof x === 'string'` tests the type, not the value, so it is excluded.
  `(?:===|!==)\\s*(?:${names})\\b|(?<!typeof )\\b(?:${names})\\s*(?:===|!==)(?!\\s*'')`,
);

const SECRET_CHECKING_FILES = [
  'cron-auth.ts',
  'integrations-portal-guards.ts',
  'quality-issues-routes.ts',
  'kv-cleanup-routes.ts',
  'publications-route-helpers.ts',
  'esign-ops-routes.ts',
];

describe('shared-secret comparisons', () => {
  it('no code compares a shared secret with === or !==', () => {
    const offenders = sourceFiles(SERVER_DIR).flatMap((file) =>
      codeOnly(readFileSync(file, 'utf8'))
        .filter(({ line }) => DIRECT_COMPARE.test(line))
        .map(({ line, n }) => `${relative(SERVER_DIR, file)}:${n}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it.each(SECRET_CHECKING_FILES)('%s compares with constantTimeEqual', (file) => {
    const src = readFileSync(join(SERVER_DIR, file), 'utf8');
    expect(src).toMatch(/import \{[^}]*\bconstantTimeEqual\b[^}]*\} from '\.\/crypto-utils\.ts'/);
    expect(src).toMatch(/constantTimeEqual\(/);
  });
});
