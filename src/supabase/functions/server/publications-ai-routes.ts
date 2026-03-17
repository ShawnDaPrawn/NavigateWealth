/**
 * Publications AI Writing Routes
 * Phase 3 — AI Writing Tools
 *
 * Thin route dispatcher for AI writing operations.
 * All business logic is delegated to publications-ai-service.ts.
 *
 * @module publications/ai-routes
 */

import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { processAIWritingRequest, generateFullArticle, searchUnsplashImage } from './publications-ai-service.ts';
import type { AIWritingRequest, GenerateArticleBrief } from './publications-ai-service.ts';

const app = new Hono();
const log = createModuleLogger('publications-ai');

// Root handler
app.get('/', (c) => c.json({ service: 'publications-ai', status: 'active' }));
app.get('', (c) => c.json({ service: 'publications-ai', status: 'active' }));

// ---------------------------------------------------------------------------
// POST /generate — Main AI writing endpoint
// ---------------------------------------------------------------------------

app.post('/generate', async (c) => {
  try {
    const body = await c.req.json() as AIWritingRequest;

    // Basic validation
    if (!body.action) {
      return c.json({ success: false, error: 'Action is required' }, 400);
    }

    const validActions = [
      'improve', 'expand', 'summarize', 'continue', 'tone',
      'headline', 'excerpt', 'compliance_check', 'seo_optimize',
      'generate_callout', 'fix_grammar', 'custom',
    ];

    if (!validActions.includes(body.action)) {
      return c.json({
        success: false,
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      }, 400);
    }

    if (!body.content && body.action !== 'custom') {
      return c.json({
        success: false,
        error: 'Content is required for this action',
      }, 400);
    }

    // Content length guard — prevent abuse
    if (body.content && body.content.length > 50000) {
      return c.json({
        success: false,
        error: 'Content exceeds maximum length (50,000 characters)',
      }, 400);
    }

    const result = await processAIWritingRequest(body);

    return c.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI processing failed';
    log.error('AI writing request failed', error);

    // Distinguish between config errors and processing errors
    if (message.includes('OPENAI_API_KEY')) {
      return c.json({
        success: false,
        error: 'AI service is not configured. Please add your OpenAI API key.',
      }, 503);
    }

    return c.json({ success: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /generate-article — Full article generation from brief
// ---------------------------------------------------------------------------

app.post('/generate-article', async (c) => {
  try {
    const body = await c.req.json() as GenerateArticleBrief;

    // Validate required fields
    if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length < 3) {
      return c.json({
        success: false,
        error: 'Topic is required and must be at least 3 characters',
      }, 400);
    }

    const validAudiences = ['advisors', 'clients', 'both'];
    if (!body.audience || !validAudiences.includes(body.audience)) {
      return c.json({
        success: false,
        error: `Audience must be one of: ${validAudiences.join(', ')}`,
      }, 400);
    }

    const validTones = ['professional', 'conversational', 'authoritative', 'friendly', 'educational'];
    if (!body.tone || !validTones.includes(body.tone)) {
      return c.json({
        success: false,
        error: `Tone must be one of: ${validTones.join(', ')}`,
      }, 400);
    }

    const validLengths = ['short', 'medium', 'long'];
    if (!body.targetLength || !validLengths.includes(body.targetLength)) {
      return c.json({
        success: false,
        error: `Target length must be one of: ${validLengths.join(', ')}`,
      }, 400);
    }

    // Topic length guard
    if (body.topic.length > 500) {
      return c.json({
        success: false,
        error: 'Topic exceeds maximum length (500 characters)',
      }, 400);
    }

    const result = await generateFullArticle(body);

    return c.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Article generation failed';
    log.error('Article generation request failed', error);

    if (message.includes('OPENAI_API_KEY')) {
      return c.json({
        success: false,
        error: 'AI service is not configured. Please add your OpenAI API key.',
      }, 503);
    }

    return c.json({ success: false, error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /test-unsplash — Diagnostic endpoint to verify Unsplash integration
// ---------------------------------------------------------------------------

app.get('/test-unsplash', async (c) => {
  const query = c.req.query('q') || 'financial planning office';
  log.info('Testing Unsplash integration', { query });

  const hasKey = !!Deno.env.get('UNSPLASH_ACCESS_KEY')?.trim();
  if (!hasKey) {
    return c.json({
      success: false,
      error: 'UNSPLASH_ACCESS_KEY is not set. Add this secret in your Supabase project settings.',
      configured: false,
    }, 503);
  }

  const result = await searchUnsplashImage(query);
  if (!result) {
    return c.json({
      success: false,
      error: 'Unsplash search returned no results. The API key may be invalid or the query returned nothing. Check server logs for details.',
      configured: true,
      query,
    });
  }

  return c.json({
    success: true,
    configured: true,
    query,
    data: {
      heroUrl: result.heroUrl,
      thumbnailUrl: result.thumbnailUrl,
      photographer: result.photographerName,
      photoId: result.photoId,
    },
  });
});

export default app;