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

const log = createModuleLogger('publications-ai');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIAction =
  | 'improve'
  | 'expand'
  | 'summarize'
  | 'continue'
  | 'tone'
  | 'headline'
  | 'excerpt'
  | 'compliance_check'
  | 'seo_optimize'
  | 'generate_callout'
  | 'fix_grammar'
  | 'custom';

export interface AIWritingRequest {
  action: AIAction;
  /** The selected text or primary content to operate on */
  content: string;
  /** Surrounding context to improve quality */
  context?: string;
  /** Target tone for 'tone' action */
  tone?: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Custom user prompt for 'custom' action */
  prompt?: string;
  /** Article metadata for context */
  articleTitle?: string;
  articleExcerpt?: string;
  articleCategory?: string;
}

export interface AIWritingResponse {
  result: string;
  suggestions?: string[];
  warnings?: string[];
  action: AIAction;
  tokensUsed?: number;
}

// ---------------------------------------------------------------------------
// Full Article Generation Types
// ---------------------------------------------------------------------------

export interface GenerateArticleBrief {
  /** Topic or working title */
  topic: string;
  /** Target audience */
  audience: 'advisors' | 'clients' | 'both';
  /** Writing tone */
  tone: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Key points to cover (optional) */
  keyPoints?: string[];
  /** Target word count */
  targetLength: 'short' | 'medium' | 'long';
  /** Category name for context */
  categoryName?: string;
  /** Template body to use as structural guide (optional) */
  templateBody?: string;
  /** Additional instructions (optional) */
  additionalInstructions?: string;
  /** Available category names for auto-detection when no category is explicitly selected */
  availableCategories?: string[];
}

