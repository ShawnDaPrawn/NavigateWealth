/**
 * LinkedIn Integration — Routes
 *
 * Thin route dispatchers for the LinkedIn OAuth 2.0 flow and Share on LinkedIn.
 *
 * Endpoints:
 *   GET  /linkedin/auth-url        — Generate OAuth authorization URL
 *   POST /linkedin/callback        — Exchange code for tokens
 *   GET  /linkedin/status          — Check connection status
 *   POST /linkedin/disconnect      — Remove stored tokens
 *   POST /linkedin/share/text      — Create a text-only share
 *   POST /linkedin/share/article   — Create an article/URL share
 *   POST /linkedin/share/image     — Upload image + create share
 *
 * All routes require admin authentication (requireAdmin → sets c.get('userId')).
 *
 * Response contract: all routes return { success: true, data: T } on success,
 * consistent with the standardised social media API response shape.
 *
 * @module linkedin/routes
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { LinkedInService } from './linkedin-service.ts';
import {
  OAuthCallbackSchema,
  ShareTextSchema,
  ShareArticleSchema,
  ShareImageSchema,
} from './linkedin-validation.ts';

const app = new Hono();
const log = createModuleLogger('linkedin-routes');
const service = new LinkedInService();

// ============================================================================
// OAuth 2.0 Flow
// ============================================================================

/**
 * GET /linkedin/auth-url
 * Returns the LinkedIn OAuth authorization URL for the admin to redirect to.
 * Query params:
 *   redirectUri — the URI LinkedIn should redirect back to after authorization
 */
app.get('/auth-url', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId') as string;
  const redirectUri = c.req.query('redirectUri');

  if (!redirectUri) {
    return c.json({ success: false, error: 'redirectUri query parameter is required' }, 400);
  }

  const authUrl = await service.getAuthorizationUrl(adminUserId, redirectUri);

  return c.json({ success: true, data: { authUrl } });
}));

/**
 * POST /linkedin/callback
 * Exchange the authorization code for tokens.
 * Body: { code, state, redirectUri }
 */
app.post('/callback', requireAdmin, asyncHandler(async (c) => {
  const body = await c.req.json();
  const input = OAuthCallbackSchema.parse(body);

  const status = await service.handleCallback(input.code, input.state, input.redirectUri);

  return c.json({ success: true, data: status });
}));

// ============================================================================
// Connection Management
// ============================================================================

/**
 * GET /linkedin/status
 * Check whether LinkedIn is connected for the current admin user.
 */
app.get('/status', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId') as string;
  const status = await service.getStatus(adminUserId);

  return c.json({ success: true, data: status });
}));

/**
 * POST /linkedin/disconnect
 * Disconnect LinkedIn — removes stored tokens.
 */
app.post('/disconnect', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId') as string;
  await service.disconnect(adminUserId);

  return c.json({ success: true, data: { message: 'LinkedIn disconnected successfully' } });
}));

// ============================================================================
// Share on LinkedIn
// ============================================================================

/**
 * POST /linkedin/share/text
 * Create a text-only LinkedIn post.
 */
app.post('/share/text', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId') as string;
  const body = await c.req.json();
  const input = ShareTextSchema.parse(body);

  const result = await service.shareText(adminUserId, input.text, input.visibility);

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 502);
  }

  return c.json({ success: true, data: { postId: result.postId } });
}));

/**
 * POST /linkedin/share/article
 * Create a LinkedIn post with an article/URL attachment.
 */
app.post('/share/article', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId') as string;
  const body = await c.req.json();
  const input = ShareArticleSchema.parse(body);

  const result = await service.shareArticle(
    adminUserId,
    input.text,
    input.url,
    input.title,
    input.description,
    input.visibility,
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 502);
  }

  return c.json({ success: true, data: { postId: result.postId } });
}));

/**
 * POST /linkedin/share/image
 * Upload an image to LinkedIn and create a share with it.
 */
app.post('/share/image', requireAdmin, asyncHandler(async (c) => {
  const adminUserId = c.get('userId') as string;
  const body = await c.req.json();
  const input = ShareImageSchema.parse(body);

  const result = await service.shareImage(
    adminUserId,
    input.text,
    input.imageUrl,
    input.title,
    input.description,
    input.visibility,
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 502);
  }

  return c.json({ success: true, data: { postId: result.postId } });
}));

export default app;
