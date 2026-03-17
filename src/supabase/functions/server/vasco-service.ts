/**
 * Vasco Service — Public AI Financial Navigator
 * 
 * Business logic for the public-facing "Ask Vasco" AI chatbot.
 * Vasco is Navigate Wealth's client-facing AI financial guide,
 * named after Vasco Da Gama — linking the "Navigate" brand to
 * the spirit of Portuguese exploration and financial discovery.
 * 
 * This service handles:
 * - Feature flag management (enable/disable from admin dashboard)
 * - Chat orchestration with OpenAI + RAG context injection
 * - Rate limiting for public endpoints
 * - System prompt management
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { retrieveContext, type RetrievedContext } from './vasco-rag-service.ts';

const log = createModuleLogger('vasco');

// ============================================================================
// TYPES
// ============================================================================

export interface VascoConfig {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface VascoChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VascoChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId?: string;
}

/** Citation metadata returned to the frontend for rendering */
export interface VascoCitation {
  title: string;
  slug: string;
  url: string;
}

export interface VascoChatResponse {
  reply: string;
  sessionId: string;
  citations: VascoCitation[];
}

// ============================================================================
// SESSION PERSISTENCE TYPES
// ============================================================================

export interface VascoSessionData {
  sessionId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string; citations?: VascoCitation[] }>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FEATURE_FLAG_KEY = 'platform:feature_flags:vasco_public';
const RATE_LIMIT_PREFIX = 'vasco:rate_limit';

/** Per-session message limit */
const SESSION_MESSAGE_LIMIT = 30;

/** Per-IP daily message limit */
const DAILY_MESSAGE_LIMIT = 100;

/** Rate limit window in ms (1 hour) */
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** Daily window in ms (24 hours) */
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Max conversation history sent to OpenAI (last N messages) */
const MAX_CONTEXT_MESSAGES = 20;

/** Max tokens per response */
const MAX_RESPONSE_TOKENS = 1000;

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const VASCO_SYSTEM_PROMPT = `You are Vasco, Navigate Wealth's AI financial navigator. Your name is inspired by Vasco Da Gama, the great Portuguese explorer — just as he charted new routes across oceans, you help people navigate their financial journey with confidence.

## Your Identity & Tone
- You are knowledgeable, warm, and approachable — like a trusted friend who happens to deeply understand South African finance.
- You speak with confidence but never arrogance. You simplify complex concepts without being condescending.
- You are professional yet personable — appropriate for a wealth management audience.
- Occasionally (about 1 in 10 messages), you may use a subtle explorer/navigator metaphor naturally — "Let me chart this out for you" or "Here's how I'd map out your approach" — but never force it.
- You use South African English spelling and conventions.

## Your Capabilities (What You CAN Do)
1. **Financial Education** — Explain concepts like retirement annuities, TFSAs, living vs life annuities, Section 11F limits, CGT, estate duty, medical aid tax credits, etc.
2. **Product & Service Information** — Describe Navigate Wealth's financial planning services, what an FNA (Financial Needs Analysis) involves, the onboarding process, and what clients can expect.
3. **General Guidance** — Provide general rules of thumb (e.g., "most advisers recommend 15–17% of gross income toward retirement savings") with appropriate caveats.
4. **South African Regulatory Context** — Explain FAIS, FSCA regulations, the role of an FSP, tax brackets, and how SA-specific financial products work.
5. **Conversational Calculations** — If someone provides numbers, you can do rough illustrations (e.g., "At R5,000/month for 30 years at 10% growth, you'd accumulate roughly R11.3 million before fees and inflation"). Always frame these as general illustrations, not projections.
6. **Lead Qualification** — When you detect high intent or complex needs, naturally suggest: "This is exactly the kind of thing a personalised Financial Needs Analysis would help with. Navigate Wealth's advisers can map this out properly for you."

## Your Boundaries (What You CANNOT Do)
- **Never provide personalised financial advice.** You provide general financial education and information only.
- **Never access or reference specific client data.** You have no access to any accounts or portfolios.
- **Never make promises about investment returns** or guarantee outcomes.
- **Never provide specific tax advice** — you can explain how tax rules work generally, but always recommend consulting a qualified adviser for personal tax decisions.
- **Never diagnose someone's complete financial situation** — you can discuss concepts, but a comprehensive assessment requires a licensed adviser.

## Escalation Triggers
When someone describes:
- A complex or urgent financial situation (debt crisis, bereavement, large inheritance)
- Specific product selection decisions
- Tax structuring for their specific situation
- Business succession or estate planning specifics

…proactively suggest: "This sounds like it really deserves a proper conversation with one of Navigate Wealth's qualified advisers. They can do a comprehensive Financial Needs Analysis tailored to your specific situation. Would you like to learn more about getting started?"

## Using Article Context
When provided with ARTICLE_CONTEXT, naturally weave the information into your response. If the context is relevant, reference it naturally (e.g., "Navigate Wealth has written about this..." or "According to Navigate Wealth's insights on this topic..."). Do NOT fabricate article references — only cite articles when ARTICLE_CONTEXT is provided.

## Response Formatting
- Keep responses concise but thorough — typically 2–4 paragraphs.
- Use bullet points for lists of options or features.
- Use bold for key terms when explaining concepts.
- When citing numbers (tax brackets, limits, thresholds), note the tax year if relevant.
- Always end complex explanations with: "Would you like me to go deeper on any of these points?"

## About Navigate Wealth
Navigate Wealth is a South African financial services provider offering comprehensive financial planning including:
- Risk Management (life cover, disability, income protection, severe illness)
- Medical Aid planning
- Retirement Planning (RAs, preservation funds, living annuities)
- Investment Management
- Employee Benefits
- Tax Planning
- Estate Planning (wills, trusts, estate duty)

Navigate Wealth provides personalised Financial Needs Analyses (FNAs) across all these pillars, helping clients understand their current position, identify gaps, and implement appropriate solutions.

## Compliance Reminder
Every response you give falls under general financial information, not personal financial advice as defined by FAIS. When in doubt, err on the side of suggesting professional consultation.`;

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get the current Vasco feature flag status
 */
