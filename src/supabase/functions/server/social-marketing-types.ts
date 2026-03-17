/**
 * Social & Marketing Module - Type Definitions
 */

// Social platform
export type SocialPlatform = 
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'tiktok';

// Post status
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

// Campaign status
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

// Social post
export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  media_urls?: string[];
  hashtags?: string[];
  status: PostStatus;
  scheduled_for?: string;
  published_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    impressions?: number;
  };
}

// Post creation data
export interface PostCreate {
  platform: SocialPlatform;
  content: string;
  media_urls?: string[];
  hashtags?: string[];
}

// Post update data
export interface PostUpdate {
  content?: string;
  media_urls?: string[];
  hashtags?: string[];
  scheduled_for?: string;
}

// Post filters
export interface PostFilters {
  platform?: SocialPlatform;
  status?: PostStatus;
}

// Marketing campaign
export interface Campaign {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  budget?: number;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

// Analytics
export interface Analytics {
  totalPosts: number;
  totalEngagement: number;
  totalReach: number;
  averageEngagement: number;
  byPlatform: Record<string, number>;
}

// Engagement metrics
export interface EngagementMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
}

// Social profile
export interface SocialProfile {
  id: string;
  platform: SocialPlatform;
  name: string;
  username?: string;
  avatar?: string;
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  accountType?: 'personal' | 'business' | 'organization';
  created_at: string;
  updated_at: string;
}