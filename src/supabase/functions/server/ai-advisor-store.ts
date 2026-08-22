/**
 * The advisor's session store: KV rows in, normalized sessions and messages
 * out, plus the legacy-history migration.
 *
 * Split out of `ai-advisor.ts` (1,443 lines). The logger keeps the channel
 * name `ai-advisor`, so the split renames nothing in the logs.
 */
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';
import {
  type AdvisorMessageArtifact,
  type AdvisorSessionSummary,
  type AdvisorStoredMessage,
  type KvRow,
  LEGACY_CHAT_PREFIX,
  SESSION_MESSAGE_PREFIX,
  SESSION_META_KEY,
  SESSION_META_PREFIX,
  getSupabase,
} from './ai-advisor-shared.ts';

const log = createModuleLogger('ai-advisor');

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

export function getClientName(profile: unknown): string {
  if (!isRecord(profile)) return 'the client';

  const personalInfo = isRecord(profile.personalInformation) ? profile.personalInformation : null;

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

export function extractTimestamp(value: unknown): number {
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

export function uniqueItems(items: unknown[]): unknown[] {
  const seen = new Set<string>();

  return items.filter((item, _index) => {
    const key: string = isRecord(item)
      ? (() => {
          const explicitKey = [
            item.id,
            item.messageId,
            item.documentId,
            item.policyNumber,
            item.filePath,
            item.url,
          ].find((value) => typeof value === 'string' && value.trim());
          return typeof explicitKey === 'string' && explicitKey.trim()
            ? explicitKey
            : JSON.stringify(item);
        })()
      : JSON.stringify(item);

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortByRecency(items: unknown[]): unknown[] {
  return [...items].sort((a, b) => extractTimestamp(b) - extractTimestamp(a));
}

export async function safeResolve<T>(
  label: string,
  task: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    log.error(`Failed to load ${label} for authenticated Vasco context`, error);
    return fallback;
  }
}

export async function fetchRowsByPrefix(prefix: string): Promise<KvRow[]> {
  const { data, error } = await getSupabase()
    .from('kv_store_91ed8379')
    .select('key, value')
    .like('key', `${prefix}%`);

  if (error) throw error;
  return data || [];
}

export function toIsoTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

export function toTimestampKey(timestamp: string): string {
  const parsed = new Date(timestamp).getTime();
  const numeric = Number.isFinite(parsed) ? parsed : Date.now();
  return String(numeric).padStart(13, '0');
}

export function stripMarkdownArtifacts(content: string): string {
  return content
    .replace(/[*_`#>-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSessionTitle(seed?: string): string {
  const cleaned = seed ? stripMarkdownArtifacts(seed) : '';
  if (!cleaned) return 'New chat';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42).trimEnd()}…` : cleaned;
}

export function buildMessagePreview(content: string): string {
  const cleaned = stripMarkdownArtifacts(content);
  if (!cleaned) return '';
  return cleaned.length > 72 ? `${cleaned.slice(0, 72).trimEnd()}…` : cleaned;
}

export function normalizeAdvisorStoredMessage(value: unknown): AdvisorStoredMessage | null {
  if (!isRecord(value)) return null;
  if (value.role !== 'user' && value.role !== 'assistant') return null;
  if (typeof value.content !== 'string') return null;

  const citations = Array.isArray(value.citations)
    ? value.citations
        .filter(isRecord)
        .map((citation) => ({
          title: typeof citation.title === 'string' ? citation.title : '',
          slug: typeof citation.slug === 'string' ? citation.slug : '',
          url: typeof citation.url === 'string' ? citation.url : '',
        }))
        .filter((citation) => citation.title && citation.slug && citation.url)
    : undefined;

  const artifacts = Array.isArray(value.artifacts)
    ? (value.artifacts.filter(isRecord) as AdvisorMessageArtifact[])
    : undefined;

  return {
    role: value.role,
    content: value.content,
    timestamp: toIsoTimestamp(value.timestamp),
    citations: citations && citations.length > 0 ? citations : undefined,
    artifacts: artifacts && artifacts.length > 0 ? artifacts : undefined,
  };
}

export function normalizeAdvisorSessionSummary(
  value: unknown,
  sessionId?: string,
): AdvisorSessionSummary | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : sessionId || '';
  if (!id) return null;

  const createdAt = toIsoTimestamp(value.createdAt);
  const updatedAt = toIsoTimestamp(value.updatedAt, createdAt);
  const messageCount =
    typeof value.messageCount === 'number' && Number.isFinite(value.messageCount)
      ? Math.max(0, Math.floor(value.messageCount))
      : 0;

  return {
    id,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'New chat',
    createdAt,
    updatedAt,
    lastMessagePreview:
      typeof value.lastMessagePreview === 'string' ? value.lastMessagePreview : '',
    messageCount,
    legacyImported: value.legacyImported === true,
  };
}

export async function listAllKvRowsByPrefix(
  prefix: string,
): Promise<Array<{ key: string; value: unknown }>> {
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

export async function deleteKvKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  for (let index = 0; index < keys.length; index += 100) {
    await kv.mdel(keys.slice(index, index + 100));
  }
}

export async function listAdvisorSessionSummaries(
  subjectUserId: string,
): Promise<AdvisorSessionSummary[]> {
  const rows = await listAllKvRowsByPrefix(SESSION_META_PREFIX(subjectUserId));
  return rows
    .map((row) =>
      normalizeAdvisorSessionSummary(
        row.value,
        row.key.slice(SESSION_META_PREFIX(subjectUserId).length),
      ),
    )
    .filter((summary): summary is AdvisorSessionSummary => Boolean(summary))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getAdvisorSessionSummary(
  subjectUserId: string,
  sessionId: string,
): Promise<AdvisorSessionSummary | null> {
  const raw = await kv.get(SESSION_META_KEY(subjectUserId, sessionId));
  return normalizeAdvisorSessionSummary(raw, sessionId);
}

export async function upsertAdvisorSessionSummary(
  subjectUserId: string,
  summary: AdvisorSessionSummary,
): Promise<void> {
  await kv.set(SESSION_META_KEY(subjectUserId, summary.id), summary);
}

export async function ensureAdvisorSession(
  subjectUserId: string,
  sessionId?: string | null,
  titleSeed?: string,
): Promise<AdvisorSessionSummary> {
  const requestedId =
    typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : crypto.randomUUID();
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

export function advisorSessionMessageKey(
  subjectUserId: string,
  sessionId: string,
  timestamp: string,
  sequence: number,
): string {
  return `${SESSION_MESSAGE_PREFIX(subjectUserId, sessionId)}${toTimestampKey(timestamp)}:${String(sequence).padStart(4, '0')}:${crypto.randomUUID()}`;
}

export async function loadAdvisorSessionMessages(
  subjectUserId: string,
  sessionId: string,
): Promise<AdvisorStoredMessage[]> {
  const rows = await listAllKvRowsByPrefix(SESSION_MESSAGE_PREFIX(subjectUserId, sessionId));
  return rows
    .map((row) => normalizeAdvisorStoredMessage(row.value))
    .filter((message): message is AdvisorStoredMessage => Boolean(message))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function appendAdvisorSessionMessages(
  subjectUserId: string,
  sessionId: string,
  newMessages: AdvisorStoredMessage[],
  titleSeed?: string,
): Promise<AdvisorSessionSummary> {
  const summary = await ensureAdvisorSession(subjectUserId, sessionId, titleSeed);
  if (newMessages.length === 0) return summary;

  const keys = newMessages.map((message, index) =>
    advisorSessionMessageKey(
      subjectUserId,
      summary.id,
      message.timestamp,
      summary.messageCount + index,
    ),
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

export async function clearAdvisorSessionMessages(
  subjectUserId: string,
  sessionId: string,
): Promise<AdvisorSessionSummary | null> {
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

export async function deleteAdvisorSession(
  subjectUserId: string,
  sessionId: string,
): Promise<void> {
  const rows = await listAllKvRowsByPrefix(SESSION_MESSAGE_PREFIX(subjectUserId, sessionId));
  await deleteKvKeys(rows.map((row) => row.key));
  await kv.del(SESSION_META_KEY(subjectUserId, sessionId));
}

export async function deleteLegacyAdvisorHistory(subjectUserId: string): Promise<void> {
  const rows = await listAllKvRowsByPrefix(LEGACY_CHAT_PREFIX(subjectUserId));
  await deleteKvKeys(rows.map((row) => row.key));
}

export async function migrateLegacyAdvisorHistory(
  subjectUserId: string,
): Promise<AdvisorSessionSummary[]> {
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

export async function listEnsuredAdvisorSessions(
  subjectUserId: string,
): Promise<AdvisorSessionSummary[]> {
  await migrateLegacyAdvisorHistory(subjectUserId);
  return listAdvisorSessionSummaries(subjectUserId);
}
