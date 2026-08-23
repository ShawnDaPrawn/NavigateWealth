/**
 * Request/filter shapes shared by the social-media API slices.
 */
import type {
  SocialPost,
  SocialPlatform,
  PostStatus,
  MediaFile,
  PostLink,
  // UTMParameters, // Unused import
} from '../types';

export interface ConnectProfileRequest {
  platform: SocialPlatform;
  accessToken?: string;
  refreshToken?: string;
  accountType?: 'personal' | 'business' | 'organization';
}

export interface UpdateProfileRequest {
  name?: string;
  username?: string;
  avatar?: string;
}

// Post API Types
export interface CreatePostRequest {
  profiles: string[];
  campaign?: string;
  body: string;
  firstComment?: string;
  media?: MediaFile[];
  link?: PostLink;
  scheduledAt?: Date;
  tags?: string[];
}

export interface UpdatePostRequest {
  profiles?: string[];
  campaign?: string;
  body?: string;
  firstComment?: string;
  media?: MediaFile[];
  link?: PostLink;
  scheduledAt?: Date;
  tags?: string[];
}

export interface SchedulePostRequest {
  scheduledAt: Date;
}

export interface PostFilters {
  status?: PostStatus | PostStatus[];
  profiles?: string[];
  campaign?: string;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
}

// Campaign API Types
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'active' | 'paused' | 'completed';
}

// Analytics API Types
export interface AnalyticsFilters {
  profiles?: string[];
  startDate?: Date;
  endDate?: Date;
  campaign?: string;
}

export interface AnalyticsResponse {
  totalImpressions: number;
  totalClicks: number;
  totalEngagement: number;
  averageCTR: number;
  averageEngagementRate: number;
  topPerformingPost?: SocialPost;
  postsByPlatform: Record<SocialPlatform, number>;
  engagementByPlatform: Record<SocialPlatform, number>;
}

// Media Upload Types
export interface UploadMediaRequest {
  file: File;
  alt?: string;
}

// ============================================================================
// Configuration
// ============================================================================