export interface GenerateArticleResult {
  title: string;
  excerpt: string;
  body: string;
  suggestedSlug: string;
  readingTimeMinutes: number;
  suggestedMetaDescription: string;
  tokensUsed: number;
  /** AI-suggested category name (returned when availableCategories was provided) */
  suggestedCategoryName?: string;
  /** Hero image URL sourced from Unsplash based on article topic */
  suggestedHeroImageUrl?: string;
  /** Thumbnail image URL sourced from Unsplash based on article topic */
  suggestedThumbnailUrl?: string;
  /** Unsplash photo ID for stale image tracking */
  unsplashPhotoId?: string;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are the dedicated content writer for Navigate Wealth, a South African financial advisory practice. Your role is to transform provided source material — including RSS feeds, research notes, commentary, documents, and any other supplied inputs — into original, high-quality articles for publication on a South African financial advisory website.

CORE IDENTITY AND PURPOSE:
- You must fully rewrite and enhance all content into polished Navigate Wealth material that reads as entirely original
- Never reference, cite, or attribute the original source in any way
- You are not merely paraphrasing — you are strengthening structure, sharpening clarity, enhancing strategic interpretation, and clearly explaining the long-term wealth implications of the information

NUMERICAL ACCURACY (NON-NEGOTIABLE):
- All facts, data points, statistics, percentages, dates, thresholds, limits, and rand values contained in source material must be included accurately and precisely
- Absolutely no omission of material figures — no numerical information may be excluded
- If a source references changes — such as adjustments to VAT, TFSA annual limits, retirement fund thresholds, tax brackets, rebates, or contribution caps — you must explicitly state the exact percentages, rand amounts, and effective dates
- Under no circumstances may you generalise changes without including the specific values involved

AUDIENCE AND LOCALISATION:
- Articles must be written directly to Navigate Wealth clients as the primary audience
- All content must be interpreted through a South African financial planning lens
- Incorporate South African tax law, SARS implications, Regulation 28 considerations, retirement annuities, tax-free savings accounts, discretionary investing structures, rand exposure versus offshore allocation, JSE dynamics, and the broader South African economic environment
- Global material must always be reframed for South African investors

TONE AND STYLE:
- Professional, authoritative, strategic, precise, and intellectually confident
- Avoid sensationalism, fluff, filler, or academic detachment
- Each article must include a strong headline, clear subheadings, structured paragraphs, and conclude with a decisive strategic advisory takeaway

SOURCE ATTRIBUTION (STRICTLY FORBIDDEN):
- Under no circumstances may you mention the original publication
- Never use phrases such as "according to a recent article," "a report by," "sources indicate," or similar attribution language
- Never include hyperlinks to source material
- Never copy sentences verbatim or display obvious paraphrasing patterns

NAVIGATE WEALTH POSITIONING:
- Every article must reinforce the importance of independent professional advice
- Clearly position Navigate Wealth as a forward-thinking, highly competent advisory firm
- Demonstrate the value of working with a Navigate Wealth financial adviser in navigating complexity and making sound, strategic financial decisions

FORMATTING RULES:
- Use South African English spelling (e.g., "optimise" not "optimize", "colour" not "color")
- Use ZAR (R) for currency references unless otherwise specified
- Format dates as dd MMM yyyy (e.g., 22 Feb 2026)
- Output clean HTML that works with a TipTap editor (use <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags)
- Do NOT wrap output in markdown code fences

COMPLIANCE:
- Never guarantee investment returns or make specific performance promises
- Comply with South African financial services regulations (FAIS Act, FICA, POPIA)
- Always recommend professional advice for individual circumstances`;

function getActionPrompt(request: AIWritingRequest): string {
  const { action, content, context, tone, prompt, articleTitle, articleExcerpt, articleCategory } = request;

  const articleContext = [
    articleTitle && `Article title: "${articleTitle}"`,
    articleExcerpt && `Article excerpt: "${articleExcerpt}"`,
    articleCategory && `Category: ${articleCategory}`,
    context && `Surrounding content:\n${context}`,
  ]
    .filter(Boolean)
    .join('\n');

  switch (action) {
    case 'improve':
      return `Improve the following text for clarity, readability, and professional tone. Fix any grammatical issues, improve sentence flow, and strengthen the writing while preserving the original meaning and key points. Return only the improved text as clean HTML.\n\n${articleContext}\n\nText to improve:\n${content}`;

    case 'expand':
      return `Expand the following text with more detail, examples, and supporting information. Add depth while keeping it engaging and relevant to a financial planning audience. Aim for roughly 2-3x the original length. Return clean HTML.\n\n${articleContext}\n\nText to expand:\n${content}`;

    case 'summarize':
      return `Summarize the following text concisely, capturing the key points in 2-3 sentences. The summary should be suitable for an article excerpt or executive summary. Return clean HTML (a single <p> tag).\n\n${articleContext}\n\nText to summarize:\n${content}`;

    case 'continue':
      return `Continue writing from where the text below ends. Write 2-3 additional paragraphs that naturally follow the existing content's topic, style, and tone. Return clean HTML.\n\n${articleContext}\n\nContinue from:\n${content}`;

    case 'tone': {
      const toneMap: Record<string, string> = {
        professional: 'formal, authoritative, and suitable for a financial services whitepaper',
        conversational: 'warm, approachable, and easy to read while remaining professional',
        authoritative: 'confident, data-driven, and expert-level without being condescending',
        friendly: 'welcoming, supportive, and encouraging while maintaining credibility',
        educational: 'explanatory, patient, and structured for learning, with clear definitions of terms',
      };
      const toneDesc = toneMap[tone || 'professional'] || toneMap.professional;
      return `Rewrite the following text in a ${tone || 'professional'} tone (${toneDesc}). Preserve the factual content but adjust the voice and style. Return clean HTML.\n\n${articleContext}\n\nText to rewrite:\n${content}`;
    }

    case 'headline':
      return `Generate 5 compelling headline options for a financial planning article with the following content. Each headline should be:\n- Clear and specific\n- Between 40-80 characters\n- Engaging without being clickbait\n- Appropriate for a wealth management audience\n\nReturn a JSON array of strings, e.g. ["Headline 1", "Headline 2", ...]\n\n${articleContext}\n\nContent:\n${content}`;

