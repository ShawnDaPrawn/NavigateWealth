/**
 * Client Communication Hooks — Preferences
 *
 * React Query hooks for communication preferences.
 * Guidelines refs: §6 (hooks as only API consumers), §11.2 (React Query only)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { communicationKeys } from './queryKeys';
import * as commApi from '../api';
import { DEFAULT_PREFERENCES } from '../constants';
import type { CommunicationSettings } from '../types';

/**
 * Fetch the current user's communication preferences.
 * Falls back to defaults when no saved preferences exist.
 */
export function useCommunicationPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: communicationKeys.preferences(user?.id),
    queryFn: async () => {
      const prefs = await commApi.fetchPreferences();
      return prefs ?? DEFAULT_PREFERENCES;
    },
    enabled: !!user,
  });
}

/**
 * Mutation: persist updated communication preferences.
 * Invalidates the preferences query on success.
 */
export function useUpdatePreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: CommunicationSettings) =>
      commApi.updatePreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: communicationKeys.preferences(user?.id),
      });
    },
  });
}
