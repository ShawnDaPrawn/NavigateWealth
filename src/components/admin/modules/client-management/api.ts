import { api, APIError } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { GetClientsResponse, UpdateClientMetadataResponse, GetClientProfileResponse, ProfileData, CleanupResult, KvCleanupResult } from './types';
import { ENDPOINTS } from './constants';
import { ClientKeysResponse } from './hooks/useClientKeys';
import { ALL_PRODUCT_KEYS } from '../product-management/keyManagerConstants';
import type { ProductKey } from '../product-management/types';

// ── Key registry lookup map ──────────────────────────────────────────────────
// Built once at module load from the canonical key definitions.
// Used by getClientKeys to resolve proper name, dataType, category, and
// isCalculated flag instead of naive string parsing.
const KEY_REGISTRY: Record<string, ProductKey> = {};
for (const key of ALL_PRODUCT_KEYS) {
  KEY_REGISTRY[key.id] = key;
}

export const clientApi = {
  /**
   * Fetch all clients (users)
   * Supports optional pagination via page/perPage query params.
   * When omitted, the server returns the full unpaginated list.
   */
  getClients: async (params?: { page?: number; perPage?: number }): Promise<GetClientsResponse> => {
    try {
      let endpoint = ENDPOINTS.ALL_USERS;
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
      return await api.get<GetClientProfileResponse>(`${ENDPOINTS.PERSONAL_INFO}?key=${encodeURIComponent(profileKey)}`);
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
  updateClientMetadata: async (userId: string, metadata: Record<string, unknown>): Promise<UpdateClientMetadataResponse> => {
    try {
      return await api.put<UpdateClientMetadataResponse>(ENDPOINTS.USER_METADATA(userId), { metadata });
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
    await new Promise(resolve => setTimeout(resolve, 3000));
    return true;
  },

  /**
   * Fetch client key values from KV store
   */
  getClientKeys: async (userId: string): Promise<ClientKeysResponse> => {
    try {
      const clientKeysKey = `user_profile:${userId}:client_keys`;
      const response = await api.get<{ value: Record<string, number | string | boolean | null> }>(`/kv-store/${encodeURIComponent(clientKeysKey)}`);
      
      // Transform KV response into structured key data
      const keyValues = response.value || {};
      
      // TODO: Fetch contributing policies from policy management
      // This is a placeholder implementation
      const keys = Object.entries(keyValues).map(([keyId, value]) => {
        // ── Primary path: look up from the canonical key registry ───────
        const keyDef = KEY_REGISTRY[keyId];
        if (keyDef) {
          return {
            keyId,
            name: keyDef.name,
            value,
            dataType: keyDef.dataType,
            category: keyDef.category,
            isCalculated: keyDef.isCalculated ?? false,
            lastUpdated: new Date().toISOString(),
            contributingPolicies: []
          };
        }

        // ── Fallback: key not in registry (custom/dynamic keys) ─────────
        // Infer dataType from the JS value type, category from the key ID.
        logger.warn('Key not found in registry, using fallback inference', { keyId });
        let dataType: string = 'text';
        if (typeof value === 'number') dataType = 'currency';
        if (typeof value === 'boolean') dataType = 'boolean';

        // For category, try progressively longer prefixes to handle
        // compound names like "medical_aid", "retirement_pre", "invest_voluntary"
        const parts = keyId.split('_');
        let category = parts[0];
        // Check 2-word prefix (e.g., medical_aid, retirement_pre, invest_voluntary, estate_planning, employee_benefits)
        if (parts.length >= 2) {
          const twoWordPrefix = `${parts[0]}_${parts[1]}`;
          // Use the 2-word prefix if it looks like a known category pattern
          if (['medical_aid', 'retirement_pre', 'retirement_post', 'invest_voluntary', 'invest_guaranteed',
               'employee_benefits', 'estate_planning', 'post_retirement',
               'profile_personal', 'profile_contact', 'profile_identity', 'profile_address',
               'profile_employment', 'profile_health', 'profile_family', 'profile_banking',
               'profile_risk', 'profile_financial'].includes(twoWordPrefix)) {
            category = twoWordPrefix;
          }
        }

        return {
          keyId,
          name: keyId.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          value,
          dataType,
          category,
          isCalculated: keyId.includes('_total') || keyId.includes('_recommended'),
          lastUpdated: new Date().toISOString(),
          contributingPolicies: []
        };
      });

      return {
        keys,
        lastCalculated: new Date().toISOString(),
        totalCategories: new Set(keys.map(k => k.category)).size
      };
    } catch (error: unknown) {
      // If the key doesn't exist (404), return empty data instead of throwing
      // Check for 404 status in the error object or message
      const err = error as { status?: number; statusCode?: number; message?: string };
      if (err?.status === 404 || err?.statusCode === 404 || err?.message?.includes('404')) {
        logger.info('Client keys not found (first time setup)', { userId });
        return {
          keys: [],
          lastCalculated: new Date().toISOString(),
          totalCategories: 0
        };
      }
      
      logger.error('Failed to fetch client keys', error, { userId });
      // Only throw if it's a real error, not just "not found"
      throw error;
    }
  },

  /**
   * Trigger recalculation of client key totals
   */
  recalculateClientKeys: async (userId: string): Promise<{ success: boolean }> => {
    try {
      const response = await api.post<{ success: boolean }>('/integrations/recalculate-totals', { clientId: userId });
      logger.info('Client keys recalculated', { userId });
      return response;
    } catch (error) {
      logger.error('Failed to recalculate client keys', error, { userId });
      throw error;
    }
  },

  /**
   * Get key history/audit trail
   */
  getClientKeyHistory: async (userId: string, keyId: string): Promise<{ history: Array<{ timestamp: string; value: number; changedBy: string }> }> => {
    try {
      // TODO: Implement actual history tracking
      // For now, return mock data
      logger.info('Fetching client key history', { userId, keyId });
      return {
        history: [
          {
            timestamp: new Date().toISOString(),
            value: 1000000,
            changedBy: 'System (Auto-calculation)'
          }
        ]
      };
    } catch (error) {
      logger.error('Failed to fetch client key history', error, { userId, keyId });
      throw error;
    }
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

// Export individual functions for convenience
export const {
  getClients,
  fetchClientProfile,
  updateClientProfile,
  updateClientMetadata,
  runSanctionsScreening,
  getClientKeys,
  recalculateClientKeys,
  getClientKeyHistory,
  runCleanup,
  runKvCleanup
} = clientApi;