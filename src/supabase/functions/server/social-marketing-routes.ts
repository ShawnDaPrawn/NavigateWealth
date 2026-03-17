/**
 * Social & Marketing Module - Routes
 * 
 * Social media and marketing management:
 * - Social media posts
 * - Post scheduling
 * - Analytics tracking
 * - Campaign management
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { SocialMarketingService } from './social-marketing-service.ts';
import { CreatePostSchema, UpdatePostSchema } from './social-marketing-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('social-marketing');
const service = new SocialMarketingService();

// ============================================================================
// SOCIAL PROFILES
// ============================================================================

/**
 * GET /social-marketing/profiles
 * Get all social profiles
 */
app.get('/profiles', requireAdmin, asyncHandler(async (c) => {
  const profiles = await service.getAllProfiles();
  return c.json({ success: true, data: profiles });
}));

/**
 * GET /social-marketing/profiles/:id
 * Get specific profile
 */
app.get('/profiles/:id', requireAdmin, asyncHandler(async (c) => {
  const profileId = c.req.param('id');
  const profile = await service.getProfileById(profileId);
  return c.json({ success: true, data: profile });
}));

/**
 * POST /social-marketing/profiles/connect
 * Connect a new social profile
 */
app.post('/profiles/connect', requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json();
  log.info('Connecting social profile', { platform: body.platform });
  const profile = await service.connectProfile(body);
  return c.json({ success: true, data: profile }, 201);
}));

/**
 * PUT /social-marketing/profiles/:id
 * Update a social profile
 */
app.put('/profiles/:id', requireAdmin, asyncHandler(async (c) => {
  const profileId = c.req.param('id');
  const body = await c.req.json();
  const profile = await service.updateProfile(profileId, body);
  return c.json({ success: true, data: profile });
}));

/**
 * POST /social-marketing/profiles/:id/disconnect
 * Disconnect a social profile
 */
app.post('/profiles/:id/disconnect', requireAdmin, asyncHandler(async (c) => {
  const profileId = c.req.param('id');
  await service.disconnectProfile(profileId);
  return c.json({ success: true });
}));

/**
 * POST /social-marketing/profiles/:id/sync
 * Sync a social profile
 */
app.post('/profiles/:id/sync', requireAdmin, asyncHandler(async (c) => {
  const profileId = c.req.param('id');
  const profile = await service.getProfileById(profileId);
  // Sync is a no-op for now — returns current profile data
  return c.json({ success: true, data: profile });
}));

/**
 * DELETE /social-marketing/profiles/:id
 * Delete a social profile
 */
app.delete('/profiles/:id', requireAdmin, asyncHandler(async (c) => {
  const profileId = c.req.param('id');
  await service.deleteProfile(profileId);
  return c.json({ success: true });
}));

// ============================================================================
// SOCIAL MEDIA POSTS
// ============================================================================

/**
 * GET /social-marketing/posts
 * Get all social media posts
 */
app.get('/posts', requireAdmin, asyncHandler(async (c) => {
  const filters = {
    platform: c.req.query('platform'),
    status: c.req.query('status'),
  };
  
  const posts = await service.getAllPosts(filters);
  
  return c.json({ success: true, data: posts });
}));

/**
 * GET /social-marketing/posts/:id
 * Get specific post
 */
app.get('/posts/:id', requireAdmin, asyncHandler(async (c) => {
  const postId = c.req.param('id');
  
  const post = await service.getPostById(postId);
  
  return c.json({ success: true, data: post });
}));

/**
 * POST /social-marketing/posts
 * Create new post
 */
app.post('/posts', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const body = await c.req.json();
  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  log.info('Creating social post', { adminUserId, platform: parsed.data.platform });
  
  const post = await service.createPost(adminUserId, parsed.data);
  
  log.success('Social post created', { postId: post.id });
  
  return c.json({ success: true, data: post }, 201);
}));

