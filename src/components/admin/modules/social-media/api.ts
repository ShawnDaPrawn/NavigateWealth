/**
 * Social Media API Client
 *
 * Centralized API layer for all social media operations. The slices live in
 * ./api (channels/profiles, posts, analytics, automation assets, AI, LinkedIn);
 * this barrel re-exports the whole surface so the many consumers keep
 * importing from one place.
 *
 * Channels, posts and analytics come from Buffer through the Edge Function;
 * the automation assets come from the `social_*` tables the routines write.
 *
 * @module social-media/api
 */

import { profilesApi } from './api/profilesApi';
import { postsApi } from './api/postsApi';
import { analyticsApi } from './api/analyticsApi';
import { socialAssetsApi } from './api/socialAssetsApi';
import { socialMediaAIApi } from './api/socialMediaAIApi';
import { linkedinApi } from './api/linkedinApi';

export { profilesApi, postsApi, analyticsApi, socialAssetsApi, socialMediaAIApi, linkedinApi };
export type { APIResponse, PaginatedResponse } from './api/apiBase';
export type { CreatePostRequest, PostFilters } from './api/requests';
export type { AssetListFilters } from './api/socialAssetsApi';
export type { BufferChannelDto, BufferPostDto } from './api/bufferMapping';
export { channelToProfile, bufferPostToSocialPost } from './api/bufferMapping';
export type { LinkedInConnectionStatus, LinkedInShareResult } from './api/linkedinApi';

// ============================================================================
// Convenience: Default Export
// ============================================================================

export default {
  profiles: profilesApi,
  posts: postsApi,
  analytics: analyticsApi,
  assets: socialAssetsApi,
  ai: socialMediaAIApi,
  linkedin: linkedinApi,
};
