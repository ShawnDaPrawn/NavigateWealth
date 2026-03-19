/**
 * AI Advisor Routes (Client Facing)
 * Backend for the Client Portal AI Financial Advisor
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";
import { createModuleLogger } from "./stderr-logger.ts";
import { ensureSeeded, getActivePrompt } from './prompt-service.ts';
import { getPortfolioSummary } from './client-portal-service.ts';

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
interface KvRow { key: string; value: unknown }

interface AdvisorUserContext {
  clientName: string;
  profile: Record<string, unknown>;
  profileInformation: {
    clientKeys: unknown;
    compliance: unknown[];
    riskProfile: unknown;
    beneficiaries: unknown[];
  };
  policyInformation: unknown[];
  portfolioOverview: Awaited<ReturnType<typeof getPortfolioSummary>> | null;
  fnaInformation: Record<string, unknown[]>;
  communicationHistory: unknown[];
  documentHistory: unknown[];
  schemaSources: {
    profile: string[];
    policies: string[];
    portfolioOverview: string[];
    fnas: string[];
    communications: string[];
    documents: string[];
  };
}

const POLICY_COLLECTION_KEY = (userId: string) => `policies:client:${userId}`;
const LEGACY_POLICY_PREFIX = (userId: string) => `client:${userId}:policy:`;
const PROFILE_KEY = (userId: string) => `user_profile:${userId}:personal_info`;
const CLIENT_KEYS_KEY = (userId: string) => `user_profile:${userId}:client_keys`;
const COMPLIANCE_PREFIX = (userId: string) => `client:${userId}:compliance:`;
const RISK_PROFILE_KEY = (userId: string) => `client:${userId}:risk_profile`;
const BENEFICIARY_PREFIX = (userId: string) => `client:${userId}:beneficiary:`;
const COMMUNICATION_PREFIX = (userId: string) => `communication_log:${userId}:`;
const DOCUMENT_PREFIXES = ['document:', 'doc:', 'tax_doc:', 'estate_doc:'] as const;
const ESIGN_PREFIX = (userId: string) => `esign:client:${userId}:`;
const FNA_PREFIXES = {
  riskPlanning: 'risk-planning-fna:client:',
  medical: 'medical-fna:client:',
  retirement: 'retirement-fna:client:',
  investment: 'investment-ina:client:',
  taxPlanning: 'tax-planning-fna:client:',
  estatePlanning: 'estate-planning-fna:client:',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function getClientName(profile: unknown): string {
  if (!isRecord(profile)) return 'the client';

  const personalInfo = isRecord(profile.personalInformation)
    ? profile.personalInformation
    : null;

  const firstName = [
    profile.firstName,
    profile.first_name,
    profile.name,
    personalInfo?.firstName,
    personalInfo?.first_name,
  ].find((value) => typeof value === 'string' && value.trim());

  const lastName = [
    profile.lastName,
    profile.last_name,
    profile.surname,
    personalInfo?.lastName,
    personalInfo?.last_name,
    personalInfo?.surname,
  ].find((value) => typeof value === 'string' && value.trim());

  const fullName = [firstName, lastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return fullName || 'the client';
}

function extractTimestamp(value: unknown): number {
  if (!isRecord(value)) return 0;

  const candidate = [
    value.updatedAt,
    value.updated_at,
    value.createdAt,
    value.created_at,
    value.timestamp,
    value.uploadDate,
    value.uploadedAt,
    value.uploaded_at,
    value.sentAt,
    value.sent_at,
    value.date,
  ].find((field) => typeof field === 'string' && field.trim());

  if (typeof candidate !== 'string') return 0;

  const parsed = new Date(candidate).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueItems(items: unknown[]): unknown[] {
  const seen = new Set<string>();

  return items.filter((item, index) => {
    let key = `idx:${index}`;

    if (isRecord(item)) {
      const explicitKey = [
        item.id,
        item.messageId,
        item.documentId,
        item.policyNumber,
        item.filePath,
        item.url,
      ].find((value) => typeof value === 'string' && value.trim());

      key = typeof explicitKey === 'string' && explicitKey.trim()
        ? explicitKey
        : JSON.stringify(item);
    } else {
      key = JSON.stringify(item);
    }

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByRecency(items: unknown[]): unknown[] {
  return [...items].sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
}

async function safeResolve<T>(label: string, task: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await task();
  } catch (error) {
    log.error(`Failed to load ${label} for authenticated Vasco context`, error);
    return fallback;
  }
}

async function fetchRowsByPrefix(prefix: string): Promise<KvRow[]> {
  const { data, error } = await getSupabase()
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', `${prefix}%`);

  if (error) throw error;
  return data || [];
}

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
async function getUserContext(userId: string): Promise<AdvisorUserContext | null> {
  const profile = await safeResolve(
    'profile',
    () => kv.get(PROFILE_KEY(userId)),
    {},
  );

  const profileRecord = isRecord(profile) ? profile : {};
  const clientName = getClientName(profileRecord);

  const [
    clientKeys,
    currentPolicies,
    legacyPolicyRows,
    portfolioOverview,
    complianceRows,
    riskProfile,
    beneficiaryRows,
    communicationHistory,
    documentBuckets,
    esignRows,
    riskPlanning,
    medical,
    retirement,
    investment,
    taxPlanning,
    estatePlanning,
  ] = await Promise.all([
    safeResolve('client keys', () => kv.get(CLIENT_KEYS_KEY(userId)), null),
    safeResolve('policy collection', () => kv.get(POLICY_COLLECTION_KEY(userId)), []),
    safeResolve('legacy policy records', () => fetchRowsByPrefix(LEGACY_POLICY_PREFIX(userId)), [] as KvRow[]),
    safeResolve('portfolio overview', () => getPortfolioSummary(userId), null),
    safeResolve('compliance records', () => fetchRowsByPrefix(COMPLIANCE_PREFIX(userId)), [] as KvRow[]),
    safeResolve('risk profile', () => kv.get(RISK_PROFILE_KEY(userId)), null),
    safeResolve('beneficiary records', () => fetchRowsByPrefix(BENEFICIARY_PREFIX(userId)), [] as KvRow[]),
    safeResolve('communication history', () => kv.getByPrefix(COMMUNICATION_PREFIX(userId)), []),
    Promise.all(
      DOCUMENT_PREFIXES.map((prefix) =>
        safeResolve(
          `${prefix} documents`,
          () => kv.getByPrefix(`${prefix}${userId}:`),
          [],
        )
      )
    ),
    safeResolve('e-sign document history', () => fetchRowsByPrefix(ESIGN_PREFIX(userId)), [] as KvRow[]),
    safeResolve('risk planning FNAs', () => kv.getByPrefix(`${FNA_PREFIXES.riskPlanning}${userId}:`), []),
    safeResolve('medical FNAs', () => kv.getByPrefix(`${FNA_PREFIXES.medical}${userId}:`), []),
    safeResolve('retirement FNAs', () => kv.getByPrefix(`${FNA_PREFIXES.retirement}${userId}:`), []),
    safeResolve('investment INAs', () => kv.getByPrefix(`${FNA_PREFIXES.investment}${userId}:`), []),
    safeResolve('tax planning FNAs', () => kv.getByPrefix(`${FNA_PREFIXES.taxPlanning}${userId}:`), []),
    safeResolve('estate planning FNAs', () => kv.getByPrefix(`${FNA_PREFIXES.estatePlanning}${userId}:`), []),
  ]);

  const policyInformation = uniqueItems([
    ...((Array.isArray(currentPolicies) ? currentPolicies : []) as unknown[]),
    ...legacyPolicyRows.map((row) => ({ key: row.key, value: row.value })),
  ]);

  const documentHistory = sortByRecency(uniqueItems([
    ...documentBuckets.flat(),
    ...esignRows.map((row) => ({ key: row.key, value: row.value })),
  ]));

  const fnaInformation = {
    riskPlanning: sortByRecency(riskPlanning),
    medical: sortByRecency(medical),
    retirement: sortByRecency(retirement),
    investment: sortByRecency(investment),
    taxPlanning: sortByRecency(taxPlanning),
    estatePlanning: sortByRecency(estatePlanning),
  };

  return {
    clientName,
    profile: profileRecord,
    profileInformation: {
      clientKeys,
      compliance: complianceRows.map((row) => ({ key: row.key, value: row.value })),
      riskProfile,
      beneficiaries: beneficiaryRows.map((row) => ({ key: row.key, value: row.value })),
    },
    policyInformation,
    portfolioOverview,
    fnaInformation,
    communicationHistory: sortByRecency(uniqueItems(communicationHistory)),
    documentHistory,
    schemaSources: {
      profile: [PROFILE_KEY(userId), CLIENT_KEYS_KEY(userId), RISK_PROFILE_KEY(userId)],
      policies: [POLICY_COLLECTION_KEY(userId), LEGACY_POLICY_PREFIX(userId)],
      portfolioOverview: ['client-portal-service:getPortfolioSummary'],
      fnas: Object.values(FNA_PREFIXES).map((prefix) => `${prefix}${userId}:`),
      communications: [COMMUNICATION_PREFIX(userId)],
      documents: [
        ...DOCUMENT_PREFIXES.map((prefix) => `${prefix}${userId}:`),
        ESIGN_PREFIX(userId),
      ],
    },
  };
}

/**
 * Build system prompt
 */
