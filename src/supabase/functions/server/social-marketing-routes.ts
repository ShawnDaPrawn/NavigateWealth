/**
 * Social & Marketing — routes (Buffer-backed).
 *
 *   GET    /social-marketing/status        — is Buffer configured / reachable
 *   GET    /social-marketing/channels      — connected Buffer channels
 *   GET    /social-marketing/posts         — posts in a date window (calendar)
 *   POST   /social-marketing/posts         — manual Compose → Buffer
 *   DELETE /social-marketing/posts/:id     — delete a Buffer post
 *   GET    /social-marketing/analytics     — aggregated metrics (stat cards)
 *
 * All admin. The weekly automation does not come through here — see
 * social-assets-routes.ts and docs/runbooks/social-automation.md.
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  AnalyticsQuerySchema,
  ComposePostSchema,
  PostsQuerySchema,
} from './social-marketing-validation.ts';
import {
  composePost,
  deletePost,
  getAnalytics,
  getStatus,
  listChannels,
  listPosts,
} from './social-marketing-service.ts';

const app = new Hono();
const log = createModuleLogger('social-marketing');

app.get(
  '/status',
  requireAdmin,
  asyncHandler(async (c) => {
    const status = await getStatus();
    return c.json({ success: true, data: status });
  }),
);

app.get(
  '/channels',
  requireAdmin,
  asyncHandler(async (c) => {
    const channels = await listChannels();
    return c.json({ success: true, data: channels });
  }),
);

app.get(
  '/posts',
  requireAdmin,
  asyncHandler(async (c) => {
    const parsed = PostsQuerySchema.safeParse({
      from: c.req.query('from') ?? undefined,
      to: c.req.query('to') ?? undefined,
      channelId: c.req.query('channelId') ?? undefined,
    });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const posts = await listPosts(parsed.data);
    return c.json({ success: true, data: posts });
  }),
);

app.post(
  '/posts',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const raw = await c.req.json().catch(() => ({}));
    const parsed = ComposePostSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    log.info('Composing social post', {
      adminUserId,
      channels: parsed.data.channelIds.length,
      mode: parsed.data.mode,
    });
    const result = await composePost(parsed.data, adminUserId);
    const status = result.created.length > 0 ? 201 : 502;
    return c.json({ success: result.created.length > 0, data: result }, status);
  }),
);

app.delete(
  '/posts/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const postId = c.req.param('id')!;
    if (!/^[a-f\d]{24}$/.test(postId)) {
      return c.json({ error: 'Invalid Buffer post id' }, 400);
    }
    await deletePost(postId);
    log.info('Social post deleted', { adminUserId: c.get('userId'), postId });
    return c.json({ success: true });
  }),
);

app.get(
  '/analytics',
  requireAdmin,
  asyncHandler(async (c) => {
    const parsed = AnalyticsQuerySchema.safeParse({ days: c.req.query('days') ?? undefined });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const analytics = await getAnalytics(parsed.data.days);
    return c.json({ success: true, data: analytics });
  }),
);

export default app;
