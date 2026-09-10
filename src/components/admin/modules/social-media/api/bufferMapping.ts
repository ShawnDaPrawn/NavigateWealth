/**
 * Buffer → app vocabulary.
 *
 * The Edge Function returns Buffer's own channel and post shapes (plus a
 * `platform` and `appStatus` it derives). The calendar, composer and channel
 * panel keep working in terms of `SocialProfile` / `SocialPost`, so this is
 * the one place that translation lives — and the one place to look when a
 * field on screen does not match Buffer.
 */
import type { MediaFile, SocialPlatform, SocialPost, SocialProfile } from '../types';

export interface BufferChannelDto {
  id: string;
  name: string;
  displayName: string | null;
  service: string;
  type: string;
  avatar: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused?: boolean;
  timezone: string;
  externalLink: string | null;
  postingSchedule?: Array<{ day: string; times: string[]; paused: boolean }>;
  platform: SocialPlatform | null;
  isConnected: boolean;
}

export interface BufferPostDto {
  id: string;
  channelId: string;
  channelService: string;
  text: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  externalLink: string | null;
  via: string;
  schedulingType: string | null;
  createdAt: string;
  updatedAt: string;
  error: { message: string } | null;
  assets: Array<{ type: string; source: string; thumbnail: string }>;
  tags: Array<{ id: string; name: string }>;
  platform: SocialPlatform | null;
  appStatus: SocialPost['status'];
}

const ACCOUNT_TYPES: Record<string, SocialProfile['accountType']> = {
  page: 'organization',
  business: 'business',
  profile: 'personal',
  account: 'personal',
};

/** Buffer's network slug when the server could not map it (e.g. facebook). */
function platformFromService(service: string): SocialPlatform {
  if (service === 'twitter') return 'x';
  if (service === 'facebook') return 'facebook';
  if (service === 'instagram') return 'instagram';
  return 'linkedin';
}

export function channelToProfile(channel: BufferChannelDto): SocialProfile {
  return {
    id: channel.id,
    platform: channel.platform ?? platformFromService(channel.service),
    name: channel.displayName || channel.name,
    username: channel.name,
    avatar: channel.avatar,
    isConnected: channel.isConnected,
    accountType: ACCOUNT_TYPES[channel.type],
    service: channel.service,
    externalLink: channel.externalLink,
    timezone: channel.timezone,
    postingSchedule: channel.postingSchedule ?? [],
  };
}

function assetToMedia(asset: BufferPostDto['assets'][number], index: number): MediaFile {
  return {
    id: `${asset.source || 'asset'}#${index}`,
    url: asset.source,
    type: asset.type === 'video' ? 'video' : 'image',
    filename: asset.source.split('/').pop() || 'media',
    size: 0,
  };
}

export function bufferPostToSocialPost(post: BufferPostDto): SocialPost {
  return {
    id: post.id,
    profiles: [post.channelId],
    channelId: post.channelId,
    platform: post.platform ?? platformFromService(post.channelService),
    bufferStatus: post.status,
    externalLink: post.externalLink,
    body: post.text,
    media: (post.assets ?? []).map(assetToMedia),
    scheduledAt: post.dueAt ? new Date(post.dueAt) : undefined,
    publishedAt: post.sentAt ? new Date(post.sentAt) : undefined,
    status: post.appStatus,
    createdBy: post.via,
    createdAt: new Date(post.createdAt),
    updatedAt: new Date(post.updatedAt),
    failureReason: post.error?.message,
    retryCount: 0,
    tags: (post.tags ?? []).map((t) => t.name),
  };
}
