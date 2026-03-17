/**
 * Social & Marketing Module - Service Layer
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import type {
  SocialPost,
  PostCreate,
  PostUpdate,
  PostFilters,
  Campaign,
  Analytics,
  SocialProfile,
} from './social-marketing-types.ts';

const log = createModuleLogger('social-marketing-service');

// Helper to generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

export class SocialMarketingService {
  
  // ========================================================================
  // SOCIAL PROFILES
  // ========================================================================
  
  /**
   * Get all social profiles
   */
  async getAllProfiles(): Promise<SocialProfile[]> {
    const profiles = await kv.getByPrefix('social_profile:');
    if (!profiles || profiles.length === 0) {
      return [];
    }
    profiles.sort((a: SocialProfile, b: SocialProfile) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return profiles;
  }

  /**
   * Get profile by ID
   */
  async getProfileById(profileId: string): Promise<SocialProfile> {
    const profile = await kv.get(`social_profile:${profileId}`);
    if (!profile) {
      throw new NotFoundError('Social profile not found');
    }
    return profile;
  }

  /**
   * Connect (create) a social profile
   */
  async connectProfile(data: {
    platform: string;
    accessToken?: string;
    refreshToken?: string;
    accountType?: string;
  }): Promise<SocialProfile> {
    const profileId = generateId();
    const timestamp = new Date().toISOString();

    const profile: SocialProfile = {
      id: profileId,
      platform: data.platform as SocialProfile['platform'],
      name: data.platform.charAt(0).toUpperCase() + data.platform.slice(1),
      isConnected: true,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accountType: data.accountType as SocialProfile['accountType'],
      created_at: timestamp,
      updated_at: timestamp,
    };

    await kv.set(`social_profile:${profileId}`, profile);
    log.success('Social profile connected', { profileId, platform: data.platform });
    return profile;
  }

  /**
   * Update a social profile
   */
  async updateProfile(profileId: string, updates: Partial<SocialProfile>): Promise<SocialProfile> {
    const profile = await this.getProfileById(profileId);
    Object.assign(profile, updates);
    profile.updated_at = new Date().toISOString();
    await kv.set(`social_profile:${profileId}`, profile);
    log.success('Social profile updated', { profileId });
    return profile;
  }

  /**
   * Disconnect a social profile
   */
  async disconnectProfile(profileId: string): Promise<void> {
    const profile = await this.getProfileById(profileId);
    profile.isConnected = false;
    profile.accessToken = undefined;
    profile.refreshToken = undefined;
    profile.updated_at = new Date().toISOString();
    await kv.set(`social_profile:${profileId}`, profile);
    log.success('Social profile disconnected', { profileId });
  }

  /**
   * Delete a social profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    await kv.del(`social_profile:${profileId}`);
    log.success('Social profile deleted', { profileId });
  }

  // ========================================================================
  // SOCIAL MEDIA POSTS
  // ========================================================================
  
  /**
   * Get all posts
   */
  async getAllPosts(filters?: Partial<PostFilters>): Promise<SocialPost[]> {
    const posts = await kv.getByPrefix('social_post:');
    
    if (!posts || posts.length === 0) {
      return [];
    }
    
    let filtered = posts;
    
    // Apply filters
    if (filters?.platform) {
      filtered = filtered.filter((p: SocialPost) => p.platform === filters.platform);
    }
    
    if (filters?.status) {
      filtered = filtered.filter((p: SocialPost) => p.status === filters.status);
    }
    
    // Sort by scheduled/created date (newest first)
    filtered.sort((a: SocialPost, b: SocialPost) => {
      const dateA = new Date(a.scheduled_for || a.created_at);
      const dateB = new Date(b.scheduled_for || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
    
    return filtered;
  }
  
  /**
   * Get post by ID
   */
  async getPostById(postId: string): Promise<SocialPost> {
    const post = await kv.get(`social_post:${postId}`);
    
    if (!post) {
      throw new NotFoundError('Social post not found');
    }
    
    return post;
  }
  
  /**
   * Create post
   */
  async createPost(createdBy: string, data: PostCreate): Promise<SocialPost> {
    const postId = generateId();
    const timestamp = new Date().toISOString();
    
    const post: SocialPost = {
      id: postId,
      platform: data.platform,
      content: data.content,
      media_urls: data.media_urls || [],
      hashtags: data.hashtags || [],
      status: 'draft',
      created_by: createdBy,
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`social_post:${postId}`, post);
    
    log.success('Social post created', { postId, platform: post.platform });
    
    return post;
  }
  
  /**
   * Update post
   */
  async updatePost(postId: string, updates: PostUpdate): Promise<SocialPost> {
    const post = await this.getPostById(postId);
    
    if (post.status === 'published') {
      throw new ValidationError('Cannot update published post');
    }
    
    Object.assign(post, updates);
    post.updated_at = new Date().toISOString();
    
    await kv.set(`social_post:${postId}`, post);
    
    log.success('Social post updated', { postId });
    
    return post;
  }
  
  /**
   * Publish post
   */
  async publishPost(postId: string): Promise<{ success: boolean; message: string }> {
    const post = await this.getPostById(postId);
    
    if (post.status === 'published') {
      throw new ValidationError('Post is already published');
    }
    
    // TODO: Integrate with actual social media APIs
    // For now, just mark as published
    
    post.status = 'published';
    post.published_at = new Date().toISOString();
    post.updated_at = new Date().toISOString();
    
    await kv.set(`social_post:${postId}`, post);
    
    log.success('Social post published', { postId, platform: post.platform });
    
    return {
      success: true,
      message: 'Post published successfully',
    };
  }
  
  /**
   * Schedule post
   */
  async schedulePost(postId: string, scheduledFor: string): Promise<SocialPost> {
    const post = await this.getPostById(postId);
    
    post.status = 'scheduled';
    post.scheduled_for = scheduledFor;
    post.updated_at = new Date().toISOString();
    
    await kv.set(`social_post:${postId}`, post);
    
    log.success('Social post scheduled', { postId, scheduledFor });
    
    return post;
  }
  
  /**
   * Delete post
   */
  async deletePost(postId: string): Promise<void> {
    await kv.del(`social_post:${postId}`);
    
    log.success('Social post deleted', { postId });
  }
  
  // ========================================================================
  // SCHEDULING
  // ========================================================================
  
  /**
   * Get posting schedule
   */
  async getSchedule(dateRange?: { startDate?: string; endDate?: string }): Promise<SocialPost[]> {
    const posts = await this.getAllPosts({ status: 'scheduled' });
    
    let filtered = posts;
    
    // Filter by date range
    if (dateRange?.startDate) {
      filtered = filtered.filter((p: SocialPost) =>
        p.scheduled_for && new Date(p.scheduled_for) >= new Date(dateRange.startDate!)
      );
    }
    
    if (dateRange?.endDate) {
      filtered = filtered.filter((p: SocialPost) =>
        p.scheduled_for && new Date(p.scheduled_for) <= new Date(dateRange.endDate!)
      );
    }
    
    return filtered;
  }
  
  // ========================================================================
  // ANALYTICS
  // ========================================================================
  
  /**
   * Get analytics
   */
  async getAnalytics(filters?: {
    platform?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Analytics> {
    log.info('Generating social media analytics', { filters });
    
    const posts = await this.getAllPosts({ status: 'published' });
    
    let filtered = posts;
    
    // Apply filters
    if (filters?.platform) {
      filtered = filtered.filter((p: SocialPost) => p.platform === filters.platform);
    }
    
    if (filters?.startDate) {
      filtered = filtered.filter((p: SocialPost) =>
        p.published_at && new Date(p.published_at) >= new Date(filters.startDate!)
      );
    }
    
    if (filters?.endDate) {
      filtered = filtered.filter((p: SocialPost) =>
        p.published_at && new Date(p.published_at) <= new Date(filters.endDate!)
      );
    }
    
    // Calculate metrics
    const totalPosts = filtered.length;
    const totalEngagement = filtered.reduce((sum: number, p: SocialPost) => {
      return sum + (p.metrics?.likes || 0) + (p.metrics?.comments || 0) + (p.metrics?.shares || 0);
    }, 0);
    
    const totalReach = filtered.reduce((sum: number, p: SocialPost) => {
      return sum + (p.metrics?.reach || 0);
    }, 0);
    
    return {
      totalPosts,
      totalEngagement,
      totalReach,
      averageEngagement: totalPosts > 0 ? totalEngagement / totalPosts : 0,
      byPlatform: this.groupByPlatform(filtered),
    };
  }
  
  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(): Promise<{ totalEngagement: number; averageEngagement: number; byPlatform: Record<string, unknown> }> {
    const analytics = await this.getAnalytics();
    
    return {
      totalEngagement: analytics.totalEngagement,
      averageEngagement: analytics.averageEngagement,
      byPlatform: analytics.byPlatform,
    };
  }
  
  /**
   * Group posts by platform
   */
  private groupByPlatform(posts: SocialPost[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    posts.forEach((post) => {
      grouped[post.platform] = (grouped[post.platform] || 0) + 1;
    });
    
    return grouped;
  }
  
  // ========================================================================
  // CAMPAIGNS
  // ========================================================================
  
  /**
   * Get all campaigns
   */
  async getAllCampaigns(): Promise<Campaign[]> {
    const campaigns = await kv.getByPrefix('marketing_campaign:');
    
    if (!campaigns || campaigns.length === 0) {
      return [];
    }
    
    // Sort by created date (newest first)
    campaigns.sort((a: Campaign, b: Campaign) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return campaigns;
  }
  
  /**
   * Create campaign
   */
  async createCampaign(data: Partial<Campaign>): Promise<Campaign> {
    const campaignId = generateId();
    const timestamp = new Date().toISOString();
    
    const campaign: Campaign = {
      id: campaignId,
      name: data.name!,
      description: data.description,
      start_date: data.start_date!,
      end_date: data.end_date,
      budget: data.budget,
      status: 'draft',
      created_at: timestamp,
      updated_at: timestamp,
    };
    
    await kv.set(`marketing_campaign:${campaignId}`, campaign);
    
    log.success('Marketing campaign created', { campaignId });
    
    return campaign;
  }
  
  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, updates: Partial<Campaign>): Promise<Campaign> {
    const campaign = await kv.get(`marketing_campaign:${campaignId}`);
    
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }
    
    Object.assign(campaign, updates);
    campaign.updated_at = new Date().toISOString();
    
    await kv.set(`marketing_campaign:${campaignId}`, campaign);
    
    log.success('Marketing campaign updated', { campaignId });
    
    return campaign;
  }
  
  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    await kv.del(`marketing_campaign:${campaignId}`);
    
    log.success('Marketing campaign deleted', { campaignId });
  }
}