/**
 * Social channel assets — the Assets tab's media, per channel.
 *
 * WHAT THIS SERVES
 * ----------------
 * Finished pictures and videos made for LinkedIn, Instagram or X. An outside
 * agent (ChatGPT) adds them; a publishing routine later draws from what is
 * `available` and marks it `used`. Bytes go to the public bucket under
 * `channels/<channel>/`, the row lives in `social_channel_assets`, and every
 * write goes through the SQL functions in migration `social_channel_assets`
 * so the HTTPS path and the Supabase-connector path behave identically.
 *
 * TWO WAYS IN, ONE SET OF RULES
 * -----------------------------
 * A caller may send the file as multipart, or hand over a URL for the server
 * to fetch. The URL path is not a loophole: the bytes are downloaded and put
 * through the same signature check and size limit before anything is stored.
 * What a file claims to be never decides anything — the first bytes do.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { APIError, ValidationError } from './error.middleware.ts';
import {
  downloadForUpload,
  getSocialSupabase,
  removePublicObject,
  uploadPublicBytes,
} from './social-assets-storage.ts';
import type {
  ChannelAsset,
  ChannelAssetPatch,
  ListChannelAssetsOptions,
} from './social-channel-assets-types.ts';

const log = createModuleLogger('social-channel-assets');

const TABLE = 'social_channel_assets';

/** Everything this module writes lives under here; nothing else may be deleted. */
export const CHANNEL_ASSETS_PREFIX = 'channels';

/**
 * Accepted media, and the extension each gets.
 *
 * Kept in step with the bucket's own `allowedMimeTypes`: a wider list here
 * would only turn a clear 400 into an opaque storage failure.
 */
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * Images are small; video is not. Both sit under the bucket's own ceiling.
 *
 * The video figure is what this endpoint can actually deliver, not what the
 * bucket would hold. `bodyLimitMiddleware` in create-app.ts refuses a multipart
 * body over 55MB before any route sees it, and both intake paths — the uploaded
 * file and the fetched `sourceUrl` — hold the whole thing in memory to sniff its
 * first bytes, so an isolate has no way to take a 200MB reel however generous
 * the bucket is. Advertising 200MB here would only move the refusal from a
 * clear message to a 413 nobody can act on. 50MB leaves room for the multipart
 * boundary under that ceiling; the bucket stays at 200MB so a future
 * direct-to-storage upload needs no migration to use it.
 */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export interface SniffedMedia {
  mediaType: 'image' | 'video';
  contentType: string;
  extension: string;
}

/**
 * What the bytes actually are.
 *
 * The bucket is world-readable, so a file renamed to `.png` must not be able
 * to land in it. Every format here is identified by its own signature:
 * PNG and JPEG by their magic numbers, WebP and MP4/MOV by a marker a few
 * bytes in (`RIFF....WEBP`, `....ftyp`), WebM by the EBML header.
 */
export function sniffMedia(bytes: Uint8Array): SniffedMedia | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return { mediaType: 'image', contentType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mediaType: 'image', contentType: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { mediaType: 'image', contentType: 'image/webp', extension: 'webp' };
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return { mediaType: 'video', contentType: 'video/webm', extension: 'webm' };
  }
  // ISO base media (MP4, M4V, MOV): 4-byte box size, then 'ftyp', then a brand.
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    const isQuickTime = brand.startsWith('qt');
    return isQuickTime
      ? { mediaType: 'video', contentType: 'video/quicktime', extension: 'mov' }
      : { mediaType: 'video', contentType: 'video/mp4', extension: 'mp4' };
  }
  return null;
}

/** `Reel FINAL v2.mp4` → `reel-final-v2`, capped. Empty when nothing survives. */
export function slugifyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * `channels/<channel>/<uuid>__<slug>.<ext>`.
 *
 * Grouped by channel so the bucket is browsable, unique so an upload never
 * overwrites media a scheduled post points at, and self-describing so the
 * object is recognisable in the storage console.
 */
export function buildStoragePath(channel: string, filename: string, extension: string): string {
  const slug = slugifyName(filename || '');
  return `${CHANNEL_ASSETS_PREFIX}/${channel}/${crypto.randomUUID()}${slug ? `__${slug}` : ''}.${extension}`;
}

function rowToAsset(row: Record<string, unknown>): ChannelAsset {
  return row as unknown as ChannelAsset;
}

