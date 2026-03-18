/**
 * AI Advisor Routes (Client Facing)
 * Backend for the Client Portal AI Financial Advisor
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";
import { ensureSeeded, getActivePrompt } from './prompt-service.ts';

const app = new Hono();
const log = createModuleLogger('ai-advisor');

// Root handlers
app.get('/', (c) => c.json({ service: 'ai-advisor', status: 'active' }));
app.get('', (c) => c.json({ service: 'ai-advisor', status: 'active' }));

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const getOpenAIKey = () => Deno.env.get('OPENAI_API_KEY');

/**
 * Authentication middleware
 */
import type { Context, Next } from 'npm:hono';

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

async function requireAuth(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized: Invalid user session' }, 401);
    }

    // Attach user info to context
    c.set('user', user);
    await next();
  } catch (error) {
    log.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

/**
 * Fetch client data for AI context
 */
async function getUserContext(userId: string) {
  try {
    // Fetch user profile from KV store
    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = await kv.get(profileKey);

    // Fetch related data using direct Supabase queries for flexibility and consistency with other modules
    const [
      policies,
      compliance,
      riskProfile,
      beneficiaries
    ] = await Promise.all([
      // Policies
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${userId}:policy:%`),
      
      // Compliance
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${userId}:compliance:%`),
      
      // Risk profile
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .eq('key', `client:${userId}:risk_profile`)
        .single(),
      
      // Beneficiaries
      getSupabase()
        .from('kv_store_91ed8379')
        .select('*')
        .like('key', `client:${userId}:beneficiary:%`)
    ]);

    return {
      profile: profile || {},
      policies: policies.data || [],
      compliance: compliance.data || [],
      riskProfile: riskProfile.data?.value || null,
      beneficiaries: beneficiaries.data || []
    };
  } catch (error) {
    log.error('Error fetching user context:', error);
    return null;
  }
}

/**
 * Build system prompt
 */
function buildSystemPrompt(context: Record<string, unknown>) {
  let clientName = 'the client';
  if (context?.profile) {
    const firstName = context.profile.firstName || context.profile.first_name || context.profile.personalInformation?.firstName || '';
    const lastName = context.profile.surname || context.profile.last_name || context.profile.personalInformation?.lastName || '';
    if (firstName) clientName = `${firstName} ${lastName}`.trim();
  }

  return `You are the AI Financial Advisor for Navigate Wealth, assisting ${clientName} directly on their client portal.

## Your Role
- Provide helpful, friendly, and professional financial guidance.
- Explain financial concepts (investments, retirement, tax, estate planning) in simple terms.
- Answer questions about their specific portfolio using the provided context.
- Encourage them to book a consultation with their human adviser for complex decisions.

## Client Context
${context ? `
- Name: ${clientName}
- Policies: ${context.policies.length} active records
- Risk Profile: ${context.riskProfile ? JSON.stringify(context.riskProfile) : 'Not set'}
` : 'No specific portfolio data available.'}

## Guidelines
1. **Disclaimer**: Always remind the user that you are an AI and this is not official financial advice.
2. **Safety**: Do not make promises about returns or guarantees.
3. **Scope**: Stick to financial topics.
4. **Referral**: If a query is complex or requires specific action (like "Cancel my policy"), advise them to contact their human adviser or use the "Contact" page.
5. **Tone**: Professional, encouraging, and clear. Avoid jargon where possible.

## South African Context
- Apply South African financial context (SARS, RAs, TFSAs, etc.).
- Currency: ZAR (R).
`;
}

const ADVISOR_AGENT_ID = 'vasco-authenticated';
const ADVISOR_CONTEXT = 'authenticated' as const;

const DEFAULT_PORTAL_PROMPT = `You are Navigate Wealth’s AI Financial Advisor for logged-in clients.

## Role
- Explain concepts and help the client understand their situation using the runtime context provided by the system.
- Be professional, encouraging, and clear. Use South African context (SARS, RAs, TFSAs, etc.).

## Boundaries
- This is not official financial advice. Always include a brief disclaimer in advice-adjacent responses.
- Do not promise returns or guarantees.

## Next steps
- If the user asks for actions (cancel policy, change beneficiary, etc.), direct them to their adviser/support or the appropriate workflow.
`;

/**
 * Call OpenAI
 */
