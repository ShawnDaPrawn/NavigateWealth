/**
 * Social Media AI Service
 *
 * Orchestrates OpenAI API calls for social media content generation.
 * Supports platform-specific post text generation using a stored prompt
 * or a fallback system prompt.
 *
 * Business logic lives here; routes are thin dispatchers.
 *
 * @module social-media/ai-service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const log = createModuleLogger('social-media-ai');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const getOpenAIKey = () => Deno.env.get('OPENAI_API_KEY');

/** Lazy Supabase admin client for Storage operations */
const getSupabase = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  );

const AI_IMAGES_BUCKET = 'make-91ed8379-social-ai-images';

/** Stored prompt for social media content generation (OpenAI Responses API) */
const STORED_PROMPT_ID = 'pmpt_69acc00905788195b8a4b763943cc01407a6a471a6bfa00f';
const STORED_PROMPT_VERSION = '1';

/** Platform character limits */
const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  x: 280,
  twitter: 280,
};

/** Platform display names */
const PLATFORM_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  twitter: 'X (Twitter)',
};

// ---------------------------------------------------------------------------
// Brand Identity Constants (Navigate Wealth defaults)
// ---------------------------------------------------------------------------

/**
 * Navigate Wealth default brand identity.
 * Used as the base for all DALL-E prompts.
 * When the brand colour palette is stored in KV (brand:colours:palette),
 * those colours augment these defaults at generation time.
 */
const NW_BRAND_DEFAULTS = {
  /** Core visual identity description injected into every DALL-E prompt */
  visualIdentity: [
    'Navigate Wealth is a premium South African financial advisory brand.',
    'The visual style is modern, clean, and sophisticated — never cluttered or gimmicky.',
    'Photography style: high-end editorial, warm natural lighting, real-world settings.',
    'Colour palette: deep navy blue (#1B2A4A) as the primary brand colour, paired with warm gold (#C9A84C) as an accent.',
    'Supporting colours: crisp white (#FFFFFF), light grey (#F4F5F7), and soft slate (#64748B).',
    'Typography feel: clean sans-serif, generous whitespace, strong visual hierarchy.',
    'Imagery should evoke trust, growth, clarity, and financial confidence.',
    'South African context: use landscapes, cityscapes, and people that reflect South Africa\'s diversity.',
    'Never include specific text, logos, or watermarks in the generated image.',
    'Avoid stock-photo clichés (e.g., piggy banks, stacked coins, generic handshakes).',
    'Prefer abstract geometric patterns, real-life lifestyle imagery, or conceptual illustrations.',
  ].join(' '),

  /** Colour hex values for prompt enrichment */
  colours: {
    primary: '#1B2A4A',    // Deep Navy
    accent: '#C9A84C',     // Warm Gold
    background: '#FFFFFF', // White
    surface: '#F4F5F7',    // Light Grey
    muted: '#64748B',      // Slate
  },
} as const;

/**
 * DALL-E 3 supported sizes and their mapping to social platform formats.
 * DALL-E 3 only supports: 1024x1024, 1024x1792, 1792x1024
 */
