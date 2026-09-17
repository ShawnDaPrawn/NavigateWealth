#!/usr/bin/env node
/**
 * Back up every Supabase Storage object to a local directory, with a manifest.
 *
 * WHY THIS EXISTS WHEN THE DATABASE IS ALREADY DUMPED
 * ---------------------------------------------------
 * `pg_dump` carries `storage.objects` — the METADATA rows — and not one byte of
 * the files themselves. So the weekly backup, before this script, restored a
 * database that knew the name, size and owner of every signed PDF while the
 * PDFs were gone. Supabase Storage has no versioning and no soft delete: an
 * object removed with the service-role key is removed. Signed e-sign documents,
 * client documents, policy documents and the e-sign certificates are the least
 * reproducible data the platform holds, and they were the only major dataset
 * with no backup at all.
 *
 * WHAT IT PRODUCES
 * ----------------
 *   <out>/objects/<bucket>/<path...>   every object, byte for byte
 *   <out>/manifest.csv                 bucket,path,bytes,sha256,contentType,updatedAt
 *   <out>/buckets.csv                  bucket,public,objects,bytes
 *   <out>/object-count.txt             the object total, as a bare integer
 *
 * The manifest is what makes the copy verifiable rather than merely present.
 * A restore compares it against what it uploaded; this script compares it
 * against what the API said the object was before writing a line.
 *
 * NO npm DEPENDENCIES ON PURPOSE
 * ------------------------------
 * Plain `fetch` and `node:crypto`, so the backup workflow can run it without
 * `npm ci` — the same reasoning as `post-deploy-smoke.mjs`. A backup that
 * depends on the dependency tree being installable is a backup that fails on
 * the day a registry is down.
 *
 * ENVIRONMENT
 *   SUPABASE_URL                 https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    service-role key (Storage has no scoped key)
 *   NW_BACKUP_MIN_OBJECTS        floor for the total object count (default 1)
 *
 * Usage: node scripts/ops/backup-storage.mjs <output-directory>
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Storage list API page size. The API caps a page well above this. */
export const LIST_PAGE_SIZE = 100;

/**
 * A listing entry is a FOLDER, not an object, when the API returns a null id.
 *
 * This is the discrimination the whole recursion rests on, and it is not
 * obvious: Supabase Storage is flat, and "folders" are synthesised from path
 * prefixes at list time. A folder row carries `id: null` and `metadata: null`
 * while a real object always carries an id. Treating a folder as an object
 * downloads a 404 body and writes a file named after the prefix; treating an
 * object as a folder silently skips it, which is the direction that loses data.
 *
 * @param {{ id?: string | null }} entry
 */
export function isFolderEntry(entry) {
  return entry === null || typeof entry !== 'object' || entry.id === null || entry.id === undefined;
}

/**
 * Join a remote object path onto a local directory, refusing traversal.
 *
 * Object names come from the Storage API, which means they are ultimately
 * chosen by whatever uploaded them. Writing `../../etc/whatever` because a key
 * said so would turn a backup into an arbitrary local write, so the resolved
 * path must stay inside its own bucket's directory, and that directory inside
 * the output root. Rejected rather than sanitised: a silently renamed object
 * would restore to the wrong key.
 *
 * @param {string} root
 * @param {string} bucket
 * @param {string} objectPath
 */
export function safeObjectPath(root, bucket, objectPath) {
  const rootResolved = resolve(root);
  const bucketDir = resolve(rootResolved, bucket);
  const target = resolve(bucketDir, objectPath);

  // TWO levels of containment, because one is not enough and the gap between
  // them is easy to miss. Checking only the root accepts a key of
  // `../other-bucket/x`: the bucket segment absorbs the `..`, the path stays
  // inside the backup root, and the object lands in a DIFFERENT bucket's tree
  // while the manifest records it under this one. That is silent corruption of
  // the restore, not a security hole, and it is the likelier of the two bugs.
  // Checking only the bucket accepts a bucket named `../evil`, which is the
  // arbitrary-write one.
  //
  // Prefix comparison includes the separator so a sibling sharing a name
  // prefix (`/root/bucket-evil` against `/root/bucket`) cannot pass, and an
  // exact match is rejected because that is the directory itself, not an object.
  const contains = (/** @type {string} */ parent, /** @type {string} */ child) =>
    child !== parent && child.startsWith(parent + sep);

  if (!contains(rootResolved, bucketDir) || !contains(bucketDir, target)) {
    throw new Error(`Refusing to write outside the backup root: ${bucket}/${objectPath}`);
  }
  return target;
}

