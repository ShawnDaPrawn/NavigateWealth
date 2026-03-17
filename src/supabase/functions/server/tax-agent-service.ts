/**
 * Tax Agent Service — Session Management, Agent Invocation & Persistence
 *
 * Manages tax agent sessions in KV, invokes the Navigate Wealth Tax Agent
 * via the OpenAI Responses API, and handles persistence of conversation
 * exchanges.
 *
 * Architecture:
 *   Frontend  --(send)-----------> Server (this file) --> OpenAI Responses API
 *   Server    --(persist)--------> KV Store
 *
 * The agent workflow ID is wf_69a1a4d2e8a881909802326ffc40464904d116eb78b3bdb1.
 * OPENAI_API_KEY never leaves the server.
 *
 * KV key convention: tax_agent:{clientId}:{sessionId}
 *
 * @module tax-agent/service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  TaxAgentSession,
  TaxAgentSessionStatus,
  TaxAgentOutputPack,
} from './tax-agent-types.ts';

const log = createModuleLogger('tax-agent-service');

// ── Agent Workflow ID ──────────────────────────────────────────────
// The Navigate Wealth Tax Agent workflow, registered on OpenAI.
const TAX_AGENT_WORKFLOW_ID = 'wf_69a1a4d2e8a881909802326ffc40464904d116eb78b3bdb1';

// ── KV Key Helpers ─────────────────────────────────────────────────

function sessionKey(clientId: string, sessionId: string): string {
  return `tax_agent:${clientId}:${sessionId}`;
}

function sessionPrefix(clientId: string): string {
  return `tax_agent:${clientId}:`;
}

// ── Profile Context Builder ────────────────────────────────────────

function buildProfileSummary(
  profile: Record<string, unknown> | null,
  clientName: string,
): string {
  if (!profile) {
    return `CLIENT: ${clientName}\nNo profile information available. Please gather all necessary details during the interview.`;
  }

  const lines: string[] = [`CLIENT PROFILE: ${clientName}`];

  if (profile.firstName || profile.lastName) {
    lines.push(`Name: ${profile.firstName || ''} ${profile.lastName || ''}`.trim());
  }
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.idNumber) lines.push(`ID Number: ${profile.idNumber}`);
  if (profile.dateOfBirth) lines.push(`Date of Birth: ${profile.dateOfBirth}`);
  if (profile.taxNumber) lines.push(`SARS Tax Number: ${profile.taxNumber}`);

  // Employment / income context
  if (profile.employmentStatus) lines.push(`Employment Status: ${profile.employmentStatus}`);
  if (profile.employer) lines.push(`Employer: ${profile.employer}`);

  return lines.join('\n');
}

// ── Session CRUD ───────────────────────────────────────────────────

export async function createSession(
  clientId: string,
  clientName: string,
  adviserId: string,
): Promise<TaxAgentSession> {
  const sessionId = `${clientId}-ta-${Date.now()}`;
  const now = new Date().toISOString();

  // Load client profile for context injection
  const profile = await kv.get<Record<string, unknown>>(`user_profile:${clientId}:personal_info`);
  const profileSummary = buildProfileSummary(profile, clientName);

  const session: TaxAgentSession = {
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
    outputPack: null,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(sessionKey(clientId, sessionId), session);
  log.info('Tax agent session created', { sessionId, clientId });

  return session;
}

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
): Promise<TaxAgentSession | null> {
  return kv.get(sessionKey(clientId, sessionId));
}

export async function getClientSessions(
  clientId: string,
): Promise<TaxAgentSession[]> {
  const sessions = await kv.getByPrefix(sessionPrefix(clientId));
  return (sessions || []).sort(
    (a: TaxAgentSession, b: TaxAgentSession) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function deleteSession(
  clientId: string,
  sessionId: string,
): Promise<void> {
  await kv.del(sessionKey(clientId, sessionId));
  log.info('Tax agent session deleted', { sessionId });
}

// ── Agent Invocation (Server-Side) ────────────────────────────────

/**
 * Send a message to the Navigate Wealth Tax Agent via OpenAI Responses API.
 *
 * Uses the specific workflow ID (TAX_AGENT_WORKFLOW_ID) as the model so
 * the correct agent configuration and instructions are applied automatically.
 *
 * Falls back to Chat Completions with gpt-4o if the Responses API fails
 * (e.g. the workflow is paused or unavailable).
 */
