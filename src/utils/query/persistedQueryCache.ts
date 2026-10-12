/**
 * Persisted React Query cache — instant screens, never stale for long.
 * ====================================================================
 *
 * WHY
 * ---
 * Every Edge Function call costs ~1.5–2 s from South Africa before it does any
 * work (docs/runbooks/edge-function-latency.md). Without a persisted cache, a
 * page reload, a new tab or reopening the PWA starts every admin screen from a
 * skeleton and pays that wait again. With it, the screen paints from the last
 * copy at once and refreshes in the background.
 *
 * HOW FRESHNESS IS KEPT (the rule the owner set: "if policy values change,
 * that must be updated")
 * -----------------------------------------------------------------------
 * 1. A restored entry keeps its ORIGINAL `dataUpdatedAt`. It is therefore older
 *    than any query's `staleTime`, so the moment a screen mounts it, React
 *    Query refetches it. The saved copy is only ever on screen for the length
 *    of that one request, and is then replaced in place.
 * 2. Nothing older than `MAX_AGE_MS` is restored at all.
 * 3. A new deploy discards the whole cache (`buster` = build id), so a changed
 *    response shape can never be rendered by code that expects the old one.
 * 4. Mutations keep invalidating as before; an invalidated query refetches and
 *    the next save writes the new value.
 * 5. `refetchOnWindowFocus` stays on, so a value changed by a colleague is
 *    picked up as soon as the tab is looked at again.
 *
 * PRIVACY
 * -------
 * - One entry per user id. A different user signing in on the same browser can
 *   never read another user's entry, and every other user's entry is deleted
 *   at that point.
 * - Sign-out (including the inactivity timeout and a session expiring)
 *   deletes the entry and empties the in-memory cache.
 * - Only staff (admin) sessions persist; client-portal sessions do not.
 * - A query can opt out with `meta: { persist: false }`.
 *
 * WHAT IS PERSISTED
 * -----------------
 * Successful queries whose data is plain JSON-like data (objects, arrays,
 * primitives, Dates). Anything holding a class instance, function, Map, Blob
 * and the like is skipped rather than risk restoring something that no longer
 * behaves like what the component expects.
 */

import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type Query,
  type QueryClient,
} from '@tanstack/react-query';
import { logger } from '../logger';

/** Entries older than this are discarded instead of restored. */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Debounce between saves; every refetch changes the cache. */
export const SAVE_DELAY_MS = 2_000;

/** Upper bound on persisted queries; the most recently updated win. */
export const MAX_PERSISTED_QUERIES = 400;

/**
 * Discards the cache on every deploy. Set by vite.config.ts from the commit
 * being built; undefined under Vitest.
 */
export const BUILD_ID: string = import.meta.env?.VITE_NW_BUILD_ID || 'dev';

const ENTRY_PREFIX = 'query-cache:';

export interface PersistedEntry {
  buster: string;
  savedAt: number;
  state: DehydratedState;
}

/** Minimal async key-value store; IndexedDB in the browser, a Map in tests. */
export interface CacheStorage {
  get(key: string): Promise<PersistedEntry | undefined>;
  set(key: string, value: PersistedEntry): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function entryKey(userId: string): string {
  return `${ENTRY_PREFIX}${userId}`;
}

/**
 * True for data made only of plain objects, arrays, primitives and Dates —
 * what an API response deserialises to. Anything else is not persisted.
 */
export function isPlainData(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || value === undefined) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (type !== 'object') return false; // function, symbol, bigint
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.every((item) => isPlainData(item, depth + 1));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value as Record<string, unknown>).every((item) =>
    isPlainData(item, depth + 1),
  );
}

/** Data objects already checked, so a save does not re-walk unchanged data. */
const plainDataVerdicts = new WeakMap<object, boolean>();

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  if (query.meta?.persist === false) return false;
  const data = query.state.data;
  if (data === null || typeof data !== 'object') return isPlainData(data);
  const known = plainDataVerdicts.get(data);
  if (known !== undefined) return known;
  const verdict = isPlainData(data);
  plainDataVerdicts.set(data, verdict);
  return verdict;
}

/** Dehydrate the persistable queries, newest first, capped. */
export function snapshot(queryClient: QueryClient): DehydratedState {
  const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersistQuery });
  if (state.queries.length > MAX_PERSISTED_QUERIES) {
    state.queries = [...state.queries]
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
      .slice(0, MAX_PERSISTED_QUERIES);
  }
  return { ...state, mutations: [] };
}

/** Whether an entry may be restored now. */
export function isRestorable(
  entry: PersistedEntry | undefined,
  now: number,
): entry is PersistedEntry {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.buster !== BUILD_ID) return false;
  // NaN and Infinity are typeof 'number' but are not a time. `now - NaN > age`
  // is false, so without this check a corrupt entry would be restored.
  if (!Number.isFinite(entry.savedAt) || now - entry.savedAt > MAX_AGE_MS) return false;
  return Array.isArray(entry.state?.queries);
}

