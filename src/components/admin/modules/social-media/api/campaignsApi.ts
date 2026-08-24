/**
 * Campaign management. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import type {
  SocialPost,
  Campaign,
  // UTMParameters, // Unused import
} from '../types';
import { SOCIAL_MEDIA_BASE, get, post, put, del, type APIResponse } from './apiBase';
import type { CreateCampaignRequest, UpdateCampaignRequest, AnalyticsResponse } from './requests';

export const campaignsApi = {
  /**
   * Get all campaigns
   */
  async getAll(): Promise<APIResponse<Campaign[]>> {
    return get<Campaign[]>(`${SOCIAL_MEDIA_BASE}/campaigns`);
  },

  /**
   * Get a specific campaign by ID
   */
  async getById(campaignId: string): Promise<APIResponse<Campaign>> {
    return get<Campaign>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}`);
  },

  /**
   * Create a new campaign
   */
  async create(data: CreateCampaignRequest): Promise<APIResponse<Campaign>> {
    return post<Campaign>(`${SOCIAL_MEDIA_BASE}/campaigns`, data);
  },

  /**
   * Update an existing campaign
   */
  async update(campaignId: string, data: UpdateCampaignRequest): Promise<APIResponse<Campaign>> {
    return put<Campaign>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}`, data);
  },

  /**
   * Delete a campaign
   */
  async delete(campaignId: string): Promise<APIResponse<void>> {
    return del<void>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}`);
  },

  /**
   * Get posts associated with a campaign
   */
  async getPosts(campaignId: string): Promise<APIResponse<SocialPost[]>> {
    return get<SocialPost[]>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}/posts`);
  },

  /**
   * Get analytics for a campaign
   */
  async getAnalytics(campaignId: string): Promise<APIResponse<AnalyticsResponse>> {
    return get<AnalyticsResponse>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}/analytics`);
  },

  /**
   * Add posts to a campaign
   */
  async addPosts(campaignId: string, postIds: string[]): Promise<APIResponse<Campaign>> {
    return post<Campaign>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}/posts`, { postIds });
  },

  /**
   * Remove posts from a campaign
   */
  async removePosts(campaignId: string, postIds: string[]): Promise<APIResponse<Campaign>> {
    return del<Campaign>(
      `${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}/posts?ids=${postIds.join(',')}`,
    );
  },
};

// ============================================================================
// Analytics API
// ============================================================================
