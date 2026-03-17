/**
 * Social Media API Client
 * 
 * Centralized API layer for all social media operations including:
 * - Social profile management (connect/disconnect platforms)
 * - Post management (create, schedule, publish)
 * - Campaign management
 * - Analytics and reporting
 * - Media uploads
 * - AI content generation
 * 
 * @module social-media/api
 */

import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { logger } from '../../../../utils/logger';
import { getErrorMessage } from '../../../../utils/errorUtils';
import type {
  SocialProfile,
  SocialPost,
  Campaign,
  PostAnalytics,
  SocialPlatform,
  PostStatus,
  MediaFile,
  PostLink,
  // UTMParameters, // Unused import
  GeneratePostTextInput,
  GeneratePostTextResult,
  AIGenerationRecord,
  GenerateImageInput,
  GenerateImageResult,
  AIImageRecord,
  GenerateBundleInput,
  GenerateBundleResult,
  CustomBrandTemplate,
  CreateCustomTemplateInput,
  UpdateCustomTemplateInput,
  AIAnalyticsSummary,
} from './types';

// ============================================================================
// Types - API Request/Response
// ============================================================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Profile API Types
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

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;
const SOCIAL_MEDIA_BASE = `${BASE_URL}/social-marketing`;

const defaultHeaders = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Retrieve session token for authenticated requests */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { createClient } = await import('../../../../utils/supabase/client');
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  } catch {
    // Fall through to default headers
  }
  return defaultHeaders;
}

async function handleResponse<T>(response: Response): Promise<APIResponse<T>> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
    };
  }

  const data = await response.json();
  return {
    success: true,
    data: data.data || data,
  };
}

async function get<T>(url: string): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API GET failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

async function post<T>(url: string, body?: unknown): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API POST failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

async function put<T>(url: string, body?: unknown): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API PUT failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

async function del<T>(url: string): Promise<APIResponse<T>> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });
    return handleResponse<T>(response);
  } catch (error) {
    logger.error('API DELETE failed', error, { url });
    return {
      success: false,
      error: getErrorMessage(error) || 'Network error',
    };
  }
}

// ============================================================================
// Social Profiles API
// ============================================================================

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

export const postsApi = {
  /**
   * Get all posts with optional filters
   */
  async getAll(filters?: PostFilters): Promise<APIResponse<SocialPost[]>> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        statuses.forEach(s => params.append('status', s));
      }
      if (filters.profiles) {
        filters.profiles.forEach(p => params.append('profile', p));
      }
      if (filters.campaign) params.append('campaign', filters.campaign);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.tags) {
        filters.tags.forEach(t => params.append('tag', t));
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
    return del<Campaign>(`${SOCIAL_MEDIA_BASE}/campaigns/${campaignId}/posts?ids=${postIds.join(',')}`);
  },
};

// ============================================================================
// Analytics API
// ============================================================================

export const analyticsApi = {
  /**
   * Get overall social media analytics
   */
  async getOverview(filters?: AnalyticsFilters): Promise<APIResponse<AnalyticsResponse>> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.profiles) {
        filters.profiles.forEach(p => params.append('profile', p));
      }
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.campaign) params.append('campaign', filters.campaign);
    }

    const queryString = params.toString();
    const url = queryString 
      ? `${SOCIAL_MEDIA_BASE}/analytics?${queryString}`
      : `${SOCIAL_MEDIA_BASE}/analytics`;

    return get<AnalyticsResponse>(url);
  },

  /**
   * Get analytics by platform
   */
  async getByPlatform(platform: SocialPlatform, filters?: AnalyticsFilters): Promise<APIResponse<AnalyticsResponse>> {
    const params = new URLSearchParams();
    params.append('platform', platform);
    
    if (filters) {
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.campaign) params.append('campaign', filters.campaign);
    }

    return get<AnalyticsResponse>(`${SOCIAL_MEDIA_BASE}/analytics/platform?${params.toString()}`);
  },

  /**
   * Get top performing posts
   */
  async getTopPosts(limit: number = 10): Promise<APIResponse<SocialPost[]>> {
    return get<SocialPost[]>(`${SOCIAL_MEDIA_BASE}/analytics/top-posts?limit=${limit}`);
  },

  /**
   * Export analytics data
   */
  async export(filters?: AnalyticsFilters, format: 'csv' | 'json' = 'csv'): Promise<APIResponse<Blob>> {
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (filters) {
      if (filters.profiles) {
        filters.profiles.forEach(p => params.append('profile', p));
      }
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.campaign) params.append('campaign', filters.campaign);
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_BASE}/analytics/export?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Export failed: ${response.statusText}`,
        };
      }

      const blob = await response.blob();
      return {
        success: true,
        data: blob,
      };
    } catch (error) {
      logger.error('Export failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Export failed',
      };
    }
  },
};

// ============================================================================
// Media API
// ============================================================================

export const mediaApi = {
  /**
   * Upload media file
   */
  async upload(file: File, alt?: string): Promise<APIResponse<MediaFile>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (alt) formData.append('alt', alt);

      const headers = await getAuthHeaders();
      // Remove Content-Type so browser sets it with multipart boundary
      delete (headers as Record<string, string>)['Content-Type'];
      const response = await fetch(`${SOCIAL_MEDIA_BASE}/media/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      return handleResponse<MediaFile>(response);
    } catch (error) {
      logger.error('Upload failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Upload failed',
      };
    }
  },

  /**
   * Delete media file
   */
  async delete(mediaId: string): Promise<APIResponse<void>> {
    return del<void>(`${SOCIAL_MEDIA_BASE}/media/${mediaId}`);
  },

  /**
   * Get media metadata
   */
  async getMetadata(mediaId: string): Promise<APIResponse<MediaFile>> {
    return get<MediaFile>(`${SOCIAL_MEDIA_BASE}/media/${mediaId}`);
  },
};

