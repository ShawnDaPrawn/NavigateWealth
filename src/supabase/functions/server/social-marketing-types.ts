/**
 * Social & Marketing — server-side types (Buffer-backed).
 *
 * The previous shape of this module stored posts and "connected profiles" in
 * KV behind a `publishPost` that only flipped a status. Production held zero
 * rows in either namespace. Buffer is now the system of record for channels
 * and posts; these are the views the admin UI reads.
 */

import type {
  AppPostStatus,
  BufferAggregatedMetrics,
  BufferChannel,
  BufferMetric,
  BufferPost,
  BufferPostStatus,
  SocialChannel,
} from './buffer-service.ts';

export type {
  AppPostStatus,
  BufferAggregatedMetrics,
  BufferChannel,
  BufferMetric,
  BufferPost,
  BufferPostStatus,
  SocialChannel,
};

export interface ChannelView extends BufferChannel {
  /** The app's vocabulary (linkedin | instagram | x), null for networks the app does not use. */
  platform: SocialChannel | null;
  isConnected: boolean;
}

export interface PostView extends BufferPost {
  platform: SocialChannel | null;
  appStatus: AppPostStatus;
}

export type ComposeMode = 'now' | 'queue' | 'scheduled' | 'draft';

export interface ComposeImageInput {
  /** A public URL Buffer can fetch, or ... */
  url?: string;
  /** ... a path in the private AI-images bucket, copied to the public bucket first. */
  storagePath?: string;
  altText?: string;
}

export interface ComposePostInput {
  channelIds: string[];
  text: string;
  mode: ComposeMode;
  /** ISO 8601 with offset; required when mode is 'scheduled'. */
  scheduledAt?: string;
  images?: ComposeImageInput[];
  link?: { url: string; title?: string; description?: string };
}

export interface ComposeResult {
  created: Array<{
    channelId: string;
    platform: SocialChannel | null;
    postId: string;
    status: BufferPostStatus;
    dueAt: string | null;
  }>;
  failed: Array<{ channelId: string; platform: SocialChannel | null; error: string }>;
}

export interface AnalyticsView {
  from: string;
  to: string;
  metricsUpdatedAt: string | null;
  /** Keyed by Buffer's metric type: impressions, reactions, comments, shares, clicks, engagementRate, postCount, ... */
  totals: Record<string, number>;
  metrics: BufferMetric[];
}

export interface SocialMarketingStatus {
  configured: boolean;
  account?: { email: string; organizations: Array<{ id: string; name: string }> };
  error?: string;
}
