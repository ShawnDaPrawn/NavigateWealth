/**
 * Social profile management (connect/disconnect platforms). One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import type {
  SocialProfile,
  // UTMParameters, // Unused import
} from '../types';
import { SOCIAL_MEDIA_BASE, get, post, put, del, type APIResponse } from './apiBase';
import type { ConnectProfileRequest, UpdateProfileRequest } from './requests';

export const profilesApi = {
  /**
   * Get all social media profiles
   */
  async getAll(): Promise<APIResponse<SocialProfile[]>> {
    return get<SocialProfile[]>(`${SOCIAL_MEDIA_BASE}/profiles`);
  },

  /**
   * Get a specific profile by ID
   */
  async getById(profileId: string): Promise<APIResponse<SocialProfile>> {
    return get<SocialProfile>(`${SOCIAL_MEDIA_BASE}/profiles/${profileId}`);
  },

  /**
   * Connect a new social media platform
   */
  async connect(data: ConnectProfileRequest): Promise<APIResponse<SocialProfile>> {
    return post<SocialProfile>(`${SOCIAL_MEDIA_BASE}/profiles/connect`, data);
  },

  /**
   * Update profile information
   */
  async update(profileId: string, data: UpdateProfileRequest): Promise<APIResponse<SocialProfile>> {
    return put<SocialProfile>(`${SOCIAL_MEDIA_BASE}/profiles/${profileId}`, data);
  },

  /**
   * Disconnect a social media profile
   */
  async disconnect(profileId: string): Promise<APIResponse<void>> {
    return post<void>(`${SOCIAL_MEDIA_BASE}/profiles/${profileId}/disconnect`);
  },

  /**
   * Sync profile data from platform
   */
  async sync(profileId: string): Promise<APIResponse<SocialProfile>> {
    return post<SocialProfile>(`${SOCIAL_MEDIA_BASE}/profiles/${profileId}/sync`);
  },

  /**
   * Delete a profile
   */
  async delete(profileId: string): Promise<APIResponse<void>> {
    return del<void>(`${SOCIAL_MEDIA_BASE}/profiles/${profileId}`);
  },
};

// ============================================================================
// Posts API
// ============================================================================
