import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILD_ID,
  MAX_AGE_MS,
  MAX_PERSISTED_QUERIES,
  NOOP_STORAGE,
  createQueryCachePersister,
  entryKey,
  isPlainData,
  isRestorable,
  snapshot,
  type CacheStorage,
  type PersistedEntry,
} from '../persistedQueryCache';

const NOW = 1_800_000_000_000;

function mapStorage(initial: Record<string, PersistedEntry> = {}) {
  const map = new Map<string, PersistedEntry>(Object.entries(initial));
  const storage: CacheStorage = {
    get: async (key) => map.get(key),
    set: async (key, value) => void map.set(key, value),
    delete: async (key) => void map.delete(key),
    keys: async () => [...map.keys()],
  };
  return { map, storage };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { gcTime: MAX_AGE_MS, retry: false } } });
}

/** A saved entry holding one query, as a previous session would have written it. */
function savedEntry(
  key: unknown[],
  data: unknown,
  overrides: Partial<PersistedEntry> = {},
): PersistedEntry {
  const source = newClient();
  source.setQueryData(key, data, { updatedAt: NOW - 60_000 });
  return { buster: BUILD_ID, savedAt: NOW - 60_000, state: snapshot(source), ...overrides };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('isPlainData', () => {
  it('accepts what an API response deserialises to', () => {
    expect(isPlainData({ a: 1, b: ['x', null, { c: true }], d: new Date(0) })).toBe(true);
    expect(isPlainData(Object.create(null))).toBe(true);
    expect(isPlainData(undefined)).toBe(true);
  });

  it('rejects anything that would not survive a round trip as itself', () => {
    class Money {
      constructor(public cents: number) {}
    }
    expect(isPlainData({ total: new Money(5) })).toBe(false);
    expect(isPlainData({ byId: new Map() })).toBe(false);
    expect(isPlainData({ ids: new Set([1]) })).toBe(false);
    expect(isPlainData({ format: () => 'x' })).toBe(false);
    expect(isPlainData({ big: BigInt(1) })).toBe(false);
  });
});

describe('isRestorable', () => {
  const entry = (overrides: Partial<PersistedEntry>): PersistedEntry => ({
    buster: BUILD_ID,
    savedAt: NOW,
    state: { queries: [], mutations: [] },
    ...overrides,
  });

  it('restores a current entry from this build', () => {
    expect(isRestorable(entry({}), NOW + 1000)).toBe(true);
  });

  it('refuses an entry saved by a different deploy', () => {
    expect(isRestorable(entry({ buster: 'some-other-build' }), NOW)).toBe(false);
  });

  it('refuses an entry older than the maximum age', () => {
    expect(isRestorable(entry({}), NOW + MAX_AGE_MS + 1)).toBe(false);
  });

  it('refuses nothing and garbage', () => {
    expect(isRestorable(undefined, NOW)).toBe(false);
    expect(isRestorable({ buster: BUILD_ID } as PersistedEntry, NOW)).toBe(false);
  });
});

describe('snapshot', () => {
  it('keeps only successful, plain, non-opted-out queries', async () => {
    const client = newClient();
    client.setQueryData(['plain'], { value: 1 });
    client.setQueryData(['instance'], new Map([[1, 2]]));
    await client
      .fetchQuery({
        queryKey: ['opted-out'],
        queryFn: async () => ({ secret: true }),
        meta: { persist: false },
      })
      .catch(() => undefined);
    await client
      .fetchQuery({
        queryKey: ['failed'],
        queryFn: async () => {
          throw new Error('nope');
        },
      })
      .catch(() => undefined);

    expect(snapshot(client).queries.map((query) => query.queryKey)).toEqual([['plain']]);
  });

  it('caps the number of queries, keeping the most recently updated', () => {
    const client = newClient();
    for (let i = 0; i < MAX_PERSISTED_QUERIES + 5; i += 1) {
      client.setQueryData(['item', i], { i }, { updatedAt: NOW + i });
    }
    const kept = snapshot(client).queries;
    expect(kept).toHaveLength(MAX_PERSISTED_QUERIES);
    expect(kept.some((query) => query.queryKey[1] === 0)).toBe(false);
    expect(kept.some((query) => query.queryKey[1] === MAX_PERSISTED_QUERIES + 4)).toBe(true);
  });
});

describe('createQueryCachePersister', () => {
  it('shows the saved copy at once, then replaces it with the server value', async () => {
    // The owner's rule: if a policy value changed since the copy was saved,
    // the screen must end up showing the new value, not the saved one.
    const { storage } = mapStorage({
      [entryKey('adviser-1')]: savedEntry(['policies', 'client-9'], { premium: 100 }),
    });
    const client = newClient();
    const persister = createQueryCachePersister({ queryClient: client, storage, now: () => NOW });

    await persister.start('adviser-1');
    expect(client.getQueryData(['policies', 'client-9'])).toEqual({ premium: 100 });

    const queryFn = vi.fn(async () => ({ premium: 250 }));
    // A long staleTime would normally suppress a refetch on mount; a restored
    // copy must be refetched anyway.
    const observer = new QueryObserver(client, {
      queryKey: ['policies', 'client-9'],
      queryFn,
      staleTime: 10 * 60 * 1000,
    });
    const seen: unknown[] = [];
    const unsubscribe = observer.subscribe((result) => seen.push(result.data));
    await vi.waitFor(() =>
      expect(client.getQueryData(['policies', 'client-9'])).toEqual({ premium: 250 }),
    );
    unsubscribe();

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(seen[0]).toEqual({ premium: 100 });
    expect(seen.at(-1)).toEqual({ premium: 250 });
  });

  it('never lets a saved copy overwrite newer data already in memory', async () => {
    const { storage } = mapStorage({
      [entryKey('adviser-1')]: savedEntry(['stats'], { total: 1 }),
    });
    const client = newClient();
    client.setQueryData(['stats'], { total: 2 }, { updatedAt: NOW });

    await createQueryCachePersister({ queryClient: client, storage, now: () => NOW }).start(
      'adviser-1',
    );

    expect(client.getQueryData(['stats'])).toEqual({ total: 2 });
    expect(client.getQueryCache().find({ queryKey: ['stats'] })?.state.isInvalidated).toBe(false);
  });

  it("deletes other users' entries and never restores them", async () => {
    const { map, storage } = mapStorage({
      [entryKey('adviser-1')]: savedEntry(['clients'], ['a']),
      [entryKey('adviser-2')]: savedEntry(['clients'], ['b']),
    });
    const client = newClient();

    await createQueryCachePersister({ queryClient: client, storage, now: () => NOW }).start(
      'adviser-2',
    );

    expect(client.getQueryData(['clients'])).toEqual(['b']);
    expect([...map.keys()]).toEqual([entryKey('adviser-2')]);
  });

  it('drops an entry from another deploy instead of restoring it', async () => {
    const { map, storage } = mapStorage({
      [entryKey('adviser-1')]: savedEntry(['clients'], ['a'], { buster: 'previous-deploy' }),
    });
    const client = newClient();

    await createQueryCachePersister({ queryClient: client, storage, now: () => NOW }).start(
      'adviser-1',
    );

    expect(client.getQueryData(['clients'])).toBeUndefined();
    expect(map.size).toBe(0);
  });

  it('saves changes for the signed-in user after the debounce', async () => {
    vi.useFakeTimers();
    const { map, storage } = mapStorage();
    const client = newClient();
    const persister = createQueryCachePersister({
      queryClient: client,
      storage,
      now: () => NOW,
      saveDelayMs: 1000,
    });

    await persister.start('adviser-1');
    client.setQueryData(['tasks'], [{ id: 't1' }]);
    expect(map.size).toBe(0);

    await vi.advanceTimersByTimeAsync(1000);
    const saved = map.get(entryKey('adviser-1'));
    expect(saved?.buster).toBe(BUILD_ID);
    expect(saved?.state.queries.map((query) => query.queryKey)).toEqual([['tasks']]);
  });

  it('flush writes immediately', async () => {
    const { map, storage } = mapStorage();
    const client = newClient();
    const persister = createQueryCachePersister({
      queryClient: client,
      storage,
      now: () => NOW,
      saveDelayMs: 60_000,
    });

    await persister.start('adviser-1');
    client.setQueryData(['notes'], ['n1']);
    await persister.flush();

    expect(map.get(entryKey('adviser-1'))?.state.queries).toHaveLength(1);
  });

  it('on sign-out deletes the saved copy, empties memory and stops saving', async () => {
    const { map, storage } = mapStorage({
      [entryKey('adviser-1')]: savedEntry(['clients'], ['a']),
    });
    const client = newClient();
    const persister = createQueryCachePersister({
      queryClient: client,
      storage,
      now: () => NOW,
      saveDelayMs: 0,
    });

    await persister.start('adviser-1');
    await persister.signOut();
    client.setQueryData(['after'], 1);
    await persister.flush();

    expect(persister.userId).toBeNull();
    expect(map.size).toBe(0);
    expect(client.getQueryData(['clients'])).toBeUndefined();
  });

  it('switching user without a reload clears the first user out of memory', async () => {
    const { storage } = mapStorage();
    const client = newClient();
    const persister = createQueryCachePersister({ queryClient: client, storage, now: () => NOW });

    await persister.start('adviser-1');
    client.setQueryData(['clients'], ['visible to adviser-1 only']);
    await persister.start('adviser-2');

    expect(client.getQueryData(['clients'])).toBeUndefined();
    expect(persister.userId).toBe('adviser-2');
  });

  it('starting twice for the same user is a no-op', async () => {
    const { storage } = mapStorage();
    const get = vi.spyOn(storage, 'get');
    const persister = createQueryCachePersister({ queryClient: newClient(), storage });

    await persister.start('adviser-1');
    await persister.start('adviser-1');

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('survives storage that keeps nothing', async () => {
    const client = newClient();
    const persister = createQueryCachePersister({ queryClient: client, storage: NOOP_STORAGE });

    await persister.start('adviser-1');
    client.setQueryData(['x'], 1);
    await persister.flush();
    await persister.signOut();

    expect(client.getQueryData(['x'])).toBeUndefined();
  });

  it('survives storage that throws', async () => {
    const failing: CacheStorage = {
      get: async () => {
        throw new Error('blocked');
      },
      set: async () => {
        throw new Error('quota');
      },
      delete: async () => {
        throw new Error('blocked');
      },
      keys: async () => {
        throw new Error('blocked');
      },
    };
    const client = newClient();
    const persister = createQueryCachePersister({ queryClient: client, storage: failing });

    await expect(persister.start('adviser-1')).resolves.toBeUndefined();
    client.setQueryData(['x'], 1);
    await expect(persister.flush()).resolves.toBeUndefined();
    await expect(persister.signOut()).resolves.toBeUndefined();
  });
});
