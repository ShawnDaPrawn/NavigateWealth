/**
 * A ratchet against one defect that has now been found nine times
 * ===============================================================
 *
 * Every instance had the same shape: a KV key ending in `${Date.now()}`.
 * `Date.now()` is millisecond-resolution and `kv.set` upserts, so two writes in
 * the same millisecond collide and the second silently replaces the first. In
 * six of the seven the record already carried a unique id that simply was not in
 * the key.
 *
 * Fixed so far:
 *   - requests-service        compliance audit log      (#243)
 *   - auto-content-service    pipeline run log          (#243)
 *   - will-chat-service       interview session id      (#244)
 *   - tax-agent-service       interview session id      (#244)
 *   - form-prefill-routes     prefill audit record      (#245)
 *   - integrations-upload-routes   upload history       (#245)
 *   - integrations-sync-engine     upload history       (#245)
 *   - ai-advisor              legacy chat turn          (#245)
 *   - ai-intelligence         conversation turn         (#245)
 *
 * Nine occurrences is not a coincidence, it is a habit. This test scans the
 * source rather than any one behaviour, so the next is caught when it is
 * written instead of when a record goes missing.
 *
 * WHAT THIS SCANNER DOES NOT CATCH
 * --------------------------------
 * It looks for a timestamp at the END of a key, so a key carrying one in the
 * MIDDLE — `audit:{timestamp}:{someOtherId}` — slips past. That case is not
 * reliably decidable from the template alone: it needs to know whether the
 * remaining segments are unique per record, and `${targetId}` reads exactly
 * like `${entryId}` to a regex. Rather than ship a heuristic that would either
 * miss cases or cry wolf, the boundary is stated here — a key that interpolates
 * a timestamp anywhere but the end needs its own behavioural test, and the
 * reviewer's question on any new KV key is "what in this key is unique per
 * record?"
 *
 * It also says nothing about a version number derived from a record COUNT,
 * which is the same defect wearing different clothes.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Resolved from the working directory rather than `import.meta.url`: under
// Vitest the latter yields a path that is not repo-rooted here. The
// file-count assertion at the foot of this file is what proves the walker
// actually found the tree.
const SERVER_DIR = join(process.cwd(), 'src/supabase/functions/server');

function serverSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : serverSourceFiles(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * Removes line and block comments. Without this the explanatory comments on the
 * fixed sites — which quote the offending shape — would be reported as
 * offenders themselves.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Template literals whose LAST interpolation is a millisecond timestamp. */
const TEMPLATE = /`[^`]*`/g;

/**
 * Matches a trailing `${Date.now()}` and any arithmetic around it —
 * `${Date.now() + 1}`, `${Date.now() - offset}`, `${1 + Date.now()}`.
 *
 * The arithmetic form is not a lesser case: `Date.now() + 1` is precisely the
 * expression this ratchet's own commit removed from `ai-advisor.ts`. Offsetting
 * a millisecond timestamp does nothing for uniqueness — two calls in the same
 * millisecond still produce the same key — and it adds a second failure mode,
 * because `${Date.now() + 1}` on one write can equal a bare `${Date.now()}` on
 * the next.
 */
const ENDS_WITH_NOW = /\$\{[^{}]*\bDate\.now\(\)[^{}]*\}$/;

function offendingKeyTemplates(source: string): string[] {
  return (
    (stripComments(source).match(TEMPLATE) ?? [])
      .map((literal) => literal.slice(1, -1))
      .filter((body) => ENDS_WITH_NOW.test(body))
      // A KV key is namespaced with colons. This keeps log messages and display
      // strings, which legitimately end in a timestamp, out of the result.
      .filter((body) => body.includes(':'))
  );
}

describe('the scanner itself', () => {
  it('reports a key that ends in a bare Date.now()', () => {
    expect(
      offendingKeyTemplates('await kv.set(`history:${a}:${b}:${Date.now()}`, entry);'),
    ).toEqual(['history:${a}:${b}:${Date.now()}']);
  });

  it('reports a key that ends in an OFFSET Date.now(), the form this commit removed', () => {
    // `ai-advisor.ts` keyed the assistant reply `Date.now() + 1` to push it
    // past the client's message. Deterministic, but not unique: two replies in
    // one millisecond still collide, and `+ 1` can also land on the next
    // turn's bare timestamp.
    expect(
      offendingKeyTemplates('await kv.set(`ai_advisor:${u}:chat:${Date.now() + 1}`, reply);'),
    ).toEqual(['ai_advisor:${u}:chat:${Date.now() + 1}']);
    expect(
      offendingKeyTemplates('await kv.set(`audit:${id}:${Date.now() - drift}`, row);'),
    ).toEqual(['audit:${id}:${Date.now() - drift}']);
    expect(offendingKeyTemplates('await kv.set(`run:${id}:${1 + Date.now()}`, row);')).toEqual([
      'run:${id}:${1 + Date.now()}',
    ]);
  });

  it('accepts the same key once a unique segment follows the timestamp', () => {
    expect(
      offendingKeyTemplates('await kv.set(`history:${a}:${b}:${Date.now()}:${entry.id}`, entry);'),
    ).toEqual([]);
    expect(
      offendingKeyTemplates('await kv.set(`history:${a}:${Date.now() + 1}:${entry.id}`, entry);'),
    ).toEqual([]);
  });

  it('ignores a timestamp in a comment, including one quoting the bad shape', () => {
    expect(
      offendingKeyTemplates('// was `audit:${id}:${Date.now()}` before the fix\nconst x = 1;'),
    ).toEqual([]);
  });

  it('ignores a display string that merely ends in a timestamp', () => {
    expect(offendingKeyTemplates('log.info(`finished at ${Date.now()}`);')).toEqual([]);
  });
});

describe('no server key is built from a bare millisecond timestamp', () => {
  it('finds no offending key template anywhere under the server tree', () => {
    const offenders = serverSourceFiles(SERVER_DIR)
      .map((file) => ({ file, keys: offendingKeyTemplates(readFileSync(file, 'utf8')) }))
      .filter(({ keys }) => keys.length > 0)
      .map(({ file, keys }) => `${file.split('/server/')[1]}: ${keys.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  it('scans a meaningful number of files, so a broken walker cannot pass silently', () => {
    // Guards the guard: if `serverSourceFiles` ever returns nothing, the
    // assertion above would pass vacuously — the same way the bucket test did
    // before Codex caught it.
    expect(serverSourceFiles(SERVER_DIR).length).toBeGreaterThan(100);
  });
});
