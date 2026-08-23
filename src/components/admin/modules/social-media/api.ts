/**
 * Social Media API Client
 *
 * Centralized API layer for all social media operations. The slices live in
 * ./api (profiles, posts, campaigns, analytics, media, AI, LinkedIn) on the
 * shared HTTP base; this barrel re-exports the whole surface so the many
 * consumers keep importing from one place.
 *
 * @module social-media/api
 */

import { profilesApi } from './api/profilesApi';
import { postsApi } from './api/postsApi';
import { campaignsApi } from './api/campaignsApi';
import { analyticsApi } from './api/analyticsApi';
import { mediaApi } from './api/mediaApi';
import { socialMediaAIApi } from './api/socialMediaAIApi';
import { linkedinApi } from './api/linkedinApi';

export {
  profilesApi,
  postsApi,
  campaignsApi,
  analyticsApi,
  mediaApi,
  socialMediaAIApi,
  linkedinApi,
};
export type { APIResponse, PaginatedResponse } from './api/apiBase';
export type {
  ConnectProfileRequest,
  UpdateProfileRequest,
  CreatePostRequest,
  UpdatePostRequest,
  SchedulePostRequest,
  PostFilters,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  AnalyticsFilters,
  AnalyticsResponse,
  UploadMediaRequest,
} from './api/requests';
export type { LinkedInConnectionStatus, LinkedInShareResult } from './api/linkedinApi';

// ============================================================================
// Convenience: Default Export
// ============================================================================

export default {
  profiles: profilesApi,
  posts: postsApi,
  campaigns: campaignsApi,
  analytics: analyticsApi,
  media: mediaApi,
  ai: socialMediaAIApi,
  linkedin: linkedinApi,
};