function buildRuntimeContextPrompt(context: AdvisorUserContext | null) {
  if (!context) {
    return `## Runtime Client Context
No client-specific context could be loaded for this request.

## Context Handling
- Explain that personalised context is temporarily unavailable.
- Still answer general financial education questions.
- Do not invent portfolio, policy, communication, or document details.`;
  }

  return `## Runtime Client Context
This context was fetched live for ${context.clientName} on this request. Treat the structured JSON below as the authoritative client record.

### What You Can Use
- Full profile information
- Policy information
- Portfolio overview information
- FNA and INA information
- Communication history
- Document history

### Profile Information
${toPrettyJson({
  profile: context.profile,
  clientKeys: context.profileInformation.clientKeys,
  compliance: context.profileInformation.compliance,
  riskProfile: context.profileInformation.riskProfile,
  beneficiaries: context.profileInformation.beneficiaries,
})}

### Policy Information
${toPrettyJson(context.policyInformation)}

### Portfolio Overview Information
${toPrettyJson(context.portfolioOverview)}

### FNA Information
${toPrettyJson(context.fnaInformation)}

### Communication History
${toPrettyJson(context.communicationHistory)}

### Document History
${toPrettyJson(context.documentHistory)}

### Schema Awareness
- The authenticated Vasco context reads live client data each request.
- The platform currently supports both active and legacy KV key patterns for some client data during migrations.
- If new fields appear inside these JSON objects, treat them as valid client context.
- If a required section is empty, say it is not currently available rather than guessing.

### Context Sources
${toPrettyJson(context.schemaSources)}`;
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
    const systemPrompt = `${activeBase}\n\n${buildRuntimeContextPrompt(context)}`;

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
    const systemPrompt = `${activeBase}\n\n${buildRuntimeContextPrompt(context)}`;

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
