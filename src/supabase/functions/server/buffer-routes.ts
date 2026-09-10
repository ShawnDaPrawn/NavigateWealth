/**
 * Buffer Integration — Routes
 *
 * Thin dispatchers for the Buffer GraphQL proxy used by Social Media & Marketing.
 *
 *   GET  /buffer/status          — Connection + account
 *   POST /buffer/connect         — Store an admin-pasted API key (env secret wins)
 *   POST /buffer/disconnect      — Remove a stored key
 *   GET  /buffer/channels        — Connected social channels
 *   GET  /buffer/posts           — Scheduled / sending queue
 *   POST /buffer/posts           — Create / schedule / share now
 *
 * All routes require admin authentication.
 *
 * @module buffer/routes
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { BufferService } from './buffer-service.ts';
import { ConnectBufferSchema, CreateBufferPostSchema } from './buffer-validation.ts';

const app = new Hono();
const log = createModuleLogger('buffer-routes');
const service = new BufferService();

app.get(
  '/status',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    log.info('Buffer status requested', { adminUserId });
    const status = await service.getStatus();
    return c.json({ success: true, data: status });
  }),
);

app.post(
  '/connect',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const input = ConnectBufferSchema.parse(await c.req.json());
    const status = await service.connect(input.apiKey, adminUserId, input.organizationId);
    return c.json({ success: true, data: status });
  }),
);

app.post(
  '/disconnect',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    await service.disconnect(adminUserId);
    return c.json({ success: true, data: { message: 'Buffer disconnected' } });
  }),
);

app.get(
  '/channels',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const organizationId = c.req.query('organizationId');
    log.info('Buffer channels requested', { adminUserId });
    const channels = await service.listChannels(organizationId || undefined);
    return c.json({ success: true, data: channels });
  }),
);

app.get(
  '/posts',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const organizationId = c.req.query('organizationId');
    log.info('Buffer posts requested', { adminUserId });
    const posts = await service.listPosts(organizationId || undefined);
    return c.json({ success: true, data: posts });
  }),
);

app.post(
  '/posts',
  requireAdmin,
  asyncHandler(async (c) => {
    const adminUserId = c.get('userId') as string;
    const input = CreateBufferPostSchema.parse(await c.req.json());
    log.info('Buffer post create', { adminUserId, channels: input.channelIds.length });
    const results = await service.createPosts(input);
    return c.json({ success: true, data: results }, 201);
  }),
);

export default app;
