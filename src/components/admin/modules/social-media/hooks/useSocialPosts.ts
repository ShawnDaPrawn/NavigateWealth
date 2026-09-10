/**
 * useSocialPosts Hook
 *
 * A window of Buffer posts for the calendar, plus Compose (create in Buffer,
 * one post per channel) and delete. There is no local post store: what the
 * calendar shows is what Buffer will publish. (React Query per Guidelines
 * §6, §11.2.)
 *
 * @module social-media/hooks/useSocialPosts
 */

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postsApi } from '../api';
import type { ComposeRequest, ComposeResult, PostStatus, SocialPost } from '../types';
import { socialMediaKeys } from './queryKeys';

export interface PostRange {
  start: Date;
  end: Date;
}

interface UseSocialPostsOptions {
  /** Initial calendar window. Defaults to two weeks back, nine weeks ahead. */
  initialRange?: PostRange;
  fetchOnMount?: boolean;
}

interface UseSocialPostsReturn {
  posts: SocialPost[];
  loading: boolean;
  error: string | null;
  range: PostRange;
  setRange: (range: PostRange) => void;
  refetch: () => Promise<void>;
  createPost: (data: ComposeRequest) => Promise<ComposeResult | null>;
  isCreating: boolean;
  deletePost: (postId: string) => Promise<boolean>;
  getPostsByStatus: (status: PostStatus) => SocialPost[];
}

const POSTS_STALE_TIME = 2 * 60 * 1000; // 2 minutes
const DAY_MS = 24 * 60 * 60 * 1000;

export function defaultPostRange(now = new Date()): PostRange {
  return {
    start: new Date(now.getTime() - 14 * DAY_MS),
    end: new Date(now.getTime() + 63 * DAY_MS),
  };
}

/** Human-readable outcome of a compose call, for the toast. */
export function describeComposeResult(result: ComposeResult): {
  kind: 'success' | 'partial' | 'error';
  message: string;
} {
  const created = result.created.length;
  const failed = result.failed.length;
  if (created > 0 && failed === 0) {
    return {
      kind: 'success',
      message: `Sent to Buffer for ${created} channel${created === 1 ? '' : 's'}`,
    };
  }
  if (created > 0) {
    return {
      kind: 'partial',
      message: `${created} created, ${failed} failed: ${result.failed.map((f) => f.error).join('; ')}`,
    };
  }
  return {
    kind: 'error',
    message: result.failed.map((f) => f.error).join('; ') || 'Buffer rejected the post',
  };
}

export function useSocialPosts(options: UseSocialPostsOptions = {}): UseSocialPostsReturn {
  const { initialRange, fetchOnMount = true } = options;
  const queryClient = useQueryClient();
  const [range, setRange] = useState<PostRange>(() => initialRange ?? defaultPostRange());

  const postsQuery = useQuery({
    queryKey: socialMediaKeys.posts.dateRange(range.start.toISOString(), range.end.toISOString()),
    queryFn: () => postsApi.getByDateRange(range.start, range.end),
    enabled: fetchOnMount,
    staleTime: POSTS_STALE_TIME,
  });

  const posts: SocialPost[] = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);

  const invalidatePosts = useCallback(
    () => queryClient.invalidateQueries({ queryKey: socialMediaKeys.posts.all }),
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: (data: ComposeRequest) => postsApi.create(data),
    onSuccess: (result) => {
      invalidatePosts();
      const outcome = describeComposeResult(result);
      if (outcome.kind === 'success') toast.success(outcome.message);
      else if (outcome.kind === 'partial') toast.warning(outcome.message);
      else toast.error(outcome.message);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to send the post to Buffer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => postsApi.delete(postId),
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post deleted in Buffer');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete the post');
    },
  });

  const createPost = useCallback(
    async (data: ComposeRequest): Promise<ComposeResult | null> => {
      try {
        return await createMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    [createMutation],
  );

  const deletePost = useCallback(
    async (postId: string): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(postId);
        return true;
      } catch {
        return false;
      }
    },
    [deleteMutation],
  );

  const refetch = useCallback(async () => {
    await invalidatePosts();
  }, [invalidatePosts]);

  const getPostsByStatus = useCallback(
    (status: PostStatus) => posts.filter((p) => p.status === status),
    [posts],
  );

  const error = postsQuery.error
    ? postsQuery.error instanceof Error
      ? postsQuery.error.message
      : 'Failed to fetch posts'
    : null;

  return {
    posts,
    loading: postsQuery.isLoading,
    error,
    range,
    setRange,
    refetch,
    createPost,
    isCreating: createMutation.isPending,
    deletePost,
    getPostsByStatus,
  };
}
