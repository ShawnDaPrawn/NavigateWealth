/**
 * Publications AI Writing Service
 * Phase 3 — AI Writing Tools
 *
 * Orchestrates OpenAI calls for article content generation,
 * transformation, compliance checking, and SEO optimisation.
 *
 * Business logic lives here; routes are thin dispatchers.
 *
 * @module publications/ai-service
 */

import { createModuleLogger } from './stderr-logger.ts';
export * from './publications-ai-model.ts';
export { searchUnsplashImage } from './publications-ai-images.ts';

import type {
  AIWritingRequest,
  AIWritingResponse,
  GenerateArticleBrief,
  GenerateArticleResult,
} from './publications-ai-model.ts';
import {
  BASE_SYSTEM_PROMPT,
  buildArticleGenerationPrompt,
  getActionPrompt,
} from './publications-ai-prompts.ts';
import { callOpenAI, callOpenAIWorkflow } from './publications-ai-openai.ts';
import { deriveImageSearchQuery, searchUnsplashImage } from './publications-ai-images.ts';
import { cleanHTML, postProcess } from './publications-ai-postprocess.ts';

const log = createModuleLogger('publications-ai');

export async function generateFullArticle(
  brief: GenerateArticleBrief,
  options?: { excludeImageIds?: Set<string> },
): Promise<GenerateArticleResult> {
  log.info('Generating full article', {
    topic: brief.topic,
    audience: brief.audience,
    tone: brief.tone,
    targetLength: brief.targetLength,
  });

  const prompt = buildArticleGenerationPrompt(brief);

  // Try workflow first, fallback to chat completions handled inside
  const { text, tokensUsed } = await callOpenAIWorkflow(prompt);

  // Parse the JSON response
  let parsed: Record<string, unknown>;
  try {
    // Strip any markdown code fences that might slip through
    const cleaned = text
      .replace(/^```json?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (_parseErr) {
    log.error('Failed to parse article generation response as JSON', { text: text.slice(0, 500) });
    // Attempt to extract fields manually
    parsed = {
      title: brief.topic,
      excerpt: '',
      body: cleanHTML(text),
      suggestedSlug: brief.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      suggestedMetaDescription: '',
    };
  }

  const body = typeof parsed.body === 'string' ? cleanHTML(parsed.body) : '';
  const wordCount = body
    .replace(/<[^>]+>/g, '')
    .split(/\s+/)
    .filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const result: GenerateArticleResult = {
    title: (parsed.title as string) || brief.topic,
    excerpt: (parsed.excerpt as string) || '',
    body,
    suggestedSlug:
      (parsed.suggestedSlug as string) ||
      brief.topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    readingTimeMinutes: readingTime,
    suggestedMetaDescription: (parsed.suggestedMetaDescription as string) || '',
    tokensUsed,
    suggestedCategoryName: (parsed.suggestedCategory as string) || undefined,
  };

  // Search Unsplash for a hero/thumbnail image using the AI-suggested query
  // Fallback: derive a search query from the article title if the AI didn't provide one
  const imageSearchQuery =
    (parsed.imageSearchQuery as string) || deriveImageSearchQuery(result.title, brief.topic);
  log.info('Searching Unsplash for article image', {
    query: imageSearchQuery,
    source: parsed.imageSearchQuery ? 'ai' : 'fallback',
  });
  const imageResult = await searchUnsplashImage(imageSearchQuery, options?.excludeImageIds);
  if (imageResult) {
    result.suggestedHeroImageUrl = imageResult.heroUrl;
    result.suggestedThumbnailUrl = imageResult.thumbnailUrl;
    result.unsplashPhotoId = imageResult.photoId;
    log.info('Unsplash image assigned', {
      photographer: imageResult.photographerName,
      photoId: imageResult.photoId,
      query: imageSearchQuery,
    });
  } else {
    log.error('Unsplash image NOT assigned — article will have no hero/thumbnail image', {
      query: imageSearchQuery,
      hasAccessKey: !!Deno.env.get('UNSPLASH_ACCESS_KEY'),
    });
  }

  log.info('Article generated successfully', {
    titleLength: result.title.length,
    bodyLength: result.body.length,
    wordCount,
    readingTime,
    tokensUsed,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Post-processing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API: AI Writing Request Processing
// ---------------------------------------------------------------------------

/**
 * Process an AI writing request (inline editor actions like improve, expand, etc.)
 *
 * @param request - The AI writing request with action, content, and context
 * @returns Processed AI writing response
 */
export async function processAIWritingRequest(
  request: AIWritingRequest,
): Promise<AIWritingResponse> {
  const { action } = request;

  log.info('Processing AI writing request', { action });

  const userPrompt = getActionPrompt(request);

  const maxTokens = action === 'expand' || action === 'continue' ? 3000 : 2000;
  const temperature = action === 'fix_grammar' ? 0.3 : 0.7;

  const { text, tokensUsed } = await callOpenAI(BASE_SYSTEM_PROMPT, userPrompt, {
    temperature,
    maxTokens,
  });

  const response = postProcess(action, text, tokensUsed);

  log.info('AI writing request complete', {
    action,
    resultLength: response.result.length,
    tokensUsed: response.tokensUsed,
  });

  return response;
}
