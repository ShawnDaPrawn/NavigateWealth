/**
 * Batched KV reads.
 *
 * The KV store's `get` opens its own Postgres client per call, so a list route
 * that reads one row per item pays for that N times over — and when those
 * reads are awaited in a loop, N times in series. Both shapes were the dominant
 * cost of loading admin pages that list things: clients, e-signature envelopes,
 * signers.
 *
 * `mgetBatched` is the fix for the fan-out, and `mgetKeyed` for the common case
 * where the caller wants to look the results back up by id rather than by
 * position.
 *
 * @module kv-batch
 */

import * as kv from './kv_store.tsx';

/**
 * Keys per batch.
 *
 * `kv.mget` filters with PostgREST's `in.(...)`, which travels in the request
 * URL, so one batch cannot hold an unbounded key list. 200 keys keeps a batch
 * of `user_profile:<uuid>:personal_info`-sized keys around 12KB — comfortably
 * inside every gateway limit — while still collapsing thousands of individual
 * reads into a handful of round trips.
 */
export const KV_BATCH_SIZE = 200;

/**
 * Read many keys as a few batched queries, preserving the order of `keys`.
 *
 * The returned array is always the same length as `keys`, with `undefined` in
 * the slot of any key that has no row — so callers can zip it against their
 * own list by index without a second lookup.
 */
export async function mgetBatched<T>(keys: string[]): Promise<(T | undefined)[]> {
  if (keys.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += KV_BATCH_SIZE) {
    batches.push(keys.slice(i, i + KV_BATCH_SIZE));
  }

  const results = await Promise.all(batches.map((batch) => kv.mget(batch)));
  return results.flat();
}

/**
 * Read many ids under one key prefix and return them keyed by id.
 *
 * Ids are de-duplicated before the read, which matters when several parents
 * point at the same child — two envelopes sharing a document, say. Ids with no
 * row are simply absent from the map.
 */
export async function mgetKeyed<T>(prefix: string, ids: string[]): Promise<Map<string, T>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await mgetBatched<T>(unique.map((id) => `${prefix}${id}`));

  const byId = new Map<string, T>();
  unique.forEach((id, index) => {
    const row = rows[index];
    if (row != null) byId.set(id, row);
  });
  return byId;
}

/**
 * Read many "index" rows — KV values that are arrays of ids — and return each
 * as a guaranteed array.
 *
 * These index rows are how the e-signature namespace models its one-to-many
 * links (`esign:envelope:<id>:signers` holds the signer ids). Reading them one
 * per parent is the first half of every N+1 in that module; this reads them
 * all at once. A corrupt or missing value becomes `[]` rather than throwing,
 * matching what the per-row callers did with their own `Array.isArray` guards.
 */
export async function mgetIdLists(keys: string[]): Promise<string[][]> {
  const rows = await mgetBatched<unknown>(keys);
  return rows.map((row) => (Array.isArray(row) ? (row as string[]) : []));
}
