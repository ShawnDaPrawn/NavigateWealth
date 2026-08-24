/**
 * Analytics and reporting. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorUtils';
import type {
  SocialPost,
  SocialPlatform,
  // UTMParameters, // Unused import
} from '../types';
import { SOCIAL_MEDIA_BASE, getAuthHeaders, get, type APIResponse } from './apiBase';
import type { AnalyticsFilters, AnalyticsResponse } from './requests';

export const analyticsApi = {
  /**
   * Get overall social media analytics
   */
  async getOverview(filters?: AnalyticsFilters): Promise<APIResponse<AnalyticsResponse>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.profiles) {
        filters.profiles.forEach((p) => params.append('profile', p));
      }
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.campaign) params.append('campaign', filters.campaign);
    }

    const queryString = params.toString();
    const url = queryString
      ? `${SOCIAL_MEDIA_BASE}/analytics?${queryString}`
      : `${SOCIAL_MEDIA_BASE}/analytics`;

    return get<AnalyticsResponse>(url);
  },

  /**
   * Get analytics by platform
   */
  async getByPlatform(
    platform: SocialPlatform,
    filters?: AnalyticsFilters,
  ): Promise<APIResponse<AnalyticsResponse>> {
    const params = new URLSearchParams();
    params.append('platform', platform);

    if (filters) {
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.campaign) params.append('campaign', filters.campaign);
    }

    return get<AnalyticsResponse>(`${SOCIAL_MEDIA_BASE}/analytics/platform?${params.toString()}`);
  },

  /**
   * Get top performing posts
   */
  async getTopPosts(limit: number = 10): Promise<APIResponse<SocialPost[]>> {
    return get<SocialPost[]>(`${SOCIAL_MEDIA_BASE}/analytics/top-posts?limit=${limit}`);
  },

  /**
   * Export analytics data
   */
  async export(
    filters?: AnalyticsFilters,
    format: 'csv' | 'json' = 'csv',
  ): Promise<APIResponse<Blob>> {
    const params = new URLSearchParams();
    params.append('format', format);

    if (filters) {
      if (filters.profiles) {
        filters.profiles.forEach((p) => params.append('profile', p));
      }
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.campaign) params.append('campaign', filters.campaign);
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_BASE}/analytics/export?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Export failed: ${response.statusText}`,
        };
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    } catch (error) {
      logger.error('Export failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Export failed',
      };
    }
  },
};

// ============================================================================
// Media API
// ============================================================================
