/**
 * Post management: create, schedule, publish. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import type {
  SocialPost,
  PostAnalytics,
  // UTMParameters, // Unused import
} from '../types';
import { SOCIAL_MEDIA_BASE, get, post, put, del, type APIResponse } from './apiBase';
import type { CreatePostRequest, UpdatePostRequest, PostFilters } from './requests';

export const postsApi = {
  /**
   * Get all posts with optional filters
   */
  async getAll(filters?: PostFilters): Promise<APIResponse<SocialPost[]>> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        statuses.forEach((s) => params.append('status', s));
      }
      if (filters.profiles) {
        filters.profiles.forEach((p) => params.append('profile', p));
      }
      if (filters.campaign) params.append('campaign', filters.campaign);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.tags) {
        filters.tags.forEach((t) => params.append('tag', t));
      }
    }

    const queryString = params.toString();
    const url = queryString
      ? `${SOCIAL_MEDIA_BASE}/posts?${queryString}`
      : `${SOCIAL_MEDIA_BASE}/posts`;

    return get<SocialPost[]>(url);
  },

  /**
   * Get a specific post by ID
   */
  async getById(postId: string): Promise<APIResponse<SocialPost>> {
    return get<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts/${postId}`);
  },

  /**
   * Create a new post (saves as draft by default)
   */
  async create(data: CreatePostRequest): Promise<APIResponse<SocialPost>> {
    return post<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts`, data);
  },

  /**
   * Update an existing post
   */
  async update(postId: string, data: UpdatePostRequest): Promise<APIResponse<SocialPost>> {
    return put<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts/${postId}`, data);
  },

  /**
   * Delete a post
   */
  async delete(postId: string): Promise<APIResponse<void>> {
    return del<void>(`${SOCIAL_MEDIA_BASE}/posts/${postId}`);
  },

  /**
   * Schedule a post for future publishing
   */
  async schedule(postId: string, scheduledAt: Date): Promise<APIResponse<SocialPost>> {
    return post<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts/${postId}/schedule`, { scheduledAt });
  },

  /**
   * Publish a post immediately
   */
  async publish(postId: string): Promise<APIResponse<SocialPost>> {
    return post<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts/${postId}/publish`);
  },

  /**
   * Duplicate an existing post
   */
  async duplicate(postId: string): Promise<APIResponse<SocialPost>> {
    return post<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts/${postId}/duplicate`);
  },

  /**
   * Cancel a scheduled post
   */
  async cancelSchedule(postId: string): Promise<APIResponse<SocialPost>> {
    return post<SocialPost>(`${SOCIAL_MEDIA_BASE}/posts/${postId}/cancel-schedule`);
  },

  /**
   * Get posts by date range (for calendar view)
   */
  async getByDateRange(startDate: Date, endDate: Date): Promise<APIResponse<SocialPost[]>> {
    return this.getAll({ startDate, endDate });
  },

  /**
   * Get analytics for a specific post
   */
  async getAnalytics(postId: string): Promise<APIResponse<PostAnalytics>> {
    return get<PostAnalytics>(`${SOCIAL_MEDIA_BASE}/posts/${postId}/analytics`);
  },
};

// ============================================================================
// Campaigns API
// ============================================================================