/**
 * PUT /social-marketing/posts/:id
 * Update post
 */
app.put('/posts/:id', requireAdmin, asyncHandler(async (c) => {
  const postId = c.req.param('id');
  const body = await c.req.json();
  const parsed = UpdatePostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }
  
  const post = await service.updatePost(postId, parsed.data);
  
  return c.json({ success: true, data: post });
}));

/**
 * POST /social-marketing/posts/:id/publish
 * Publish post immediately
 */
app.post('/posts/:id/publish', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const postId = c.req.param('id');
  
  log.info('Publishing social post', { adminUserId, postId });
  
  const result = await service.publishPost(postId);
  
  log.success('Social post published', { postId });
  
  return c.json({ success: true, data: result });
}));

/**
 * DELETE /social-marketing/posts/:id
 * Delete post
 */
app.delete('/posts/:id', requireAdmin, asyncHandler(async (c) => {
  const postId = c.req.param('id');
  
  await service.deletePost(postId);
  
  return c.json({ success: true });
}));

// ============================================================================
// SCHEDULING
// ============================================================================

/**
 * GET /social-marketing/schedule
 * Get posting schedule
 */
app.get('/schedule', requireAdmin, asyncHandler(async (c) => {
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  
  const schedule = await service.getSchedule({ startDate, endDate });
  
  return c.json({ success: true, data: schedule });
}));

/**
 * POST /social-marketing/posts/:id/schedule
 * Schedule post for later
 */
app.post('/posts/:id/schedule', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const postId = c.req.param('id');
  const { scheduledFor } = await c.req.json();
  
  log.info('Scheduling social post', { adminUserId, postId, scheduledFor });
  
  const post = await service.schedulePost(postId, scheduledFor);
  
  log.success('Social post scheduled', { postId, scheduledFor });
  
  return c.json({ success: true, data: post });
}));

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /social-marketing/analytics
 * Get social media analytics
 */
app.get('/analytics', requireAdmin, asyncHandler(async (c) => {
  const platform = c.req.query('platform');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  
  const analytics = await service.getAnalytics({ platform, startDate, endDate });
  
  return c.json({ success: true, data: analytics });
}));

/**
 * GET /social-marketing/analytics/engagement
 * Get engagement metrics
 */
app.get('/analytics/engagement', requireAdmin, asyncHandler(async (c) => {
  const metrics = await service.getEngagementMetrics();
  
  return c.json({ success: true, data: metrics });
}));

// ============================================================================
// CAMPAIGNS
// ============================================================================

/**
 * GET /social-marketing/campaigns
 * Get all marketing campaigns
 */
app.get('/campaigns', requireAdmin, asyncHandler(async (c) => {
  const campaigns = await service.getAllCampaigns();
  
  return c.json({ success: true, data: campaigns });
}));

/**
 * POST /social-marketing/campaigns
 * Create new campaign
 */
app.post('/campaigns', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId');
  const body = await c.req.json();
  
  log.info('Creating marketing campaign', { adminUserId, campaignName: body.name });
  
  const campaign = await service.createCampaign(body);
  
  log.success('Marketing campaign created', { campaignId: campaign.id });
  
  return c.json({ success: true, data: campaign }, 201);
}));

/**
 * PUT /social-marketing/campaigns/:id
 * Update campaign
 */
app.put('/campaigns/:id', requireAdmin, asyncHandler(async (c) => {
  const campaignId = c.req.param('id');
  const updates = await c.req.json();
  
  const campaign = await service.updateCampaign(campaignId, updates);
  
  return c.json({ success: true, data: campaign });
}));

/**
 * DELETE /social-marketing/campaigns/:id
 * Delete campaign
 */
app.delete('/campaigns/:id', requireAdmin, asyncHandler(async (c) => {
  const campaignId = c.req.param('id');
  
  await service.deleteCampaign(campaignId);
  
  return c.json({ success: true });
}));

export default app;