/**
 * Client keys — data access.
 *
 * Moved verbatim out of client-management/api.ts. These three calls were the
 * only part of that module's API surface that other feature modules used, and
 * reaching them meant importing client-management's internals from
 * risk-planning-fna and medical-fna. They are about the client-keys KV store,
 * not about managing clients, so they belong here.
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { ALL_PRODUCT_KEYS } from '../product-management';
import type { ProductKey } from '../product-management';
import type { ClientKeysResponse } from './types';

// ── Key registry lookup map ──────────────────────────────────────────────────
// Built once at module load from the canonical key definitions.
// Used by getClientKeys to resolve proper name, dataType, category, and
// isCalculated flag instead of naive string parsing.
const KEY_REGISTRY: Record<string, ProductKey> = {};
for (const key of ALL_PRODUCT_KEYS) {
  KEY_REGISTRY[key.id] = key;
}

export const clientKeysApi = {
  /**
   * Fetch client key values from KV store
   */
  getClientKeys: async (userId: string): Promise<ClientKeysResponse> => {
    try {
      const clientKeysKey = `user_profile:${userId}:client_keys`;
      const response = await api.get<{ value: Record<string, number | string | boolean | null> }>(
        `/kv-store/${encodeURIComponent(clientKeysKey)}`,
      );

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
            contributingPolicies: [],
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
          if (
            [
              'medical_aid',
              'retirement_pre',
              'retirement_post',
              'invest_voluntary',
              'invest_guaranteed',
              'employee_benefits',
              'estate_planning',
              'post_retirement',
              'profile_personal',
              'profile_contact',
              'profile_identity',
              'profile_address',
              'profile_employment',
              'profile_health',
              'profile_family',
              'profile_banking',
              'profile_risk',
              'profile_financial',
            ].includes(twoWordPrefix)
          ) {
            category = twoWordPrefix;
          }
        }

        return {
          keyId,
          name: keyId
            .split('_')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          value,
          dataType: dataType as 'currency' | 'number' | 'percentage' | 'text' | 'date' | 'boolean',
          category,
          isCalculated: keyId.includes('_total') || keyId.includes('_recommended'),
          lastUpdated: new Date().toISOString(),
          contributingPolicies: [],
        };
      });

      return {
        keys,
        lastCalculated: new Date().toISOString(),
        totalCategories: new Set(keys.map((k) => k.category)).size,
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
          totalCategories: 0,
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
      const response = await api.post<{ success: boolean }>('/integrations/recalculate-totals', {
        clientId: userId,
      });
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
  getClientKeyHistory: async (
    userId: string,
    keyId: string,
  ): Promise<{ history: Array<{ timestamp: string; value: number; changedBy: string }> }> => {
    try {
      // TODO: Implement actual history tracking
      // For now, return mock data
      logger.info('Fetching client key history', { userId, keyId });
      return {
        history: [
          {
            timestamp: new Date().toISOString(),
            value: 1000000,
            changedBy: 'System (Auto-calculation)',
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to fetch client key history', error, { userId, keyId });
      throw error;
    }
  },
};
