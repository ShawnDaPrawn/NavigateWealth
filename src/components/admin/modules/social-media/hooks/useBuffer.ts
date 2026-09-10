/**
 * useBuffer — React Query hook for the Buffer GraphQL proxy.
 *
 * @module social-media/hooks/useBuffer
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { bufferApi, type CreateBufferPostRequest } from '../api/bufferApi';
import { socialMediaKeys } from './queryKeys';

const BUFFER_STALE_TIME = 60 * 1000;

function unwrapError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useBuffer() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: socialMediaKeys.buffer.all });

  const statusQuery = useQuery({
    queryKey: socialMediaKeys.buffer.status(),
    queryFn: async () => {
      const response = await bufferApi.getStatus();
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to load Buffer status');
    },
    staleTime: BUFFER_STALE_TIME,
  });

  const connected = Boolean(statusQuery.data?.connected);

  const channelsQuery = useQuery({
    queryKey: socialMediaKeys.buffer.channels(),
    queryFn: async () => {
      const response = await bufferApi.listChannels();
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to load Buffer channels');
    },
    enabled: connected,
    staleTime: BUFFER_STALE_TIME,
  });

  const postsQuery = useQuery({
    queryKey: socialMediaKeys.buffer.posts(),
    queryFn: async () => {
      const response = await bufferApi.listPosts();
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to load Buffer queue');
    },
    enabled: connected,
    staleTime: BUFFER_STALE_TIME,
  });

  const connectMutation = useMutation({
    mutationFn: async ({ apiKey, organizationId }: { apiKey: string; organizationId?: string }) => {
      const response = await bufferApi.connect(apiKey, organizationId);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to connect Buffer');
    },
    onSuccess: () => {
      invalidate();
      toast.success('Buffer connected');
    },
    onError: (error: unknown) => {
      toast.error(unwrapError(error, 'Failed to connect Buffer'));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await bufferApi.disconnect();
      if (response.success) return;
      throw new Error(response.error || 'Failed to disconnect Buffer');
    },
    onSuccess: () => {
      invalidate();
      toast.success('Buffer disconnected');
    },
    onError: (error: unknown) => {
      toast.error(unwrapError(error, 'Failed to disconnect Buffer'));
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (input: CreateBufferPostRequest) => {
      const response = await bufferApi.createPost(input);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to create Buffer post');
    },
    onSuccess: (results) => {
      invalidate();
      const count = results.length;
      toast.success(
        count === 1 ? 'Post sent to Buffer' : `Post sent to Buffer (${count} channels)`,
      );
    },
    onError: (error: unknown) => {
      toast.error(unwrapError(error, 'Failed to create Buffer post'));
    },
  });

  return {
    status: statusQuery.data ?? null,
    statusLoading: statusQuery.isLoading,
    channels: channelsQuery.data ?? [],
    channelsLoading: channelsQuery.isLoading,
    posts: postsQuery.data ?? [],
    postsLoading: postsQuery.isLoading,
    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    createPost: createPostMutation.mutateAsync,
    isCreating: createPostMutation.isPending,
    refresh: invalidate,
  };
}
