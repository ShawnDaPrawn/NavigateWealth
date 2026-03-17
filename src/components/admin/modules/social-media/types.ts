/**
 * Social Media Type Definitions
 * 
 * Comprehensive type system for the Social Media module including:
 * - Platform types and constants
 * - Profile, post, and campaign types
 * - Analytics and metrics types
 * - API request/response types (re-exported from api.ts)
 * 
 * @module social-media/types
 */

// ============================================================================
// Core Types
// ============================================================================

export type SocialPlatform = 'linkedin' | 'instagram' | 'facebook' | 'x';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'pending_approval';
export type UserRole = 'admin' | 'marketer' | 'approver' | 'viewer';

// ============================================================================
// Social Profiles
// ============================================================================

export interface SocialProfile {
  id: string;
  platform: SocialPlatform;
  name: string;
  username: string;
  avatar?: string;
  isConnected: boolean;
  followerCount?: number;
  accountType?: 'personal' | 'business' | 'organization';
  lastSync?: Date;
}

// ============================================================================
// Media & Links
// ============================================================================

export interface MediaFile {
  id: string;
  url: string;
  type: 'image' | 'video';
  alt?: string;
  filename: string;
  size: number;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface UTMParameters {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface PostLink {
  url: string;
  utm?: UTMParameters;
  shortenedUrl?: string;
  title?: string;
  description?: string;
  image?: string;
}

// ============================================================================
// Posts
// ============================================================================

export interface SocialPost {
  id: string;
  profiles: string[]; // Profile IDs
  campaign?: string;
  body: string;
  firstComment?: string; // Instagram only
  media: MediaFile[];
  link?: PostLink;
  scheduledAt?: Date;
  publishedAt?: Date;
  status: PostStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  failureReason?: string;
  retryCount: number;
  analytics?: PostAnalytics;
  tags?: string[];
}

export interface PostAnalytics {
  impressions: number;
  clicks: number;
  ctr: number;
  reactions: number;
  comments: number;
  shares: number;
  saves?: number; // Instagram/LinkedIn
  followers_gained?: number;
  reach?: number;
  engagement_rate: number;
}

// ============================================================================
// Campaigns
// ============================================================================

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'completed';
  posts: string[]; // Post IDs
  totalPosts: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  createdBy: string;
  createdAt: Date;
}

// ============================================================================
// Platform Configuration
// ============================================================================

export interface PlatformLimits {
  maxCharacters: number;
  maxImages: number;
  maxVideos: number;
  videoMaxSize: number; // MB
  imageMaxSize: number; // MB
  aspectRatios: {
    recommended: string[];
    supported: string[];
  };
  features: {
    firstComment: boolean;
    hashtags: boolean;
    mentions: boolean;
    polls: boolean;
    stories: boolean;
  };
}

export const PLATFORM_LIMITS: Record<SocialPlatform, PlatformLimits> = {
  linkedin: {
    maxCharacters: 3000,
    maxImages: 20,
    maxVideos: 1,
    videoMaxSize: 5120, // 5GB
    imageMaxSize: 100,
    aspectRatios: {
      recommended: ['1.91:1', '1:1', '4:5'],
      supported: ['1.91:1', '1:1', '4:5', '9:16'],
    },
    features: {
      firstComment: false,
      hashtags: true,
      mentions: true,
      polls: true,
      stories: false,
    },
  },
  instagram: {
    maxCharacters: 2200,
    maxImages: 10,
    maxVideos: 1,
    videoMaxSize: 4096, // 4GB
    imageMaxSize: 30,
    aspectRatios: {
      recommended: ['1:1', '4:5', '9:16'],
      supported: ['1.91:1', '1:1', '4:5', '9:16'],
    },
    features: {
      firstComment: true,
      hashtags: true,
      mentions: true,
      polls: false,
      stories: true,
    },
  },
  facebook: {
    maxCharacters: 63206,
    maxImages: 30,
    maxVideos: 1,
    videoMaxSize: 10240, // 10GB
    imageMaxSize: 100,
    aspectRatios: {
      recommended: ['1.91:1', '1:1', '4:5'],
      supported: ['1.91:1', '1:1', '4:5', '9:16', '16:9'],
    },
    features: {
      firstComment: false,
      hashtags: true,
      mentions: true,
      polls: true,
      stories: true,
    },
  },
  x: {
    maxCharacters: 280,
    maxImages: 4,
    maxVideos: 1,
    videoMaxSize: 512, // 512MB
    imageMaxSize: 5,
    aspectRatios: {
      recommended: ['16:9', '1:1'],
      supported: ['16:9', '1:1', '2:1'],
    },
    features: {
      firstComment: false,
      hashtags: true,
      mentions: true,
      polls: true,
      stories: false,
    },
  },
};

// ============================================================================
// Scheduling & Calendar
// ============================================================================

export interface ScheduleSlot {
  date: Date;
  posts: SocialPost[];
  suggestedTimes?: Date[];
}

export interface BestTime {
  platform: SocialPlatform;
  dayOfWeek: number; // 0-6
  hour: number; // 0-23
  engagement_rate: number;
}

// ============================================================================
// Compliance & Audit
// ============================================================================

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  blockedTerms: string[];
  requiredApprovals: number;
  platforms: SocialPlatform[];
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'publish' | 'approve' | 'reject';
  resourceType: 'post' | 'campaign' | 'profile';
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
}

