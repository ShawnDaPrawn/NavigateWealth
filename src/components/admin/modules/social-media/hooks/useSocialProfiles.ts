/**
 * useSocialProfiles Hook
 *
 * The Buffer channels the practice publishes to, as `SocialProfile`s. Read-only
 * by design: connecting or reconnecting a network is done in Buffer, and the
 * Channels panel links there. (React Query per Guidelines §6, §11.2.)
 *
 * @module social-media/hooks/useSocialProfiles
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '../api';
import type { BufferStatus, SocialProfile, SocialPlatform } from '../types';
import { socialMediaKeys } from './queryKeys';

interface UseSocialProfilesOptions {
  /** Whether to fetch on mount (maps to React Query `enabled`). */
  fetchOnMount?: boolean;
}

interface UseSocialProfilesReturn {
  profiles: SocialProfile[];
  connectedProfiles: SocialProfile[];
  loading: boolean;
  error: string | null;
  fetchProfiles: () => Promise<void>;
  getProfileById: (profileId: string) => SocialProfile | undefined;
  getProfilesByPlatform: (platform: SocialPlatform) => SocialProfile[];
  isConnected: (platform: SocialPlatform) => boolean;
}

const PROFILES_STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useSocialProfiles(options: UseSocialProfilesOptions = {}): UseSocialProfilesReturn {
  const { fetchOnMount = true } = options;
  const queryClient = useQueryClient();

  const profilesQuery = useQuery({
    queryKey: socialMediaKeys.profiles.lists(),
    queryFn: () => profilesApi.getAll(),
    enabled: fetchOnMount,
    staleTime: PROFILES_STALE_TIME,
  });

  const profiles: SocialProfile[] = useMemo(() => profilesQuery.data ?? [], [profilesQuery.data]);
  const connectedProfiles = useMemo(() => profiles.filter((p) => p.isConnected), [profiles]);

  const fetchProfiles = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: socialMediaKeys.profiles.lists() });
  }, [queryClient]);

  const getProfileById = useCallback(
    (profileId: string) => profiles.find((p) => p.id === profileId),
    [profiles],
  );

  const getProfilesByPlatform = useCallback(
    (platform: SocialPlatform) => profiles.filter((p) => p.platform === platform),
    [profiles],
  );

  const isConnected = useCallback(
    (platform: SocialPlatform) => profiles.some((p) => p.platform === platform && p.isConnected),
    [profiles],
  );

  const error = profilesQuery.error
    ? profilesQuery.error instanceof Error
      ? profilesQuery.error.message
      : 'Failed to fetch channels'
    : null;

  return {
    profiles,
    connectedProfiles,
    loading: profilesQuery.isLoading,
    error,
    fetchProfiles,
    getProfileById,
    getProfilesByPlatform,
    isConnected,
  };
}

/** Whether the Edge Function can reach Buffer (drives the Channels panel banner). */
export function useBufferStatus(enabled = true) {
  return useQuery<BufferStatus>({
    queryKey: socialMediaKeys.profiles.status(),
    queryFn: () => profilesApi.getStatus(),
    enabled,
    staleTime: PROFILES_STALE_TIME,
  });
}
