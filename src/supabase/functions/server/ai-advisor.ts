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
import { getAuthContext, AuthError } from "./auth-mw.ts";
import { PERSONNEL_ROLES } from "./constants.ts";

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
interface AdvisorMessageArtifact extends Record<string, unknown> {}
interface AdvisorStoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{ title: string; slug: string; url: string }>;
  artifacts?: AdvisorMessageArtifact[];
}
interface AdvisorSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messageCount: number;
  legacyImported?: boolean;
}

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
const LEGACY_CHAT_PREFIX = (userId: string) => `ai_advisor:${userId}:chat:`;
const SESSION_META_PREFIX = (userId: string) => `ai_advisor:${userId}:session_meta:`;
const SESSION_META_KEY = (userId: string, sessionId: string) => `${SESSION_META_PREFIX(userId)}${sessionId}`;
const SESSION_MESSAGE_PREFIX = (userId: string, sessionId: string) =>
  `ai_advisor:${userId}:session:${sessionId}:message:`;
const FNA_PREFIXES = {
  riskPlanning: 'risk-planning-fna:client:',
  medical: 'medical-fna:client:',
  retirement: 'retirement-fna:client:',
  investment: 'investment-ina:client:',
  taxPlanning: 'tax-planning-fna:client:',
  estatePlanning: 'estate-planning-fna:client:',
} as const;

function toIsoTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function toTimestampKey(timestamp: string): string {
  const parsed = new Date(timestamp).getTime();
  const numeric = Number.isFinite(parsed) ? parsed : Date.now();
  return String(numeric).padStart(13, '0');
}

function stripMarkdownArtifacts(content: string): string {
  return content
    .replace(/[*_`#>\-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSessionTitle(seed?: string): string {
  const cleaned = seed ? stripMarkdownArtifacts(seed) : '';
  if (!cleaned) return 'New chat';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42).trimEnd()}…` : cleaned;
}

function buildMessagePreview(content: string): string {
  const cleaned = stripMarkdownArtifacts(content);
  if (!cleaned) return '';
  return cleaned.length > 72 ? `${cleaned.slice(0, 72).trimEnd()}…` : cleaned;
}

function normalizeAdvisorStoredMessage(value: unknown): AdvisorStoredMessage | null {
  if (!isRecord(value)) return null;
  if (value.role !== 'user' && value.role !== 'assistant') return null;
  if (typeof value.content !== 'string') return null;

  const citations = Array.isArray(value.citations) ? value.citations.filter(isRecord).map((citation) => ({
    title: typeof citation.title === 'string' ? citation.title : '',
    slug: typeof citation.slug === 'string' ? citation.slug : '',
    url: typeof citation.url === 'string' ? citation.url : '',
  })).filter((citation) => citation.title && citation.slug && citation.url) : undefined;

  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.filter(isRecord) as AdvisorMessageArtifact[]
    : undefined;

  return {
    role: value.role,
    content: value.content,
    timestamp: toIsoTimestamp(value.timestamp),
    citations: citations && citations.length > 0 ? citations : undefined,
    artifacts: artifacts && artifacts.length > 0 ? artifacts : undefined,
  };
}

function normalizeAdvisorSessionSummary(value: unknown, sessionId?: string): AdvisorSessionSummary | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' && value.id.trim()
    ? value.id.trim()
    : (sessionId || '');
  if (!id) return null;

  const createdAt = toIsoTimestamp(value.createdAt);
  const updatedAt = toIsoTimestamp(value.updatedAt, createdAt);
  const messageCount = typeof value.messageCount === 'number' && Number.isFinite(value.messageCount)
    ? Math.max(0, Math.floor(value.messageCount))
    : 0;

  return {
    id,
    title: typeof value.title === 'string' && value.title.trim()
      ? value.title.trim()
      : 'New chat',
    createdAt,
    updatedAt,
    lastMessagePreview: typeof value.lastMessagePreview === 'string' ? value.lastMessagePreview : '',
    messageCount,
    legacyImported: value.legacyImported === true,
  };
}

async function listAllKvRowsByPrefix(prefix: string): Promise<Array<{ key: string; value: unknown }>> {
  const rows: Array<{ key: string; value: unknown }> = [];
  let startAfter: string | undefined;

  while (true) {
    const batch = await kv.listByPrefix(prefix, { limit: 200, startAfter });
    rows.push(...batch);
    if (batch.length < 200) break;
    startAfter = batch[batch.length - 1]?.key;
    if (!startAfter) break;
  }

  return rows;
}

async function deleteKvKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  for (let index = 0; index < keys.length; index += 100) {
    await kv.mdel(keys.slice(index, index + 100));
  }
}

