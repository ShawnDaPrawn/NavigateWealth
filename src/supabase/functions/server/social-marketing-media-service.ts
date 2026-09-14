/**
 * Social & Marketing — the media library.
 *
 * WHY THIS EXISTS
 * ---------------
 * Compose could attach an image by public URL, which is only useful to someone
 * who already hosts images somewhere. Everyone else had no way to get a picture
 * into a post at all. Uploads land in the same PUBLIC bucket the automation
 * writes to (`social-assets-storage.ts`), because Buffer fetches a post's image
 * from the URL it is handed — possibly days later, when a scheduled post fires —
 * so a signed URL with an expiry is the wrong shape here.
 *
 * NO TABLE, ON PURPOSE
 * --------------------
 * The bucket is the library. Listing a prefix gives name, size, content type
 * and created_at, which is everything the picker shows, so a row per image
 * would be a second source of truth that can disagree with storage after a
 * failed upload or a manual delete. The one piece storage cannot hold is the
 * original file name, so it is carried in the object path (see `buildPath`).
 * Alt text is per-post rather than per-image and is captured in the composer.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError } from './error.middleware.ts';
import {
  listPublicObjects,
  publicUrlFor,
  removePublicObject,
  uploadPublicBytes,
} from './social-assets-storage.ts';
import type { MediaItem } from './social-marketing-types.ts';

const log = createModuleLogger('social-marketing-media');

/** Everything an admin uploads lives under this prefix; nothing else may be deleted. */
export const MEDIA_PREFIX = 'uploads';

/** Matches the bucket's own `allowedMimeTypes` — a wider list here would just fail at storage. */
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** The bucket's `fileSizeLimit`. Checked here so the caller gets a 400, not a storage 413. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Does the byte signature agree with the declared content type?
 *
 * A browser sets `type` from the file extension, so a renamed file arrives
 * claiming to be an image. The public bucket is served to the internet, so it
 * is worth four bytes to check.
 */
export function sniffImageType(
  bytes: Uint8Array,
): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** `photo of the team.PNG` → `photo-of-the-team`, capped. Empty when nothing survives. */
export function slugifyName(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '');
  return stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * `uploads/<uuid>__<slug>.<ext>` — flat, so one `list()` returns the library,
 * unique, so an upload never overwrites a picture a scheduled post points at,
 * and self-describing, so the picker can show the name the person uploaded.
 */
export function buildPath(filename: string, extension: string): string {
  const slug = slugifyName(filename);
  const id = crypto.randomUUID();
  return `${MEDIA_PREFIX}/${id}${slug ? `__${slug}` : ''}.${extension}`;
}

/** Recover the display name a `buildPath` object carries. */
export function displayNameFor(objectName: string): string {
  const withoutExt = objectName.replace(/\.[^.]+$/, '');
  const separator = withoutExt.indexOf('__');
  const slug = separator === -1 ? '' : withoutExt.slice(separator + 2);
  return slug ? slug.replace(/-/g, ' ') : 'Untitled image';
}

function toMediaItem(
  name: string,
  size: number,
  contentType: string | null,
  createdAt: string | null,
): MediaItem {
  const storagePath = `${MEDIA_PREFIX}/${name}`;
  return {
    storagePath,
    url: publicUrlFor(storagePath),
    name: displayNameFor(name),
    size,
    contentType,
    uploadedAt: createdAt,
  };
}

/** A multipart part that carries bytes and a name. */
export interface UploadedFile {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

/**
 * `instanceof File` is unreliable here: the edge runtime and the test runtime
 * each have their own File class, and a part built by one fails the check in
 * the other. The shape is what actually matters.
 */
export function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UploadedFile).arrayBuffer === 'function'
  );
}

export interface UploadMediaInput {
  bytes: Uint8Array;
  filename: string;
  declaredType: string;
}

export async function uploadMedia(input: UploadMediaInput): Promise<MediaItem> {
  if (input.bytes.length === 0) {
    throw new ValidationError('The file is empty.');
  }
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Images must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB or smaller.`,
    );
  }

  const sniffed = sniffImageType(input.bytes);
  if (!sniffed) {
    throw new ValidationError('That file is not a PNG, JPEG or WebP image.');
  }
  // The signature wins: it is what the bytes actually are.
  const declared = input.declaredType.split(';')[0].trim().toLowerCase();
  if (declared && ALLOWED[declared] && declared !== sniffed) {
    throw new ValidationError(`The file says it is ${declared} but its contents are ${sniffed}.`);
  }

  const storagePath = buildPath(input.filename, ALLOWED[sniffed]);
  const url = await uploadPublicBytes(input.bytes, storagePath, sniffed);
  log.info('Social media upload stored', { storagePath, bytes: input.bytes.length, type: sniffed });

  return {
    storagePath,
    url,
    name: displayNameFor(storagePath.slice(MEDIA_PREFIX.length + 1)),
    size: input.bytes.length,
    contentType: sniffed,
    uploadedAt: new Date().toISOString(),
  };
}

export async function listMedia(limit: number): Promise<MediaItem[]> {
  const objects = await listPublicObjects(MEDIA_PREFIX, limit);
  return objects.map((o) => toMediaItem(o.name, o.size, o.contentType, o.createdAt));
}

/**
 * Delete one uploaded image.
 *
 * The prefix guard is the point: the same bucket holds the weekly automation's
 * rendered images, and a path from a request must never be able to reach them.
 */
export async function deleteMedia(storagePath: string): Promise<void> {
  if (!storagePath.startsWith(`${MEDIA_PREFIX}/`) || storagePath.includes('..')) {
    throw new ValidationError('Only uploaded images can be deleted.');
  }
  await removePublicObject(storagePath);
  log.info('Social media upload deleted', { storagePath });
}
