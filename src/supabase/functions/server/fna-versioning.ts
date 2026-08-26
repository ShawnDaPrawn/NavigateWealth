/**
 * One implementation of "what version number comes next".
 * =======================================================
 *
 * Nine sites across the FNA/INA families used to compute this as
 * `(records?.length || 0) + 1`. A count is not a sequence: it only counts what
 * is still there. Delete an earlier record and the count drops, so the next
 * write is handed a version number that is already in use — and because the
 * version goes into the KV key and `kv.set` upserts, that write does not fail,
 * it silently replaces a stored record.
 *
 * It is reachable with nothing but the product's own buttons:
 *
 *   create -> v1, v2, v3
 *   delete v2
 *   create -> count is 2, so v3, and the surviving v3 is gone
 *
 * `nextVersion` reads the highest version already stored instead, which cannot
 * regress. It is deliberately tolerant of what it is handed — legacy rows
 * missing `version`, rows where it was stored as a string, `null` from a failed
 * read — because the alternative is throwing on the write path of a client's
 * financial record.
 *
 * WHAT THIS DOES NOT FIX
 * ----------------------
 * It is still a read-then-write. Two saves whose reads overlap see the same
 * maximum and settle on the same number, and closing that needs a
 * compare-and-set the KV store does not offer. So every caller ALSO puts a
 * unique segment in the key: the version stays the human-facing label, and
 * uniqueness is carried by something that does not depend on reading first.
 * Two records may share a version; neither can destroy the other.
 *
 * @module server/fna-versioning
 */

/** A stored record that may or may not carry a usable version number. */
interface MaybeVersioned {
  version?: unknown;
  id?: unknown;
}

/** `...-v12` or `...-v12-ab12cd34` → 12. */
const VERSION_IN_ID = /-v(\d+)(?:-[0-9a-f]{8})?$/;

/**
 * The next version number for a set of already-stored records.
 *
 * @param records Whatever the prefix scan returned — may be null/undefined.
 * @returns One above the highest version present, or 1 when there is none.
 */
export function nextVersion(records: readonly unknown[] | null | undefined): number {
  return highestVersion(records) + 1;
}

/**
 * The highest version present, or 0 when nothing usable is stored.
 *
 * Reads the version from BOTH the record's `version` field and the `-v{n}` its
 * id carries, taking whichever is higher, because the two are not guaranteed to
 * agree. A record stored before the field existed has only the id; a record
 * whose field went stale has an id that is still right. Trusting only the field
 * would hand back a number that is already in use — which the unique key
 * segment stops from destroying anything, but which still puts two records
 * under one label.
 *
 * Both sources are ignored when unusable rather than throwing: this runs on the
 * write path of a client's financial record, and one malformed legacy row is
 * not a reason to refuse the save.
 */
export function highestVersion(records: readonly unknown[] | null | undefined): number {
  if (!records || records.length === 0) return 0;

  return records.reduce<number>((max, record) => {
    const row = record as MaybeVersioned | null;

    const raw = row?.version;
    const fromField = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof fromField === 'number' && Number.isFinite(fromField) && fromField > max) {
      max = fromField;
    }

    if (typeof row?.id === 'string') {
      const matched = VERSION_IN_ID.exec(row.id);
      const fromId = matched ? Number(matched[1]) : NaN;
      if (Number.isFinite(fromId) && fromId > max) max = fromId;
    }

    return max;
  }, 0);
}

/**
 * The unique segment appended to a versioned record id.
 *
 * Eight hex characters, not a full uuid: these ids appear in URLs and in
 * adviser-facing logs, and the segment only has to survive collisions between
 * the handful of records one client accumulates — not be globally unique.
 */
export function versionSuffix(): string {
  return crypto.randomUUID().slice(0, 8);
}
