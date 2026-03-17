/**
 * Will Chat Service — Session Management, Agent Invocation & Persistence
 *
 * Manages will chat sessions in KV, invokes the OpenAI agent, and handles
 * persistence of conversation exchanges.
 *
 * Architecture:
 *   Frontend  --(send)-----------> Server (this file) --> OpenAI Responses API
 *   Server    --(persist)--------> KV Store
 *
 * The agent is invoked server-side using OPENAI_API_KEY with the Responses API.
 * Conversation chaining uses `previous_response_id` so the agent retains context
 * without re-sending the full history on every turn.
 *
 * @module will-chat/service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  WillChatSession,
  WillChatSessionStatus,
  WillOutputPack,
} from './will-chat-types.ts';

const log = createModuleLogger('will-chat-service');

// ── KV Key Helpers ─────────────────────────────────────────────────

function sessionKey(clientId: string, sessionId: string): string {
  return `will_chat:${clientId}:${sessionId}`;
}

function sessionPrefix(clientId: string): string {
  return `will_chat:${clientId}:`;
}

// ── Session CRUD ───────────────────────────────────────────────────

export async function createSession(
  clientId: string,
  clientName: string,
  adviserId: string,
): Promise<WillChatSession> {
  const sessionId = `${clientId}-wc-${Date.now()}`;
  const now = new Date().toISOString();

  // Load client profile for context injection
  const [profile, clientKeys] = await Promise.all([
    kv.get(`user_profile:${clientId}:personal_info`),
    kv.get(`user_profile:${clientId}:client_keys`),
  ]);

  // Build the profile context — this is sent as the initial user message
  // to pre-load the agent with client data.
  const profileSummary = buildProfileSummary(profile, clientKeys, clientName);

  const session: WillChatSession = {
    id: sessionId,
    clientId,
    adviserId,
    clientName,
    messages: [
      {
        role: 'system',
        content: profileSummary,
        timestamp: now,
      },
    ],
    status: 'active',
    willText: null,
    outputPack: null,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(sessionKey(clientId, sessionId), session);
  log.info('Will chat session created', { sessionId, clientId });

  return session;
}

/**
 * Get the profile context string for a session.
 * This is sent as part of the initial message to the agent,
 * pre-loading client data.
 */
export async function getProfileContext(
  clientId: string,
  sessionId: string,
): Promise<string | null> {
  const session = await getSession(clientId, sessionId);
  if (!session) return null;

  const systemMsg = session.messages.find((m) => m.role === 'system');
  return systemMsg?.content || null;
}

export async function getSession(
  clientId: string,
  sessionId: string,
): Promise<WillChatSession | null> {
  return kv.get(sessionKey(clientId, sessionId));
}

export async function getClientSessions(
  clientId: string,
): Promise<WillChatSession[]> {
  const sessions = await kv.getByPrefix(sessionPrefix(clientId));
  return (sessions || []).sort(
    (a: WillChatSession, b: WillChatSession) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function deleteSession(
  clientId: string,
  sessionId: string,
): Promise<void> {
  await kv.del(sessionKey(clientId, sessionId));
  log.info('Will chat session deleted', { sessionId });
}

// ── Agent Invocation (Server-Side) ─────────────────────────────────

/**
 * Send a message to the OpenAI agent and return the reply.
 *
 * Uses the Responses API with `previous_response_id` for conversation
 * chaining. Falls back to Chat Completions if Responses API fails.
 *
 * The agent workflow is referenced implicitly through the conversation
 * context. The profile context (system message) and conversation history
 * carry the full interview state.
 */
export async function sendToAgent(
  conversationMessages: Array<{ role: string; content: string }>,
  previousResponseId: string | null,
): Promise<{ text: string; responseId: string | null; strategy: string }> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured on server');
  }

  // ── Attempt 1: POST /v1/responses (preferred — supports conversation chaining)
  try {
    const input = previousResponseId
      ? conversationMessages.slice(-1).map((m) => ({
          role: m.role === 'system' ? 'developer' : m.role,
          content: m.content,
        }))
      : conversationMessages.map((m) => ({
          role: m.role === 'system' ? 'developer' : m.role,
          content: m.content,
        }));

    const responsesBody: Record<string, unknown> = {
      model: 'gpt-4o',
      input,
    };
    if (previousResponseId) {
      responsesBody.previous_response_id = previousResponseId;
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(responsesBody),
    });

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const text = extractResponsesText(data);
      const responseId = (typeof data.id === 'string') ? data.id : null;
      log.info('Responses API succeeded', { responseId, textLen: text.length });
      return { text, responseId, strategy: 'responses_api' };
    }

    const errBody = await res.text();
    log.warn(`Responses API failed (${res.status}): ${errBody.slice(0, 300)}`);
  } catch (err) {
    log.warn('Responses API network error', err);
  }

  // ── Attempt 2: POST /v1/chat/completions (fallback)
  const chatMessages = conversationMessages.map((m) => ({
    role: m.role === 'system' ? 'system' : m.role,
    content: m.content,
  }));

  const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: chatMessages,
      max_tokens: 4096,
    }),
  });

  if (!chatRes.ok) {
    const errBody = await chatRes.text();
    throw new Error(
      `Agent call failed via both Responses API and Chat Completions. ` +
      `Chat Completions (${chatRes.status}): ${errBody.slice(0, 300)}`
    );
  }

  const chatData = await chatRes.json() as Record<string, unknown>;
  const text = extractChatCompletionText(chatData);
  log.info('Chat Completions API succeeded (fallback)', { textLen: text.length });
  return { text, responseId: null, strategy: 'chat_completions' };
}

