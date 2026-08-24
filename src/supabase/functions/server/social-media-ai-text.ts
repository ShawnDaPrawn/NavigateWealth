/**
 * Social-media AI text generation: platform limits, the stored/system
 * prompts, the OpenAI call paths (Responses + Chat Completions), and the
 * generation history. One slice of social-media-ai-service.ts.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  OPENAI_PRIMARY_MODEL,
  applyChatTokenLimit,
  isResponsesOnlyModel,
} from './ai-model-config.ts';
import { getOpenAIKey } from './social-media-ai-shared.ts';

const log = createModuleLogger('social-media-ai');

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
async function callOpenAI(
  input: GeneratePostTextInput,
): Promise<{ content: string; tokensUsed: number }> {
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
  const body: Record<string, unknown> = {
    model: OPENAI_PRIMARY_MODEL,
    input: userPrompt,
    prompt: {
      id: STORED_PROMPT_ID,
      version: STORED_PROMPT_VERSION,
    },
  };
  if (!isResponsesOnlyModel(OPENAI_PRIMARY_MODEL)) body.temperature = 0.7;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
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
  const body: Record<string, unknown> = {
    model: OPENAI_PRIMARY_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  };
  if (!isResponsesOnlyModel(OPENAI_PRIMARY_MODEL)) body.temperature = 0.7;
  applyChatTokenLimit(body, OPENAI_PRIMARY_MODEL, 2000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    log.error('OpenAI Chat Completions API error:', error);

    if (response.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.');
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
  let parsed: {
    posts: Array<{ platform: string; content: string; hashtags?: string[]; callToAction?: string }>;
  };
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
    throw new Error('AI generated an invalid response format. Please try again.', {
      cause: parseErr,
    });
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
    const hashtagText =
      hashtags.length > 0
        ? '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
        : '';
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
export async function getGenerationById(generationId: string): Promise<AIGenerationRecord | null> {
  const record = await kv.get(`social_ai_generation:${generationId}`);
  return record || null;
}

// ===========================================================================
// IMAGE GENERATION (Phase 2)
// ===========================================================================

// ---------------------------------------------------------------------------
// Brand Context Resolver
// ---------------------------------------------------------------------------