export interface QueryCachePersister {
  /** Restore this user's entry (if valid) and start saving changes for them. */
  start(userId: string): Promise<void>;
  /** Stop saving, delete the user's entry and empty the in-memory cache. */
  signOut(): Promise<void>;
  /** Write any pending change now (page hidden / unloading). */
  flush(): Promise<void>;
  /** The user currently being persisted, if any. */
  readonly userId: string | null;
}

export function createQueryCachePersister(options: {
  queryClient: QueryClient;
  storage: CacheStorage;
  now?: () => number;
  saveDelayMs?: number;
}): QueryCachePersister {
  const { queryClient, storage, now = Date.now, saveDelayMs = SAVE_DELAY_MS } = options;
  let userId: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const save = async () => {
    timer = null;
    if (!userId || !dirty) return;
    dirty = false;
    const owner = userId;
    try {
      const entry: PersistedEntry = {
        buster: BUILD_ID,
        savedAt: now(),
        state: snapshot(queryClient),
      };
      // Sign-out may have landed before the write. `set` itself also yields,
      // so a delete from sign-out can finish first and this write would put
      // the signed-out user's cache back. The check below removes it.
      if (userId === owner) await storage.set(entryKey(owner), entry);
    } catch (error) {
      logger.debug('Query cache save skipped', { error });
    }
    if (userId !== owner) {
      try {
        await storage.delete(entryKey(owner));
      } catch (error) {
        logger.debug('Query cache delete failed', { error });
      }
    }
  };

  const scheduleSave = () => {
    dirty = true;
    if (timer === null) timer = setTimeout(() => void save(), saveDelayMs);
  };

  const stopSaving = () => {
    unsubscribe?.();
    unsubscribe = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    dirty = false;
  };

  return {
    get userId() {
      return userId;
    },

    async start(nextUserId) {
      if (userId === nextUserId) return;
      if (userId !== null) {
        // A different user without a page load in between: nothing of the
        // previous user's may survive in memory or on disk.
        await this.signOut();
      }
      userId = nextUserId;

      try {
        // Delete every other user's entry: one browser, one persisted user.
        const keys = await storage.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith(ENTRY_PREFIX) && key !== entryKey(nextUserId))
            .map((key) => storage.delete(key)),
        );

        const entry = await storage.get(entryKey(nextUserId));
        if (userId !== nextUserId) return; // signed out while reading
        if (isRestorable(entry, now())) {
          // hydrate() never overwrites a query that already holds newer data,
          // so a fetch that finished first always wins.
          hydrate(queryClient, entry.state);
          // Then mark every query that is now showing a restored copy as
          // invalidated. Age alone is not enough: a query with a long
          // staleTime, saved a minute before a reload, would otherwise be
          // treated as fresh and not refetched — and a reload must always
          // bring current values (policy figures included). Invalidated
          // queries refetch the moment a screen uses them; nothing is fetched
          // here for screens that are not open.
          const restoredAt = new Map(
            entry.state.queries.map((query) => [query.queryHash, query.state.dataUpdatedAt]),
          );
          await queryClient.invalidateQueries({
            predicate: (query) => restoredAt.get(query.queryHash) === query.state.dataUpdatedAt,
            refetchType: 'none',
          });
        } else if (entry) {
          await storage.delete(entryKey(nextUserId));
        }
      } catch (error) {
        logger.debug('Query cache restore skipped', { error });
      }

      if (userId !== nextUserId) return;
      unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' || event.type === 'removed') scheduleSave();
      });
    },

    async signOut() {
      const previous = userId;
      userId = null;
      stopSaving();
      queryClient.clear();
      if (previous) {
        try {
          await storage.delete(entryKey(previous));
        } catch (error) {
          logger.debug('Query cache delete failed', { error });
        }
      }
    },

    async flush() {
      if (timer !== null) clearTimeout(timer);
      await save();
    },
  };
}

// ============================================================================
// Storage
// ============================================================================

/**
 * Keeps nothing. Used where IndexedDB is unavailable, so the persister still
 * empties the in-memory cache on sign-out.
 */
export const NOOP_STORAGE: CacheStorage = {
  get: async () => undefined,
  set: async () => {},
  delete: async () => {},
  keys: async () => [],
};

const DB_NAME = 'nw-query-cache';
const STORE = 'entries';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB-backed storage, or `null` where IndexedDB is unavailable (old
 * browsers, some private modes, tests) — persistence is then simply off.
 */
export function createIndexedDbStorage(): CacheStorage | null {
  if (typeof indexedDB === 'undefined') return null;

  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  };
  const store = async (mode: IDBTransactionMode) =>
    (await db()).transaction(STORE, mode).objectStore(STORE);

  return {
    async get(key) {
      return (await promisify((await store('readonly')).get(key))) as PersistedEntry | undefined;
    },
    async set(key, value) {
      await promisify((await store('readwrite')).put(value, key));
    },
    async delete(key) {
      await promisify((await store('readwrite')).delete(key));
    },
    async keys() {
      return (await promisify((await store('readonly')).getAllKeys())).map(String);
    },
  };
}