// ── Send + Persist (Combined) ──────────────────────────────────────

/**
 * Send a user message to the agent, persist the exchange, and return
 * the assistant reply. This is the primary entry point for the frontend.
 */
export async function sendAndPersist(
  clientId: string,
  sessionId: string,
  userMessage: string,
  previousResponseId: string | null,
): Promise<{
  assistantReply: string;
  responseId: string | null;
  strategy: string;
  status: WillChatSessionStatus;
  willReady: boolean;
  outputPack: WillOutputPack | null;
}> {
  const session = await getSession(clientId, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Build the full conversation for the API call
  const conversationMessages = [
    ...session.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Include system/profile context as the first message if no previous_response_id
  // (i.e. first turn or when context needs to be re-sent)
  if (!previousResponseId) {
    const systemMsg = session.messages.find((m) => m.role === 'system');
    if (systemMsg) {
      conversationMessages.unshift({ role: 'system', content: systemMsg.content });
    }
  }

  // Call the agent
  const { text: assistantReply, responseId, strategy } = await sendToAgent(
    conversationMessages,
    previousResponseId,
  );

  // Persist the exchange
  const now = new Date().toISOString();
  session.messages.push(
    { role: 'user', content: userMessage, timestamp: now },
    { role: 'assistant', content: assistantReply, timestamp: now },
  );

  // Check if the agent has delivered the final will
  const { willReady, outputPack } = detectWillCompletion(assistantReply);

  if (willReady && outputPack) {
    session.status = 'completed';
    session.willText = assistantReply;
    session.outputPack = outputPack;
    log.info('Will completion detected', { sessionId });
  }

  session.updatedAt = now;
  await kv.set(sessionKey(clientId, sessionId), session);

  log.info('Message sent and persisted', {
    sessionId,
    strategy,
    messageCount: session.messages.filter((m) => m.role !== 'system').length,
    willReady,
  });

  return {
    assistantReply,
    responseId,
    strategy,
    status: session.status,
    willReady,
    outputPack: session.outputPack,
  };
}

// ── Persist Exchange (Backward Compat — from old frontend-direct-call flow) ──

/**
 * Persist a user message + assistant reply. This is used by the
 * legacy /persist endpoint where the frontend called OpenAI directly.
 * The new preferred flow is sendAndPersist().
 */
export async function persistExchange(
  clientId: string,
  sessionId: string,
  userMessage: string,
  assistantReply: string,
): Promise<{
  status: WillChatSessionStatus;
  willReady: boolean;
  outputPack: WillOutputPack | null;
}> {
  const session = await getSession(clientId, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const now = new Date().toISOString();

  session.messages.push(
    { role: 'user', content: userMessage, timestamp: now },
    { role: 'assistant', content: assistantReply, timestamp: now },
  );

  const { willReady, outputPack } = detectWillCompletion(assistantReply);

  if (willReady && outputPack) {
    session.status = 'completed';
    session.willText = assistantReply;
    session.outputPack = outputPack;
    log.info('Will completion detected during persist', { sessionId });
  }

  session.updatedAt = now;
  await kv.set(sessionKey(clientId, sessionId), session);

  return {
    status: session.status,
    willReady,
    outputPack: session.outputPack,
  };
}

// ── Save Final Will to KV (mirrors existing will storage) ──────────

/**
 * Persist the completed will as a formal `will:*` KV record,
 * compatible with the existing WillManagementView and PDF generator.
 */
export async function saveCompletedWill(
  clientId: string,
  sessionId: string,
  adviserId: string,
): Promise<{ willId: string }> {
  const session = await getSession(clientId, sessionId);
  if (!session || !session.outputPack) {
    throw new Error('Session not found or will not yet completed');
  }

  // Determine version from existing wills
  const existingWills = await kv.getByPrefix(`will:${clientId}:last_will:`);
  const version = (existingWills?.length || 0) + 1;

  const willId = `${clientId}-last_will-v${version}`;
  const timestamp = new Date().toISOString();

  const willRecord = {
    id: willId,
    clientId,
    clientName: session.clientName,
    type: 'last_will',
    version,
    status: 'draft',
    data: {
      aiGenerated: true,
      chatSessionId: sessionId,
      willText: session.outputPack.willDraft,
      issueRegister: session.outputPack.issueRegister,
      executionChecklist: session.outputPack.executionChecklist,
      confirmationSummary: session.outputPack.confirmationSummary,
      fullOutput: session.willText,
    },
    createdBy: adviserId,
    createdAt: timestamp,
    updatedAt: timestamp,
    finalizedAt: null,
    finalizedBy: null,
  };

  const key = `will:${clientId}:last_will:${willId}`;
  await kv.set(key, willRecord);

  log.info('Completed will saved from chat session', {
    willId,
    sessionId,
    clientId,
  });

  return { willId };
}

// ── Profile Context Builder ────────────────────────────────────────

/**
 * Build a profile summary string to inject into the conversation
 * as the initial user context message.
 *
 * This pre-loads the agent with client data so it can skip
 * questions for known fields and jump to confirmation.
 */
function buildProfileSummary(
  profile: Record<string, unknown> | null,
  clientKeys: Record<string, unknown> | null,
  clientName: string,
): string {
  const parts: string[] = [
    `[SYSTEM CONTEXT — CLIENT PROFILE DATA PRE-LOADED FOR WILL INTERVIEW]`,
    `The following client profile data has been loaded from the Navigate Wealth platform.`,
    `Use this to pre-populate the will and only ask for confirmation of critical fields.`,
    ``,
  ];

  if (profile) {
    const firstName =
      (profile.firstName as string) ||
      (profile.first_name as string) ||
      '';
    const lastName =
      (profile.surname as string) ||
      (profile.last_name as string) ||
      '';
    const email = (profile.email as string) || '';
    const phone =
      (profile.phone as string) ||
      (profile.phoneNumber as string) ||
      '';
    const idNumber = (profile.idNumber as string) || '';
    const dob = (profile.dateOfBirth as string) || '';
    const maritalStatus = (profile.maritalStatus as string) || '';
    const address =
      (profile.physicalAddress as string) ||
      (profile.address as string) ||
      '';
    const spouseName = (profile.spouseName as string) || '';

    parts.push(`**Client Profile:**`);
    parts.push(`- Full Name: ${firstName} ${lastName}`.trim());
    if (idNumber) parts.push(`- SA ID / Passport: ${idNumber}`);
    if (dob) parts.push(`- Date of Birth: ${dob}`);
    if (email) parts.push(`- Email: ${email}`);
    if (phone) parts.push(`- Phone: ${phone}`);
    if (maritalStatus) parts.push(`- Marital Status: ${maritalStatus}`);
    if (spouseName) parts.push(`- Spouse Name: ${spouseName}`);
    if (address) parts.push(`- Address: ${address}`);
    parts.push('');
  } else {
    parts.push(`Client name: ${clientName}`);
    parts.push(`No detailed profile data available — collect all information during interview.`);
    parts.push('');
  }

  if (clientKeys && Object.keys(clientKeys).length > 0) {
    parts.push(`**Financial Data Keys (summary):**`);
    const keyCount = Object.keys(clientKeys).length;
    parts.push(`- ${keyCount} financial data points on file`);
    parts.push('');
  }

  parts.push(`Begin the will interview now. Start with Stage S1 (Identity & Revocation).`);

  return parts.join('\n');
}

// ── Will Completion Detection ──────────────────────────────────────

function detectWillCompletion(reply: string): {
  willReady: boolean;
  outputPack: WillOutputPack | null;
} {
  const hasWillDraft =
    reply.includes('LAST WILL AND TESTAMENT') ||
    reply.includes('Last Will and Testament') ||
    reply.includes('LAST WILL & TESTAMENT');

  const hasIssueRegister =
    reply.includes('ISSUE REGISTER') ||
    reply.includes('Issue Register') ||
    reply.includes('Issue & Risk Register');

  const hasChecklist =
    reply.includes('EXECUTION CHECKLIST') ||
    reply.includes('Execution Checklist');

  if (hasWillDraft && (hasIssueRegister || hasChecklist)) {
    return { willReady: true, outputPack: parseOutputPack(reply) };
  }

  return { willReady: false, outputPack: null };
}

function parseOutputPack(fullText: string): WillOutputPack {
  const sections: WillOutputPack = {
    willDraft: '',
    issueRegister: '',
    executionChecklist: '',
    confirmationSummary: '',
  };

  const issueStart =
    fullText.search(/(?:#{1,3}\s*)?(?:ISSUE(?:\s*&\s*RISK)?\s*REGISTER|Issue(?:\s*&\s*Risk)?\s*Register)/i);
  const checklistStart =
    fullText.search(/(?:#{1,3}\s*)?(?:EXECUTION\s*CHECKLIST|Execution\s*Checklist)/i);
  const confirmStart =
    fullText.search(
      /(?:#{1,3}\s*)?(?:CLIENT\s*CONFIRMATION\s*SUMMARY|Confirmation\s*Summary|CONFIRMATION\s*SUMMARY)/i,
    );

  const positions = [
    { key: 'issueRegister' as const, pos: issueStart },
    { key: 'executionChecklist' as const, pos: checklistStart },
    { key: 'confirmationSummary' as const, pos: confirmStart },
  ]
    .filter((p) => p.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  if (positions.length === 0) {
    sections.willDraft = fullText.trim();
  } else {
    sections.willDraft = fullText.slice(0, positions[0].pos).trim();
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].pos;
      const end = i + 1 < positions.length ? positions[i + 1].pos : fullText.length;
      sections[positions[i].key] = fullText.slice(start, end).trim();
    }
  }

  return sections;
}

// ── Helper Functions ───────────────────────────────────────────────

/**
 * Extract text from a Responses API response.
 * Format: { output: [{ type: "message", content: [{ type: "output_text", text: "..." }] }], output_text: "..." }
 */
function extractResponsesText(data: Record<string, unknown>): string {
  // Standard Responses API: output array → message items → output_text blocks
  if (Array.isArray(data.output)) {
    const textParts: string[] = [];
    for (const item of data.output as Array<Record<string, unknown>>) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content as Array<Record<string, unknown>>) {
          if (block.type === 'output_text' && typeof block.text === 'string') {
            textParts.push(block.text);
          }
        }
      }
    }
    if (textParts.length > 0) return textParts.join('\n\n');
  }

  // Flat output_text field (convenience)
  if (typeof data.output_text === 'string') return data.output_text;
  if (typeof data.text === 'string') return data.text;

  log.warn('Unexpected Responses API shape', { keys: Object.keys(data) });
  return JSON.stringify(data);
}

/**
 * Extract text from a Chat Completions API response.
 * Format: { choices: [{ message: { content: "..." } }] }
 */
function extractChatCompletionText(data: Record<string, unknown>): string {
  if (Array.isArray(data.choices)) {
    const choices = data.choices as Array<Record<string, unknown>>;
    if (choices.length > 0) {
      const msg = choices[0].message as Record<string, unknown> | undefined;
      if (msg && typeof msg.content === 'string') {
        return msg.content;
      }
    }
  }

  log.warn('Unexpected Chat Completions shape', { keys: Object.keys(data) });
  return JSON.stringify(data);
}