// ============================================================================
// AI Content Generation API
// ============================================================================

const SOCIAL_MEDIA_AI_BASE = `${BASE_URL}/social-media-ai`;

export const socialMediaAIApi = {
  /**
   * Generate platform-specific post text using AI
   */
  async generatePostText(input: GeneratePostTextInput): Promise<APIResponse<GeneratePostTextResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generate-post`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<GeneratePostTextResult>(response);
    } catch (error) {
      logger.error('AI post text generation failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to generate post text',
      };
    }
  },

  /**
   * Get AI generation history
   */
  async getHistory(limit = 20): Promise<APIResponse<AIGenerationRecord[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/history?limit=${limit}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIGenerationRecord[]>(response);
    } catch (error) {
      logger.error('Failed to fetch AI generation history', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch history',
      };
    }
  },

  /**
   * Get a specific generation record
   */
  async getGeneration(generationId: string): Promise<APIResponse<AIGenerationRecord>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generation/${generationId}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIGenerationRecord>(response);
    } catch (error) {
      logger.error('Failed to fetch AI generation record', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch generation',
      };
    }
  },

  /**
   * Check if AI service is configured
   */
  async getStatus(): Promise<APIResponse<{ configured: boolean }>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/status`, {
        method: 'GET',
        headers,
      });
      return handleResponse<{ configured: boolean }>(response);
    } catch (error) {
      logger.error('Failed to check AI service status', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to check status',
      };
    }
  },

  /**
   * Generate image using AI
   */
  async generateImage(input: GenerateImageInput): Promise<APIResponse<GenerateImageResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generate-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<GenerateImageResult>(response);
    } catch (error) {
      logger.error('AI image generation failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to generate image',
      };
    }
  },

  /**
   * Get AI image generation history
   */
  async getImageHistory(limit = 20): Promise<APIResponse<AIImageRecord[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/image-history?limit=${limit}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIImageRecord[]>(response);
    } catch (error) {
      logger.error('Failed to fetch AI image generation history', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch image history',
      };
    }
  },

  /**
   * Get a specific image generation record
   */
  async getImageGeneration(generationId: string): Promise<APIResponse<AIImageRecord>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/image-generation/${generationId}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIImageRecord>(response);
    } catch (error) {
      logger.error('Failed to fetch AI image generation record', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to fetch image generation',
      };
    }
  },

  /**
   * Generate a bundle of content using AI
   */
  async generateBundle(input: GenerateBundleInput): Promise<APIResponse<GenerateBundleResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/generate-bundle`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<GenerateBundleResult>(response);
    } catch (error) {
      logger.error('AI bundle generation failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to generate bundle',
      };
    }
  },

  /**
   * Create a custom brand template
   */
  async createCustomTemplate(input: CreateCustomTemplateInput): Promise<APIResponse<CustomBrandTemplate>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<CustomBrandTemplate>(response);
    } catch (error) {
      logger.error('Failed to create custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to create template',
      };
    }
  },

  /**
   * Update a custom brand template
   */
  async updateCustomTemplate(templateId: string, input: UpdateCustomTemplateInput): Promise<APIResponse<CustomBrandTemplate>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates/${templateId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(input),
      });
      return handleResponse<CustomBrandTemplate>(response);
    } catch (error) {
      logger.error('Failed to update custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to update template',
      };
    }
  },

  /**
   * Delete a custom brand template
   */
  async deleteCustomTemplate(templateId: string): Promise<APIResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates/${templateId}`, {
        method: 'DELETE',
        headers,
      });
      return handleResponse<void>(response);
    } catch (error) {
      logger.error('Failed to delete custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to delete template',
      };
    }
  },

  /**
   * Get a custom brand template
   */
  async getCustomTemplate(templateId: string): Promise<APIResponse<CustomBrandTemplate>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates/${templateId}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<CustomBrandTemplate>(response);
    } catch (error) {
      logger.error('Failed to get custom brand template', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get template',
      };
    }
  },

  /**
   * Get all custom brand templates
   */
  async getAllCustomTemplates(): Promise<APIResponse<CustomBrandTemplate[]>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/templates`, {
        method: 'GET',
        headers,
      });
      return handleResponse<CustomBrandTemplate[]>(response);
    } catch (error) {
      logger.error('Failed to get all custom brand templates', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get templates',
      };
    }
  },

  /**
   * Get AI analytics summary
   */
  async getAIAnalyticsSummary(): Promise<APIResponse<AIAnalyticsSummary>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${SOCIAL_MEDIA_AI_BASE}/analytics`, {
        method: 'GET',
        headers,
      });
      return handleResponse<AIAnalyticsSummary>(response);
    } catch (error) {
      logger.error('Failed to get AI analytics summary', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get summary',
      };
    }
  },
};

