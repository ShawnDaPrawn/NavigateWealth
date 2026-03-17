/**
 * Social Media AI Routes
 *
 * Thin route dispatcher for AI-powered social media content generation.
 * All business logic is delegated to social-media-ai-service.ts.
 *
 * @module social-media/ai-routes
 */

import { Hono } from 'npm:hono';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  generatePostText,
  getGenerationHistory,
  getGenerationById,
  generateImage,
  refreshImageUrl,
  getImageHistory,
  generateBundle,
  createCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  listCustomTemplates,
  getAIAnalytics,
} from './social-media-ai-service.ts';
import {
  GeneratePostTextSchema,
  GetHistorySchema,
  GenerateImageSchema,
  RefreshImageUrlSchema,
  GenerateBundleSchema,
  CreateCustomTemplateSchema,
  UpdateCustomTemplateSchema,
} from './social-media-ai-validation.ts';

const app = new Hono();
const log = createModuleLogger('social-media-ai');

// Root handler
app.get('/', (c) =>
  c.json({ service: 'social-media-ai', status: 'active' }),
);

// ---------------------------------------------------------------------------
// POST /generate-post — Generate platform-specific post text
// ---------------------------------------------------------------------------

app.post(
  '/generate-post',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();

    const parsed = GeneratePostTextSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    log.info('AI post text generation requested', {
      userId,
      platforms: parsed.data.platforms,
      topic: parsed.data.topic.slice(0, 50),
    });

    const result = await generatePostText(parsed.data, userId);

    log.success('AI post text generation completed', {
      generationId: result.generationId,
      postCount: result.posts.length,
    });

    return c.json({ success: true, data: result });
  }),
);

// ---------------------------------------------------------------------------
// GET /history — Get generation history for the current user
// ---------------------------------------------------------------------------

app.get(
  '/history',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const limitParam = c.req.query('limit');

    const parsed = GetHistorySchema.safeParse({ limit: limitParam || 20 });
    const limit = parsed.success ? parsed.data.limit : 20;

    const history = await getGenerationHistory(userId, limit);

    return c.json({ success: true, data: history });
  }),
);

// ---------------------------------------------------------------------------
// GET /generation/:id — Get a specific generation record
// ---------------------------------------------------------------------------

app.get(
  '/generation/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const generationId = c.req.param('id');

    const record = await getGenerationById(generationId);
    if (!record) {
      return c.json({ error: 'Generation record not found' }, 404);
    }

    return c.json({ success: true, data: record });
  }),
);

// ---------------------------------------------------------------------------
// GET /status — Check if AI service is configured
// ---------------------------------------------------------------------------

app.get(
  '/status',
  requireAdmin,
  asyncHandler(async (c) => {
    const configured = !!Deno.env.get('OPENAI_API_KEY');
    return c.json({
      success: true,
      data: { configured },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /generate-image — Generate a branded image for a specific platform
// ---------------------------------------------------------------------------

app.post(
  '/generate-image',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();

    const parsed = GenerateImageSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    log.info('AI image generation requested', {
      userId,
      platform: parsed.data.platform,
      style: parsed.data.style,
    });

    const result = await generateImage(parsed.data, userId);

    log.success('AI image generation completed', {
      generationId: result.generationId,
      imageCount: result.images.length,
    });

    return c.json({ success: true, data: result });
  }),
);

// ---------------------------------------------------------------------------
// POST /refresh-image-url — Refresh a signed URL for a stored image
// ---------------------------------------------------------------------------

app.post(
  '/refresh-image-url',
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json();

    const parsed = RefreshImageUrlSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const signedUrl = await refreshImageUrl(parsed.data.storagePath);
    if (!signedUrl) {
      return c.json({ error: 'Failed to refresh image URL' }, 404);
    }

    return c.json({ success: true, data: { signedUrl } });
  }),
);

// ---------------------------------------------------------------------------
// GET /image-history — Get image generation history
// ---------------------------------------------------------------------------

app.get(
  '/image-history',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const limitParam = c.req.query('limit');
    const parsed = GetHistorySchema.safeParse({ limit: limitParam || 20 });
    const limit = parsed.success ? parsed.data.limit : 20;

    const history = await getImageHistory(userId, limit);

    return c.json({ success: true, data: history });
  }),
);

// ---------------------------------------------------------------------------
// POST /generate-bundle — Generate a bundle of content for a specific platform
// ---------------------------------------------------------------------------

app.post(
  '/generate-bundle',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();

    const parsed = GenerateBundleSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    log.info('AI bundle generation requested', {
      userId,
      textPlatforms: parsed.data.text.platforms,
      imagePlatform: parsed.data.image.platform,
    });

    const result = await generateBundle(parsed.data, userId);

    log.success('AI bundle generation completed', {
      bundleId: result.bundleId,
      textPosts: result.text.posts.length,
      imageCount: result.image.images.length,
    });

    return c.json({ success: true, data: result });
  }),
);

// ---------------------------------------------------------------------------
// POST /create-custom-template — Create a custom template
// ---------------------------------------------------------------------------

app.post(
  '/templates',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();

    const parsed = CreateCustomTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    log.info('Custom template creation requested', { userId, name: parsed.data.name });
    const result = await createCustomTemplate(parsed.data, userId);
    return c.json({ success: true, data: result });
  }),
);

// ---------------------------------------------------------------------------
// POST /update-custom-template — Update a custom template
// ---------------------------------------------------------------------------

app.put(
  '/templates/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const templateId = c.req.param('id');
    const body = await c.req.json();

    const parsed = UpdateCustomTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const result = await updateCustomTemplate(templateId, parsed.data, userId);
    if (!result) {
      return c.json({ error: 'Template not found' }, 404);
    }
    return c.json({ success: true, data: result });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /delete-custom-template — Delete a custom template
// ---------------------------------------------------------------------------

app.delete(
  '/templates/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const templateId = c.req.param('id');

    const deleted = await deleteCustomTemplate(templateId, userId);
    if (!deleted) {
      return c.json({ error: 'Template not found or not owned by you' }, 404);
    }
    return c.json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// GET /list-custom-templates — List custom templates
// ---------------------------------------------------------------------------

app.get(
  '/templates',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const templates = await listCustomTemplates(userId);
    return c.json({ success: true, data: templates });
  }),
);

// ---------------------------------------------------------------------------
// GET /ai-analytics — Get AI analytics
// ---------------------------------------------------------------------------

app.get(
  '/analytics',
  requireAdmin,
  asyncHandler(async (c) => {
    const userId = c.get('userId');
    const analytics = await getAIAnalytics(userId);
    return c.json({ success: true, data: analytics });
  }),
);

export default app;