export interface AddChannelAssetInput {
  channel: 'linkedin' | 'instagram' | 'x';
  /** The file itself, when the caller sent multipart. */
  bytes?: Uint8Array;
  /** A link for the server to fetch, when the caller could not send bytes. */
  sourceUrl?: string;
  fileName?: string;
  declaredType?: string;
  caption?: string;
  altText?: string;
  tags?: string[];
  notes?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  /** Who is adding it: `chatgpt`, `admin`, a routine name. */
  source?: string;
  agent?: string;
}

/**
 * Store one file and register it against a channel.
 *
 * Order matters: validate, then store the bytes, then insert the row. A row
 * without an object would be a broken link in the Assets tab, whereas an
 * object without a row is invisible clutter that costs only storage — so the
 * cheaper failure is the one left possible, and the insert failing cleans up
 * after itself.
 */
export async function addChannelAsset(input: AddChannelAssetInput): Promise<ChannelAsset> {
  let bytes = input.bytes;
  let declared = (input.declaredType || '').split(';')[0].trim().toLowerCase();

  if (!bytes) {
    if (!input.sourceUrl) {
      throw new ValidationError('Send the file itself, or a sourceUrl for the server to fetch.');
    }
    const fetched = await downloadForUpload(input.sourceUrl, MAX_VIDEO_BYTES);
    bytes = fetched.bytes;
    declared = declared || fetched.contentType.toLowerCase();
  }

  if (bytes.length === 0) throw new ValidationError('The file is empty.');

  const sniffed = sniffMedia(bytes);
  if (!sniffed) {
    throw new ValidationError(
      'That file is not a supported image (PNG, JPEG, WebP) or video (MP4, MOV, WebM).',
    );
  }

  // A declared type that disagrees with the bytes is a mistake worth naming,
  // not something to silently override.
  const known = { ...IMAGE_TYPES, ...VIDEO_TYPES };
  if (declared && known[declared] && declared !== sniffed.contentType) {
    throw new ValidationError(
      `The file says it is ${declared} but its contents are ${sniffed.contentType}.`,
    );
  }

  const limit = sniffed.mediaType === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (bytes.length > limit) {
    throw new ValidationError(
      `${sniffed.mediaType === 'video' ? 'Videos' : 'Images'} must be ${Math.round(limit / 1024 / 1024)}MB or smaller.`,
    );
  }

  const storagePath = buildStoragePath(input.channel, input.fileName || 'asset', sniffed.extension);
  const url = await uploadPublicBytes(bytes, storagePath, sniffed.contentType);

  const { data, error } = await getSocialSupabase().rpc('social_channel_assets_add', {
    p_asset: {
      channel: input.channel,
      media_type: sniffed.mediaType,
      storage_path: storagePath,
      url,
      file_name: input.fileName ?? null,
      content_type: sniffed.contentType,
      byte_size: String(bytes.length),
      width: input.width ?? null,
      height: input.height ?? null,
      duration_seconds: input.durationSeconds ?? null,
      caption: input.caption ?? null,
      alt_text: input.altText ?? null,
      tags: input.tags ?? [],
      notes: input.notes ?? null,
      source: input.source ?? null,
    },
    p_agent: input.agent ?? null,
  });

  if (error) {
    // The object is already up; without its row nothing can ever reach it.
    await removePublicObject(storagePath).catch(() => undefined);
    throw new APIError(
      `Could not register the asset: ${error.message}`,
      500,
      'ASSET_INSERT_FAILED',
    );
  }

  log.info('Channel asset added', {
    channel: input.channel,
    mediaType: sniffed.mediaType,
    bytes: bytes.length,
    source: input.source,
  });
  return rowToAsset(data as Record<string, unknown>);
}

export async function listChannelAssets(
  options: ListChannelAssetsOptions = {},
): Promise<ChannelAsset[]> {
  const { data, error } = await getSocialSupabase().rpc('social_channel_assets_list', {
    p_channel: options.channel ?? null,
    // `null` means every status; the SQL default of 'available' is the queue a
    // routine wants, but the Assets tab shows everything unless asked.
    p_status: options.status ?? null,
    p_media_type: options.mediaType ?? null,
    p_limit: options.limit ?? 60,
    p_offset: options.offset ?? 0,
  });
  if (error) {
    throw new APIError(`Could not list assets: ${error.message}`, 500, 'ASSET_LIST_FAILED');
  }
  return ((data as Record<string, unknown>[]) ?? []).map(rowToAsset);
}