const DALLE_PLATFORM_DIMENSIONS: Record<string, { size: '1024x1024' | '1024x1792' | '1792x1024'; label: string }> = {
  // LinkedIn: landscape feed posts (1200×627 → 1792x1024)
  linkedin: { size: '1792x1024', label: 'LinkedIn landscape' },
  // Instagram: square feed posts (1080×1080 → 1024x1024)
  instagram: { size: '1024x1024', label: 'Instagram square' },
  // Instagram story: portrait (1080×1920 → 1024x1792)
  instagram_story: { size: '1024x1792', label: 'Instagram story' },
  // Facebook: landscape feed posts (1200×630 → 1792x1024)
  facebook: { size: '1792x1024', label: 'Facebook landscape' },
  // X/Twitter: landscape (1200×675 → 1792x1024)
  x: { size: '1792x1024', label: 'X landscape' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialAIPlatform = 'linkedin' | 'instagram' | 'facebook' | 'x';

export type ContentTone =
  | 'professional'
  | 'conversational'
  | 'authoritative'
  | 'friendly'
  | 'educational';

export type ContentGoal =
  | 'engagement'
  | 'awareness'
  | 'education'
  | 'promotion'
  | 'thought_leadership';

export interface GeneratePostTextInput {
  /** Target platforms for content generation */
  platforms: SocialAIPlatform[];
  /** Topic or subject for the post */
  topic: string;
  /** Desired tone of the content */
  tone: ContentTone;
  /** Content goal */
  goal: ContentGoal;
  /** Optional article body to repurpose into social posts */
  articleContent?: string;
  /** Optional article title for context */
  articleTitle?: string;
  /** Key points to include */
  keyPoints?: string[];
  /** Whether to include hashtags */
  includeHashtags: boolean;
  /** Whether to include a call-to-action */
  includeCTA: boolean;
  /** Custom instructions */
  additionalInstructions?: string;
}

export interface GeneratedPlatformPost {
  platform: SocialAIPlatform;
  content: string;
  hashtags: string[];
  characterCount: number;
  characterLimit: number;
  withinLimit: boolean;
  callToAction?: string;
}

export interface GeneratePostTextResult {
  posts: GeneratedPlatformPost[];
  tokensUsed: number;
  generationId: string;
}

export interface AIGenerationRecord {
  id: string;
  input: GeneratePostTextInput;
  result: GeneratePostTextResult;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Image Generation Types
// ---------------------------------------------------------------------------

export type ImageStyle =
  | 'photorealistic'
  | 'editorial'
  | 'abstract'
  | 'conceptual'
  | 'lifestyle'
  | 'data_visualisation';

export interface GenerateImageInput {
  /** Target platform(s) — determines DALL-E output dimensions */
  platform: SocialAIPlatform | 'instagram_story';
  /** Subject / scene description */
  subject: string;
  /** Visual style preference */
  style: ImageStyle;
  /** Optional topic context (used to enrich the prompt) */
  topic?: string;
  /** Optional additional style instructions */
  additionalInstructions?: string;
  /** Quality: standard or hd */
  quality?: 'standard' | 'hd';
}

export interface GeneratedImage {
  /** Platform this image was sized for */
  platform: string;
  /** Supabase Storage signed URL (1-hour expiry) */
  signedUrl: string;
  /** Storage path (for later retrieval / deletion) */
  storagePath: string;
  /** DALL-E dimensions used */
  dimensions: string;
  /** The final prompt sent to DALL-E (useful for iteration) */
  revisedPrompt: string;
}

export interface GenerateImageResult {
  images: GeneratedImage[];
  generationId: string;
}

export interface AIImageRecord {
  id: string;
  input: GenerateImageInput;
  result: GenerateImageResult;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// System prompt (fallback when stored prompt is not available)
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `You are the social media content strategist for Navigate Wealth, a South African financial advisory practice. Your role is to create engaging, platform-specific social media posts.

CORE IDENTITY:
- Navigate Wealth is a forward-thinking, highly competent financial advisory firm
- Content must reinforce the importance of independent professional advice
- All content is aimed at South African audiences

LOCALISATION:
- Use South African English spelling (e.g., "optimise" not "optimize")
- Reference South African financial concepts where relevant (RA, TFSA, Reg 28, JSE)
- Use ZAR (R) for currency references
- Reference South African economic context

COMPLIANCE (NON-NEGOTIABLE):
- Never guarantee investment returns or make specific performance promises
- Comply with FAIS Act, FICA, POPIA
- Always recommend professional advice for individual circumstances
- No misleading claims about financial products

TONE GUIDELINES:
- Professional: Authoritative, data-driven, suitable for industry peers
- Conversational: Approachable, relatable, uses everyday language
- Authoritative: Expert positioning, thought leadership, confident
- Friendly: Warm, inclusive, community-building
- Educational: Informative, explanatory, value-adding

OUTPUT FORMAT:
You MUST respond with valid JSON only. No markdown, no code fences, no explanation text.
The JSON must match this structure exactly:
{
  "posts": [
    {
      "platform": "linkedin",
      "content": "The post body text without hashtags",
      "hashtags": ["hashtag1", "hashtag2"],
      "callToAction": "Optional CTA text"
    }
  ]
}`;
}

function buildUserPrompt(input: GeneratePostTextInput): string {
  const platformList = input.platforms
    .map((p) => `${PLATFORM_NAMES[p]} (max ${PLATFORM_CHAR_LIMITS[p]} chars)`)
    .join(', ');

  let prompt = `Generate social media posts for the following platforms: ${platformList}

Topic: ${input.topic}
Tone: ${input.tone}
Goal: ${input.goal}
Include hashtags: ${input.includeHashtags ? 'Yes (3-5 relevant hashtags per platform)' : 'No'}
Include CTA: ${input.includeCTA ? 'Yes' : 'No'}`;

  if (input.keyPoints && input.keyPoints.length > 0) {
    prompt += `\n\nKey points to cover:\n${input.keyPoints.map((p) => `- ${p}`).join('\n')}`;
  }

  if (input.articleContent) {
    prompt += `\n\nRepurpose this article content into social posts:\n`;
    if (input.articleTitle) {
      prompt += `Title: ${input.articleTitle}\n`;
    }
    // Truncate article content to avoid excessive token usage
    const truncated = input.articleContent.slice(0, 3000);
    prompt += `Content: ${truncated}${input.articleContent.length > 3000 ? '...[truncated]' : ''}`;
  }

  if (input.additionalInstructions) {
    prompt += `\n\nAdditional instructions: ${input.additionalInstructions}`;
  }

  prompt += `\n\nGenerate one post per platform. Each post must respect the platform's character limit and conventions. Respond with valid JSON only.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// OpenAI API Calls
// ---------------------------------------------------------------------------

/**
 * Try the OpenAI Responses API with stored prompt first.
 * Falls back to Chat Completions API if stored prompt fails.
 */
async function callOpenAI(input: GeneratePostTextInput): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const userPrompt = buildUserPrompt(input);

  // Attempt 1: Try stored prompt via Responses API
  try {
    log.info('Attempting OpenAI Responses API with stored prompt');
    const responsesResult = await callResponsesAPI(apiKey, userPrompt);
    return responsesResult;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Stored prompt failed, falling back to Chat Completions API', { error: msg });
  }

  // Attempt 2: Fallback to Chat Completions API
  return callChatCompletionsAPI(apiKey, userPrompt);
}

/**
 * Call OpenAI Responses API with stored prompt
 */
async function callResponsesAPI(
  apiKey: string,
  userPrompt: string,
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      input: userPrompt,
      prompt: {
        id: STORED_PROMPT_ID,
        version: STORED_PROMPT_VERSION,
      },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Responses API error: ${response.status} - ${error?.error?.message || 'Unknown error'}`,
    );
  }

  const data = await response.json();

  // Extract text from the Responses API output
  const outputText =
    data.output_text ||
    data.output?.find?.((o: Record<string, unknown>) => o.type === 'message')?.content?.[0]?.text ||
    '';

  const tokensUsed = data.usage?.total_tokens || 0;

  return { content: outputText, tokensUsed };
}

/**
 * Fallback: Call OpenAI Chat Completions API with inline system prompt
 */
async function callChatCompletionsAPI(
  apiKey: string,
  userPrompt: string,
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    log.error('OpenAI Chat Completions API error:', error);

    if (response.status === 429) {
      throw new Error(
        'OpenAI API rate limit exceeded. Please wait a moment and try again.',
      );
    }
    if (response.status === 401) {
      throw new Error('OpenAI API authentication failed. Please check your API key.');
    }
    throw new Error(
      `OpenAI API error: ${response.status} - ${error?.error?.message || 'Unknown error'}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const tokensUsed = data.usage?.total_tokens || 0;

  return { content, tokensUsed };
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Generate social media post text for specified platforms.
 */
export async function generatePostText(
  input: GeneratePostTextInput,
  userId: string,
): Promise<GeneratePostTextResult> {
  log.info('Generating social media post text', {
    platforms: input.platforms,
    topic: input.topic.slice(0, 50),
    tone: input.tone,
    goal: input.goal,
  });

  const { content: rawContent, tokensUsed } = await callOpenAI(input);

  // Parse the JSON response
  let parsed: { posts: Array<{ platform: string; content: string; hashtags?: string[]; callToAction?: string }> };
  try {
    // Strip any markdown fences if present
    const cleaned = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (parseErr: unknown) {
    log.error('Failed to parse OpenAI response as JSON', {
      rawContent: rawContent.slice(0, 500),
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    throw new Error(
      'AI generated an invalid response format. Please try again.',
    );
  }

  if (!parsed.posts || !Array.isArray(parsed.posts)) {
    throw new Error('AI response missing posts array. Please try again.');
  }

  // Map to typed result with character count validation
  const posts: GeneratedPlatformPost[] = parsed.posts.map((post) => {
    const platform = post.platform as SocialAIPlatform;
    const charLimit = PLATFORM_CHAR_LIMITS[platform] || 3000;
    const fullContent = post.content || '';
    const hashtags = post.hashtags || [];
    const hashtagText = hashtags.length > 0 ? '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '';
    const totalLength = fullContent.length + hashtagText.length;

    return {
      platform,
      content: fullContent,
      hashtags: hashtags.map((h) => h.replace(/^#/, '')),
      characterCount: totalLength,
      characterLimit: charLimit,
      withinLimit: totalLength <= charLimit,
      callToAction: post.callToAction,
    };
  });

  const generationId = crypto.randomUUID();

  const result: GeneratePostTextResult = {
    posts,
    tokensUsed,
    generationId,
  };

  // Persist generation record for history
  const record: AIGenerationRecord = {
    id: generationId,
    input,
    result,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  try {
    await kv.set(`social_ai_generation:${generationId}`, record);
    log.info('AI generation record saved', { generationId });
  } catch (kvErr: unknown) {
    // Non-critical — log but don't fail the request
    log.warn('Failed to save AI generation record', {
      generationId,
      error: kvErr instanceof Error ? kvErr.message : String(kvErr),
    });
  }

  log.success('Social media post text generated', {
    generationId,
    platformCount: posts.length,
    tokensUsed,
  });

  return result;
}

/**
 * Get AI generation history for the current admin.
 */
export async function getGenerationHistory(
  userId: string,
  limit = 20,
): Promise<AIGenerationRecord[]> {
  const allRecords = await kv.getByPrefix('social_ai_generation:');

  if (!allRecords || allRecords.length === 0) {
    return [];
  }

  // Filter by user, sort newest first, apply limit
  const userRecords = allRecords
    .filter((r: AIGenerationRecord) => r.createdBy === userId)
    .sort(
      (a: AIGenerationRecord, b: AIGenerationRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);

  return userRecords;
}

/**
 * Get a specific generation record by ID.
 */
export async function getGenerationById(
  generationId: string,
): Promise<AIGenerationRecord | null> {
  const record = await kv.get(`social_ai_generation:${generationId}`);
  return record || null;
}

// ===========================================================================
// IMAGE GENERATION (Phase 2)
// ===========================================================================

// ---------------------------------------------------------------------------
// Brand Context Resolver
// ---------------------------------------------------------------------------

interface BrandContext {
  visualIdentity: string;
  colourDescription: string;
  voiceTone: string;
}

/**
 * Build a brand context object by merging KV-stored brand data with defaults.
 * Reads from brand:colours:palette and brand:guidelines:voice (non-blocking).
 */
async function resolveBrandContext(): Promise<BrandContext> {
  let colourDescription = `Primary: deep navy blue (${NW_BRAND_DEFAULTS.colours.primary}). Accent: warm gold (${NW_BRAND_DEFAULTS.colours.accent}). Background: white (${NW_BRAND_DEFAULTS.colours.background}). Surface: light grey (${NW_BRAND_DEFAULTS.colours.surface}). Muted: slate (${NW_BRAND_DEFAULTS.colours.muted}).`;
  let voiceTone = 'Professional, trustworthy, forward-thinking.';

  try {
    const [palette, voice] = await Promise.all([
      kv.get('brand:colours:palette'),
      kv.get('brand:guidelines:voice'),
    ]);

    // Enrich colours from stored palette if available
    if (palette && typeof palette === 'object' && 'swatches' in palette) {
      const swatches = (palette as { swatches: Array<{ name: string; hex: string; group: string }> }).swatches;
      if (swatches.length > 0) {
        const colourLines = swatches.map(
          (s) => `${s.name} (${s.group}): ${s.hex}`,
        );
        colourDescription = `Brand colours from corporate identity: ${colourLines.join(', ')}.`;
        log.info('Using stored brand colour palette for image generation', {
          colourCount: swatches.length,
        });
      }
    }

    // Enrich voice/tone if available
    if (voice && typeof voice === 'object') {
      const v = voice as { tone?: string; terminology?: string; notes?: string };
      const parts: string[] = [];
      if (v.tone) parts.push(`Tone: ${v.tone}`);
      if (v.terminology) parts.push(`Terminology: ${v.terminology}`);
      if (v.notes) parts.push(v.notes);
      if (parts.length > 0) {
        voiceTone = parts.join('. ');
      }
    }
  } catch (brandErr: unknown) {
    log.warn('Failed to load brand context from KV, using defaults', {
      error: brandErr instanceof Error ? brandErr.message : String(brandErr),
    });
  }

  return {
    visualIdentity: NW_BRAND_DEFAULTS.visualIdentity,
    colourDescription,
    voiceTone,
  };
}

// ---------------------------------------------------------------------------
// DALL-E Prompt Builder
// ---------------------------------------------------------------------------

const IMAGE_STYLE_DIRECTIVES: Record<ImageStyle, string> = {
  photorealistic:
    'Photorealistic, high-resolution photograph. Natural lighting, shallow depth of field, editorial quality. Shot on a professional camera.',
  editorial:
    'High-end editorial photography style. Magazine-quality composition, dramatic but natural lighting, professional colour grading.',
  abstract:
    'Abstract geometric composition. Clean shapes, bold colour blocking, minimalist design. Modern graphic art style.',
  conceptual:
    'Conceptual illustration with metaphorical visual storytelling. Thoughtful composition, symbolic elements, sophisticated colour palette.',
  lifestyle:
    'Authentic lifestyle photography. Candid, warm, natural moments. Real people in real settings, aspirational but relatable.',
  data_visualisation:
    'Clean, modern data visualisation aesthetic. Abstract representation of charts, graphs, or financial growth patterns. Minimal, elegant, tech-forward.',
};

/**
 * Build the DALL-E prompt with Navigate Wealth branding baked in.
 */
function buildImagePrompt(
  input: GenerateImageInput,
  brand: BrandContext,
): string {
  const styleDirective = IMAGE_STYLE_DIRECTIVES[input.style] || IMAGE_STYLE_DIRECTIVES.editorial;
  const platformDims = DALLE_PLATFORM_DIMENSIONS[input.platform];
  const platformContext = platformDims
    ? `This image is for a ${platformDims.label} post.`
    : '';

  const parts: string[] = [
    // Core brand identity
    `BRAND CONTEXT: ${brand.visualIdentity}`,
    '',
    // Colour directive
    `COLOUR PALETTE: ${brand.colourDescription}. The image should harmonise with these brand colours — use them as dominant tones, accents, or background elements where natural.`,
    '',
    // Style directive
    `VISUAL STYLE: ${styleDirective}`,
    '',
    // Platform context
    platformContext,
    '',
    // Subject
    `SUBJECT: ${input.subject}`,
  ];

  if (input.topic) {
    parts.push(`TOPIC CONTEXT: The post is about "${input.topic}" in the context of financial planning and wealth management.`);
  }

  if (input.additionalInstructions) {
    parts.push(`ADDITIONAL REQUIREMENTS: ${input.additionalInstructions}`);
  }

  // Hard constraints
  parts.push(
    '',
    'CONSTRAINTS (NON-NEGOTIABLE):',
    '- Do NOT include any text, words, letters, numbers, logos, or watermarks in the image.',
    '- Do NOT render any UI elements, buttons, or interface components.',
    '- The image must be suitable for professional social media use by a financial advisory firm.',
    '- Avoid clichéd financial imagery (piggy banks, coin stacks, dollar signs).',
    '- Ensure the image feels premium, trustworthy, and South African in context.',
  );

  return parts.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Supabase Storage Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the AI images bucket exists (idempotent).
 */
async function ensureImageBucket(): Promise<void> {
  const supabase = getSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: { name: string }) => b.name === AI_IMAGES_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(AI_IMAGES_BUCKET, { public: false });
    if (error) {
      log.error('Failed to create AI images bucket', { error: error.message });
    } else {
      log.info('Created AI images bucket', { bucket: AI_IMAGES_BUCKET });
    }
  }
}

/**
 * Download image from URL (DALL-E returns a temporary URL) and upload to Supabase Storage.
 */
async function uploadImageToStorage(
  imageUrl: string,
  storagePath: string,
): Promise<{ storagePath: string; signedUrl: string }> {
  const supabase = getSupabase();

  // Download the image from DALL-E's temporary URL
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) {
    throw new Error(`Failed to download generated image: ${imgResponse.status}`);
  }

  const imageBuffer = await imgResponse.arrayBuffer();
  const uint8 = new Uint8Array(imageBuffer);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(AI_IMAGES_BUCKET)
    .upload(storagePath, uint8, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    log.error('Failed to upload AI image to storage', { error: uploadError.message, storagePath });
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // Create a signed URL (1 hour expiry)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(AI_IMAGES_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (signedError || !signedData?.signedUrl) {
    log.error('Failed to create signed URL', { error: signedError?.message, storagePath });
    throw new Error('Failed to create signed URL for uploaded image');
  }

  return { storagePath, signedUrl: signedData.signedUrl };
}

// ---------------------------------------------------------------------------
// DALL-E API Call
// ---------------------------------------------------------------------------

/**
 * Call OpenAI DALL-E 3 API to generate an image.
 */
async function callDALLE(
  prompt: string,
  size: '1024x1024' | '1024x1792' | '1792x1024',
  quality: 'standard' | 'hd' = 'standard',
): Promise<{ url: string; revisedPrompt: string }> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  log.info('Calling DALL-E 3 API', { size, quality, promptLength: prompt.length });

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    log.error('DALL-E 3 API error', { status: response.status, error });

    if (response.status === 429) {
      throw new Error('Image generation rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 400) {
      const msg = error?.error?.message || 'Invalid request';
      // DALL-E content policy rejections come as 400
      if (msg.includes('safety') || msg.includes('policy')) {
        throw new Error(
          'The image prompt was rejected by the content safety system. Please adjust the subject or style and try again.',
        );
      }
      throw new Error(`Image generation failed: ${msg}`);
    }
    throw new Error(
      `DALL-E API error: ${response.status} - ${error?.error?.message || 'Unknown error'}`,
    );
  }

  const data = await response.json();
  const imageData = data.data?.[0];

  if (!imageData?.url) {
    throw new Error('DALL-E returned no image data');
  }

  return {
    url: imageData.url,
    revisedPrompt: imageData.revised_prompt || prompt,
  };
}

// ---------------------------------------------------------------------------
// Public Image Generation Service Function
// ---------------------------------------------------------------------------

/**
 * Generate a branded social media image for a specific platform.
 * 1. Resolves brand context from KV store
 * 2. Builds a brand-aware DALL-E prompt
 * 3. Calls DALL-E 3 with platform-correct dimensions
 * 4. Uploads result to Supabase Storage
 * 5. Returns signed URL + metadata
 */
export async function generateImage(
  input: GenerateImageInput,
  userId: string,
): Promise<GenerateImageResult> {
  log.info('Generating branded social media image', {
    platform: input.platform,
    style: input.style,
    subject: input.subject.slice(0, 80),
  });

  // Ensure storage bucket exists
  await ensureImageBucket();

  // Resolve brand context
  const brand = await resolveBrandContext();

  // Build branded prompt
  const prompt = buildImagePrompt(input, brand);

  // Determine dimensions
  const platformDims = DALLE_PLATFORM_DIMENSIONS[input.platform] || DALLE_PLATFORM_DIMENSIONS.linkedin;
  const quality = input.quality || 'standard';

  // Call DALL-E
  const { url: tempUrl, revisedPrompt } = await callDALLE(prompt, platformDims.size, quality);

  // Upload to Supabase Storage
  const generationId = crypto.randomUUID();
  const timestamp = Date.now();
  const storagePath = `${userId}/${generationId}_${input.platform}_${timestamp}.png`;

  const { storagePath: finalPath, signedUrl } = await uploadImageToStorage(tempUrl, storagePath);

  const image: GeneratedImage = {
    platform: input.platform,
    signedUrl,
    storagePath: finalPath,
    dimensions: platformDims.size,
    revisedPrompt,
  };

  const result: GenerateImageResult = {
    images: [image],
    generationId,
  };

  // Persist image generation record
  const record: AIImageRecord = {
    id: generationId,
    input,
    result,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  try {
    await kv.set(`social_ai_image:${generationId}`, record);
    log.info('AI image record saved', { generationId });
  } catch (kvErr: unknown) {
    log.warn('Failed to save AI image record', {
      generationId,
      error: kvErr instanceof Error ? kvErr.message : String(kvErr),
    });
  }

  log.success('Branded social media image generated', {
    generationId,
    platform: input.platform,
    dimensions: platformDims.size,
    quality,
  });

  return result;
}

/**
 * Refresh a signed URL for a previously generated image.
 */
export async function refreshImageUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(AI_IMAGES_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    log.error('Failed to refresh signed URL', { error: error?.message, storagePath });
    return null;
  }
  return data.signedUrl;
}

/**
 * Get image generation history.
 */
export async function getImageHistory(
  userId: string,
  limit = 20,
): Promise<AIImageRecord[]> {
  const allRecords = await kv.getByPrefix('social_ai_image:');
  if (!allRecords || allRecords.length === 0) return [];

  return allRecords
    .filter((r: AIImageRecord) => r.createdBy === userId)
    .sort(
      (a: AIImageRecord, b: AIImageRecord) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);
}

// ===========================================================================
// BUNDLE GENERATION (Phase 3) — Text + Image in one flow
// ===========================================================================

export interface GenerateBundleInput {
  /** Text generation params */
  text: GeneratePostTextInput;
  /** Image generation params */
  image: GenerateImageInput;
}

export interface GenerateBundleResult {
  text: GeneratePostTextResult;
  image: GenerateImageResult;
  bundleId: string;
}

export interface AIBundleRecord {
  id: string;
  input: GenerateBundleInput;
  result: GenerateBundleResult;
  createdBy: string;
  createdAt: string;
}

/**
 * Generate a full content bundle: post text + branded image in parallel.
 */
export async function generateBundle(
  input: GenerateBundleInput,
  userId: string,
): Promise<GenerateBundleResult> {
  log.info('Generating content bundle (text + image)', {
    platforms: input.text.platforms,
    imagePlatform: input.image.platform,
    imageStyle: input.image.style,
  });

  // Run text and image generation in parallel
  const [textResult, imageResult] = await Promise.all([
    generatePostText(input.text, userId),
    generateImage(input.image, userId),
  ]);

  const bundleId = crypto.randomUUID();

  const result: GenerateBundleResult = {
    text: textResult,
    image: imageResult,
    bundleId,
  };

  // Persist bundle record
  const record: AIBundleRecord = {
    id: bundleId,
    input,
    result,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  try {
    await kv.set(`social_ai_bundle:${bundleId}`, record);
    log.info('AI bundle record saved', { bundleId });
  } catch (kvErr: unknown) {
    log.warn('Failed to save AI bundle record', {
      bundleId,
      error: kvErr instanceof Error ? kvErr.message : String(kvErr),
    });
  }

  log.success('Content bundle generated', {
    bundleId,
    textPlatforms: textResult.posts.length,
    imageCount: imageResult.images.length,
  });

  return result;
}

// ===========================================================================
// CUSTOM BRAND TEMPLATES (Phase 3+)
// ===========================================================================

export interface CustomBrandTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  platforms: string[];
  tone: string;
  goal: string;
  topicPrompt: string;
  includeHashtags: boolean;
  includeCTA: boolean;
  additionalInstructions: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function createCustomTemplate(
  input: Omit<CustomBrandTemplate, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  userId: string,
): Promise<CustomBrandTemplate> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const template: CustomBrandTemplate = { ...input, id, createdBy: userId, createdAt: now, updatedAt: now };
  await kv.set(`social_ai_template:${id}`, template);
  log.info('Custom brand template created', { id, name: template.name });
  return template;
}

export async function updateCustomTemplate(
  id: string,
  updates: Partial<Omit<CustomBrandTemplate, 'id' | 'createdBy' | 'createdAt'>>,
  userId: string,
): Promise<CustomBrandTemplate | null> {
  const existing = await kv.get(`social_ai_template:${id}`) as CustomBrandTemplate | null;
  if (!existing) return null;
  if (existing.createdBy !== userId) throw new Error('You can only edit templates you created');
  const updated: CustomBrandTemplate = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await kv.set(`social_ai_template:${id}`, updated);
  log.info('Custom brand template updated', { id, name: updated.name });
  return updated;
}

export async function deleteCustomTemplate(id: string, userId: string): Promise<boolean> {
  const existing = await kv.get(`social_ai_template:${id}`) as CustomBrandTemplate | null;
  if (!existing) return false;
  if (existing.createdBy !== userId) throw new Error('You can only delete templates you created');
  await kv.del(`social_ai_template:${id}`);
  log.info('Custom brand template deleted', { id, name: existing.name });
  return true;
}

export async function listCustomTemplates(userId: string): Promise<CustomBrandTemplate[]> {
  const allRecords = await kv.getByPrefix('social_ai_template:');
  if (!allRecords || allRecords.length === 0) return [];
  return (allRecords as CustomBrandTemplate[])
    .filter((t) => t.createdBy === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

// ===========================================================================
// AI ANALYTICS (Phase 3+)
// ===========================================================================

export async function getAIAnalytics(userId: string) {
  const [textRecords, imageRecords, bundleRecords] = await Promise.all([
    kv.getByPrefix('social_ai_generation:'),
    kv.getByPrefix('social_ai_image:'),
    kv.getByPrefix('social_ai_bundle:'),
  ]);

  const userText = ((textRecords || []) as AIGenerationRecord[]).filter((r) => r.createdBy === userId);
  const userImages = ((imageRecords || []) as AIImageRecord[]).filter((r) => r.createdBy === userId);
  const userBundles = ((bundleRecords || []) as AIBundleRecord[]).filter((r) => r.createdBy === userId);

  const platformBreakdown: Record<string, number> = {};
  const toneBreakdown: Record<string, number> = {};
  const goalBreakdown: Record<string, number> = {};
  const styleBreakdown: Record<string, number> = {};

  for (const rec of userText) {
    for (const p of rec.input.platforms) platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;
    toneBreakdown[rec.input.tone] = (toneBreakdown[rec.input.tone] || 0) + 1;
    goalBreakdown[rec.input.goal] = (goalBreakdown[rec.input.goal] || 0) + 1;
  }
  for (const rec of userImages) {
    platformBreakdown[rec.input.platform] = (platformBreakdown[rec.input.platform] || 0) + 1;
    styleBreakdown[rec.input.style] = (styleBreakdown[rec.input.style] || 0) + 1;
  }
  for (const rec of userBundles) {
    for (const p of rec.input.text.platforms) platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;
    toneBreakdown[rec.input.text.tone] = (toneBreakdown[rec.input.text.tone] || 0) + 1;
    goalBreakdown[rec.input.text.goal] = (goalBreakdown[rec.input.text.goal] || 0) + 1;
    styleBreakdown[rec.input.image.style] = (styleBreakdown[rec.input.image.style] || 0) + 1;
  }

  // Daily activity (last 30 days)
  const now = Date.now();
  const dailyMap: Record<string, { text: number; image: number; bundle: number }> = {};
  for (let d = 0; d < 30; d++) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    dailyMap[date] = { text: 0, image: 0, bundle: 0 };
  }
  for (const r of userText)   { const d = r.createdAt.slice(0, 10); if (dailyMap[d]) dailyMap[d].text++; }
  for (const r of userImages) { const d = r.createdAt.slice(0, 10); if (dailyMap[d]) dailyMap[d].image++; }
  for (const r of userBundles){ const d = r.createdAt.slice(0, 10); if (dailyMap[d]) dailyMap[d].bundle++; }

  const dailyActivity = Object.entries(dailyMap)
    .map(([date, counts]) => ({ date, ...counts }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Recent generations (last 20)
  const allRecent: Array<{ id: string; type: string; topic?: string; platforms?: string[]; createdAt: string }> = [];
  for (const r of userText) allRecent.push({ id: r.id, type: 'text', topic: r.input.topic, platforms: r.input.platforms, createdAt: r.createdAt });
  for (const r of userImages) allRecent.push({ id: r.id, type: 'image', topic: r.input.topic || r.input.subject, platforms: [r.input.platform], createdAt: r.createdAt });
  for (const r of userBundles) allRecent.push({ id: r.id, type: 'bundle', topic: r.input.text.topic, platforms: r.input.text.platforms, createdAt: r.createdAt });
  allRecent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    totalTextGenerations: userText.length,
    totalImageGenerations: userImages.length,
    totalBundleGenerations: userBundles.length,
    totalGenerations: userText.length + userImages.length + userBundles.length,
    platformBreakdown,
    toneBreakdown,
    goalBreakdown,
    styleBreakdown,
    dailyActivity,
    recentGenerations: allRecent.slice(0, 20),
  };
}