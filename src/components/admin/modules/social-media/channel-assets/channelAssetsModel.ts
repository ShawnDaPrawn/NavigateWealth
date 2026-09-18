/**
 * Channel assets — pure helpers (Guidelines §7.1).
 *
 * Kept out of the components so the rules about what a channel accepts have
 * one home and can be tested without rendering anything.
 */

import type { ChannelAsset, ChannelAssetChannel, ChannelAssetStatus } from '../types';

export const CHANNEL_ORDER: ChannelAssetChannel[] = ['instagram', 'linkedin', 'x'];

/** The user's words for each channel. X is still "Twitter" to most people. */
export const CHANNEL_LABEL: Record<ChannelAssetChannel, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
};

export interface StatusDisplay {
  label: string;
  className: string;
}

/** The §8.3 status vocabulary: green is live, blue is ready, grey is set aside. */
export const STATUS_DISPLAY: Record<ChannelAssetStatus, StatusDisplay> = {
  available: { label: 'Available', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  used: { label: 'Published', className: 'bg-green-50 text-green-700 border-green-200' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `21.5` → `0:21`. Videos are short here, so minutes is as far as it goes. */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** `1080 × 1920` when both are known. */
export function formatDimensions(asset: ChannelAsset): string | null {
  if (!asset.width || !asset.height) return null;
  return `${asset.width} × ${asset.height}`;
}

/**
 * What a reviewer should know before a routine publishes this.
 *
 * Only genuine blockers: Instagram will not take a post without alt text in a
 * way that reads well, and a video with no caption leaves the routine writing
 * one from nothing. Advice, not enforcement — the routine may still choose it.
 */
export function assetWarnings(asset: ChannelAsset): string[] {
  const warnings: string[] = [];
  if (asset.media_type === 'image' && !asset.alt_text) {
    warnings.push('No alt text');
  }
  if (!asset.caption) warnings.push('No suggested caption');
  return warnings;
}

export function countByStatus(assets: ChannelAsset[]): Record<ChannelAssetStatus, number> {
  const counts: Record<ChannelAssetStatus, number> = { available: 0, used: 0, archived: 0 };
  for (const asset of assets) counts[asset.status] += 1;
  return counts;
}