export async function getChannelAsset(id: string): Promise<ChannelAsset> {
  const { data, error } = await getSocialSupabase()
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new APIError(`Could not read the asset: ${error.message}`, 500, 'ASSET_READ_FAILED');
  }
  if (!data) throw new APIError('Asset not found', 404, 'ASSET_NOT_FOUND');
  return rowToAsset(data);
}

/** Editable fields. Status changes go through the SQL function, not here. */
export async function updateChannelAsset(
  id: string,
  patch: ChannelAssetPatch,
  agent?: string,
): Promise<ChannelAsset> {
  const supabase = getSocialSupabase();

  if (patch.status) {
    const { error } = await supabase.rpc('social_channel_assets_set_status', {
      p_id: id,
      p_status: patch.status,
      p_agent: agent ?? null,
    });
    if (error) {
      throw new APIError(
        `Could not change the status: ${error.message}`,
        500,
        'ASSET_STATUS_FAILED',
      );
    }
  }

  const fields: Record<string, unknown> = {};
  if (patch.caption !== undefined) fields.caption = patch.caption;
  if (patch.altText !== undefined) fields.alt_text = patch.altText;
  if (patch.tags !== undefined) fields.tags = patch.tags;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  if (patch.channel !== undefined) fields.channel = patch.channel;

  if (Object.keys(fields).length > 0) {
    fields.updated_by = agent ?? null;
    const { error } = await supabase.from(TABLE).update(fields).eq('id', id);
    if (error) {
      throw new APIError(
        `Could not update the asset: ${error.message}`,
        500,
        'ASSET_UPDATE_FAILED',
      );
    }
  }

  return getChannelAsset(id);
}

/** Called by a publishing routine once Buffer has accepted the post. */
export async function markChannelAssetUsed(
  id: string,
  bufferPostId?: string,
  agent?: string,
): Promise<ChannelAsset> {
  const { data, error } = await getSocialSupabase().rpc('social_channel_assets_mark_used', {
    p_id: id,
    p_buffer_post_id: bufferPostId ?? null,
    p_agent: agent ?? null,
  });
  if (error) {
    const notFound = /not found/i.test(error.message);
    throw new APIError(
      notFound ? 'Asset not found' : `Could not mark the asset used: ${error.message}`,
      notFound ? 404 : 500,
      notFound ? 'ASSET_NOT_FOUND' : 'ASSET_USE_FAILED',
    );
  }
  return rowToAsset(data as Record<string, unknown>);
}

/**
 * Remove an asset and its file.
 *
 * The row goes first: if the storage delete then fails, the Assets tab is
 * still correct and the orphan costs only space. Doing it the other way round
 * would leave a row pointing at nothing.
 */
export async function deleteChannelAsset(id: string): Promise<void> {
  const asset = await getChannelAsset(id);

  const { error } = await getSocialSupabase().from(TABLE).delete().eq('id', id);
  if (error) {
    throw new APIError(`Could not delete the asset: ${error.message}`, 500, 'ASSET_DELETE_FAILED');
  }

  // Belt and braces: the path came from our own row, but a delete that could
  // reach outside `channels/` is exactly the bug worth making impossible.
  if (
    asset.storage_path.startsWith(`${CHANNEL_ASSETS_PREFIX}/`) &&
    !asset.storage_path.includes('..')
  ) {
    await removePublicObject(asset.storage_path).catch((err: unknown) => {
      log.warn('Asset row deleted but its file remains', {
        storagePath: asset.storage_path,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
  log.info('Channel asset deleted', { id, storagePath: asset.storage_path });
}

/** Per-channel counts, so the tab and an integrating agent can see the shape. */
export async function channelAssetSummary(): Promise<
  Record<string, { available: number; used: number; archived: number; total: number }>
> {
  const { data, error } = await getSocialSupabase().from(TABLE).select('channel, status');
  if (error) {
    throw new APIError(`Could not summarise assets: ${error.message}`, 500, 'ASSET_SUMMARY_FAILED');
  }
  const summary: Record<
    string,
    { available: number; used: number; archived: number; total: number }
  > = {};
  for (const channel of ['linkedin', 'instagram', 'x']) {
    summary[channel] = { available: 0, used: 0, archived: 0, total: 0 };
  }
  for (const row of (data as { channel: string; status: string }[]) ?? []) {
    const bucket = summary[row.channel];
    if (!bucket) continue;
    if (row.status === 'available') bucket.available += 1;
    else if (row.status === 'used') bucket.used += 1;
    else if (row.status === 'archived') bucket.archived += 1;
    bucket.total += 1;
  }
  return summary;
}