export async function sendToAgent(
  conversationMessages: Array<{ role: string; content: string }>,
  previousResponseId: string | null,
): Promise<{ text: string; responseId: string | null; strategy: string }> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured on server');
  }

  // ── Attempt 1: Responses API with Tax Agent Workflow ID ──────────
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
      model: TAX_AGENT_WORKFLOW_ID,
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
      log.info('Responses API (tax agent workflow) succeeded', { responseId, textLen: text.length });
      return { text, responseId, strategy: 'responses_api_workflow' };
    }

    const errBody = await res.text();
    log.warn(`Responses API failed (${res.status}): ${errBody.slice(0, 300)}`);
  } catch (err) {
    log.warn('Responses API network error', err);
  }

  // ── Attempt 2: Chat Completions fallback ─────────────────────────
  log.info('Falling back to Chat Completions (gpt-4o)');
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
      `Tax agent call failed via both Responses API and Chat Completions. ` +
      `Chat Completions (${chatRes.status}): ${errBody.slice(0, 300)}`
    );
  }

  const chatData = await chatRes.json() as Record<string, unknown>;
  const text = extractChatCompletionText(chatData);
  log.info('Chat Completions fallback succeeded', { textLen: text.length });
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
  status: TaxAgentSessionStatus;
  interviewComplete: boolean;
  outputPack: TaxAgentOutputPack | null;
}> {
  const session = await getSession(clientId, sessionId);
  if (!session) {
    throw new Error(`Tax agent session not found: ${sessionId}`);
  }

  // Build conversation for the API call
  const conversationMessages = [
    ...session.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // Include profile context as first message when no chaining ID
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

  // Detect interview completion
  const { interviewComplete, outputPack } = detectInterviewCompletion(assistantReply);

  if (interviewComplete && outputPack) {
    session.status = 'completed';
    session.outputPack = outputPack;
    log.info('Tax agent interview completion detected', { sessionId });
  }

  session.updatedAt = now;
  await kv.set(sessionKey(clientId, sessionId), session);

  log.info('Tax agent message sent and persisted', {
    sessionId,
    strategy,
    messageCount: session.messages.filter((m) => m.role !== 'system').length,
    interviewComplete,
  });

  return {
    assistantReply,
    responseId,
    strategy,
    status: session.status,
    interviewComplete,
    outputPack: session.outputPack,
  };
}

// ── Save Session Output ────────────────────────────────────────────

/**
 * Save the completed interview output pack explicitly (for manual saves
 * before the agent signals automatic completion).
 */
export async function saveSessionOutput(
  clientId: string,
  sessionId: string,
  adviserId: string,
): Promise<{ sessionId: string }> {
  const session = await getSession(clientId, sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  session.status = 'completed';
  session.updatedAt = new Date().toISOString();
  await kv.set(sessionKey(clientId, sessionId), session);

  log.info('Tax agent session saved as completed', { sessionId, adviserId });
  return { sessionId };
}

// ── Completion Detection ───────────────────────────────────────────

/**
 * Detect whether the agent has signalled the end of the interview
 * and attempt to parse structured output sections.
 *
 * The agent is instructed to include sentinel markers when complete:
 *   [TAX_INTERVIEW_COMPLETE]
 *   [SUBMISSION_TYPE]: <type>
 *   [INFORMATION_SUMMARY]: <summary>
 *   [DOCUMENT_CHECKLIST]: <checklist>
 *   [NEXT_STEPS]: <steps>
 *   [CONFIRMATION_SUMMARY]: <summary>
 */
function detectInterviewCompletion(
  reply: string,
): { interviewComplete: boolean; outputPack: TaxAgentOutputPack | null } {
  const completionMarker = '[TAX_INTERVIEW_COMPLETE]';
  if (!reply.includes(completionMarker)) {
    return { interviewComplete: false, outputPack: null };
  }

  // Parse structured sections
  const extract = (tag: string): string => {
    const regex = new RegExp(`\\[${tag}\\][:\\s]*([\\s\\S]*?)(?=\\[[A-Z_]+\\]|$)`, 'i');
    const match = reply.match(regex);
    return match ? match[1].trim() : '';
  };

  const outputPack: TaxAgentOutputPack = {
    submissionType: extract('SUBMISSION_TYPE') || 'Tax Submission',
    informationSummary: extract('INFORMATION_SUMMARY') || reply,
    documentChecklist: extract('DOCUMENT_CHECKLIST') || '',
    nextSteps: extract('NEXT_STEPS') || '',
    confirmationSummary: extract('CONFIRMATION_SUMMARY') || reply,
  };

  return { interviewComplete: true, outputPack };
}

// ── Text Extractors ────────────────────────────────────────────────

function extractResponsesText(data: Record<string, unknown>): string {
  // OpenAI Responses API output shape
  const output = data.output as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item.type === 'message') {
        const content = item.content as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(content)) {
          const textBlock = content.find((c) => c.type === 'output_text' || c.type === 'text');
          if (textBlock && typeof textBlock.text === 'string') return textBlock.text;
        }
      }
    }
  }
  // Fallback: try direct text field
  if (typeof data.text === 'string') return data.text;
  return JSON.stringify(data);
}

function extractChatCompletionText(data: Record<string, unknown>): string {
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(choices) && choices.length > 0) {
    const message = choices[0].message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') return message.content;
  }
  return JSON.stringify(data);
}
