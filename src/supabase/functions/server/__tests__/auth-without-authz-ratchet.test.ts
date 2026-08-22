/**
 * Authenticate-then-discard ratchet (P1.4 / S6, S7)
 * ================================================
 *
 * `await getAuthContext(c)` with the result thrown away means the handler
 * proved WHO the caller is and then ignored it. On a route keyed by a resource
 * id, that is authentication standing in for authorization: any logged-in user
 * can act on any resource whose id they know.
 *
 * That was not hypothetical. Eight e-sign download/audit handlers wrote
 * `const _ctx = await getAuthContext(c)` — the underscore an explicit
 * acknowledgement that the answer was unused — and served any envelope's
 * signed PDF, audit trail, certificate, evidence pack or field definitions to
 * any authenticated caller.
 *
 * The FNA family was worse: 33 handlers across risk, medical, retirement, tax,
 * investment, estate, wills, and the two AI chat services called
 * `await authenticateUser(...)` and threw the user away, then read, wrote or
 * deleted whatever `:clientId` / `:fnaId` / `:willId` the caller named. Any
 * signed-in account could read any client's cover analysis, medical FNA, will,
 * or tax documents. Both halves fixed in P1.4.
 *
 * WHY A FLOOR AND NOT A BAN
 * -------------------------
 * The pattern is legitimate on routes that are not keyed by a resource the
 * caller could be a stranger to — "list the things I am allowed to see", or a
 * global read where the sub-router's own middleware already scopes the result.
 * The two surviving `authenticateUser` discards are the `/status` endpoints on
 * will-chat and tax-agent, which report whether an API key is configured and
 * take no resource id at all. The remaining `getAuthContext` call sites need
 * reading one at a time, so the count is floored rather than forbidden.
 *
 * WHEN THIS FAILS
 * ---------------
 * If your route takes an id, resolve ownership: `requireOwnedEnvelope` for
 * e-sign, `requireClientAccess` for client-scoped routes, or an explicit
 * `isAdmin || userId === callerId` check (the reference implementation is in
 * client-portal-routes.ts). If the route genuinely needs no ownership check,
 * say why in the PR and re-baseline.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { announceRatchetSlack } from '../../../../test/ratchet-notice';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(SERVER_DIR, '../../../..');
const BASELINE_FILE = join(REPO_ROOT, '.auth-without-authz-baseline');

/**
 * A discarded auth result: a bare `await <gateway>(...)` statement, or one bound
 * to a deliberately-unused `_`-prefixed name.
 *
 * BOTH gateways are counted. `getAuthContext` is the auth-mw one; the FNA family
 * uses `authenticateUser` instead, and when this ratchet only knew about the
 * first it reported a clean 31 while 33 FNA handlers were discarding through the
 * second — a gate measuring half the surface it appeared to cover.
 */
const GATEWAYS = ['getAuthContext', 'authenticateUser'];
const DISCARDED = GATEWAYS.flatMap((fn) => [
  new RegExp(`^\\s*await ${fn}\\(.*\\);\\s*$`),
  new RegExp(`const\\s+_\\w*\\s*=\\s*await ${fn}\\(`),
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const offenders: { file: string; count: number }[] = [];
let total = 0;
for (const file of walk(SERVER_DIR)) {
  const src = readFileSync(file, 'utf8');
  if (!GATEWAYS.some((fn) => src.includes(fn))) continue;
  let count = 0;
  for (const line of src.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    if (DISCARDED.some((p) => p.test(line))) count += 1;
  }
  if (count > 0) {
    offenders.push({ file: file.slice(SERVER_DIR.length + 1), count });
    total += count;
  }
}

describe('handlers that authenticate and discard the result', () => {
  it('finds a realistic number (analysis sanity check)', () => {
    // Guards against the patterns silently breaking and reporting a vacuous 0.
    expect(total).toBeGreaterThan(10);
  });

  it('confirms the e-sign and FNA handlers fixed in P1.4 no longer do it', () => {
    // The handlers this ratchet was written around. If any reappears here,
    // ownership was dropped again.
    const files = offenders.map((o) => o.file);
    for (const fixed of [
      'esign-sender-download-routes.ts',
      'esign-sender-audit-routes.ts',
      'esign-fields-routes.ts',
      'risk-planning-fna-routes.tsx',
      'medical-fna-routes.tsx',
      'retirement-fna-routes.tsx',
      'tax-planning-fna-routes.ts',
      'investment-ina-routes.tsx',
      'estate-planning-fna-session-routes.ts',
      'estate-planning-fna-will-routes.ts',
      'estate-planning-fna-docs-routes.ts',
    ]) {
      expect(files, `${fixed} should no longer discard its auth result`).not.toContain(fixed);
    }
  });

  it('does not add authenticate-then-discard handlers beyond the committed floor', () => {
    const raw = existsSync(BASELINE_FILE) ? readFileSync(BASELINE_FILE, 'utf8') : '';
    const floor = Number.parseInt(raw.trim(), 10);
    expect(
      Number.isFinite(floor),
      `.auth-without-authz-baseline missing or unparseable (got "${raw}")`,
    ).toBe(true);

    if (total > floor) {
      const worst = [...offenders]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((o) => `${String(o.count).padStart(4)}  ${o.file}`)
        .join('\n  ');
      expect.fail(
        `Handlers authenticating then discarding the context rose to ${total} (floor ${floor}).\n` +
          `If the route takes a resource id, authentication is not the control —\n` +
          `ownership is. Use requireOwnedEnvelope (e-sign), requireClientAccess\n` +
          `(client-scoped), or an explicit isAdmin || userId === callerId check.\n` +
          `If no ownership check applies, say why in the PR and re-baseline to ${total}.\n\n` +
          `Worst offenders:\n  ${worst}`,
      );
    }

    if (total < floor) {
      announceRatchetSlack(
        'auth-without-authz',
        total,
        floor,
        '.auth-without-authz-baseline',
        'discarded auth contexts',
      );
    }
  });
});