async function callOpenAI(messages: ChatMessage[], systemPrompt: string) {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI error: ${err.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call OpenAI with streaming — returns a ReadableStream of SSE events
 */
async function callOpenAIStream(messages: ChatMessage[], systemPrompt: string) {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI error: ${err.error?.message || response.statusText}`);
  }

  return response;
}

// Routes

/**
 * GET /status
 */
app.get('/status', requireAuth, (c) => {
  return c.json({ configured: !!getOpenAIKey() });
});

/**
 * POST /chat/stream — SSE streaming chat (real-time token delivery)
 */
app.post('/chat/stream', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { messages: clientMessages, sessionId } = body;

    if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    // Get context and build system prompt (Phase 3 KV-backed base prompt + context overlay)
    const context = await getUserContext(user.id);
    await ensureSeeded(ADVISOR_AGENT_ID, ADVISOR_CONTEXT, DEFAULT_PORTAL_PROMPT);
    const activeBase =
      (await getActivePrompt(ADVISOR_AGENT_ID, ADVISOR_CONTEXT)) ?? DEFAULT_PORTAL_PROMPT;
    const systemPrompt = `${activeBase}\n\n## Runtime Client Context\n${buildSystemPrompt(context)}`;

    // Build chat messages from history
    const chatMessages: ChatMessage[] = clientMessages
      .filter((m: { role: string }) => ['user', 'assistant'].includes(m.role))
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Call OpenAI with streaming
    const openaiResponse = await callOpenAIStream(chatMessages, systemPrompt);
    const reader = openaiResponse.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Save user message to history (non-blocking)
    const lastUserMsg = [...clientMessages].reverse().find((m: { role: string }) => m.role === 'user');
    if (lastUserMsg) {
      const conversationKey = `ai_advisor:${user.id}:chat:${Date.now()}`;
      getSupabase().from('kv_store_91ed8379').insert({
        key: conversationKey,
        value: {
          role: 'user',
          content: lastUserMsg.content,
          timestamp: new Date().toISOString()
        }
      }).then(() => {}).catch(() => {});
    }

    const finalSessionId = sessionId || crypto.randomUUID();
    let fullReply = '';

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
                  fullReply += content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }

          // Save assistant reply to history (non-blocking)
          if (fullReply) {
            const replyKey = `ai_advisor:${user.id}:chat:${Date.now() + 1}`;
            getSupabase().from('kv_store_91ed8379').insert({
              key: replyKey,
              value: {
                role: 'assistant',
                content: fullReply,
                timestamp: new Date().toISOString()
              }
            }).then(() => {}).catch(() => {});
          }

          // Send done event (no citations for ai-advisor, but maintaining interface parity)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', sessionId: finalSessionId, citations: [] })}\n\n`
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: unknown) {
    log.error('Streaming chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * POST /chat
 */
app.post('/chat', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { message } = body;

    if (!message) return c.json({ error: 'Message required' }, 400);

    // Get context (Phase 3 KV-backed base prompt + context overlay)
    const context = await getUserContext(user.id);
    await ensureSeeded(ADVISOR_AGENT_ID, ADVISOR_CONTEXT, DEFAULT_PORTAL_PROMPT);
    const activeBase =
      (await getActivePrompt(ADVISOR_AGENT_ID, ADVISOR_CONTEXT)) ?? DEFAULT_PORTAL_PROMPT;
    const systemPrompt = `${activeBase}\n\n## Runtime Client Context\n${buildSystemPrompt(context)}`;

    // Call AI
    const reply = await callOpenAI([{ role: 'user', content: message }], systemPrompt);

    // Save history
    const conversationKey = `ai_advisor:${user.id}:chat:${Date.now()}`;
    await getSupabase().from('kv_store_91ed8379').insert({
      key: conversationKey,
      value: {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      }
    });
    
    // Save reply
    const replyKey = `ai_advisor:${user.id}:chat:${Date.now() + 1}`;
    await getSupabase().from('kv_store_91ed8379').insert({
      key: replyKey,
      value: {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString()
      }
    });

    return c.json({ message: reply });
  } catch (error: unknown) {
    log.error('Chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * GET /history
 */
app.get('/history', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { data } = await getSupabase()
      .from('kv_store_91ed8379')
      .select('*')
      .like('key', `ai_advisor:${user.id}:chat:%`)
      .order('key', { ascending: true })
      .limit(50);

    const messages = (data || []).map(d => ({
      role: d.value.role,
      content: d.value.content,
      timestamp: d.value.timestamp
    }));

    return c.json({ messages });
  } catch (error) {
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

/**
 * DELETE /history
 */
app.delete('/history', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    await getSupabase()
      .from('kv_store_91ed8379')
      .delete()
      .like('key', `ai_advisor:${user.id}:chat:%`);
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to clear history' }, 500);
  }
});

export default app;