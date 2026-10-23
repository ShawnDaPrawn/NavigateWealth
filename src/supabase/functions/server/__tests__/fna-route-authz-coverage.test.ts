/**
 * Every resource-keyed FNA route carries an ownership check (P1.4 / S7).
 * ======================================================================
 *
 * The authenticate-then-discard ratchet catches the OLD shape — a handler that
 * throws the auth result away. It cannot catch the next variant of the same
 * mistake: capturing `const user` to stamp `createdBy` and still never asking
 * whether that user may touch this record. `PUT /update/:fnaId` was exactly
 * that before P1.4.
 *
 * So this sweeps structurally instead: any handler in the FNA family whose path
 * names a resource the caller could be a stranger to must contain a call to the
 * shared policy. It is a presence check, not a proof — fna-route-object-authz
 * .test.ts proves the checks actually deny — but it is the gate that fails when
 * somebody adds route number 34 without one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'risk-planning-fna-routes.ts',
  'medical-fna-routes.ts',
  'retirement-fna-routes.ts',
  'tax-planning-fna-routes.ts',
  'investment-ina-routes.ts',
  'estate-planning-fna-session-routes.ts',
  'estate-planning-fna-will-routes.ts',
  'estate-planning-fna-docs-routes.ts',
  'will-chat-routes.ts',
  'tax-agent-routes.ts',
];

/**
 * Routes that name a resource but deliberately do not call the shared policy.
 *
 * Each entry is a standing decision, not an oversight. Keep this list short and
 * keep the reason with it — an unexplained exemption is how a gate stops
 * meaning anything.
 */
const EXEMPT: Record<string, string> = {
  // Empty on purpose. The three `latest-published` reads used to sit here as
  // "anon-key portal reads with a documented bypass"; the September 2026 auth
  // review found the bypass let anyone read any client's published FNA with no
  // login at all, and they now call the shared policy like everything else.
};

const RESOURCE_PARAM = /:(clientId|fnaId|sessionId|willId|docId)\b/;
/**
 * A client id taken from the request BODY rather than the path. The path sweep
 * cannot see these, which is how `POST /medical-fna/create` went unchecked: it
 * read `clientId` out of the parsed body and filed that client's profile data
 * into its response.
 */
const BODY_CLIENT_ID =
  /\{[^}]*\bclientId\b[^}]*\}\s*=\s*(?:parsed\.data|body|await c\.req\.json\(\))|\b(?:body|parsed\.data)\.clientId\b/;
const POLICY_CALL = /assert(Client|RecordClient)Access\(/;
const ROUTE = /^(?:app|\w+Routes)\.(get|post|put|patch|delete)\(\s*'([^']*)'/;

interface Handler {
  file: string;
  method: string;
  path: string;
  body: string;
}

function handlers(): Handler[] {
  const found: Handler[] = [];
  for (const file of FILES) {
    const lines = readFileSync(join(SERVER_DIR, file), 'utf8').split('\n');
    const starts: { i: number; method: string; path: string }[] = [];
    lines.forEach((line, i) => {
      const m = ROUTE.exec(line);
      if (m) starts.push({ i, method: m[1].toUpperCase(), path: m[2] });
    });
    starts.forEach((s, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1].i : lines.length;
      found.push({ file, method: s.method, path: s.path, body: lines.slice(s.i, end).join('\n') });
    });
  }
  return found;
}

const all = handlers();
const keyed = all.filter((h) => RESOURCE_PARAM.test(h.path) || BODY_CLIENT_ID.test(h.body));

describe('FNA route ownership coverage', () => {
  it('finds the routes it claims to sweep (analysis sanity check)', () => {
    // Guards against the route regex silently breaking and reporting a vacuous
    // "everything is covered" over an empty set.
    expect(all.length).toBeGreaterThan(50);
    expect(keyed.length).toBeGreaterThan(30);
    expect(new Set(keyed.map((h) => h.file)).size).toBe(FILES.length);
  });

  it('requires a shared-policy call on every resource-keyed handler', () => {
    const missing = keyed
      .filter((h) => !POLICY_CALL.test(h.body))
      .filter((h) => !(`${h.file} ${h.path}` in EXEMPT))
      .map((h) => `${h.method} ${h.path}  (${h.file})`);

    expect(
      missing,
      `These handlers name a resource but never ask whether the caller may touch it.\n` +
        `Add assertClientAccess(user, clientId, '<module>:<action>') for a path-supplied\n` +
        `id, or assertRecordClientAccess(user, record, ...) for an id read off the stored\n` +
        `record. If the route genuinely needs no check, add it to EXEMPT with the reason.\n\n` +
        `Missing:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('keeps every exemption pointing at a route that still exists', () => {
    // A stale exemption is worse than none: it looks like a considered decision
    // while covering nothing, and silently absolves the next route that
    // happens to reuse the path.
    const live = new Set(keyed.map((h) => `${h.file} ${h.path}`));
    for (const key of Object.keys(EXEMPT)) {
      expect(live, `exemption "${key}" no longer matches any route`).toContain(key);
    }
  });

  it('keeps no exemption for a route that already calls the policy', () => {
    // The same rot from the other side: once the route gains the check, the
    // exemption only documents a bypass that no longer exists.
    const stale = keyed
      .filter((h) => `${h.file} ${h.path}` in EXEMPT && POLICY_CALL.test(h.body))
      .map((h) => `${h.file} ${h.path}`);
    expect(stale).toEqual([]);
  });

  it('covers client ids taken from the request body, not only the path', () => {
    // Sanity check that the body sweep is live, so it cannot pass vacuously.
    const bodyKeyed = all.filter((h) => BODY_CLIENT_ID.test(h.body));
    expect(bodyKeyed.map((h) => `${h.method} ${h.path} (${h.file})`)).toContain(
      'POST /create (medical-fna-routes.ts)',
    );
  });
});