/**
 * CSV field escaping. Object keys legitimately contain commas, quotes and
 * newlines, and a manifest that cannot round-trip them is a manifest that
 * misreports which files exist.
 *
 * @param {string | number | boolean} value
 */
export function csvField(value) {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

/** @param {readonly (readonly (string | number | boolean)[])[]} rows */
export function serializeCsv(rows) {
  return rows.map((row) => row.map(csvField).join(',')).join('\n') + '\n';
}

export const MANIFEST_HEADER = ['bucket', 'path', 'bytes', 'sha256', 'contentType', 'updatedAt'];
export const BUCKETS_HEADER = ['bucket', 'public', 'objects', 'bytes'];

/**
 * The size the API reported, when it reported one.
 *
 * `metadata.size` is normally present and is what the check below compares
 * against. It is occasionally absent (an object written through a path that did
 * not populate metadata), and an absent size must NOT read as zero — that would
 * turn "we do not know" into "expected nothing", and the length check would
 * then pass for a truncated download.
 *
 * @param {{ metadata?: { size?: unknown } | null }} entry
 */
export function listedSize(entry) {
  const size = entry?.metadata?.size;
  return typeof size === 'number' && Number.isFinite(size) ? size : null;
}

/**
 * Fail a download whose byte count disagrees with the listing.
 *
 * The failure this catches is a truncated or partially-written object, which
 * otherwise lands in the archive looking exactly like a small file.
 *
 * @param {string} bucket
 * @param {string} path
 * @param {number | null} expected
 * @param {number} actual
 */
export function assertSize(bucket, path, expected, actual) {
  if (expected !== null && expected !== actual) {
    throw new Error(
      `${bucket}/${path}: downloaded ${actual} bytes, listing said ${expected}. ` +
        `Treating as a truncated download.`,
    );
  }
}

/**
 * @param {string} baseUrl
 * @param {string} serviceKey
 */
function storageFetch(baseUrl, serviceKey) {
  /**
   * @param {string} path
   * @param {RequestInit} [init]
   */
  return async function call(path, init = {}) {
    const response = await fetch(`${baseUrl}/storage/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Storage API ${response.status} for ${path}: ${body.slice(0, 300)}`);
    }
    return response;
  };
}

/** @param {(path: string, init?: RequestInit) => Promise<Response>} call */
export async function listBuckets(call) {
  const response = await call('/bucket');
  const buckets = await response.json();
  if (!Array.isArray(buckets)) throw new Error('Bucket listing did not return an array');
  return buckets;
}

/**
 * Walk one bucket depth-first, following synthesised folder prefixes.
 *
 * @param {(path: string, init?: RequestInit) => Promise<Response>} call
 * @param {string} bucket
 * @param {string} [prefix]
 * @returns {Promise<Array<{ path: string, size: number | null, contentType: string, updatedAt: string }>>}
 */
