/**
 * useSocialPosts Hook
 *
 * React Query-based hook for managing social media posts including:
 * - Fetching posts with filters (useQuery)
 * - Creating, updating, deleting posts (useMutation)
 * - Scheduling and publishing posts
 * - Post analytics
 *
 * Migrated from manual useState/useEffect to React Query per Guidelines §6, §11.2.
 *
 * @module social-media/hooks/useSocialPosts
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  postsApi,
  type CreatePostRequest,
  type UpdatePostRequest,
  type PostFilters,
} from '../api';
import type { SocialPost, PostStatus } from '../types';
import { toast } from 'sonner@2.0.3';
import { socialMediaKeys } from './queryKeys';

// ============================================================================
// Options & Return Types
// ============================================================================

interface UseSocialPostsOptions {
  /** Initial filters to apply */
  initialFilters?: PostFilters;

  /**
   * Whether to fetch posts on mount.
   * Maps to React Query `enabled`.
   * @default true
   */
  fetchOnMount?: boolean;
}

interface UseSocialPostsReturn {
  posts: SocialPost[];
  loading: boolean;
  error: string | null;
  filters: PostFilters;

  // Actions
  fetchPosts: (filters?: PostFilters) => Promise<void>;
  createPost: (data: CreatePostRequest) => Promise<SocialPost | null>;
  updatePost: (postId: string, data: UpdatePostRequest) => Promise<boolean>;
  deletePost: (postId: string) => Promise<boolean>;
  schedulePost: (postId: string, scheduledAt: Date) => Promise<boolean>;
  publishPost: (postId: string) => Promise<boolean>;
  duplicatePost: (postId: string) => Promise<SocialPost | null>;
  cancelSchedule: (postId: string) => Promise<boolean>;

  // Quick create actions
  saveDraft: (data: CreatePostRequest) => Promise<SocialPost | null>;
  scheduleNewPost: (data: CreatePostRequest, scheduledAt: Date) => Promise<SocialPost | null>;
  publishNow: (data: CreatePostRequest) => Promise<SocialPost | null>;

  // Filters
  setFilters: (filters: PostFilters) => void;
  clearFilters: () => void;

  // Helpers
  getPostById: (postId: string) => SocialPost | undefined;
  getPostsByStatus: (status: PostStatus) => SocialPost[];
  getPostsByDateRange: (startDate: Date, endDate: Date) => Promise<SocialPost[]>;
}

// ============================================================================
// Stale time (Guidelines §5.3 — query behaviour centralised)
// ============================================================================

const POSTS_STALE_TIME = 2 * 60 * 1000; // 2 minutes

// ============================================================================
// Hook
// ============================================================================

