/**
 * Tests for `getByPrefixWhereFieldEquals` in `kv_store.tsx`.
 *
 * This is the one KV helper that pushes a value filter down to Postgres. The
 * every-minute scheduled-publish job used to read all 165 article records to
 * find the zero that were due (docs/INCIDENTS.md, 2026-09-13), and the fix
 * depends on this emitting the exact PostgREST filter that migration
 * 20260914083818's partial index is built for. A typo in the column expression
 * would silently fall back to a sequential scan, or worse, match nothing and
 * stop scheduled articles publishing — so the emitted query is asserted, not
 * just the returned rows.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

interface RecordedCall {
  method: string;
  args: unknown[];
}

const recorded: RecordedCall[] = [];
let resolveWith: { data: unknown; error: unknown } = { data: [], error: null };

function builder() {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'gte', 'lt', 'eq', 'order']) {
    chain[method] = (...args: unknown[]) => {
      recorded.push({ method, args });
      return chain;
    };
  }
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(onFulfilled);
  return chain;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      recorded.push({ method: 'from', args: [table] });
      return builder();
    },
  }),
}));

import { getByPrefixWhereFieldEquals } from '../kv_store.tsx';

const callsTo = (method: string) => recorded.filter((c) => c.method === method).map((c) => c.args);

beforeEach(() => {
  recorded.length = 0;
  resolveWith = { data: [], error: null };
  // The module builds its client from Deno.env, which Node does not have.
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

describe('getByPrefixWhereFieldEquals', () => {
  it('filters on the JSON field in Postgres, inside the prefix range', async () => {
    await getByPrefixWhereFieldEquals('article:', 'status', 'scheduled');

    expect(callsTo('from')).toEqual([['kv_store_91ed8379']]);
    // `value->>status` is what migration 20260914083818's partial index is on.
    expect(callsTo('eq')).toEqual([['value->>status', 'scheduled']]);
    // Same half-open prefix range getByPrefix uses, so the index range bound
    // and the ORDER BY are served by one scan.
    expect(callsTo('gte')).toEqual([['key', 'article:']]);
    expect(callsTo('lt')).toEqual([['key', 'article:￿']]);
    expect(callsTo('order')).toEqual([['key', { ascending: true }]]);
  });

  it('returns the values, not the rows', async () => {
    resolveWith = {
      data: [
        { key: 'article:a', value: { id: 'a', status: 'scheduled' } },
        { key: 'article:b', value: { id: 'b', status: 'scheduled' } },
      ],
      error: null,
    };

    await expect(getByPrefixWhereFieldEquals('article:', 'status', 'scheduled')).resolves.toEqual([
      { id: 'a', status: 'scheduled' },
      { id: 'b', status: 'scheduled' },
    ]);
  });

  it('returns an empty list rather than null when nothing matches', async () => {
    resolveWith = { data: null, error: null };
    await expect(getByPrefixWhereFieldEquals('article:', 'status', 'scheduled')).resolves.toEqual(
      [],
    );
  });

  it('surfaces a PostgREST error instead of reporting no matches', async () => {
    // Swallowing this would look exactly like "nothing is due", which for the
    // scheduled-publish caller means articles silently never publish.
    resolveWith = { data: null, error: { message: 'column does not exist' } };
    await expect(getByPrefixWhereFieldEquals('article:', 'status', 'scheduled')).rejects.toThrow(
      'column does not exist',
    );
  });

  it.each([
    ['status; drop table', 'a semicolon'],
    ['value->>status', 'an operator'],
    ['a.b', 'a dot'],
    ['', 'nothing at all'],
    ['1status', 'a leading digit'],
  ])('refuses a field name containing %s', async (field) => {
    await expect(getByPrefixWhereFieldEquals('article:', field, 'scheduled')).rejects.toThrow(
      /unsafe field name/,
    );
    // Rejected before any query was built.
    expect(callsTo('from')).toEqual([]);
  });
});
