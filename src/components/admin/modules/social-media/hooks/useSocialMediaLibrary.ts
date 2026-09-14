/**
 * Media library hooks — upload, list and delete the images used in posts.
 *
 * Uploading several files at once is the normal case (a person drags a folder
 * of graphics in), so `uploadMany` reports per-file outcomes rather than
 * failing the batch on the first rejected file: one 12MB photo should not lose
 * the other five. (React Query per Guidelines §6, §11.2.)
 *
 * @module social-media/hooks/useSocialMediaLibrary
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mediaApi } from '../api';
import type { SocialMediaAsset } from '../types';
import { socialMediaKeys } from './queryKeys';

const LIBRARY_STALE_TIME = 30 * 1000;

/** Mirrors the Edge Function's limit so the browser rejects an oversized file first. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** For the file input's `accept`. */
export const ACCEPT_ATTRIBUTE = 'image/png,image/jpeg,image/webp';

export interface UploadOutcome {
  uploaded: SocialMediaAsset[];
  failed: Array<{ filename: string; error: string }>;
}

/** Why this file cannot be uploaded, or null when it can. */
export function rejectionReasonFor(file: File): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return 'Only PNG, JPEG and WebP images can be uploaded.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Too large — the limit is ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`;
  }
  if (file.size === 0) return 'The file is empty.';
  return null;
}

export function describeUpload(outcome: UploadOutcome): string {
  const parts: string[] = [];
  if (outcome.uploaded.length > 0) {
    parts.push(`${outcome.uploaded.length} image${outcome.uploaded.length === 1 ? '' : 's'} added`);
  }
  if (outcome.failed.length > 0) {
    parts.push(`${outcome.failed.length} failed`);
  }
  return parts.join(', ') || 'Nothing to upload';
}

/** `enabled` lets the composer's picker hold off until it is opened. */
export function useMediaLibrary(limit = 60, enabled = true) {
  return useQuery({
    queryKey: socialMediaKeys.library.list(limit),
    queryFn: () => mediaApi.list(limit),
    staleTime: LIBRARY_STALE_TIME,
    enabled,
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]): Promise<UploadOutcome> => {
      const uploaded: SocialMediaAsset[] = [];
      const failed: UploadOutcome['failed'] = [];

      for (const file of files) {
        const reason = rejectionReasonFor(file);
        if (reason) {
          failed.push({ filename: file.name, error: reason });
          continue;
        }
        try {
          uploaded.push(await mediaApi.upload(file));
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
        void queryClient.invalidateQueries({ queryKey: socialMediaKeys.library.all });
        toast.success(describeUpload(outcome));
      }
      for (const failure of outcome.failed) {
        toast.error(`${failure.filename}: ${failure.error}`);
      }
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storagePath: string) => mediaApi.remove(storagePath),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: socialMediaKeys.library.all });
      toast.success('Image deleted');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Could not delete the image');
    },
  });
}
