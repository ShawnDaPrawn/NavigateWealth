/**
 * Social Media Module — Hooks Index
 * Navigate Wealth Admin Dashboard
 *
 * React Query hooks for Buffer channels/posts, the weekly automation, and the
 * AI generator.
 *
 * @module social-media/hooks
 */

// Query key registry
export { socialMediaKeys, socialAssetsKeys } from './queryKeys';

// Buffer channels ("profiles") and reachability
export { useSocialProfiles, useBufferStatus } from './useSocialProfiles';

// Buffer posts (calendar) and Compose
export { useSocialPosts, defaultPostRange, describeComposeResult } from './useSocialPosts';

// Aggregated Buffer metrics
export { useSocialAnalytics } from './useSocialAnalytics';

// Weekly automation (assets, settings, playbooks, jobs)
export {
  useSocialBatches,
  useSocialBatch,
  useSocialAutomationSettings,
  useSocialPlaybooks,
  useUpdateSocialSettings,
  useUpdateSocialPlaybook,
  useUpdateSocialAsset,
  useRunSocialJob,
  describeJobReport,
} from './useSocialAssets';

// Media library (uploads used in posts)
export {
  useMediaLibrary,
  useUploadMedia,
  useDeleteMedia,
  rejectionReasonFor,
  describeUpload,
  MAX_UPLOAD_BYTES,
  ACCEPT_ATTRIBUTE,
} from './useSocialMediaLibrary';

// AI content generation hooks
export { useSocialMediaAI } from './useSocialMediaAI';

// Custom template management hooks
export { useCustomTemplates } from './useCustomTemplates';

// AI analytics hooks
export { useAIAnalytics } from './useAIAnalytics';
