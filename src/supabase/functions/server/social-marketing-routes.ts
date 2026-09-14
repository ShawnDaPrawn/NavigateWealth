/**
 * Social & Marketing — routes (Buffer-backed).
 *
 *   GET    /social-marketing/status        — is Buffer configured / reachable
 *   GET    /social-marketing/channels      — connected Buffer channels
 *   GET    /social-marketing/posts         — posts in a date window (calendar)
 *   POST   /social-marketing/posts         — manual Compose → Buffer
 *   DELETE /social-marketing/posts/:id     — delete a Buffer post
 *   GET    /social-marketing/analytics     — aggregated metrics (stat cards)
 *   GET    /social-marketing/media         — the uploaded image library
 *   POST   /social-marketing/media         — upload an image (multipart)
 *   DELETE /social-marketing/media         — remove an uploaded image
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
  MediaDeleteSchema,
  MediaListQuerySchema,
  PostsQuerySchema,
} from './social-marketing-validation.ts';
import {
  deleteMedia,
  isUploadedFile,
  listMedia,
  uploadMedia,
} from './social-marketing-media-service.ts';
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

// ── Media library ───────────────────────────────────────────────────────────
// Uploads go to the PUBLIC assets bucket because Buffer fetches a post's image
// from the URL it is given, which for a scheduled post may be days later.

app.get(
  '/media',
  requireAdmin,
  asyncHandler(async (c) => {
    const parsed = MediaListQuerySchema.safeParse({ limit: c.req.query('limit') ?? undefined });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const items = await listMedia(parsed.data.limit);
    return c.json({ success: true, data: items });
  }),
);

app.post(
  '/media',
  requireAdmin,
  asyncHandler(async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file');
    if (!isUploadedFile(file)) {
      return c.json({ error: 'Attach an image as the "file" field.' }, 400);
    }

    const item = await uploadMedia({
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name || 'image',
      declaredType: file.type || '',
    });
    log.info('Media uploaded', {
      adminUserId: c.get('userId'),
      storagePath: item.storagePath,
      size: item.size,
    });
    return c.json({ success: true, data: item }, 201);
  }),
);

app.delete(
  '/media',
  requireAdmin,
  asyncHandler(async (c) => {
    const parsed = MediaDeleteSchema.safeParse({ storagePath: c.req.query('storagePath') ?? '' });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    await deleteMedia(parsed.data.storagePath);
    log.info('Media deleted', {
      adminUserId: c.get('userId'),
      storagePath: parsed.data.storagePath,
    });
    return c.json({ success: true });
  }),
);

export default app;
