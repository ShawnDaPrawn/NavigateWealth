/**
 * The advisor's chat core: assembling the client's context, the runtime
 * prompt, and the OpenAI calls — blocking and streaming.
 *
 * Split out of `ai-advisor.ts` (1,443 lines). Same logger channel on purpose.
 */
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';
import { ensureSeeded, getActivePrompt } from './prompt-service.ts';
import { getPortfolioSummary } from './client-portal-service.ts';
import {
  OPENAI_PRIMARY_MODEL,
  applyChatTokenLimit,
  isResponsesOnlyModel,
} from './ai-model-config.ts';
import {
  type AdvisorUserContext,
  BENEFICIARY_PREFIX,
  CLIENT_KEYS_KEY,
  COMMUNICATION_PREFIX,
  COMPLIANCE_PREFIX,
  type ChatMessage,
  DOCUMENT_PREFIXES,
  ESIGN_PREFIX,
  FNA_PREFIXES,
  type KvRow,
  LEGACY_POLICY_PREFIX,
  POLICY_COLLECTION_KEY,
  PROFILE_KEY,
  RISK_PROFILE_KEY,
  getOpenAIKey,
} from './ai-advisor-shared.ts';
import {
  appendAdvisorSessionMessages,
  ensureAdvisorSession,
  fetchRowsByPrefix,
  getClientName,
  isRecord,
  safeResolve,
  sortByRecency,
  toPrettyJson,
  uniqueItems,
} from './ai-advisor-store.ts';

const log = createModuleLogger('ai-advisor');

export function normalizeAdvisorChatMessages(clientMessages: unknown): ChatMessage[] | null {
  if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
    return null;
  }
  return clientMessages
    .filter((m: { role: string }) => ['user', 'assistant'].includes(m.role))
    .map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