    case 'excerpt':
      return `Generate a compelling article excerpt/meta description (150-160 characters) that summarizes the key value proposition for readers. It should entice clicking while accurately representing the content. Return just the plain text excerpt, no HTML tags.\n\n${articleContext}\n\nArticle content:\n${content}`;

    case 'compliance_check':
      return `Review the following financial content for regulatory compliance issues. Check for:
1. Misleading claims or guarantees about investment returns
2. Missing risk disclaimers where needed
3. Statements that could violate FAIS Act requirements
4. POPIA concerns (personal data references)
5. Missing "past performance" disclaimers
6. Unsubstantiated claims about financial products

Return a JSON object with:
{
  "issues": [{ "text": "problematic excerpt", "issue": "description", "severity": "high|medium|low", "suggestion": "recommended fix" }],
  "overallRisk": "low|medium|high",
  "summary": "brief overall assessment"
}\n\nContent to review:\n${content}`;

    case 'seo_optimize':
      return `Analyse the following article content and provide SEO optimisation suggestions. Return a JSON object with:
{
  "seoTitle": "optimised title (50-60 chars)",
  "metaDescription": "optimised description (150-160 chars)",
  "suggestedKeywords": ["keyword1", "keyword2", ...],
  "improvements": ["suggestion 1", "suggestion 2", ...],
  "readabilityScore": "good|fair|needs_improvement",
  "readabilityNotes": "brief assessment"
}\n\n${articleContext}\n\nContent:\n${content}`;

    case 'generate_callout':
      return `Based on the following content, generate a concise callout box. Choose the most appropriate type from: Key Takeaway (for important insights), Important (for critical warnings), Note (for supplementary information), Tip (for practical advice), or Risk Warning (for compliance/risk notices).\n\nReturn a JSON object: { "type": "takeaway|important|note|tip|warning", "content": "the callout text" }\n\n${articleContext}\n\nContent:\n${content}`;

    case 'fix_grammar':
      return `Fix all grammar, spelling, and punctuation errors in the following text. Use South African English conventions. Make minimal changes — only fix actual errors, don't rewrite for style. Return the corrected text as clean HTML.\n\nText:\n${content}`;

    case 'custom':
      return `${prompt || 'Help me improve this content.'}\n\n${articleContext}\n\nContent:\n${content}`;

    default:
      return `Improve the following text:\n${content}`;
  }
}

// ---------------------------------------------------------------------------
// OpenAI Integration
// ---------------------------------------------------------------------------

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<{ text: string; tokensUsed: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const { temperature = 0.7, maxTokens = 2000 } = options;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error('OpenAI API error', { status: response.status, body: errorBody });
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  const tokensUsed = data.usage?.total_tokens || 0;

  return { text, tokensUsed };
}

// ---------------------------------------------------------------------------
// OpenAI Responses API (Workflow) Integration
// ---------------------------------------------------------------------------

const ARTICLE_WORKFLOW_ID = 'wf_699c7dc864988190b8897ab9552fe1bc0c5d0a63afa541d1';

async function callOpenAIWorkflow(
  prompt: string,
): Promise<{ text: string; tokensUsed: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  log.info('Calling OpenAI Responses API with workflow', { workflowId: ARTICLE_WORKFLOW_ID });

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ARTICLE_WORKFLOW_ID,
        input: prompt,
      }),
      signal: AbortSignal.timeout(90000), // 90 second timeout for workflow
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unable to read error body');
      log.error('OpenAI Responses API error — falling back to Chat Completions', {
        status: response.status,
        body: errorBody.slice(0, 500),
      });

      // Fallback to Chat Completions API for ANY error (not just 404/400)
      return callOpenAI(BASE_SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4000 });
    }

    const data = await response.json();

    // Responses API returns output array
    let text = '';
    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const block of item.content) {
            if (block.type === 'output_text' || block.type === 'text') {
              text += block.text;
            }
          }
        }
      }
    }

    // Fallback: try top-level text field
    if (!text && data.output_text) {
      text = data.output_text;
    }

    // If workflow returned empty text, fall back to Chat Completions
    if (!text.trim()) {
      log.error('OpenAI Responses API returned empty text — falling back to Chat Completions');
      return callOpenAI(BASE_SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4000 });
    }

    const tokensUsed = data.usage?.total_tokens || 0;

    return { text: text.trim(), tokensUsed };
  } catch (err) {
    // Network errors, timeouts, JSON parse failures — all fall back to Chat Completions
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('OpenAI Responses API failed with exception — falling back to Chat Completions', { error: errMsg });
    return callOpenAI(BASE_SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4000 });
  }
}