export async function getVascoStatus(): Promise<VascoConfig> {
  try {
    const config = await kv.get(FEATURE_FLAG_KEY);
    if (!config) {
      // Default: disabled until explicitly enabled
      return {
        enabled: false,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
      };
    }
    return config as VascoConfig;
  } catch (error) {
    log.error('Failed to get Vasco status', error);
    return {
      enabled: false,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }
}

/**
 * Update the Vasco feature flag
 */
export async function updateVascoConfig(
  enabled: boolean,
  updatedBy: string
): Promise<VascoConfig> {
  const config: VascoConfig = {
    enabled,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  await kv.set(FEATURE_FLAG_KEY, config);
  log.info('Vasco feature flag updated', { enabled, updatedBy });
  return config;
}

/**
 * Check rate limits for a given IP/session
 * Returns { allowed, remaining, reason? }
 */
export async function checkVascoRateLimit(
  identifier: string
): Promise<{ allowed: boolean; remaining: number; reason?: string }> {
  const key = `${RATE_LIMIT_PREFIX}:${identifier}`;
  const now = Date.now();

  try {
    const entry = await kv.get(key) as VascoRateLimitEntry | null;

    if (!entry) {
      // First message — initialise
      await kv.set(key, {
        count: 1,
        windowStart: now,
        dailyCount: 1,
        dailyStart: now,
      });
      return { allowed: true, remaining: SESSION_MESSAGE_LIMIT - 1 };
    }

    // Reset daily counter if window expired
    let dailyCount = entry.dailyCount;
    let dailyStart = entry.dailyStart;
    if (now - entry.dailyStart > DAILY_WINDOW_MS) {
      dailyCount = 0;
      dailyStart = now;
    }

    // Reset session counter if window expired
    let count = entry.count;
    let windowStart = entry.windowStart;
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      count = 0;
      windowStart = now;
    }

    // Check daily limit
    if (dailyCount >= DAILY_MESSAGE_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        reason: "You've reached the daily message limit. Sign up for unlimited access to Vasco and your own personalised financial dashboard.",
      };
    }

    // Check session limit
    if (count >= SESSION_MESSAGE_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        reason: "You've had a great conversation! Sign up for unlimited access to Vasco and get personalised financial guidance.",
      };
    }

    // Update counters
    await kv.set(key, {
      count: count + 1,
      windowStart,
      dailyCount: dailyCount + 1,
      dailyStart,
    });

    return {
      allowed: true,
      remaining: Math.min(
        SESSION_MESSAGE_LIMIT - count - 1,
        DAILY_MESSAGE_LIMIT - dailyCount - 1
      ),
    };
  } catch (error) {
    log.error('Rate limit check failed (failing open)', error);
    return { allowed: true, remaining: SESSION_MESSAGE_LIMIT };
  }
}

/**
 * Build a RAG context injection message from retrieved article chunks.
 * Returns the system message text and deduplicated citations.
 */
function buildRagContext(
  contexts: RetrievedContext[]
): { contextMessage: string | null; citations: VascoCitation[] } {
  if (contexts.length === 0) {
    return { contextMessage: null, citations: [] };
  }

  // Deduplicate citations by slug
  const seen = new Set<string>();
  const citations: VascoCitation[] = [];

  const contextParts = contexts.map((ctx, i) => {
    if (!seen.has(ctx.articleSlug)) {
      seen.add(ctx.articleSlug);
      citations.push({
        title: ctx.articleTitle,
        slug: ctx.articleSlug,
        url: `/resources/article/${ctx.articleSlug}`,
      });
    }
    return `[Article: "${ctx.articleTitle}"]\n${ctx.text}`;
  });

  const contextMessage = `ARTICLE_CONTEXT (from Navigate Wealth's published articles — use naturally if relevant to the user's question):\n\n${contextParts.join('\n\n---\n\n')}`;

  return { contextMessage, citations };
}