// ============================================================================
// LinkedIn Integration API
// ============================================================================

export interface LinkedInConnectionStatus {
  connected: boolean;
  personUrn?: string;
  profileName?: string;
  profileEmail?: string;
  expiresAt?: string;
  connectedAt?: string;
}

export interface LinkedInShareResult {
  postId?: string;
}

const LINKEDIN_BASE = `${BASE_URL}/linkedin`;

export const linkedinApi = {
  /**
   * Get the LinkedIn OAuth authorization URL.
   * The frontend should redirect the user to this URL.
   */
  async getAuthUrl(redirectUri: string): Promise<APIResponse<{ authUrl: string }>> {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ redirectUri });
      const response = await fetch(`${LINKEDIN_BASE}/auth-url?${params.toString()}`, {
        method: 'GET',
        headers,
      });
      return handleResponse<{ authUrl: string }>(response);
    } catch (error) {
      logger.error('Failed to get LinkedIn auth URL', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to get LinkedIn auth URL',
      };
    }
  },

  /**
   * Exchange the OAuth callback code for tokens.
   */
  async handleCallback(code: string, state: string, redirectUri: string): Promise<APIResponse<LinkedInConnectionStatus>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/callback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, state, redirectUri }),
      });
      return handleResponse<LinkedInConnectionStatus>(response);
    } catch (error) {
      logger.error('LinkedIn OAuth callback failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'LinkedIn connection failed',
      };
    }
  },

  /**
   * Check LinkedIn connection status.
   */
  async getStatus(): Promise<APIResponse<LinkedInConnectionStatus>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/status`, {
        method: 'GET',
        headers,
      });
      return handleResponse<LinkedInConnectionStatus>(response);
    } catch (error) {
      logger.error('Failed to check LinkedIn status', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to check LinkedIn status',
      };
    }
  },

  /**
   * Disconnect LinkedIn.
   */
  async disconnect(): Promise<APIResponse<void>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/disconnect`, {
        method: 'POST',
        headers,
      });
      return handleResponse<void>(response);
    } catch (error) {
      logger.error('Failed to disconnect LinkedIn', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to disconnect LinkedIn',
      };
    }
  },

  /**
   * Share a text-only post on LinkedIn.
   */
  async shareText(text: string, visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC'): Promise<APIResponse<LinkedInShareResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/share/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, visibility }),
      });
      return handleResponse<LinkedInShareResult>(response);
    } catch (error) {
      logger.error('LinkedIn text share failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to share on LinkedIn',
      };
    }
  },

  /**
   * Share an article/URL on LinkedIn.
   */
  async shareArticle(
    text: string,
    url: string,
    title?: string,
    description?: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC',
  ): Promise<APIResponse<LinkedInShareResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/share/article`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, url, title, description, visibility }),
      });
      return handleResponse<LinkedInShareResult>(response);
    } catch (error) {
      logger.error('LinkedIn article share failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to share article on LinkedIn',
      };
    }
  },

  /**
   * Share an image on LinkedIn.
   */
  async shareImage(
    text: string,
    imageUrl: string,
    title?: string,
    description?: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC',
  ): Promise<APIResponse<LinkedInShareResult>> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${LINKEDIN_BASE}/share/image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text, imageUrl, title, description, visibility }),
      });
      return handleResponse<LinkedInShareResult>(response);
    } catch (error) {
      logger.error('LinkedIn image share failed', error);
      return {
        success: false,
        error: getErrorMessage(error) || 'Failed to share image on LinkedIn',
      };
    }
  },
};

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