// ---------------------------------------------------------------------------
// Unsplash Image Search
// ---------------------------------------------------------------------------

interface UnsplashImageResult {
  /** Full-size image URL suitable for hero images (w=1200) */
  heroUrl: string;
  /** Smaller image URL suitable for thumbnails (w=400) */
  thumbnailUrl: string;
  /** Unsplash attribution (photographer name) */
  photographerName: string;
  /** Unsplash attribution link */
  photographerUrl: string;
  /** Unsplash photo ID for dedup tracking */
  photoId: string;
}

/**
 * Search Unsplash for a relevant stock photo using the AI-suggested query.
 * Returns sized URLs for hero and thumbnail use.
 * Gracefully returns undefined if the key is missing or the search fails.
 *
 * @param query - Search query for Unsplash
 * @param excludeIds - Optional set of Unsplash photo IDs to skip (stale image prevention)
 */
export async function searchUnsplashImage(
  query: string,
  excludeIds?: Set<string>,
): Promise<UnsplashImageResult | undefined> {
  const accessKey = Deno.env.get('UNSPLASH_ACCESS_KEY')?.trim();
  if (!accessKey) {
    log.error('UNSPLASH_ACCESS_KEY not configured — skipping image search. Set this secret for Unsplash images to work.');
    return undefined;
  }

  // Reject obviously invalid keys (placeholder values the user may not have replaced)
  if (accessKey.length < 10 || accessKey === 'your-unsplash-access-key' || accessKey.startsWith('sk-')) {
    log.error('UNSPLASH_ACCESS_KEY appears invalid (too short or placeholder value)', { keyLength: accessKey.length });
    return undefined;
  }

  try {
    // Request more results when we have exclusions to increase the chance of a fresh image
    const perPage = excludeIds && excludeIds.size > 0 ? '10' : '3';

    const params = new URLSearchParams({
      query,
      per_page: perPage,
      orientation: 'landscape',
      content_filter: 'high',   // Safe content only
    });

    const url = `https://api.unsplash.com/search/photos?${params.toString()}`;
    log.info('Calling Unsplash API', { url, query, perPage });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unable to read body');
      log.error('Unsplash API error — image search failed', {
        status: response.status,
        statusText: response.statusText,
        query,
        errorBody: errorBody.slice(0, 500),
        hint: response.status === 401
          ? 'Invalid UNSPLASH_ACCESS_KEY — check the key value in your Supabase secrets'
          : response.status === 403
          ? 'Unsplash access forbidden — the API key may lack permissions or the app may need approval'
          : response.status === 429
          ? 'Unsplash rate limit exceeded — try again later'
          : 'Unexpected error from Unsplash API',
      });
      return undefined;
    }

    const data = await response.json();
    const results = data.results || [];
    if (results.length === 0) {
      log.info('No Unsplash results for query', { query });
      return undefined;
    }

    // Pick the first result not in the exclusion set
    let photo = results[0];
    if (excludeIds && excludeIds.size > 0) {
      const fresh = results.find((p: { id: string }) => !excludeIds.has(p.id));
      if (fresh) {
        photo = fresh;
        log.info('Skipped excluded images, using fresh result', { photoId: photo.id, skipped: excludeIds.size });
      } else {
        log.info('All results were in exclusion set — using first result anyway', { query });
      }
    }

    // Use Unsplash's dynamic image resizing via URL params
    // raw URL allows appending sizing params: &w=1200&fit=crop&q=80
    const rawUrl: string = photo.urls?.raw || photo.urls?.full || '';
    if (!rawUrl) {
      log.error('Unsplash photo found but has no raw/full URL', { photoId: photo.id, urls: JSON.stringify(photo.urls) });
      return undefined;
    }

    log.info('Unsplash image found successfully', { photoId: photo.id, query });

    return {
      heroUrl: `${rawUrl}&w=1200&h=630&fit=crop&q=80`,
      thumbnailUrl: `${rawUrl}&w=400&h=300&fit=crop&q=80`,
      photographerName: photo.user?.name || 'Unknown',
      photographerUrl: photo.user?.links?.html || 'https://unsplash.com',
      /** Unsplash photo ID for dedup tracking */
      photoId: photo.id,
    };
  } catch (err) {
    log.error('Unsplash image search failed with exception', { query, error: err instanceof Error ? err.message : String(err) });
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Full Article Generation
// ---------------------------------------------------------------------------

function buildArticleGenerationPrompt(brief: GenerateArticleBrief): string {
  const lengthMap = {
    short: '400-600 words',
    medium: '800-1200 words',
    long: '1500-2000 words',
  };

  const audienceMap = {
    advisors: 'qualified financial advisors and wealth managers',
    clients: 'high-net-worth individuals and retail investors seeking financial guidance',
    both: 'both financial professionals and educated consumers',
  };

  const toneMap: Record<string, string> = {
    professional: 'formal, authoritative, and suitable for a financial services publication',
    conversational: 'warm, approachable, and easy to read while remaining professional',
    authoritative: 'confident, data-driven, and expert-level without being condescending',
    friendly: 'welcoming, supportive, and encouraging while maintaining credibility',
    educational: 'explanatory, patient, and structured for learning, with clear definitions',
  };

  // Build category auto-detection instruction
  const categoryInstruction = brief.availableCategories && brief.availableCategories.length > 0
    ? `\nCATEGORY AUTO-DETECTION: No category was manually selected. Based on the topic and content, choose the single most appropriate category from this list: [${brief.availableCategories.join(', ')}]. Return your choice as "suggestedCategory" in the JSON output.`
    : '';

  let prompt = `You are an expert South African financial content writer for Navigate Wealth, a wealth management platform.

Generate a complete, publication-ready article with the following specifications:

TOPIC: ${brief.topic}
TARGET AUDIENCE: ${audienceMap[brief.audience]}
TONE: ${toneMap[brief.tone] || toneMap.professional}
TARGET LENGTH: ${lengthMap[brief.targetLength]}
${brief.categoryName ? `CATEGORY: ${brief.categoryName}` : ''}${categoryInstruction}

${brief.keyPoints && brief.keyPoints.length > 0 ? `KEY POINTS TO COVER:\n${brief.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}

${brief.additionalInstructions ? `ADDITIONAL INSTRUCTIONS: ${brief.additionalInstructions}` : ''}

${brief.templateBody ? `USE THIS TEMPLATE AS A STRUCTURAL GUIDE (adapt headings and sections as appropriate):\n${brief.templateBody}` : ''}

REQUIREMENTS:
- You must fully rewrite and enhance all content into polished Navigate Wealth material that reads as entirely original
- Never reference, cite, or attribute the original source in any way
- You are not merely paraphrasing — you are strengthening structure, sharpening clarity, enhancing strategic interpretation, and clearly explaining the long-term wealth implications of the information

NUMERICAL ACCURACY (NON-NEGOTIABLE):
- All facts, data points, statistics, percentages, dates, thresholds, limits, and rand values contained in source material must be included accurately and precisely
- Absolutely no omission of material figures — no numerical information may be excluded
- If a source references changes — such as adjustments to VAT, TFSA annual limits, retirement fund thresholds, tax brackets, rebates, or contribution caps — you must explicitly state the exact percentages, rand amounts, and effective dates
- Under no circumstances may you generalise changes without including the specific values involved

AUDIENCE AND LOCALISATION:
- Articles must be written directly to Navigate Wealth clients as the primary audience
- All content must be interpreted through a South African financial planning lens
- Incorporate South African tax law, SARS implications, Regulation 28 considerations, retirement annuities, tax-free savings accounts, discretionary investing structures, rand exposure versus offshore allocation, JSE dynamics, and the broader South African economic environment
- Global material must always be reframed for South African investors

TONE AND STYLE:
- Professional, authoritative, strategic, precise, and intellectually confident
- Avoid sensationalism, fluff, filler, or academic detachment
- Each article must include a strong headline, clear subheadings, structured paragraphs, and conclude with a decisive strategic advisory takeaway

SOURCE ATTRIBUTION (STRICTLY FORBIDDEN):
- Under no circumstances may you mention the original publication
- Never use phrases such as "according to a recent article," "a report by," "sources indicate," or similar attribution language
- Never include hyperlinks to source material
- Never copy sentences verbatim or display obvious paraphrasing patterns

NAVIGATE WEALTH POSITIONING:
- Every article must reinforce the importance of independent professional advice
- Clearly position Navigate Wealth as a forward-thinking, highly competent advisory firm
- Demonstrate the value of working with a Navigate Wealth financial adviser in navigating complexity and making sound, strategic financial decisions

FORMATTING RULES:
- Use South African English spelling (e.g., "optimise" not "optimize", "colour" not "color")
- Use ZAR (R) for currency references unless otherwise specified
- Format dates as dd MMM yyyy (e.g., 22 Feb 2026)
- Output clean HTML that works with a TipTap editor (use <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags)
- Do NOT wrap output in markdown code fences

COMPLIANCE:
- Never guarantee investment returns or make specific performance promises
- Comply with South African financial services regulations (FAIS Act, FICA, POPIA)
- Always recommend professional advice for individual circumstances

OUTPUT FORMAT — Return ONLY a valid JSON object with these exact fields:
{
  "title": "The article title (compelling, 40-80 characters)",
  "excerpt": "A concise summary for article cards and meta descriptions (150-160 characters)",
  "body": "The full article body as clean HTML using <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags. Do NOT use <h1>. Do NOT wrap in markdown code fences.",
  "suggestedSlug": "url-friendly-slug-from-title",
  "suggestedMetaDescription": "SEO-optimised meta description (150-160 characters)",
  "imageSearchQuery": "2-4 keyword phrase optimised for finding a relevant, professional stock photograph on Unsplash (e.g., 'financial planning meeting', 'south african cityscape office', 'retirement savings charts'). Choose visually appealing, non-generic terms."${brief.availableCategories && brief.availableCategories.length > 0 ? ',\n  "suggestedCategory": "The most appropriate category name from the provided list"' : ''}
}

Return ONLY the JSON object — no markdown, no explanation, no code fences.`;

  return prompt;
}

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
  } catch (parseErr) {
    log.error('Failed to parse article generation response as JSON', { text: text.slice(0, 500) });
    // Attempt to extract fields manually
    parsed = {
      title: brief.topic,
      excerpt: '',
      body: cleanHTML(text),
      suggestedSlug: brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      suggestedMetaDescription: '',
    };
  }

  const body = typeof parsed.body === 'string' ? cleanHTML(parsed.body) : '';
  const wordCount = body.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const result: GenerateArticleResult = {
    title: (parsed.title as string) || brief.topic,
    excerpt: (parsed.excerpt as string) || '',
    body,
    suggestedSlug: (parsed.suggestedSlug as string) || brief.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    readingTimeMinutes: readingTime,
    suggestedMetaDescription: (parsed.suggestedMetaDescription as string) || '',
    tokensUsed,
    suggestedCategoryName: (parsed.suggestedCategory as string) || undefined,
  };

  // Search Unsplash for a hero/thumbnail image using the AI-suggested query
  // Fallback: derive a search query from the article title if the AI didn't provide one
  const imageSearchQuery = (parsed.imageSearchQuery as string)
    || deriveImageSearchQuery(result.title, brief.topic);
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

function postProcess(action: AIAction, rawText: string, tokensUsed: number): AIWritingResponse {
  switch (action) {
    case 'headline': {
      try {
        const headlines = JSON.parse(rawText);
        return {
          result: headlines[0] || rawText,
          suggestions: Array.isArray(headlines) ? headlines : [rawText],
          action,
          tokensUsed,
        };
      } catch {
        // If JSON parse fails, split by newlines
        const lines = rawText
          .split('\n')
          .map((l: string) => l.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, '').trim())
          .filter(Boolean);
        return {
          result: lines[0] || rawText,
          suggestions: lines.length > 1 ? lines : [rawText],
          action,
          tokensUsed,
        };
      }
    }

    case 'compliance_check': {
      try {
        const parsed = JSON.parse(rawText);
        return {
          result: parsed.summary || 'Compliance review complete.',
          warnings: parsed.issues?.map(
            (i: { text: string; issue: string; severity: string; suggestion: string }) =>
              `[${i.severity?.toUpperCase()}] ${i.issue}: "${i.text}" — ${i.suggestion}`
          ),
          suggestions: [parsed.overallRisk ? `Overall risk: ${parsed.overallRisk}` : 'Review complete'],
          action,
          tokensUsed,
        };
      } catch {
        return {
          result: rawText,
          action,
          tokensUsed,
        };
      }
    }

    case 'seo_optimize': {
      try {
        const parsed = JSON.parse(rawText);
        return {
          result: parsed.metaDescription || rawText,
          suggestions: [
            parsed.seoTitle && `SEO Title: ${parsed.seoTitle}`,
            parsed.readabilityScore && `Readability: ${parsed.readabilityScore}`,
            ...(parsed.improvements || []),
            ...(parsed.suggestedKeywords?.map((k: string) => `Keyword: ${k}`) || []),
          ].filter(Boolean),
          action,
          tokensUsed,
        };
      } catch {
        return { result: rawText, action, tokensUsed };
      }
    }

    case 'generate_callout': {
      try {
        const parsed = JSON.parse(rawText);
        return {
          result: parsed.content || rawText,
          suggestions: [parsed.type || 'takeaway'],
          action,
          tokensUsed,
        };
      } catch {
        return { result: rawText, suggestions: ['takeaway'], action, tokensUsed };
      }
    }

    case 'excerpt':
      return {
        result: rawText.replace(/<[^>]+>/g, '').slice(0, 250),
        action,
        tokensUsed,
      };

    default:
      return {
        result: cleanHTML(rawText),
        action,
        tokensUsed,
      };
  }
}

/**
 * Strip markdown code fences and ensure valid HTML output.
 */
function cleanHTML(text: string): string {
  let cleaned = text
    .replace(/^```html?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  // If the result doesn't contain any HTML tags, wrap in <p>
  if (!/<[a-z][\s\S]*>/i.test(cleaned)) {
    cleaned = cleaned
      .split('\n\n')
      .map((para: string) => `<p>${para.trim()}</p>`)
      .join('\n');
  }

  return cleaned;
}

/**
 * Derive an Unsplash image search query from the article title and topic.
 * This is a fallback mechanism when the AI doesn't provide a search query.
 *
 * @param title - The article title
 * @param topic - The article topic
 * @returns A search query string
 */
function deriveImageSearchQuery(title: string, topic: string): string {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'not', 'no', 'your', 'our', 'their',
    'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom',
    'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'up', 'down', 'out', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'all', 'each',
    'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
    'weekly', 'monthly', 'insights', 'investors', 'guide', 'overview',
  ]);

  // Prefer topic if it's concise (short topics are often more descriptive)
  const source = topic.length <= 60 ? topic : title;
  const keywords = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Take 3-4 meaningful keywords, append 'professional' for better stock photo quality
  const selected = keywords.slice(0, 3).join(' ');
  return selected || 'financial planning professional';
}

// ---------------------------------------------------------------------------
// Public API: AI Writing Request Processing
// ---------------------------------------------------------------------------

/**
 * Process an AI writing request (inline editor actions like improve, expand, etc.)
 *
 * @param request - The AI writing request with action, content, and context
 * @returns Processed AI writing response
 */
export async function processAIWritingRequest(request: AIWritingRequest): Promise<AIWritingResponse> {
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