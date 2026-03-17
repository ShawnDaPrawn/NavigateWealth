/**
 * useSocialProfiles Hook
 *
 * React Query-based hook for managing social media profiles including:
 * - Fetching profiles (useQuery)
 * - Connecting/disconnecting platforms (useMutation)
 * - Syncing profile data
 * - Profile CRUD operations
 *
 * Migrated from manual useState/useEffect to React Query per Guidelines §6, §11.2.
 *
 * @module social-media/hooks/useSocialProfiles
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profilesApi, type ConnectProfileRequest, type UpdateProfileRequest } from '../api';
import type { SocialProfile, SocialPlatform } from '../types';
import { toast } from 'sonner@2.0.3';
import { socialMediaKeys } from './queryKeys';

// ============================================================================
// Options & Return Types
// ============================================================================

interface UseSocialProfilesOptions {
  /**
   * Whether to fetch profiles on mount.
   * Maps to React Query `enabled`.
   * @default true
   */
  fetchOnMount?: boolean;
}

interface UseSocialProfilesReturn {
  profiles: SocialProfile[];
  connectedProfiles: SocialProfile[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchProfiles: () => Promise<void>;
  connectProfile: (data: ConnectProfileRequest) => Promise<SocialProfile | null>;
  disconnectProfile: (profileId: string) => Promise<boolean>;
  updateProfile: (profileId: string, data: UpdateProfileRequest) => Promise<boolean>;
  syncProfile: (profileId: string) => Promise<boolean>;
  deleteProfile: (profileId: string) => Promise<boolean>;

  // Helpers
  getProfileById: (profileId: string) => SocialProfile | undefined;
  getProfilesByPlatform: (platform: SocialPlatform) => SocialProfile[];
  isConnected: (platform: SocialPlatform) => boolean;
}

// ============================================================================
// Stale time (Guidelines §5.3 — query behaviour centralised)
// ============================================================================

const PROFILES_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Hook
// ============================================================================

export function useSocialProfiles(
  options: UseSocialProfilesOptions = {},
): UseSocialProfilesReturn {
  const { fetchOnMount = true } = options;
  const queryClient = useQueryClient();

  // ── Query: Profiles list ──────────────────────────────────────────────
  const profilesQuery = useQuery({
    queryKey: socialMediaKeys.profiles.lists(),
    queryFn: async () => {
      const response = await profilesApi.getAll();
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fetch profiles');
    },
    enabled: fetchOnMount,
    staleTime: PROFILES_STALE_TIME,
  });

  const profiles: SocialProfile[] = profilesQuery.data ?? [];

  // ── Derived state ─────────────────────────────────────────────────────
  const connectedProfiles = useMemo(
    () => profiles.filter((p) => p.isConnected),
    [profiles],
  );

  // ── Mutations ─────────────────────────────────────────────────────────

  const invalidateProfiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: socialMediaKeys.profiles.all });
  }, [queryClient]);

  // Connect
  const connectMutation = useMutation({
    mutationFn: async (data: ConnectProfileRequest) => {
      const response = await profilesApi.connect(data);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to connect profile');
    },
    onSuccess: (_data, variables) => {
      invalidateProfiles();
      toast.success(`${variables.platform} profile connected successfully`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to connect profile';
      toast.error(msg);
      console.error('Error connecting profile:', err);
    },
  });

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await profilesApi.disconnect(profileId);
      if (response.success) return;
      throw new Error(response.error || 'Failed to disconnect profile');
    },
    onSuccess: () => {
      invalidateProfiles();
      toast.success('Profile disconnected successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect profile';
      toast.error(msg);
      console.error('Error disconnecting profile:', err);
    },
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ profileId, data }: { profileId: string; data: UpdateProfileRequest }) => {
      const response = await profilesApi.update(profileId, data);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to update profile');
    },
    onSuccess: () => {
      invalidateProfiles();
      toast.success('Profile updated successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      toast.error(msg);
      console.error('Error updating profile:', err);
    },
  });

  // Sync
  const syncMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await profilesApi.sync(profileId);
      if (response.success && response.data) return response.data;
      throw new Error(response.error || 'Failed to sync profile');
    },
    onSuccess: () => {
      invalidateProfiles();
      toast.success('Profile synced successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to sync profile';
      toast.error(msg);
      console.error('Error syncing profile:', err);
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await profilesApi.delete(profileId);
      if (response.success) return;
      throw new Error(response.error || 'Failed to delete profile');
    },
    onSuccess: () => {
      invalidateProfiles();
      toast.success('Profile deleted successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete profile';
      toast.error(msg);
      console.error('Error deleting profile:', err);
    },
  });

  // ── Backwards-compatible wrapper functions ────────────────────────────

  const fetchProfiles = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: socialMediaKeys.profiles.lists() });
  }, [queryClient]);

  const connectProfile = useCallback(
    async (data: ConnectProfileRequest): Promise<SocialProfile | null> => {
      try {
        return await connectMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    [connectMutation],
  );

  const disconnectProfile = useCallback(
    async (profileId: string): Promise<boolean> => {
      try {
        await disconnectMutation.mutateAsync(profileId);
        return true;
      } catch {
        return false;
      }
    },
    [disconnectMutation],
  );

  const updateProfile = useCallback(
    async (profileId: string, data: UpdateProfileRequest): Promise<boolean> => {
      try {
        await updateMutation.mutateAsync({ profileId, data });
        return true;
      } catch {
        return false;
      }
    },
    [updateMutation],
  );

  const syncProfile = useCallback(
    async (profileId: string): Promise<boolean> => {
      try {
        await syncMutation.mutateAsync(profileId);
        return true;
      } catch {
        return false;
      }
    },
    [syncMutation],
  );

  const deleteProfile = useCallback(
    async (profileId: string): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(profileId);
        return true;
      } catch {
        return false;
      }
    },
    [deleteMutation],
  );

  // ── Helper functions ──────────────────────────────────────────────────

  const getProfileById = useCallback(
    (profileId: string): SocialProfile | undefined => profiles.find((p) => p.id === profileId),
    [profiles],
  );

  const getProfilesByPlatform = useCallback(
    (platform: SocialPlatform): SocialProfile[] => profiles.filter((p) => p.platform === platform),
    [profiles],
  );

  const isConnected = useCallback(
    (platform: SocialPlatform): boolean =>
      profiles.some((p) => p.platform === platform && p.isConnected),
    [profiles],
  );

  // ── Aggregate loading state ───────────────────────────────────────────

  const loading =
    profilesQuery.isLoading ||
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    updateMutation.isPending ||
    syncMutation.isPending ||
    deleteMutation.isPending;

  const error = profilesQuery.error
    ? profilesQuery.error instanceof Error
      ? profilesQuery.error.message
      : 'Failed to fetch profiles'
    : null;

  // ── Return ────────────────────────────────────────────────────────────

  return {
    profiles,
    connectedProfiles,
    loading,
    error,

    // Actions
    fetchProfiles,
    connectProfile,
    disconnectProfile,
    updateProfile,
    syncProfile,
    deleteProfile,

    // Helpers
    getProfileById,
    getProfilesByPlatform,
    isConnected,
  };
}