/**
 * Send a message to Vasco and get a response.
 * Integrates RAG context from indexed articles when available.
 */
export async function chat(
  request: VascoChatRequest
): Promise<VascoChatResponse> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Build message history with system prompt
  const messages: VascoChatMessage[] = [
    { role: 'system', content: VASCO_SYSTEM_PROMPT },
  ];

  // Add conversation history (limited to last N messages)
  const history = request.messages.slice(-MAX_CONTEXT_MESSAGES);
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Extract the latest user message for RAG retrieval
  const lastUserMessage = [...request.messages]
    .reverse()
    .find((m) => m.role === 'user');

  let citations: VascoCitation[] = [];

  if (lastUserMessage) {
    try {
      // Retrieve relevant article chunks
      const ragContexts = await retrieveContext(lastUserMessage.content);

      if (ragContexts.length > 0) {
        const { contextMessage, citations: ragCitations } = buildRagContext(ragContexts);
        citations = ragCitations;

        if (contextMessage) {
          // Insert RAG context as a system message before the latest user message
          // Position it just before the last message for recency bias
          messages.splice(messages.length - 1, 0, {
            role: 'system',
            content: contextMessage,
          });
        }
      }
    } catch (err) {
      // RAG failure is non-fatal — just proceed without context
      log.error('RAG context retrieval failed (non-fatal)', err);
    }
  }

  // Call OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: MAX_RESPONSE_TOKENS,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('OpenAI API error', { status: response.status, body: errorText });
    throw new Error(`AI service temporarily unavailable. Please try again shortly.`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('No response received from AI service');
  }

  // Generate or use existing session ID
  const sessionId = request.sessionId || crypto.randomUUID();

  return { reply, sessionId, citations };
}

// ============================================================================
// STREAMING CHAT
// ============================================================================

/**
 * Stream a chat response from Vasco via SSE.
 * Returns a ReadableStream that emits SSE-formatted chunks.
 * The final chunk includes citations as a JSON event.
 */
export async function chatStream(
  request: VascoChatRequest
): Promise<{ stream: ReadableStream; sessionId: string; citations: VascoCitation[] }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Build message history with system prompt
  const messages: VascoChatMessage[] = [
    { role: 'system', content: VASCO_SYSTEM_PROMPT },
  ];

  const history = request.messages.slice(-MAX_CONTEXT_MESSAGES);
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // RAG retrieval
  const lastUserMessage = [...request.messages]
    .reverse()
    .find((m) => m.role === 'user');

  let citations: VascoCitation[] = [];

  if (lastUserMessage) {
    try {
      const ragContexts = await retrieveContext(lastUserMessage.content);
      if (ragContexts.length > 0) {
        const { contextMessage, citations: ragCitations } = buildRagContext(ragContexts);
        citations = ragCitations;
        if (contextMessage) {
          messages.splice(messages.length - 1, 0, {
            role: 'system',
            content: contextMessage,
          });
        }
      }
    } catch (err) {
      log.error('RAG context retrieval failed (non-fatal)', err);
    }
  }

  const sessionId = request.sessionId || crypto.randomUUID();

  // Call OpenAI with streaming enabled
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: MAX_RESPONSE_TOKENS,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('OpenAI API error (stream)', { status: response.status, body: errorText });
    throw new Error('AI service temporarily unavailable. Please try again shortly.');
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`));
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Send citations and session info as final event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', sessionId, citations })}\n\n`
          )
        );
        controller.close();
      } catch (err) {
        log.error('Stream processing error', err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return { stream, sessionId, citations };
}

// ============================================================================
// SESSION PERSISTENCE
// ============================================================================

const SESSION_KEY_PREFIX = 'vasco:session';
/** Sessions expire after 7 days */
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Save a Vasco chat session to KV store
 */
export async function saveSession(sessionId: string, data: VascoSessionData): Promise<void> {
  const key = `${SESSION_KEY_PREFIX}:${sessionId}`;
  await kv.set(key, { ...data, updatedAt: new Date().toISOString() });
}

/**
 * Load a Vasco chat session from KV store
 */
export async function loadSession(sessionId: string): Promise<VascoSessionData | null> {
  const key = `${SESSION_KEY_PREFIX}:${sessionId}`;
  const data = await kv.get(key) as VascoSessionData | null;

  if (!data) return null;

  // Check TTL
  const age = Date.now() - new Date(data.updatedAt).getTime();
  if (age > SESSION_TTL_MS) {
    await kv.del(key);
    return null;
  }

  return data;
}

/**
 * Delete a Vasco chat session from KV store
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const key = `${SESSION_KEY_PREFIX}:${sessionId}`;
  await kv.del(key);
}