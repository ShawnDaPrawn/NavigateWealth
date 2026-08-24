import { api, APIError } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import {
  GetClientsResponse,
  UpdateClientMetadataResponse,
  GetClientProfileResponse,
  ProfileData,
  CleanupResult,
  KvCleanupResult,
} from './types';
import { ENDPOINTS } from './constants';
import { clientKeys } from '../../../../utils/queryKeys';

export const clientApi = {
  /**
   * Fetch all clients (users)
   * Supports optional pagination via page/perPage query params.
   * When omitted, the server returns the full unpaginated list.
   */
  getClients: async (params?: { page?: number; perPage?: number }): Promise<GetClientsResponse> => {
    try {
      let endpoint: string = ENDPOINTS.ALL_USERS;
      if (params?.page || params?.perPage) {
        const qs = new URLSearchParams();
        if (params.page) qs.set('page', String(params.page));
        if (params.perPage) qs.set('perPage', String(params.perPage));
        endpoint = `${endpoint}?${qs.toString()}`;
      }
      return await api.get<GetClientsResponse>(endpoint);
    } catch (error) {
      logger.error('Failed to fetch clients', error);
      throw error;
    }
  },

  /**
   * Fetch client personal profile
   * Returns { success: false, data: null } for clients without a profile (404).
   * This is a valid state — not all clients have profiles yet.
   */
  fetchClientProfile: async (userId: string): Promise<GetClientProfileResponse> => {
    try {
      const profileKey = `user_profile:${userId}:personal_info`;
      return await api.get<GetClientProfileResponse>(
        `${ENDPOINTS.PERSONAL_INFO}?key=${encodeURIComponent(profileKey)}`,
      );
    } catch (error) {
      // 404 is expected for clients without a profile — return empty response
      if (error instanceof APIError && error.statusCode === 404) {
        return { success: false, data: null as unknown as ProfileData };
      }
      logger.error('Failed to fetch client profile', error, { userId });
      throw error;
    }
  },

  /**
   * Update client personal profile
   */
  updateClientProfile: async (userId: string, data: ProfileData): Promise<void> => {
    try {
      const profileKey = `user_profile:${userId}:personal_info`;
      await api.post(ENDPOINTS.PERSONAL_INFO, { key: profileKey, data });
    } catch (error) {
      logger.error('Failed to update client profile', error, { userId });
      throw error;
    }
  },

  /**
   * Update client metadata
   */
  updateClientMetadata: async (
    userId: string,
    metadata: Record<string, unknown>,
  ): Promise<UpdateClientMetadataResponse> => {
    try {
      return await api.put<UpdateClientMetadataResponse>(ENDPOINTS.USER_METADATA(userId), {
        metadata,
      });
    } catch (error) {
      logger.error('Failed to update client metadata', error, { userId });
      throw error;
    }
  },

  /**
   * Run sanctions screening (mock)
   */
  runSanctionsScreening: async (userId: string): Promise<boolean> => {
    logger.info('Running sanctions screening...', { userId });
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return true;
  },

  /**
   * Run client data cleanup / maintenance job.
   * Reconciles orphaned profiles, backfills missing accountStatus values.
   */
  runCleanup: async (dryRun: boolean = false): Promise<CleanupResult> => {
    try {
      logger.info('Running client cleanup', { dryRun });
      return await api.post<CleanupResult>(ENDPOINTS.CLIENT_CLEANUP, { dryRun });
    } catch (error) {
      logger.error('Failed to run client cleanup', error);
      throw error;
    }
  },

  /**
   * Run KV store cleanup / maintenance job.
   * Reconciles orphaned keys, backfills missing values.
   */
  runKvCleanup: async (dryRun: boolean = false): Promise<KvCleanupResult> => {
    try {
      logger.info('Running KV store cleanup', { dryRun });
      return await api.post<KvCleanupResult>(ENDPOINTS.KV_CLEANUP, { dryRun });
    } catch (error) {
      logger.error('Failed to run KV store cleanup', error);
      throw error;
    }
  },
};

export const CLIENT_PROFILE_STALE_TIME = 5 * 60 * 1000;

export function getClientProfileQueryOptions(userId: string) {
  return {
    queryKey: clientKeys.profile(userId),
    queryFn: async (): Promise<ProfileData | null> => {
      const result = await clientApi.fetchClientProfile(userId);
      return result.success && result.data ? result.data : null;
    },
    staleTime: CLIENT_PROFILE_STALE_TIME,
  };
}

// Export individual functions for convenience
export const {
  getClients,
  fetchClientProfile,
  updateClientProfile,
  updateClientMetadata,
  runSanctionsScreening,
  runCleanup,
  runKvCleanup,
} = clientApi;
