/**
 * Social-media AI image generation: brand context, DALL-E prompt building,
 * the image bucket + storage upload, and the image history. One slice of
 * social-media-ai-service.ts.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getOpenAIKey, getSupabase } from './social-media-ai-shared.ts';
import type { SocialAIPlatform } from './social-media-ai-text.ts';

const log = createModuleLogger('social-media-ai');

const AI_IMAGES_BUCKET = 'make-91ed8379-social-ai-images';

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
    "South African context: use landscapes, cityscapes, and people that reflect South Africa's diversity.",
    'Never include specific text, logos, or watermarks in the generated image.',
    'Avoid stock-photo clichés (e.g., piggy banks, stacked coins, generic handshakes).',
    'Prefer abstract geometric patterns, real-life lifestyle imagery, or conceptual illustrations.',
  ].join(' '),

  /** Colour hex values for prompt enrichment */
  colours: {
    primary: '#1B2A4A', // Deep Navy
    accent: '#C9A84C', // Warm Gold
    background: '#FFFFFF', // White
    surface: '#F4F5F7', // Light Grey
    muted: '#64748B', // Slate
  },
} as const;

/**
 * DALL-E 3 supported sizes and their mapping to social platform formats.
 * DALL-E 3 only supports: 1024x1024, 1024x1792, 1792x1024
 */
const DALLE_PLATFORM_DIMENSIONS: Record<
  string,
  { size: '1024x1024' | '1024x1792' | '1792x1024'; label: string }
> = {
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
      const swatches = (
        palette as { swatches: Array<{ name: string; hex: string; group: string }> }
      ).swatches;
      if (swatches.length > 0) {
        const colourLines = swatches.map((s) => `${s.name} (${s.group}): ${s.hex}`);
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
function buildImagePrompt(input: GenerateImageInput, brand: BrandContext): string {
  const styleDirective = IMAGE_STYLE_DIRECTIVES[input.style] || IMAGE_STYLE_DIRECTIVES.editorial;
  const platformDims = DALLE_PLATFORM_DIMENSIONS[input.platform];
  const platformContext = platformDims ? `This image is for a ${platformDims.label} post.` : '';

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
    parts.push(
      `TOPIC CONTEXT: The post is about "${input.topic}" in the context of financial planning and wealth management.`,
    );
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
  const platformDims =
    DALLE_PLATFORM_DIMENSIONS[input.platform] || DALLE_PLATFORM_DIMENSIONS.linkedin;
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
export async function getImageHistory(userId: string, limit = 20): Promise<AIImageRecord[]> {
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
