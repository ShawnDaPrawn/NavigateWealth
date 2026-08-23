/**
 * Stats, first-run initialization, and module settings.
 *
 * Split out of `api.ts` (1,441 lines); `api.ts` still re-exports every group,
 * because consumers import the aggregate from there.
 */
import type {
  Category,
  ContentType,
  PublicationStats,
  InitializationStatus,
  InitializePublicationsInput,
} from '../types';
import { BASE_URL, getAuthHeaders, handleResponse, headers } from './shared';

// ============================================================================
// STATISTICS API
// ============================================================================

/**
 * Statistics API namespace
 * Analytics and statistics for publications
 */
export const StatsAPI = {
  /**
   * Get publication statistics
   *
   * @returns Publication stats
   *
   * @example
   * ```typescript
   * const stats = await StatsAPI.getStats();
   * console.log(`Total articles: ${stats.total}`);
   * ```
   */
  async getStats(): Promise<PublicationStats> {
    const response = await fetch(`${BASE_URL}/stats`, { headers: await getAuthHeaders() });
    return handleResponse<PublicationStats>(response);
  },
};

// ============================================================================
// INITIALIZATION API
// ============================================================================

/**
 * Initialization API namespace
 * Check and initialize the publications system
 */
export const InitializationAPI = {
  /**
   * Check if publications is initialized
   *
   * @returns Initialization status
   *
   * @example
   * ```typescript
   * const status = await InitializationAPI.checkStatus();
   * if (!status.is_initialized) {
   *   await InitializationAPI.initialize();
   * }
   * ```
   */
  async checkStatus(): Promise<InitializationStatus> {
    try {
      const categoriesResponse = await fetch(`${BASE_URL}/categories`, { headers });
      const categories = await handleResponse<Category[]>(categoriesResponse);

      const typesResponse = await fetch(`${BASE_URL}/types`, { headers });
      const types = await handleResponse<ContentType[]>(typesResponse);

      return {
        is_initialized: categories.length > 0 && types.length > 0,
        has_categories: categories.length > 0,
        has_types: types.length > 0,
      };
    } catch {
      return {
        is_initialized: false,
        has_categories: false,
        has_types: false,
      };
    }
  },

  /**
   * Initialize publications with default data
   *
   * @param input - Initialization options
   * @returns Success response
   *
   * @example
   * ```typescript
   * await InitializationAPI.initialize({
   *   create_default_categories: true,
   *   create_default_types: true,
   * });
   * ```
   */
  async initialize(input: InitializePublicationsInput = {}): Promise<{ success: boolean }> {
    const response = await fetch(`${BASE_URL}/initialize`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<{ success: boolean }>(response);
  },
};

// ============================================================================
// SETTINGS API
// ============================================================================

/**
 * Settings API namespace
 * Configuration and maintenance operations
 */
export const SettingsAPI = {
  /**
   * Export all data
   */
  async exportData(): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/export`, { headers: await getAuthHeaders() });
    return handleResponse(response);
  },

  /**
   * Import data
   */
  async importData(data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/import`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  /**
   * Clear all drafts
   */
  async clearDrafts(): Promise<{ message: string }> {
    const response = await fetch(`${BASE_URL}/maintenance/clear-drafts`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    return handleResponse(response);
  },
};