async function listAdvisorSessionSummaries(subjectUserId: string): Promise<AdvisorSessionSummary[]> {
  const rows = await listAllKvRowsByPrefix(SESSION_META_PREFIX(subjectUserId));
  return rows
    .map((row) => normalizeAdvisorSessionSummary(row.value, row.key.slice(SESSION_META_PREFIX(subjectUserId).length)))
    .filter((summary): summary is AdvisorSessionSummary => Boolean(summary))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

async function getAdvisorSessionSummary(subjectUserId: string, sessionId: string): Promise<AdvisorSessionSummary | null> {
  const raw = await kv.get(SESSION_META_KEY(subjectUserId, sessionId));
  return normalizeAdvisorSessionSummary(raw, sessionId);
}

async function upsertAdvisorSessionSummary(subjectUserId: string, summary: AdvisorSessionSummary): Promise<void> {
  await kv.set(SESSION_META_KEY(subjectUserId, summary.id), summary);
}

async function ensureAdvisorSession(
  subjectUserId: string,
  sessionId?: string | null,
  titleSeed?: string,
): Promise<AdvisorSessionSummary> {
  const requestedId = typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : crypto.randomUUID();
  const existing = await getAdvisorSessionSummary(subjectUserId, requestedId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const summary: AdvisorSessionSummary = {
    id: requestedId,
    title: buildSessionTitle(titleSeed),
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: '',
    messageCount: 0,
  };
  await upsertAdvisorSessionSummary(subjectUserId, summary);
  return summary;
}

function advisorSessionMessageKey(
  subjectUserId: string,
  sessionId: string,
  timestamp: string,
  sequence: number,
): string {
  return `${SESSION_MESSAGE_PREFIX(subjectUserId, sessionId)}${toTimestampKey(timestamp)}:${String(sequence).padStart(4, '0')}:${crypto.randomUUID()}`;
}

async function loadAdvisorSessionMessages(subjectUserId: string, sessionId: string): Promise<AdvisorStoredMessage[]> {
  const rows = await listAllKvRowsByPrefix(SESSION_MESSAGE_PREFIX(subjectUserId, sessionId));
  return rows
    .map((row) => normalizeAdvisorStoredMessage(row.value))
    .filter((message): message is AdvisorStoredMessage => Boolean(message))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

async function appendAdvisorSessionMessages(
  subjectUserId: string,
  sessionId: string,
  newMessages: AdvisorStoredMessage[],
  titleSeed?: string,
): Promise<AdvisorSessionSummary> {
  const summary = await ensureAdvisorSession(subjectUserId, sessionId, titleSeed);
  if (newMessages.length === 0) return summary;

  const keys = newMessages.map((message, index) =>
    advisorSessionMessageKey(subjectUserId, summary.id, message.timestamp, summary.messageCount + index),
  );
  await kv.mset(keys, newMessages);

  const lastMessage = newMessages[newMessages.length - 1];
  const updatedSummary: AdvisorSessionSummary = {
    ...summary,
    title:
      summary.messageCount === 0 && newMessages[0]?.role === 'user'
        ? buildSessionTitle(titleSeed || newMessages[0].content)
        : summary.title,
    updatedAt: lastMessage.timestamp,
    lastMessagePreview: buildMessagePreview(lastMessage.content),
    messageCount: summary.messageCount + newMessages.length,
  };
  await upsertAdvisorSessionSummary(subjectUserId, updatedSummary);
  return updatedSummary;
}

async function clearAdvisorSessionMessages(subjectUserId: string, sessionId: string): Promise<AdvisorSessionSummary | null> {
  const summary = await getAdvisorSessionSummary(subjectUserId, sessionId);
  if (!summary) return null;

  const rows = await listAllKvRowsByPrefix(SESSION_MESSAGE_PREFIX(subjectUserId, sessionId));
  await deleteKvKeys(rows.map((row) => row.key));

  const clearedSummary: AdvisorSessionSummary = {
    ...summary,
    updatedAt: new Date().toISOString(),
    lastMessagePreview: '',
    messageCount: 0,
  };
  await upsertAdvisorSessionSummary(subjectUserId, clearedSummary);
  return clearedSummary;
}

async function deleteAdvisorSession(subjectUserId: string, sessionId: string): Promise<void> {
  const rows = await listAllKvRowsByPrefix(SESSION_MESSAGE_PREFIX(subjectUserId, sessionId));
  await deleteKvKeys(rows.map((row) => row.key));
  await kv.del(SESSION_META_KEY(subjectUserId, sessionId));
}

async function deleteLegacyAdvisorHistory(subjectUserId: string): Promise<void> {
  const rows = await listAllKvRowsByPrefix(LEGACY_CHAT_PREFIX(subjectUserId));
  await deleteKvKeys(rows.map((row) => row.key));
}

async function migrateLegacyAdvisorHistory(subjectUserId: string): Promise<AdvisorSessionSummary[]> {
  const existingSummaries = await listAdvisorSessionSummaries(subjectUserId);
  if (existingSummaries.length > 0) return existingSummaries;

  const legacyRows = await listAllKvRowsByPrefix(LEGACY_CHAT_PREFIX(subjectUserId));
  const legacyMessages = legacyRows
    .map((row) => normalizeAdvisorStoredMessage(row.value))
    .filter((message): message is AdvisorStoredMessage => Boolean(message))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (legacyMessages.length === 0) return existingSummaries;

  const firstUserMessage = legacyMessages.find((message) => message.role === 'user');
  const summary: AdvisorSessionSummary = {
    id: crypto.randomUUID(),
    title: buildSessionTitle(firstUserMessage?.content),
    createdAt: legacyMessages[0].timestamp,
    updatedAt: legacyMessages[legacyMessages.length - 1].timestamp,
    lastMessagePreview: buildMessagePreview(legacyMessages[legacyMessages.length - 1].content),
    messageCount: legacyMessages.length,
    legacyImported: true,
  };

  await upsertAdvisorSessionSummary(subjectUserId, summary);
  await kv.mset(
    legacyMessages.map((message, index) =>
      advisorSessionMessageKey(subjectUserId, summary.id, message.timestamp, index),
    ),
    legacyMessages,
  );
  await deleteLegacyAdvisorHistory(subjectUserId);

  return [summary];
}

async function listEnsuredAdvisorSessions(subjectUserId: string): Promise<AdvisorSessionSummary[]> {
  await migrateLegacyAdvisorHistory(subjectUserId);
  return listAdvisorSessionSummaries(subjectUserId);
}

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

function getAdviserIdFromClientProfile(profile: unknown): string | null {
  if (!isRecord(profile)) return null;
  const pi = isRecord(profile.personalInformation) ? profile.personalInformation : null;
  const raw = profile.adviserId ?? pi?.adviserId;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

/**
 * Staff may open the client's portal Ask Vasco (same KV conversation) for oversight.
 * Elevated roles see any client; advisers only their assigned book.
 */
async function assertCanProxyClientVasco(
  c: Context,
  staffUserId: string,
  staffRole: string,
  clientUserId: string,
): Promise<Response | null> {
  const profile = await kv.get(PROFILE_KEY(clientUserId));
  const targetRole = isRecord(profile) && typeof profile.role === 'string' ? profile.role : null;
  if (targetRole && (PERSONNEL_ROLES as readonly string[]).includes(targetRole)) {
    return c.json({ error: 'Cannot open Ask Vasco for staff accounts' }, 403);
  }

  const elevated = new Set([
    'admin',
    'super_admin',
    'super-admin',
    'compliance',
    'compliance_officer',
    'paraplanner',
    'viewer',
  ]);
  if (elevated.has(staffRole)) return null;

  if (staffRole === 'adviser') {
    const adviserId = getAdviserIdFromClientProfile(profile);
    if (adviserId !== staffUserId) {
      return c.json(
        { error: 'Forbidden: you can only view Ask Vasco for clients assigned to you' },
        403,
      );
    }
    return null;
  }

  return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
}

function normalizeAdvisorChatMessages(clientMessages: unknown): ChatMessage[] | null {
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

async function buildAdvisorSseResponse(
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

  const lastUserMsg = [...(clientMessages as { role: string; content: string }[])].reverse()
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
      [{
        role: 'user',
        content: lastUserMsg.content,
        timestamp: userMessageTimestamp,
      }],
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
          await appendAdvisorSessionMessages(subjectUserId, finalSessionId, [{
            role: 'assistant',
            content: fullReply,
            timestamp: new Date().toISOString(),
            citations: [],
            artifacts: [],
          }]);
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
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`),
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
    return await buildAdvisorSseResponse(user.id, clientMessages, sessionId);
  } catch (error: unknown) {
    log.error('Streaming chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * GET /sessions - list authenticated Ask Vasco sessions for the current client
 */
app.get('/sessions', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sessions = await listEnsuredAdvisorSessions(user.id);
    return c.json({ sessions });
  } catch (error) {
    log.error('Failed to list advisor sessions', error);
    return c.json({ error: 'Failed to load chat sessions' }, 500);
  }
});

/**
 * POST /sessions - create an empty Ask Vasco session for the current client
 */
app.post('/sessions', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const title = isRecord(body) && typeof body.title === 'string' ? body.title : undefined;
    const session = await ensureAdvisorSession(user.id, null, title);
    return c.json({ session });
  } catch (error) {
    log.error('Failed to create advisor session', error);
    return c.json({ error: 'Failed to create chat session' }, 500);
  }
});

/**
 * GET /sessions/:sessionId - load one authenticated Ask Vasco session
 */
app.get('/sessions/:sessionId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const session = await getAdvisorSessionSummary(user.id, sessionId);
    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    const messages = await loadAdvisorSessionMessages(user.id, sessionId);
    return c.json({ session, messages });
  } catch (error) {
    log.error('Failed to load advisor session', error);
    return c.json({ error: 'Failed to load chat session' }, 500);
  }
});

/**
 * DELETE /sessions/:sessionId - delete an authenticated Ask Vasco thread
 */
app.delete('/sessions/:sessionId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    await deleteAdvisorSession(user.id, sessionId);
    return c.json({ success: true });
  } catch (error) {
    log.error('Failed to delete advisor session', error);
    return c.json({ error: 'Failed to delete chat session' }, 500);
  }
});

/**
 * GET /admin/history — fetch portal Ask Vasco history for a client (staff only)
 */
app.get('/admin/history', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.query('sessionId')?.trim();
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    if (sessionId) {
      const session = await getAdvisorSessionSummary(clientUserId, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      const messages = await loadAdvisorSessionMessages(clientUserId, sessionId);
      return c.json({ messages, sessionId, session });
    }

    const sessions = await listEnsuredAdvisorSessions(clientUserId);
    const activeSession = sessions[0];
    if (!activeSession) {
      return c.json({ messages: [], sessionId: null, session: null });
    }

    const messages = await loadAdvisorSessionMessages(clientUserId, activeSession.id);
    return c.json({ messages, sessionId: activeSession.id, session: activeSession });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.statusCode);
    }
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

/**
 * GET /admin/sessions - list portal Ask Vasco sessions for a client (staff only)
 */
app.get('/admin/sessions', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    const sessions = await listEnsuredAdvisorSessions(clientUserId);
    return c.json({ sessions });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.statusCode);
    }
    log.error('Failed to list admin advisor sessions', error);
    return c.json({ error: 'Failed to load chat sessions' }, 500);
  }
});

/**
 * POST /admin/sessions - create an Ask Vasco session for a client (staff only)
 */
app.post('/admin/sessions', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const clientUserId =
      isRecord(body) && typeof body.clientUserId === 'string'
        ? body.clientUserId.trim()
        : '';
    if (!clientUserId) {
      return c.json({ error: 'clientUserId is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    const title = isRecord(body) && typeof body.title === 'string' ? body.title : undefined;
    const session = await ensureAdvisorSession(clientUserId, null, title);
    return c.json({ session });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.statusCode);
    }
    log.error('Failed to create admin advisor session', error);
    return c.json({ error: 'Failed to create chat session' }, 500);
  }
});

/**
 * GET /admin/sessions/:sessionId - load one portal Ask Vasco session for a client (staff only)
 */
app.get('/admin/sessions/:sessionId', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.param('sessionId');
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    const session = await getAdvisorSessionSummary(clientUserId, sessionId);
    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    const messages = await loadAdvisorSessionMessages(clientUserId, sessionId);
    return c.json({ session, messages });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.statusCode);
    }
    log.error('Failed to load admin advisor session', error);
    return c.json({ error: 'Failed to load chat session' }, 500);
  }
});

/**
 * DELETE /admin/sessions/:sessionId - delete a client's Ask Vasco thread (staff only)
 */
app.delete('/admin/sessions/:sessionId', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.param('sessionId');
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    await deleteAdvisorSession(clientUserId, sessionId);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.statusCode);
    }
    log.error('Failed to delete admin advisor session', error);
    return c.json({ error: 'Failed to delete chat session' }, 500);
  }
});

/**
 * POST /admin/chat/stream — same SSE contract as /chat/stream but for a client's user id
 */
app.post('/admin/chat/stream', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const body = await c.req.json();
    const { messages: clientMessages, sessionId, clientUserId } = body;
    const uid = typeof clientUserId === 'string' ? clientUserId.trim() : '';
    if (!uid) {
      return c.json({ error: 'clientUserId is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, uid);
    if (denied) return denied;
    return await buildAdvisorSseResponse(uid, clientMessages, sessionId);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      const ae = error as AuthError;
      return c.json({ error: ae.message, code: ae.code }, ae.statusCode);
    }
    log.error('Admin streaming chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * DELETE /admin/history — clear portal Ask Vasco history for a client (staff only)
 */
app.delete('/admin/history', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.query('sessionId')?.trim();
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    if (sessionId) {
      const session = await clearAdvisorSessionMessages(clientUserId, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      return c.json({ success: true, session });
    }

    const sessions = await listEnsuredAdvisorSessions(clientUserId);
    await Promise.all(sessions.map((session) => deleteAdvisorSession(clientUserId, session.id)));
    await deleteLegacyAdvisorHistory(clientUserId);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message, code: error.code }, error.statusCode);
    }
    return c.json({ error: 'Failed to clear history' }, 500);
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
    const sessionId = c.req.query('sessionId')?.trim();

    if (sessionId) {
      const session = await getAdvisorSessionSummary(user.id, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      const messages = await loadAdvisorSessionMessages(user.id, sessionId);
      return c.json({ messages, sessionId, session });
    }

    const sessions = await listEnsuredAdvisorSessions(user.id);
    const activeSession = sessions[0];
    if (!activeSession) {
      return c.json({ messages: [], sessionId: null, session: null });
    }

    const messages = await loadAdvisorSessionMessages(user.id, activeSession.id);
    return c.json({ messages, sessionId: activeSession.id, session: activeSession });
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
    const sessionId = c.req.query('sessionId')?.trim();

    if (sessionId) {
      const session = await clearAdvisorSessionMessages(user.id, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      return c.json({ success: true, session });
    }

    const sessions = await listEnsuredAdvisorSessions(user.id);
    await Promise.all(sessions.map((session) => deleteAdvisorSession(user.id, session.id)));
    await deleteLegacyAdvisorHistory(user.id);
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to clear history' }, 500);
  }
});

export default app;
