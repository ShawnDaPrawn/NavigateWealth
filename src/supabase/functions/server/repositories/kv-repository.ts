/**
 * Typed KV repository base (Stage B: introduce `repositories/`)
 * ============================================================
 *
 * WHAT THIS LAYER IS FOR
 * ----------------------
 * 178 modules import `kv_store` directly, and every one of its functions
 * returns `any` (`get`, `getByPrefix`, … all `Promise<any>`). So the data layer
 * is untyped at every call site, key strings are scattered, and the enthusiasm
 * of a `getByPrefix` is invisible at the point of use.
 *
 * THE PART THAT MATTERS: BOUNDED READS ARE THE DEFAULT
 * ----------------------------------------------------
 * `kv.getByPrefix(prefix)` has NO limit — it selects an entire namespace and
 * returns it. There are 278 call sites. `kv.listByPrefix` has supported
 * pagination with a default limit of 100 the whole time; almost nothing uses
 * it. That asymmetry is finding S5 ("119 unbounded whole-namespace scans,
 * silent truncation") expressed in the API's own ergonomics: the dangerous call
 * is the short one.
 *
 * This repository inverts that. `list()` is paginated and bounded. Reading a
 * whole namespace is still possible — sometimes it is genuinely correct — but
 * it is `listAll(reason)`, and the reason is a required argument that shows up
 * in the log line. An unbounded scan becomes a deliberate, attributable act
 * rather than the path of least resistance.
 *
 * WHAT IT DELIBERATELY IS NOT
 * ---------------------------
 * Not an ORM, and not a migration of the 1,780 direct `kv.*` calls spread over
 * 177 modules — that is a long strangler job, not a single change. This is the
 * seed plus a ratchet (`quality/baselines/kv-direct-access-baseline`) so direct call #1,781
 * cannot land silently. F10 deferred banning direct `kv_store` access on the
 * explicit grounds that "the repositories/ layer it should point at does not
 * exist yet". It does now.
 */

import * as kv from '../kv_store.tsx';
import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('kv-repository');

/** Default page size for `list()`. Mirrors kv.listByPrefix's own default. */
export const DEFAULT_PAGE_SIZE = 100;

/** Hard ceiling, so a caller cannot turn `list()` back into an unbounded scan. */
export const MAX_PAGE_SIZE = 1000;

export interface Page<T> {
  items: T[];
  /** Pass back as `startAfter` to continue. `null` when the page is the last. */
  nextCursor: string | null;
}

export interface KvRepository<T> {
  get(id: string): Promise<T | null>;
  put(id: string, value: T): Promise<void>;
  remove(id: string): Promise<void>;
  getMany(ids: string[]): Promise<(T | null)[]>;
  list(options?: { limit?: number; startAfter?: string }): Promise<Page<T>>;
  listAll(reason: string): Promise<T[]>;
  listWithKeys(reason: string, idPrefix?: string): Promise<Array<{ key: string; value: T }>>;
  key(id: string): string;
}

/**
 * Build a repository over one KV key namespace.
 *
 * `namespace` is the full key prefix INCLUDING its trailing separator, e.g.
 * `'communication:groups:'`. Keeping the separator in the caller's hands avoids
 * guessing whether a namespace uses `:` or `/`.
 */
export function createKvRepository<T>(namespace: string): KvRepository<T> {
  if (!namespace) throw new Error('createKvRepository: namespace is required');

  const key = (id: string) => `${namespace}${id}`;

  return {
    key,

    async get(id: string): Promise<T | null> {
      return ((await kv.get(key(id))) as T | null) ?? null;
    },

    async put(id: string, value: T): Promise<void> {
      await kv.set(key(id), value);
    },

    async remove(id: string): Promise<void> {
      await kv.del(key(id));
    },

    async getMany(ids: string[]): Promise<(T | null)[]> {
      if (ids.length === 0) return [];
      const values = (await kv.mget(ids.map(key))) as (T | null)[];
      return ids.map((_, i) => values[i] ?? null);
    },

    async list(options): Promise<Page<T>> {
      const requested = options?.limit ?? DEFAULT_PAGE_SIZE;
      const limit = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);
      // Fetch one extra to learn whether another page exists without a second
      // round-trip — the caller gets `limit` items and an honest cursor.
      const rows = (await kv.listByPrefix(namespace, {
        limit: limit + 1,
        startAfter: options?.startAfter,
      })) as Array<{ key: string; value: T }>;

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return {
        items: page.map((r) => r.value),
        nextCursor: hasMore ? page[page.length - 1].key : null,
      };
    },

    /**
     * Read the entire namespace. Unbounded by definition.
     *
     * `reason` is required and logged so that an unbounded scan is attributable
     * when one shows up in a slow trace. Use `list()` unless the whole set is
     * genuinely needed — a namespace that is small today is not small forever.
     */
    async listAll(reason: string): Promise<T[]> {
      if (!reason) {
        throw new Error(
          `listAll(${namespace}) requires a reason — an unbounded namespace scan ` +
            'must be attributable. Use list() for a bounded page.',
        );
      }
      const items = ((await kv.getByPrefix(namespace)) as T[]) ?? [];
      log.debug('Unbounded namespace scan', { namespace, reason, count: items.length });
      return items;
    },

    /**
     * Like `listAll`, but keeps the keys.
     *
     * Some records only carry their subject in the key — `security:<userId>`
     * holds no id field of its own — so a values-only read cannot say who a row
     * belongs to. Without this, callers needing that reach past the repository
     * into `kv_store` directly, which is what `esign-recovery-bin.ts` did and
     * what the kv-direct-access ratchet exists to discourage. Better to have the
     * abstraction cover the case than to have callers route around it.
     *
     * `idPrefix` narrows the scan to keys beneath `namespace + idPrefix`, so a
     * caller after one subject's rows in a large namespace does not pay for the
     * whole namespace.
     */
    async listWithKeys(
      reason: string,
      idPrefix?: string,
    ): Promise<Array<{ key: string; value: T }>> {
      if (!reason) {
        throw new Error(
          `listWithKeys(${namespace}) requires a reason — an unbounded namespace ` +
            'scan must be attributable.',
        );
      }
      const prefix = idPrefix ? `${namespace}${idPrefix}` : namespace;
      const rows =
        ((await kv.listByPrefix(prefix, { limit: MAX_PAGE_SIZE })) as Array<{
          key: string;
          value: T;
        }>) ?? [];
      log.debug('Keyed namespace scan', { prefix, reason, count: rows.length });
      return rows;
    },
  };
}
