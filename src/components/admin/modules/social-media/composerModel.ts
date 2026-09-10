/**
 * Compose — pure helpers for the manual post composer (Guidelines §7.1).
 */

import type {
  ComposeMode,
  ComposeRequest,
  MediaFile,
  SocialPlatform,
  SocialProfile,
} from './types';
import { PLATFORM_LIMITS } from './types';

/** X counts a link as 23 characters regardless of its length. */
const X_LINK_LENGTH = 23;
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

export function isOverLimit(text: string, platforms: SocialPlatform[]): boolean {
  return platforms.some(
    (p) => countForPlatform(text, p) > (PLATFORM_LIMITS[p]?.maxCharacters ?? 280),
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

export interface ComposeDraft {
  text: string;
  channelIds: string[];
  media: MediaFile[];
  linkUrl: string;
  linkTitle: string;
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
  if (isOverLimit(draft.text, platforms)) return 'The text is too long for a selected channel.';
  const needsImage =
    platforms.includes('instagram') && !draft.media.some((m) => m.type === 'image');
  if (needsImage) return 'Instagram posts need an image.';
  return null;
}
