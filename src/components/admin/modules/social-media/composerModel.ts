/**
 * Compose — pure helpers for the manual post composer (Guidelines §7.1).
 */

import type {
  ChannelAsset,
  ComposeMode,
  ComposeRequest,
  MediaFile,
  SocialPlatform,
  SocialProfile,
} from './types';
import { PLATFORM_LIMITS } from './types';

/** X counts a link as 23 characters regardless of its length. */
const X_LINK_LENGTH = 23;

/**
 * Images per post. Mirrors `ComposePostSchema`'s `images.max(4)` on the server:
 * without this the picker would happily attach six and every publish, queue,
 * schedule and draft attempt would come back a validation error.
 */
export const MAX_POST_IMAGES = 4;
const URL_RE = /https?:\/\/\S+/g;

/** Characters the strictest selected platform will accept. */
export function characterLimitFor(platforms: SocialPlatform[]): number {
  if (platforms.length === 0) return PLATFORM_LIMITS.x.maxCharacters;
  return Math.min(...platforms.map((p) => PLATFORM_LIMITS[p]?.maxCharacters ?? 280));
}

/** Character count as X would count it (links = 23). Other networks count plain length. */
export function countForPlatform(text: string, platform: SocialPlatform): number {
  if (platform !== 'x') return text.length;
  const links = text.match(URL_RE) ?? [];
  const withoutLinks = text.replace(URL_RE, '');
  return withoutLinks.length + links.length * X_LINK_LENGTH;
}

/**
 * The text Buffer will actually receive for a platform. X has no link card, so
 * the server appends the link to the body when it is not already in it — the
 * limit check and the counter must see that appended text, not just the body.
 */
export function effectiveTextFor(
  draft: Pick<ComposeDraft, 'text' | 'linkUrl'>,
  platform: SocialPlatform,
): string {
  const link = draft.linkUrl.trim();
  if (platform === 'x' && link && !draft.text.includes(link)) {
    return `${draft.text.trim()}\n${link}`;
  }
  return draft.text;
}

export function isOverLimit(
  draft: Pick<ComposeDraft, 'text' | 'linkUrl'>,
  platforms: SocialPlatform[],
): boolean {
  return platforms.some(
    (p) =>
      countForPlatform(effectiveTextFor(draft, p), p) > (PLATFORM_LIMITS[p]?.maxCharacters ?? 280),
  );
}

/** `YYYY-MM-DDTHH:mm:ss±HH:MM` in the browser's local zone — what Buffer wants for `dueAt`. */
export function toIsoWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const out = new Date(date);
  out.setHours(hours || 0, minutes || 0, 0, 0);
  return out;
}

/** The prefix `assetToMediaFile` stamps on a library asset's media id. */
const ASSET_MEDIA_PREFIX = 'asset_';

/**
 * A channel asset as the composer holds it.
 *
 * Its URL is already public and permanent, so it goes straight to Buffer;
 * `storagePath` (which means "copy this out of the private AI bucket") is
 * deliberately left unset, and the library path rides along separately so the
 * picker can tell what the draft already carries.
 */
export function assetToMediaFile(asset: ChannelAsset): MediaFile {
  const name = asset.file_name ?? 'Asset';
  return {
    id: `${ASSET_MEDIA_PREFIX}${asset.id}`,
    url: asset.url,
    libraryPath: asset.storage_path,
    type: 'image',
    filename: name,
    size: asset.byte_size,
    alt: asset.alt_text ?? name,
  };
}

export interface ComposeDraft {
  text: string;
  channelIds: string[];
  media: MediaFile[];
  linkUrl: string;
  linkTitle: string;
}

/**
 * The library assets a draft is carrying, by id.
 *
 * The compose request itself only needs a URL, so the asset's identity would
 * otherwise stop here — and an asset nobody marks used stays in the queue a
 * publishing routine draws from, which is how the same picture goes out twice.
 * The id rides in the media id rather than in the request because the request
 * is the Edge Function's contract and Buffer has no use for our row ids.
 */
export function assetIdsInDraft(draft: ComposeDraft): string[] {
  return draft.media
    .filter((m) => m.id.startsWith(ASSET_MEDIA_PREFIX))
    .map((m) => m.id.slice(ASSET_MEDIA_PREFIX.length))
    .filter((id) => id.length > 0);
}

/** Turn the composer's state into the request the Edge Function validates. */
export function buildComposeRequest(
  draft: ComposeDraft,
  mode: ComposeMode,
  scheduledAt?: Date,
): ComposeRequest {
  const images = draft.media
    .filter((m) => m.type === 'image')
    .map((m) =>
      m.storagePath
        ? { storagePath: m.storagePath, altText: m.alt || m.filename }
        : { url: m.url, altText: m.alt || m.filename },
    );
  const link = draft.linkUrl.trim()
    ? {
        url: draft.linkUrl.trim(),
        ...(draft.linkTitle.trim() ? { title: draft.linkTitle.trim() } : {}),
      }
    : undefined;
  return {
    channelIds: draft.channelIds,
    text: draft.text.trim(),
    mode,
    ...(mode === 'scheduled' && scheduledAt ? { scheduledAt: toIsoWithOffset(scheduledAt) } : {}),
    ...(images.length ? { images } : {}),
    ...(link ? { link } : {}),
  };
}

/** Why the composer cannot submit yet, or null when it can. */
export function composeBlocker(draft: ComposeDraft, profiles: SocialProfile[]): string | null {
  if (draft.channelIds.length === 0) return 'Choose at least one channel.';
  if (!draft.text.trim()) return 'Write the post text.';
  const platforms = profiles.filter((p) => draft.channelIds.includes(p.id)).map((p) => p.platform);
  if (isOverLimit(draft, platforms)) return 'The text is too long for a selected channel.';
  const needsImage =
    platforms.includes('instagram') && !draft.media.some((m) => m.type === 'image');
  if (needsImage) return 'Instagram posts need an image.';
  const imageCount = draft.media.filter((m) => m.type === 'image').length;
  if (imageCount > MAX_POST_IMAGES) {
    return `A post can carry at most ${MAX_POST_IMAGES} images — remove ${imageCount - MAX_POST_IMAGES}.`;
  }
  return null;
}
