/**
 * Contract adoption ratchet (Stage C / F8) — the one that counts UPWARD.
 * ======================================================================
 *
 * Every other baseline in this repo caps a backlog: `.route-auth-baseline`,
 * `.raw-fetch-baseline`, `.kv-direct-access-baseline` and the rest all fail
 * when their count RISES, and the win is driving them toward zero.
 *
 * This one is the mirror image. It floors a gain. `parseContract` call sites
 * are coverage, not debt, so the failure direction is a count that FALLS —
 * somebody deleting a validated boundary, or refactoring one away without
 * noticing what it was doing. Getting the direction backwards would produce a
 * gate that punishes the very thing it exists to encourage, so it is worth
 * being explicit: **more is better here.**
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * `src/shared/contracts` shipped as a mechanism with zero adopters, and its own
 * docblock described this ratchet as though it were already running. It was
 * not: no baseline file, nothing in CI, no call site anywhere. That is the
 * fifth time this codebase has produced a capability that was written, wired to
 * nothing, and then trusted by whoever read its name — the same shape as
 * `assertFirmAccess` (0 call sites), `security.middleware.ts` (0 importers,
 * self-described as authoritative), the six wrong-format e-sign schemas, and
 * `performSecurityCheck` (0 call sites).
 *
 * A mechanism nobody calls is not a foundation. It is a claim.
 *
 * WHEN THIS FAILS
 * ---------------
 * You removed a `parseContract` call. If the boundary genuinely went away —
 * the endpoint was deleted, the hook was merged into another — lower the
 * baseline and say so in the PR. If you replaced it with `parseContractStrict`,
 * that still counts (both are validated call sites) and the count should not
 * have moved. If you deleted it because it was noisy, that is the signal
 * working: fix the schema or the server, do not remove the check.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = resolve(CONTRACTS_DIR, '../..');
const REPO_ROOT = resolve(SRC_DIR, '..');
const BASELINE_FILE = join(REPO_ROOT, '.contract-coverage-baseline');

/** Both variants count — strict is adoption too, just further along. */
const CALL = /\bparseContract(?:Strict)?\s*\(/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const adopters: { file: string; count: number }[] = [];
let total = 0;
for (const file of walk(SRC_DIR)) {
  // The module's own definitions are the mechanism, not adoption of it.
  if (file.startsWith(CONTRACTS_DIR)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    // An import is not a call site.
    if (/^\s*import\b/.test(line)) continue;
    if (CALL.test(line)) count += 1;
  }
  if (count > 0) {
    adopters.push({ file: file.slice(SRC_DIR.length + 1), count });
    total += count;
  }
}

describe('runtime contract adoption', () => {
  it('still recognises a call site (analysis sanity check)', () => {
    // Guards the inverse case of the usual vacuous-gate risk. If the detector
    // broke and matched nothing, `total` would be 0 and the ratchet below would
    // fail loudly rather than pass — but it would fail for the wrong reason,
    // and this test says which.
    expect(CALL.test('  parseContract(Schema, data, { endpoint: "x" });')).toBe(true);
    expect(CALL.test('  parseContractStrict(Schema, data, { endpoint: "x" });')).toBe(true);
    expect(CALL.test("import { parseContract } from '../contracts';")).toBe(false);
  });

  it('has at least one real adopter outside the contracts module', () => {
    // The finding this ratchet was built for: a mechanism with no callers.
    expect(
      adopters.length,
      'src/shared/contracts has no consumers — it is a claim, not a foundation',
    ).toBeGreaterThan(0);
  });

  it('does not lose validated boundaries below the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.contract-coverage-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (total < floor) {
      const where = adopters
        .sort((a, b) => b.count - a.count)
        .map((a) => `${String(a.count).padStart(4)}  ${a.file}`)
        .join('\n  ');
      expect.fail(
        `Validated boundaries FELL to ${total} (floor ${floor}).\n` +
          `This ratchet counts upward: parseContract call sites are coverage, not\n` +
          `debt. A drop means a checked boundary stopped being checked.\n` +
          `If the endpoint genuinely went away, lower the floor and say so in the\n` +
          `PR. If the check was noisy, that was the signal working — fix the schema\n` +
          `or the server rather than deleting the check.\n\n` +
          `Remaining:\n  ${where || '(none)'}`,
      );
    }

    if (total > floor) {
      process.stdout.write(
        `\n[contract-coverage] ${total} validated boundaries, above floor ${floor} — ` +
          `lock the gain in by setting .contract-coverage-baseline to ${total}.\n`,
      );
    }
  });
});
