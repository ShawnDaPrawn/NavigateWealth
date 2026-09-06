/**
 * Batched KV reads.
 *
 * Every list route that used to read one row per item now goes through here, so
 * the properties below are load-bearing for all of them at once: order must be
 * preserved (callers zip results against their own arrays by index), missing
 * rows must leave a hole rather than shift everything after them, and the key
 * list must be chunked — `kv.mget` filters with PostgREST's `in.(...)`, which
 * travels in the request URL, so an unbounded list is a request that fails
 * outright once a firm has enough clients or envelopes.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/kv-batch.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

const store = new Map<string, unknown>();
const mget = vi.fn(async (keys: string[]) => keys.map((k) => store.get(k)));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => store.get(k) ?? null),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  mget: (keys: string[]) => mget(keys),
  getByPrefix: vi.fn(async () => []),
}));

const { mgetBatched, mgetKeyed, mgetIdLists, KV_BATCH_SIZE } = await import('../kv-batch.ts');

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('mgetBatched', () => {
  it('returns rows in the order the keys were given', async () => {
    store.set('a', { id: 'a' });
    store.set('b', { id: 'b' });
    store.set('c', { id: 'c' });

    await expect(mgetBatched(['c', 'a', 'b'])).resolves.toEqual([
      { id: 'c' },
      { id: 'a' },
      { id: 'b' },
    ]);
  });

  it('leaves a hole for a missing row rather than shifting the rest', async () => {
    store.set('a', { id: 'a' });
    store.set('c', { id: 'c' });

    const rows = await mgetBatched(['a', 'missing', 'c']);

    expect(rows).toHaveLength(3);
    expect(rows[1]).toBeUndefined();
    expect(rows[2]).toEqual({ id: 'c' });
  });

  it('reads nothing at all for an empty key list', async () => {
    await expect(mgetBatched([])).resolves.toEqual([]);
    expect(mget).not.toHaveBeenCalled();
  });

  it('sends one query when the keys fit in a single batch', async () => {
    const keys = Array.from({ length: KV_BATCH_SIZE }, (_, i) => `k${i}`);

    await mgetBatched(keys);

    expect(mget).toHaveBeenCalledTimes(1);
  });

  it('splits past the batch size instead of sending one unbounded filter', async () => {
    const keys = Array.from({ length: KV_BATCH_SIZE * 2 + 1 }, (_, i) => `k${i}`);

    await mgetBatched(keys);

    expect(mget).toHaveBeenCalledTimes(3);
    for (const [batch] of mget.mock.calls) {
      expect(batch.length).toBeLessThanOrEqual(KV_BATCH_SIZE);
    }
  });

  it('keeps order across batch boundaries', async () => {
    const keys = Array.from({ length: KV_BATCH_SIZE + 5 }, (_, i) => `k${i}`);
    keys.forEach((k, i) => store.set(k, i));

    const rows = await mgetBatched<number>(keys);

    expect(rows).toEqual(keys.map((_, i) => i));
  });
});

describe('mgetKeyed', () => {
  it('returns rows keyed by id, with the prefix applied to the read', async () => {
    store.set('thing:a', { id: 'a' });
    store.set('thing:b', { id: 'b' });

    const byId = await mgetKeyed<{ id: string }>('thing:', ['a', 'b']);

    expect(byId.get('a')).toEqual({ id: 'a' });
    expect(byId.get('b')).toEqual({ id: 'b' });
  });

  it('reads a repeated id once', async () => {
    store.set('thing:a', { id: 'a' });

    await mgetKeyed('thing:', ['a', 'a', 'a']);

    expect(mget).toHaveBeenCalledWith(['thing:a']);
  });

  it('omits ids with no row rather than mapping them to undefined', async () => {
    store.set('thing:a', { id: 'a' });

    const byId = await mgetKeyed('thing:', ['a', 'gone']);

    expect(byId.has('gone')).toBe(false);
    expect(byId.size).toBe(1);
  });

  it('ignores empty ids and reads nothing when none are left', async () => {
    const byId = await mgetKeyed('thing:', ['', '']);

    expect(byId.size).toBe(0);
    expect(mget).not.toHaveBeenCalled();
  });
});

describe('mgetIdLists', () => {
  it('returns each index row as an array of ids', async () => {
    store.set('e1:signers', ['s1', 's2']);
    store.set('e2:signers', ['s3']);

    await expect(mgetIdLists(['e1:signers', 'e2:signers'])).resolves.toEqual([
      ['s1', 's2'],
      ['s3'],
    ]);
  });

  it('turns a missing index into an empty list, keeping positions aligned', async () => {
    store.set('e1:signers', ['s1']);
    store.set('e3:signers', ['s3']);

    await expect(mgetIdLists(['e1:signers', 'e2:signers', 'e3:signers'])).resolves.toEqual([
      ['s1'],
      [],
      ['s3'],
    ]);
  });

  it('turns a corrupt index into an empty list rather than throwing', async () => {
    // These rows have held junk before, which is why every per-row caller
    // guarded with Array.isArray.
    store.set('a', 'not-an-array');
    store.set('b', { nope: true });
    store.set('c', 42);

    await expect(mgetIdLists(['a', 'b', 'c'])).resolves.toEqual([[], [], []]);
  });
});