export async function listBucketObjects(call, bucket, prefix = '') {
  /** @type {Array<{ path: string, size: number | null, contentType: string, updatedAt: string }>} */
  const objects = [];
  let offset = 0;

  for (;;) {
    const response = await call(`/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      body: JSON.stringify({
        prefix,
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    const page = await response.json();
    if (!Array.isArray(page))
      throw new Error(`Object listing for ${bucket} did not return an array`);

    for (const entry of page) {
      const name = entry?.name;
      if (typeof name !== 'string' || name === '') continue;
      const path = prefix ? `${prefix}/${name}` : name;
      if (isFolderEntry(entry)) {
        objects.push(...(await listBucketObjects(call, bucket, path)));
      } else {
        objects.push({
          path,
          size: listedSize(entry),
          contentType: entry?.metadata?.mimetype ?? '',
          updatedAt: entry?.updated_at ?? '',
        });
      }
    }

    // A short page is the last page. Paginating on `offset` rather than a
    // cursor is what the list API offers; the sort order keeps it stable.
    if (page.length < LIST_PAGE_SIZE) break;
    offset += page.length;
  }

  return objects;
}

/**
 * Download every object in every bucket into `outDir`.
 *
 * @param {{ baseUrl: string, serviceKey: string, outDir: string, minObjects?: number,
 *           log?: (message: string) => void }} options
 */
export async function backupStorage({
  baseUrl,
  serviceKey,
  outDir,
  minObjects = 1,
  log = () => {},
}) {
  const call = storageFetch(baseUrl.replace(/\/+$/, ''), serviceKey);
  const buckets = await listBuckets(call);

  const manifest = [MANIFEST_HEADER];
  const bucketRows = [BUCKETS_HEADER];
  let totalObjects = 0;
  let totalBytes = 0;

  for (const bucket of buckets) {
    const name = bucket?.id ?? bucket?.name;
    if (typeof name !== 'string' || name === '') continue;

    const entries = await listBucketObjects(call, name);
    let bucketBytes = 0;

    for (const entry of entries) {
      const response = await call(
        `/object/${encodeURIComponent(name)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
      );
      const bytes = Buffer.from(await response.arrayBuffer());
      assertSize(name, entry.path, entry.size, bytes.byteLength);

      const target = safeObjectPath(join(outDir, 'objects'), name, entry.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);

      manifest.push([
        name,
        entry.path,
        bytes.byteLength,
        createHash('sha256').update(bytes).digest('hex'),
        entry.contentType,
        entry.updatedAt,
      ]);
      bucketBytes += bytes.byteLength;
      totalObjects += 1;
    }

    bucketRows.push([name, bucket?.public === true, entries.length, bucketBytes]);
    totalBytes += bucketBytes;
    log(`${name}: ${entries.length} objects, ${bucketBytes} bytes`);
  }

  // An empty archive that exits 0 is the failure mode this whole file exists to
  // avoid — it is indistinguishable from a good backup until the day it is
  // needed. A credential that lists buckets but sees no objects produces
  // exactly that, so the count is a gate, not a statistic.
  if (totalObjects < minObjects) {
    throw new Error(
      `Backed up ${totalObjects} objects across ${buckets.length} buckets, expected at least ` +
        `${minObjects}. Refusing to record an empty archive as a successful backup.`,
    );
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'manifest.csv'), serializeCsv(manifest));
  await writeFile(join(outDir, 'buckets.csv'), serializeCsv(bucketRows));
  // The count as a bare integer, so the workflow can compare it against the
  // archive without counting manifest lines. An object key may contain a
  // newline — the manifest quotes it correctly, and `wc -l` then reports more
  // rows than there are objects, failing a perfectly good backup.
  await writeFile(join(outDir, 'object-count.txt'), `${totalObjects}\n`);

  return { buckets: buckets.length, objects: totalObjects, bytes: totalBytes };
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('usage: backup-storage.mjs <output-directory>');
    process.exit(2);
  }

  const baseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required.');
    process.exit(2);
  }

  const minObjects = Number.parseInt(process.env.NW_BACKUP_MIN_OBJECTS ?? '1', 10);
  const summary = await backupStorage({
    baseUrl,
    serviceKey,
    outDir,
    minObjects: Number.isFinite(minObjects) ? minObjects : 1,
    log: (message) => console.log(`  ${message}`),
  });

  console.log(
    `Storage backup complete: ${summary.objects} objects, ${summary.bytes} bytes, ` +
      `${summary.buckets} buckets.`,
  );
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  main().catch((error) => {
    console.error(`::error::Storage backup failed: ${error?.message ?? error}`);
    process.exit(1);
  });
}
