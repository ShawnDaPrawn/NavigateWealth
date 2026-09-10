/**
 * Social & Marketing — service layer (Buffer-backed).
 *
 * Channels, posts and analytics come straight from Buffer; the manual Compose
 * path creates Buffer posts. There is no local copy of a post: what the
 * calendar shows is what Buffer will publish, so the two cannot drift.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError } from './error.middleware.ts';
import {
  bufferServiceToChannel,
  bufferStatusToAppStatus,
  createBufferPost,
  deleteBufferPost,
  getBufferAccount,
  getBufferAggregatedMetrics,
  isBufferConfigured,
  listBufferChannels,
  listBufferPosts,
  type BufferChannel,
  type BufferCreatePostInput,
  type BufferImageAssetInput,
  type BufferShareMode,
} from './buffer-service.ts';
import { publishPrivateImage } from './social-assets-storage.ts';
import type {
  AnalyticsView,
  ChannelView,
  ComposeImageInput,
  ComposePostInput,
  ComposeResult,
  PostView,
  SocialMarketingStatus,
} from './social-marketing-types.ts';

const log = createModuleLogger('social-marketing-service');

/** The AI generator's private bucket, from which manual-compose images are copied. */
const AI_IMAGES_BUCKET = 'make-91ed8379-social-ai-images';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getStatus(): Promise<SocialMarketingStatus> {
  if (!isBufferConfigured()) return { configured: false };
  try {
    const account = await getBufferAccount();
    return {
      configured: true,
      account: { email: account.email, organizations: account.organizations },
    };
  } catch (error) {
    return {
      configured: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function toChannelView(channel: BufferChannel): ChannelView {
  return {
    ...channel,
    platform: bufferServiceToChannel(channel.service),
    isConnected: !channel.isDisconnected && !channel.isLocked,
  };
}

export async function listChannels(): Promise<ChannelView[]> {
  const channels = await listBufferChannels();
  return channels.map(toChannelView);
}

export interface ListPostsOptions {
  from?: string;
  to?: string;
  channelId?: string;
}

/** Default window: two weeks back, nine weeks ahead — what a month calendar can reach. */
export async function listPosts(options: ListPostsOptions = {}): Promise<PostView[]> {
  const now = Date.now();
  const from = options.from ?? new Date(now - 14 * DAY_MS).toISOString();
  const to = options.to ?? new Date(now + 63 * DAY_MS).toISOString();
  const posts = await listBufferPosts({
    from,
    to,
    channelIds: options.channelId ? [options.channelId] : undefined,
  });
  return posts.map((post) => ({
    ...post,
    platform: bufferServiceToChannel(post.channelService),
    appStatus: bufferStatusToAppStatus(post.status),
  }));
}

function modeToBuffer(mode: ComposePostInput['mode']): {
  mode: BufferShareMode;
  saveToDraft?: boolean;
} {
  switch (mode) {
    case 'now':
      return { mode: 'shareNow' };
    case 'scheduled':
      return { mode: 'customScheduled' };
    case 'draft':
      return { mode: 'addToQueue', saveToDraft: true };
    case 'queue':
    default:
      return { mode: 'addToQueue' };
  }
}

/** Resolve compose images to public URLs Buffer can fetch. */
async function resolveImages(
  images: ComposeImageInput[] | undefined,
): Promise<BufferImageAssetInput[]> {
  const assets: BufferImageAssetInput[] = [];
  for (const image of images ?? []) {
    let url = image.url;
    if (!url && image.storagePath) {
      const target = `manual/${crypto.randomUUID()}.png`;
      url = await publishPrivateImage(AI_IMAGES_BUCKET, image.storagePath, target);
    }
    if (!url) continue;
    assets.push({
      image: { url, metadata: { altText: image.altText || 'Navigate Wealth' } },
    });
  }
  return assets;
}

/**
 * Build the per-network payload. Instagram needs an image and cannot carry a
 * link card; LinkedIn shows a link card instead of an image when a link is
 * given; X has no link card, so the link goes into the text.
 */
export function buildCreateInput(
  channel: BufferChannel,
  input: ComposePostInput,
  assets: BufferImageAssetInput[],
): BufferCreatePostInput {
  const { mode, saveToDraft } = modeToBuffer(input.mode);
  const base: BufferCreatePostInput = {
    channelId: channel.id,
    text: input.text,
    mode,
    schedulingType: 'automatic',
    ...(saveToDraft ? { saveToDraft } : {}),
    ...(input.mode === 'scheduled' && input.scheduledAt ? { dueAt: input.scheduledAt } : {}),
  };

  switch (channel.service) {
    case 'instagram': {
      if (assets.length === 0) {
        throw new ValidationError('Instagram posts need at least one image.');
      }
      return {
        ...base,
        assets,
        metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
      };
    }
    case 'linkedin': {
      if (input.link) {
        return {
          ...base,
          metadata: {
            linkedin: {
              linkAttachment: {
                url: input.link.url,
                ...(input.link.title ? { title: input.link.title } : {}),
                ...(input.link.description ? { description: input.link.description } : {}),
              },
            },
          },
        };
      }
      return { ...base, assets };
    }
    case 'twitter': {
      const text =
        input.link && !input.text.includes(input.link.url)
          ? `${input.text}\n${input.link.url}`
          : input.text;
      return { ...base, text, assets };
    }
    default:
      return { ...base, assets };
  }
}

export async function composePost(input: ComposePostInput, actor: string): Promise<ComposeResult> {
  const channels = await listBufferChannels();
  const byId = new Map(channels.map((c) => [c.id, c]));
  const assets = await resolveImages(input.images);

  const result: ComposeResult = { created: [], failed: [] };
  for (const channelId of input.channelIds) {
    const channel = byId.get(channelId);
    if (!channel) {
      result.failed.push({
        channelId,
        platform: null,
        error: 'Channel is not connected to Buffer',
      });
      continue;
    }
    const platform = bufferServiceToChannel(channel.service);
    try {
      const created = await createBufferPost(buildCreateInput(channel, input, assets));
      result.created.push({
        channelId,
        platform,
        postId: created.id,
        status: created.status,
        dueAt: created.dueAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('Compose failed for channel', { channelId, platform, error: message });
      result.failed.push({ channelId, platform, error: message });
    }
  }

  log.info('Compose finished', {
    actor,
    created: result.created.length,
    failed: result.failed.length,
  });
  return result;
}

export async function deletePost(postId: string): Promise<void> {
  await deleteBufferPost(postId);
}

export async function getAnalytics(days: number): Promise<AnalyticsView> {
  const to = new Date();
  const from = new Date(to.getTime() - days * DAY_MS);
  const aggregated = await getBufferAggregatedMetrics({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const totals: Record<string, number> = {};
  for (const metric of aggregated.metrics) {
    totals[metric.type] = (totals[metric.type] ?? 0) + metric.value;
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    metricsUpdatedAt: aggregated.metricsUpdatedAt,
    totals,
    metrics: aggregated.metrics,
  };
}