export async function buildAdvisorSseResponse(
  subjectUserId: string,
  clientMessages: unknown,
  sessionId: unknown,
): Promise<Response> {
  const chatMessages = normalizeAdvisorChatMessages(clientMessages);
  if (!chatMessages) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const context = await getUserContext(subjectUserId);
  await ensureSeeded(ADVISOR_AGENT_ID, ADVISOR_CONTEXT, DEFAULT_PORTAL_PROMPT);
  const activeBase =
    (await getActivePrompt(ADVISOR_AGENT_ID, ADVISOR_CONTEXT)) ?? DEFAULT_PORTAL_PROMPT;
  const systemPrompt = `${activeBase}\n\n${buildRuntimeContextPrompt(context)}`;

  const openaiResponse = await callOpenAIStream(chatMessages, systemPrompt);
  const reader = openaiResponse.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const lastUserMsg = [...(clientMessages as { role: string; content: string }[])]
    .reverse()
    .find((m) => m.role === 'user');
  const finalSession = await ensureAdvisorSession(
    subjectUserId,
    typeof sessionId === 'string' ? sessionId : null,
    typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : undefined,
  );
  const finalSessionId = finalSession.id;
  const userMessageTimestamp = new Date().toISOString();

  if (lastUserMsg && typeof lastUserMsg.content === 'string') {
    await appendAdvisorSessionMessages(
      subjectUserId,
      finalSessionId,
      [
        {
          role: 'user',
          content: lastUserMsg.content,
          timestamp: userMessageTimestamp,
        },
      ],
      lastUserMsg.content,
    );
  }

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
                  encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`),
                );
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        if (fullReply) {
          await appendAdvisorSessionMessages(subjectUserId, finalSessionId, [
            {
              role: 'assistant',
              content: fullReply,
              timestamp: new Date().toISOString(),
              citations: [],
              artifacts: [],
            },
          ]);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', sessionId: finalSessionId, citations: [], artifacts: [] })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        log.error('Stream processing error', err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Fetch client data for AI context
 */
export async function getUserContext(userId: string): Promise<AdvisorUserContext | null> {
  const profile = await safeResolve('profile', () => kv.get(PROFILE_KEY(userId)), {});

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
    safeResolve(
      'legacy policy records',
      () => fetchRowsByPrefix(LEGACY_POLICY_PREFIX(userId)),
      [] as KvRow[],
    ),
    safeResolve('portfolio overview', () => getPortfolioSummary(userId), null),
    safeResolve(
      'compliance records',
      () => fetchRowsByPrefix(COMPLIANCE_PREFIX(userId)),
      [] as KvRow[],
    ),
    safeResolve('risk profile', () => kv.get(RISK_PROFILE_KEY(userId)), null),
    safeResolve(
      'beneficiary records',
      () => fetchRowsByPrefix(BENEFICIARY_PREFIX(userId)),
      [] as KvRow[],
    ),
    safeResolve('communication history', () => kv.getByPrefix(COMMUNICATION_PREFIX(userId)), []),
    Promise.all(
      DOCUMENT_PREFIXES.map((prefix) =>
        safeResolve(`${prefix} documents`, () => kv.getByPrefix(`${prefix}${userId}:`), []),
      ),
    ),
    safeResolve(
      'e-sign document history',
      () => fetchRowsByPrefix(ESIGN_PREFIX(userId)),
      [] as KvRow[],
    ),
    safeResolve(
      'risk planning FNAs',
      () => kv.getByPrefix(`${FNA_PREFIXES.riskPlanning}${userId}:`),
      [],
    ),
    safeResolve('medical FNAs', () => kv.getByPrefix(`${FNA_PREFIXES.medical}${userId}:`), []),
    safeResolve(
      'retirement FNAs',
      () => kv.getByPrefix(`${FNA_PREFIXES.retirement}${userId}:`),
      [],
    ),
    safeResolve(
      'investment INAs',
      () => kv.getByPrefix(`${FNA_PREFIXES.investment}${userId}:`),
      [],
    ),
    safeResolve(
      'tax planning FNAs',
      () => kv.getByPrefix(`${FNA_PREFIXES.taxPlanning}${userId}:`),
      [],
    ),
    safeResolve(
      'estate planning FNAs',
      () => kv.getByPrefix(`${FNA_PREFIXES.estatePlanning}${userId}:`),
      [],
    ),
  ]);

  const policyInformation = uniqueItems([
    ...((Array.isArray(currentPolicies) ? currentPolicies : []) as unknown[]),
    ...legacyPolicyRows.map((row) => ({ key: row.key, value: row.value })),
  ]);

  const documentHistory = sortByRecency(
    uniqueItems([
      ...documentBuckets.flat(),
      ...esignRows.map((row) => ({ key: row.key, value: row.value })),
    ]),
  );

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
export function buildRuntimeContextPrompt(context: AdvisorUserContext | null) {
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

export const ADVISOR_AGENT_ID = 'vasco-authenticated';
export const ADVISOR_CONTEXT = 'authenticated' as const;

export const DEFAULT_PORTAL_PROMPT = `You are Navigate Wealth’s AI Financial Advisor for logged-in clients.

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
export async function callOpenAI(messages: ChatMessage[], systemPrompt: string) {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const body: Record<string, unknown> = {
    model: OPENAI_PRIMARY_MODEL,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  };
  if (!isResponsesOnlyModel(OPENAI_PRIMARY_MODEL)) body.temperature = 0.7;
  applyChatTokenLimit(body, OPENAI_PRIMARY_MODEL, 1000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
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
export async function callOpenAIStream(messages: ChatMessage[], systemPrompt: string) {
  const OPENAI_API_KEY = getOpenAIKey();
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const body: Record<string, unknown> = {
    model: OPENAI_PRIMARY_MODEL,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
  };
  if (!isResponsesOnlyModel(OPENAI_PRIMARY_MODEL)) body.temperature = 0.7;
  applyChatTokenLimit(body, OPENAI_PRIMARY_MODEL, 1000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
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