// ============================================================================
// State Management
// ============================================================================

export interface SocialMediaState {
  posts: SocialPost[];
  campaigns: Campaign[];
  profiles: SocialProfile[];
  selectedProfiles: string[];
  currentPost: Partial<SocialPost> | null;
  viewMode: 'calendar' | 'queue' | 'analytics';
  selectedDate: Date;
  filters: {
    platform?: SocialPlatform;
    status?: PostStatus;
    campaign?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
}

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use SocialPost instead
 */
export interface MarketingPost {
  id: string;
  platform: 'Facebook' | 'Twitter' | 'LinkedIn' | 'Instagram';
  content: string;
  media: string[];
  scheduledAt?: string;
  status: 'Draft' | 'Scheduled' | 'Published' | 'Failed';
  createdBy: string;
  metrics?: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
  };
  createdAt: string;
}

// ============================================================================
// AI Content Generation Types
// ============================================================================

export type SocialAIPlatform = 'linkedin' | 'instagram' | 'facebook' | 'x';

export type ContentTone =
  | 'professional'
  | 'conversational'
  | 'authoritative'
  | 'friendly'
  | 'educational';

export type ContentGoal =
  | 'engagement'
  | 'awareness'
  | 'education'
  | 'promotion'
  | 'thought_leadership';

export interface GeneratePostTextInput {
  platforms: SocialAIPlatform[];
  topic: string;
  tone: ContentTone;
  goal: ContentGoal;
  articleContent?: string;
  articleTitle?: string;
  keyPoints?: string[];
  includeHashtags: boolean;
  includeCTA: boolean;
  additionalInstructions?: string;
}

export interface GeneratedPlatformPost {
  platform: SocialAIPlatform;
  content: string;
  hashtags: string[];
  characterCount: number;
  characterLimit: number;
  withinLimit: boolean;
  callToAction?: string;
}

export interface GeneratePostTextResult {
  posts: GeneratedPlatformPost[];
  tokensUsed: number;
  generationId: string;
}

export interface AIGenerationRecord {
  id: string;
  input: GeneratePostTextInput;
  result: GeneratePostTextResult;
  createdBy: string;
  createdAt: string;
}

// ============================================================================
// AI Image Generation Types
// ============================================================================

export type ImageStyle =
  | 'photorealistic'
  | 'editorial'
  | 'abstract'
  | 'conceptual'
  | 'lifestyle'
  | 'data_visualisation';

export interface GenerateImageInput {
  platform: SocialAIPlatform | 'instagram_story';
  subject: string;
  style: ImageStyle;
  topic?: string;
  additionalInstructions?: string;
  quality?: 'standard' | 'hd';
}

export interface GeneratedImage {
  platform: string;
  signedUrl: string;
  storagePath: string;
  dimensions: string;
  revisedPrompt: string;
}

export interface GenerateImageResult {
  images: GeneratedImage[];
  generationId: string;
}

export interface AIImageRecord {
  id: string;
  input: GenerateImageInput;
  result: GenerateImageResult;
  createdBy: string;
  createdAt: string;
}

// ============================================================================
// AI Bundle Generation Types (Phase 3)
// ============================================================================

export interface GenerateBundleInput {
  text: GeneratePostTextInput;
  image: GenerateImageInput;
}

export interface GenerateBundleResult {
  text: GeneratePostTextResult;
  image: GenerateImageResult;
  bundleId: string;
}

export interface AIBundleRecord {
  id: string;
  input: GenerateBundleInput;
  result: GenerateBundleResult;
  createdBy: string;
  createdAt: string;
}

// ============================================================================
// Custom Brand Templates (Phase 3+)
// ============================================================================

export interface CustomBrandTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  platforms: SocialAIPlatform[];
  tone: ContentTone;
  goal: ContentGoal;
  topicPrompt: string;
  includeHashtags: boolean;
  includeCTA: boolean;
  additionalInstructions: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateCustomTemplateInput = Omit<
  CustomBrandTemplate,
  'id' | 'createdBy' | 'createdAt' | 'updatedAt'
>;

export type UpdateCustomTemplateInput = Partial<CreateCustomTemplateInput>;

// ============================================================================
// AI Analytics Types (Phase 3+)
// ============================================================================

export interface AIAnalyticsSummary {
  totalTextGenerations: number;
  totalImageGenerations: number;
  totalBundleGenerations: number;
  totalGenerations: number;
  platformBreakdown: Record<string, number>;
  toneBreakdown: Record<string, number>;
  goalBreakdown: Record<string, number>;
  styleBreakdown: Record<string, number>;
  dailyActivity: Array<{
    date: string;
    text: number;
    image: number;
    bundle: number;
  }>;
  recentGenerations: Array<{
    id: string;
    type: 'text' | 'image' | 'bundle';
    topic?: string;
    platforms?: string[];
    createdAt: string;
  }>;
}