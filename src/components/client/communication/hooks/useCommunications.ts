/**
 * Client Communication Hooks — Inbox
 *
 * React Query hooks for inbox data access.
 * Guidelines refs: §6 (hooks as only API consumers), §11.2 (React Query only)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { communicationKeys } from './queryKeys';
import * as commApi from '../api';

/**
 * Fetch the current user's inbox.
 * Returns empty array on non-auth errors to prevent blank screens.
 */
export function useCommunications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: communicationKeys.byUser(user?.id),
    queryFn: async () => {
      try {
        return await commApi.fetchInbox();
      } catch (error) {
        // Re-throw auth errors so React Query can handle retries properly.
        if (error instanceof Error && 'statusCode' in error && (error as Record<string, unknown>).statusCode === 401) {
          throw error;
        }
        console.warn('Failed to fetch communications, returning empty list:', error);
        return [];
      }
    },
    enabled: !!user,
    retry: (failureCount, error) => {
      if (error instanceof Error && 'statusCode' in error && (error as Record<string, unknown>).statusCode === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Mutation: mark a single message as read.
 * Invalidates the inbox query on success.
 */
export function useMarkAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: commApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communicationKeys.byUser(user?.id) });
    },
  });
}
