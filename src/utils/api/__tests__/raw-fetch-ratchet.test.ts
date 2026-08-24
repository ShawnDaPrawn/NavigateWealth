/**
 * Raw-`fetch` convergence ratchet (Stage A / F10)
 * ==============================================
 *
 * `src/utils/api/client.ts` is the sanctioned way for the SPA to talk to the
 * Edge Function. It provides things a bare `fetch` cannot: a refresh mutex that
 * de-duplicates concurrent token refreshes, proactive refresh before expiry,
 * scoped retry with backoff on network/5xx, a typed `APIError`, Cloudflare
 * HTML-error detection, and the session-expired event the app uses to recover.
 *
 * Every raw `fetch` bypasses all of it. A 401 there does not trigger session
 * recovery; a transient network error is not retried; the caller hand-rolls its
 * own `Authorization` header. That is why the enhancement plan (§5) lists "one
 * data path" as a convergence target.
 *
 * WHY A RATCHET RATHER THAN A LINT RULE
 * -------------------------------------
 * There are 186 raw-fetch call sites in SPA feature code today — 103 of them in
 * just two module API layers (`publications/api.ts` 76, `social-media/api.ts`
 * 27) that never adopted the shared client. A `no-restricted-syntax` rule set
 * to `error` would fail the build immediately, and set to `warn` it would add
 * 186 entries to a 55-warning baseline, drowning the signal F2 exists to keep
 * legible. A count ratchet gets the important half — call site #187 cannot land
 * silently — without either failure mode.
 *
 * Burn this down by migrating callers to `api.get/post/put/patch/delete`, then
 * lower `quality/baselines/raw-fetch-baseline`. At zero, replace this with a lint rule at
 * `error` and delete the file.
 *
 * NOT COUNTED: the API client itself (it must call `fetch`), tests, and the
 * service worker / scripts, which are legitimately outside the client.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { announceRatchetSlack } from '../../../test/ratchet-notice';

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REPO_ROOT = resolve(SRC_DIR, '..');
const BASELINE_FILE = join(REPO_ROOT, 'quality/baselines/raw-fetch-baseline');

/** Areas the SPA writes feature code in. The edge function is server-side. */
const SCANNED = ['components', 'hooks', 'services', 'shared'];

/**
 * `\bfetch(` — the word boundary keeps `refetch(`/`prefetch(` out while still
 * matching `window.fetch(` and `globalThis.fetch(`, which are real raw calls.
 */
const RAW_FETCH = /\bfetch\(/g;

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('raw-fetch convergence ratchet (Stage A / F10)', () => {
  const files = SCANNED.flatMap((d) => walk(join(SRC_DIR, d)));
  const offenders: Array<{ file: string; count: number }> = [];
  let total = 0;

  for (const file of files) {
    const matches = readFileSync(file, 'utf8').match(RAW_FETCH);
    if (!matches) continue;
    total += matches.length;
    offenders.push({ file: file.slice(SRC_DIR.length + 1), count: matches.length });
  }
  offenders.sort((a, b) => b.count - a.count);

  it('scans a plausible number of source files', () => {
    // Guard against the walk silently returning nothing and reporting a vacuous
    // 0 — the failure mode that made the dependency-cruiser gate useless.
    expect(files.length).toBeGreaterThan(500);
  });

  it('does not add raw fetch() calls beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `quality/baselines/raw-fetch-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (total > floor) {
      const top = offenders
        .slice(0, 8)
        .map((o) => `${o.count.toString().padStart(4)}  ${o.file}`)
        .join('\n  ');
      expect.fail(
        `Raw fetch() calls rose to ${total} (floor ${floor}).\n` +
          `Use the shared client instead — \`import { api } from '@/utils/api'\` — so the call\n` +
          `inherits token refresh, retry, APIError typing and session recovery.\n` +
          `If this call genuinely cannot use it, say why in the PR and re-baseline\n` +
          `quality/baselines/raw-fetch-baseline to ${total}.\n\nBiggest current offenders:\n  ${top}`,
      );
    }

    if (total < floor) {
      announceRatchetSlack(
        'raw-fetch',
        total,
        floor,
        'quality/baselines/raw-fetch-baseline',
        'raw fetch() calls',
      );
    }
  });
});