export function useSocialPosts(
  options: UseSocialPostsOptions = {},
): UseSocialPostsReturn {
  const { initialFilters = {}, fetchOnMount = true } = options;
  const queryClient = useQueryClient();

  // Filters are local UI state — changing them updates the query key and
  // React Query refetches automatically (Guidelines §11.1).
  const [filters, setFiltersRaw] = useState<PostFilters>(initialFilters);

  // ── Query: Posts list ─────────────────────────────────────────────────
  const postsQuery = useQuery({
    queryKey: socialMediaKeys.posts.list(filters),
    queryFn: async () => {
      const response = await postsApi.getAll(filters);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch posts');
    },
    enabled: fetchOnMount,
    staleTime: POSTS_STALE_TIME,
  });

  const posts: SocialPost[] = postsQuery.data ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────

  const invalidatePosts = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: socialMediaKeys.posts.all });
  }, [queryClient]);

  // Create
  const createMutation = useMutation({
    mutationFn: async (data: CreatePostRequest) => {
      const response = await postsApi.create(data);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to create post');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post created successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create post';
      toast.error(msg);
      console.error('Error creating post:', err);
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ postId, data }: { postId: string; data: UpdatePostRequest }) => {
      const response = await postsApi.update(postId, data);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to update post');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post updated successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update post';
      toast.error(msg);
      console.error('Error updating post:', err);
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await postsApi.delete(postId);
      if (response.success) return;
      throw new Error(response.error || 'Failed to delete post');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post deleted successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete post';
      toast.error(msg);
      console.error('Error deleting post:', err);
    },
  });

  // Schedule
  const scheduleMutation = useMutation({
    mutationFn: async ({ postId, scheduledAt }: { postId: string; scheduledAt: Date }) => {
      const response = await postsApi.schedule(postId, scheduledAt);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to schedule post');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post scheduled successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to schedule post';
      toast.error(msg);
      console.error('Error scheduling post:', err);
    },
  });

  // Publish
  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await postsApi.publish(postId);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to publish post');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post published successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to publish post';
      toast.error(msg);
      console.error('Error publishing post:', err);
    },
  });

  // Duplicate
  const duplicateMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await postsApi.duplicate(postId);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to duplicate post');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Post duplicated successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate post';
      toast.error(msg);
      console.error('Error duplicating post:', err);
    },
  });

  // Cancel Schedule
  const cancelScheduleMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await postsApi.cancelSchedule(postId);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to cancel schedule');
    },
    onSuccess: () => {
      invalidatePosts();
      toast.success('Schedule cancelled successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to cancel schedule';
      toast.error(msg);
      console.error('Error cancelling schedule:', err);
    },
  });

  // ── Backwards-compatible wrapper functions ────────────────────────────

  const fetchPosts = useCallback(
    async (newFilters?: PostFilters) => {
      if (newFilters) setFiltersRaw(newFilters);
      await queryClient.invalidateQueries({ queryKey: socialMediaKeys.posts.lists() });
    },
    [queryClient],
  );

  const createPost = useCallback(
    async (data: CreatePostRequest): Promise<SocialPost | null> => {
      try {
        return await createMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    [createMutation],
  );

  const updatePost = useCallback(
    async (postId: string, data: UpdatePostRequest): Promise<boolean> => {
      try {
        await updateMutation.mutateAsync({ postId, data });
        return true;
      } catch {
        return false;
      }
    },
    [updateMutation],
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

  const schedulePost = useCallback(
    async (postId: string, scheduledAt: Date): Promise<boolean> => {
      try {
        await scheduleMutation.mutateAsync({ postId, scheduledAt });
        return true;
      } catch {
        return false;
      }
    },
    [scheduleMutation],
  );

  const publishPost = useCallback(
    async (postId: string): Promise<boolean> => {
      try {
        await publishMutation.mutateAsync(postId);
        return true;
      } catch {
        return false;
      }
    },
    [publishMutation],
  );

  const duplicatePost = useCallback(
    async (postId: string): Promise<SocialPost | null> => {
      try {
        return await duplicateMutation.mutateAsync(postId);
      } catch {
        return null;
      }
    },
    [duplicateMutation],
  );

  const cancelSchedule = useCallback(
    async (postId: string): Promise<boolean> => {
      try {
        await cancelScheduleMutation.mutateAsync(postId);
        return true;
      } catch {
        return false;
      }
    },
    [cancelScheduleMutation],
  );

  // ── Quick create actions ──────────────────────────────────────────────

  const saveDraft = useCallback(
    async (data: CreatePostRequest): Promise<SocialPost | null> => createPost(data),
    [createPost],
  );

  const scheduleNewPost = useCallback(
    async (data: CreatePostRequest, scheduledAt: Date): Promise<SocialPost | null> => {
      const post = await createPost({ ...data, scheduledAt });
      if (post) {
        await schedulePost(post.id, scheduledAt);
      }
      return post;
    },
    [createPost, schedulePost],
  );

  const publishNow = useCallback(
    async (data: CreatePostRequest): Promise<SocialPost | null> => {
      const post = await createPost(data);
      if (post) {
        await publishPost(post.id);
      }
      return post;
    },
    [createPost, publishPost],
  );

  // ── Filter management ─────────────────────────────────────────────────

  const setFilters = useCallback(
    (newFilters: PostFilters) => setFiltersRaw(newFilters),
    [],
  );

  const clearFilters = useCallback(() => setFiltersRaw({}), []);

  // ── Helper functions ──────────────────────────────────────────────────

  const getPostById = useCallback(
    (postId: string): SocialPost | undefined => posts.find((p) => p.id === postId),
    [posts],
  );

  const getPostsByStatus = useCallback(
    (status: PostStatus): SocialPost[] => posts.filter((p) => p.status === status),
    [posts],
  );

  const getPostsByDateRange = useCallback(
    async (startDate: Date, endDate: Date): Promise<SocialPost[]> => {
      const response = await postsApi.getByDateRange(startDate, endDate);
      if (response.success && response.data) return response.data;
      return [];
    },
    [],
  );

  // ── Aggregate loading state ───────────────────────────────────────────

  const loading =
    postsQuery.isLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    scheduleMutation.isPending ||
    publishMutation.isPending ||
    duplicateMutation.isPending ||
    cancelScheduleMutation.isPending;

  const error = postsQuery.error
    ? postsQuery.error instanceof Error
      ? postsQuery.error.message
      : 'Failed to fetch posts'
    : null;

  // ── Return ────────────────────────────────────────────────────────────

  return {
    posts,
    loading,
    error,
    filters,

    // Actions
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    schedulePost,
    publishPost,
    duplicatePost,
    cancelSchedule,

    // Quick actions
    saveDraft,
    scheduleNewPost,
    publishNow,

    // Filters
    setFilters,
    clearFilters,

    // Helpers
    getPostById,
    getPostsByStatus,
    getPostsByDateRange,
  };
}