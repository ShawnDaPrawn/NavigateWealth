/**
 * Channel assets hooks — the Assets tab's data access.
 *
 * Everything here is scoped to one channel at a time, because that is how the
 * tab is read and how a publishing routine will query it: "what have you got
 * for Instagram that has not gone out yet". (React Query per Guidelines §6, §11.2.)
 *
 * @module social-media/hooks/useChannelAssets
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { channelAssetsApi } from '../api';
import type {
  ChannelAsset,
  ChannelAssetChannel,
  ChannelAssetFilters,
  ChannelAssetPatch,
} from '../types';
import { socialMediaKeys } from './queryKeys';

const STALE_TIME = 30 * 1000;

/**
 * The endpoint's ceiling, mirrored so the browser refuses first.
 *
 * Kept in step with `social-channel-assets-service.ts`. The video figure is
 * bounded by the server's 55MB multipart body limit, not by the bucket, so a
 * larger file has to be refused here rather than after the upload.
 */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',');

export interface UploadOutcome {
  uploaded: ChannelAsset[];
  failed: Array<{ filename: string; error: string }>;
}

/** Why this file cannot be uploaded, or null when it can. */
export function rejectionReasonFor(file: File): string | null {
  const isImage = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  const isVideo = (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type);
  if (!isImage && !isVideo) {
    return 'Images must be PNG, JPEG or WebP; videos must be MP4, MOV or WebM.';
  }
  if (file.size === 0) return 'The file is empty.';
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    return `Too large — the limit is ${Math.round(limit / 1024 / 1024)}MB for ${isVideo ? 'video' : 'images'}.`;
  }
  return null;
}

export function describeUpload(outcome: UploadOutcome): string {
  const parts: string[] = [];
  if (outcome.uploaded.length > 0) {
    parts.push(`${outcome.uploaded.length} added`);
  }
  if (outcome.failed.length > 0) parts.push(`${outcome.failed.length} failed`);
  return parts.join(', ') || 'Nothing to upload';
}

export function useChannelAssetSummary() {
  return useQuery({
    queryKey: socialMediaKeys.channelAssets.channels(),
    queryFn: () => channelAssetsApi.listChannels(),
    staleTime: STALE_TIME,
  });
}

export function useChannelAssets(filters: ChannelAssetFilters) {
  return useQuery({
    queryKey: socialMediaKeys.channelAssets.list(filters as Record<string, unknown>),
    queryFn: () => channelAssetsApi.list(filters),
    staleTime: STALE_TIME,
  });
}

/**
 * Upload several files to one channel.
 *
 * Per-file outcomes rather than a batch that dies on the first rejection: one
 * oversized video should not lose the four pictures beside it.
 */
export function useUploadChannelAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      channel: ChannelAssetChannel;
      files: File[];
    }): Promise<UploadOutcome> => {
      const uploaded: ChannelAsset[] = [];
      const failed: UploadOutcome['failed'] = [];
      for (const file of input.files) {
        const reason = rejectionReasonFor(file);
        if (reason) {
          failed.push({ filename: file.name, error: reason });
          continue;
        }
        try {
          uploaded.push(await channelAssetsApi.upload(input.channel, file));
        } catch (error) {
          failed.push({
            filename: file.name,
            error: error instanceof Error ? error.message : 'Upload failed',
          });
        }
      }
      return { uploaded, failed };
    },
    onSuccess: (outcome) => {
      if (outcome.uploaded.length > 0) {
        void queryClient.invalidateQueries({ queryKey: socialMediaKeys.channelAssets.all });
        toast.success(describeUpload(outcome));
      }
      for (const failure of outcome.failed) toast.error(`${failure.filename}: ${failure.error}`);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    },
  });
}

export function useUpdateChannelAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; patch: ChannelAssetPatch }) =>
      channelAssetsApi.update(input.id, input.patch),
    onSuccess: (_asset, input) => {
      void queryClient.invalidateQueries({ queryKey: socialMediaKeys.channelAssets.all });
      if (input.patch.status) toast.success(`Moved to ${input.patch.status}`);
      else toast.success('Asset updated');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not update the asset');
    },
  });
}

export function useDeleteChannelAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => channelAssetsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialMediaKeys.channelAssets.all });
      toast.success('Asset deleted');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not delete the asset');
    },
  });
}

/**
 * Mark assets published, after Buffer has accepted the post that carried them.
 *
 * Takes the whole set at once because one composed post can carry several
 * pictures, and they all leave the shelf together. Failure is deliberately
 * quiet in the UI: the post is already away, and a toast saying otherwise
 * would be alarming and useless. It is logged so the shelf can be reconciled.
 */
export function useMarkChannelAssetsUsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, bufferPostId }: { ids: string[]; bufferPostId?: string }) => {
      await Promise.all(ids.map((id) => channelAssetsApi.markUsed(id, bufferPostId)));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialMediaKeys.channelAssets.all });
    },
    onError: (error: unknown) => {
      console.error('Could not mark composed assets as used', error);
    },
  });
}
