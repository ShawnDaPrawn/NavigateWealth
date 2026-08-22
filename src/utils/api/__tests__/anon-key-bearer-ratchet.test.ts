/**
 * Anon-key-as-bearer ratchet (P1.1)
 * =================================
 *
 * WHY THIS IS A REAL DEFECT AND NOT A STYLE PREFERENCE
 * ----------------------------------------------------
 * `publicAnonKey` ships in the browser bundle. It is not a credential, and
 * since PR #207 removed the last server branch that accepted it as auth
 * (`fna-auth.ts`'s anon-key-as-admin), **no route authenticates it**. Sending
 * it as `Authorization: Bearer …` therefore does exactly one thing: it disguises
 * "not logged in" as "authenticated with a token that happens to be rejected".
 *
 * That disguise hid a dead feature in plain sight. `communication/api.ts`'s
 * `uploadFile()` POSTed the anon key at a route guarded by
 * `requireAuth, requireAdmin` (`communication-routes.ts:88`) — so attaching a
 * file to a communication has never once worked, from the day it was written.
 * Nothing surfaced it, because a 401 from a route you are "sending a token to"
 * reads like a session problem rather than a wiring bug.
 *
 * WHY A RATCHET RATHER THAN A BAN
 * -------------------------------
 * 79 call sites across ~47 files still do this, and they are NOT all the same:
 * some hit genuinely public endpoints (quote-request, contact-form,
 * consultation) where the right fix is to send no header at all, and some hit
 * authenticated endpoints where the right fix is a real session token and the
 * call is currently broken. Each needs reading. A ban would block the build; a
 * floor makes the backlog non-worsening while it is worked down.
 *
 * WHEN THIS FAILS
 * ---------------
 * Use `api.*` from `utils/api/client.ts`, which sends the session JWT when
 * there is one and NO Authorization header when there is not. If the endpoint
 * is public, send no bearer. Do not reintroduce the anon key as one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REPO_ROOT = resolve(SRC_DIR, '..');
const BASELINE_FILE = join(REPO_ROOT, '.anon-key-bearer-baseline');

/**
 * The shapes that put the anon key where a credential belongs:
 *   Authorization: `Bearer ${publicAnonKey}`
 *   session?.access_token || publicAnonKey
 *   token ?? publicAnonKey
 *   return publicAnonKey            (inside a getAuthToken-style helper)
 *
 * Deliberately NOT matched: passing `publicAnonKey` to `createClient(url, key)`,
 * which is its correct use.
 */
const PATTERNS = [
  /Bearer \$\{publicAnonKey\}/,
  /Bearer \$\{\s*\w+\s*\|\|\s*publicAnonKey\s*\}/,
  /access_token\s*\|\|\s*publicAnonKey/,
  /\?\?\s*publicAnonKey/,
  /return publicAnonKey/,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test') continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const offenders: { file: string; count: number }[] = [];
let total = 0;
for (const file of walk(SRC_DIR)) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('publicAnonKey')) continue;
  let count = 0;
  for (const line of src.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    if (PATTERNS.some((p) => p.test(line))) count += 1;
  }
  if (count > 0) {
    offenders.push({ file: relative(SRC_DIR, file), count });
    total += count;
  }
}

describe('anon key used as a bearer token', () => {
  it('finds a realistic number of call sites (analysis sanity check)', () => {
    // Guards against the patterns silently breaking and reporting a vacuous 0,
    // the failure mode that made the dependency-cruiser gate useless.
    expect(total).toBeGreaterThan(20);
  });

  it('confirms the central client no longer does it', () => {
    // api/client.ts is the one every other call site should be routed through,
    // so it must be clean before the backlog can be argued down.
    expect(offenders.map((o) => o.file)).not.toContain('utils/api/client.ts');
  });

  it('confirms the communication upload no longer does it', () => {
    // The verified-broken call this ratchet was written around.
    const communication = offenders.find(
      (o) => o.file === 'components/admin/modules/communication/api.ts',
    );
    expect(communication, 'communication/api.ts should be clean').toBeUndefined();
  });

  it('does not add anon-key bearers beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.anon-key-bearer-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (total > floor) {
      const worst = [...offenders]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((o) => `${String(o.count).padStart(4)}  ${o.file}`)
        .join('\n  ');
      expect.fail(
        `Anon-key bearer tokens rose to ${total} (floor ${floor}).\n` +
          `The anon key is not a credential — it ships in the browser bundle and no\n` +
          `route authenticates it, so this only disguises "logged out" as a rejected\n` +
          `token. Use api.* from utils/api/client.ts, which sends the session JWT or\n` +
          `no Authorization header at all. If the endpoint is public, send no bearer.\n` +
          `If you deliberately changed the floor, update .anon-key-bearer-baseline.\n\n` +
          `Worst offenders:\n  ${worst}`,
      );
    }

    if (total < floor) {
      console.warn(
        `[anon-key-bearer] ${total} call sites, below floor ${floor} — tighten by ` +
          `setting .anon-key-bearer-baseline to ${total}.`,
      );
    }
  });
});
