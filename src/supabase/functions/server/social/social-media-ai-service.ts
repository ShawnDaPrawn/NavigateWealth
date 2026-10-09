/**
 * Social Media AI Service
 *
 * Orchestrates OpenAI API calls for social media content generation.
 * Business logic lives in the social-media-ai-* slices (shared, text,
 * images, bundles); this barrel re-exports the public surface so
 * social-media-ai-routes.ts keeps importing from one place.
 *
 * @module social-media/ai-service
 */

export {
  generatePostText,
  getGenerationHistory,
  getGenerationById,
} from './social-media-ai-text.ts';
export type {
  SocialAIPlatform,
  ContentTone,
  ContentGoal,
  GeneratePostTextInput,
  GeneratedPlatformPost,
  GeneratePostTextResult,
  AIGenerationRecord,
} from './social-media-ai-text.ts';

export { generateImage, refreshImageUrl, getImageHistory } from './social-media-ai-images.ts';
export type {
  ImageStyle,
  GenerateImageInput,
  GeneratedImage,
  GenerateImageResult,
  AIImageRecord,
} from './social-media-ai-images.ts';

export {
  generateBundle,
  createCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  listCustomTemplates,
  getAIAnalytics,
} from './social-media-ai-bundles.ts';
export type {
  GenerateBundleInput,
  GenerateBundleResult,
  AIBundleRecord,
  CustomBrandTemplate,
} from './social-media-ai-bundles.ts';
