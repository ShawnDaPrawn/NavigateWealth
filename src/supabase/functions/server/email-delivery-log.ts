/**
 * Email delivery log — the record of every email the platform tries to send.
 *
 * `sendEmail()` in email-core.ts calls `recordEmailDelivery` once per attempt,
 * success or failure. The rows live in `public.email_delivery_log` (migration
 * 20261123205911) and are read back by the Communication Centre's History,
 * the client profile's communication history, and anyone diagnosing a
 * "the client never got it" report.
 *
 * Before this existed nothing kept a record: a birthday greeting that did not
 * arrive answered 200 from its scheduled job and left no trace anywhere.
 *
 * WRITING NEVER BREAKS SENDING. The email has already gone (or failed) by the
 * time this runs; a failure to record it is logged and swallowed. Outside the
 * Edge Function (no SUPABASE_URL, i.e. unit tests) it is a no-op.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { getRequestContext } from './request-context.ts';
import {
  emailKindLabel,
  isSensitiveEmailKind,
  KINDS_IN_CAMPAIGN_HISTORY,
  type EmailKind,
} from '../../../shared/email/emailKinds.ts';

const log = createModuleLogger('email-delivery-log');

const TABLE = 'email_delivery_log';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_LENGTH = 400;

let _client: ReturnType<typeof createClient> | null | undefined;

function getClient(): ReturnType<typeof createClient> | null {
  if (_client !== undefined) return _client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  _client = url && key ? createClient(url, key) : null;
  return _client;
}

/** Test seam: drop the cached client so a test can change the environment. */
export function __resetEmailDeliveryLogForTests(): void {
  _client = undefined;
}

/**
 * Plain-text preview of an email, safe to keep.
 *
 * Links are removed, not shortened: a signing link, an unsubscribe link or a
 * confirmation link carries a token that would let whoever reads the history
 * act as the recipient.
 */
export function buildEmailPreview(text: string | undefined, html: string): string {
  const source =
    text && text.trim()
      ? text
      : html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&');
  return source
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PREVIEW_LENGTH);
}

export interface EmailDeliveryRecord {
  kind: EmailKind;
  batchId?: string;
  /** The client the email is for, when the sender knows it. See listDeliveriesForClient. */
  clientId?: string;
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
  status: 'sent' | 'failed';
  provider: string;
  providerMessageId?: string | null;
  error?: string;
}

/** Build the row exactly as it is stored. Exported for the contract tests. */
export function toDeliveryRow(record: EmailDeliveryRecord): Record<string, unknown> {
  const ctx = getRequestContext();
  const sensitive = isSensitiveEmailKind(record.kind);
  return {
    kind: record.kind,
    batch_id: record.batchId ?? null,
    client_id: record.clientId && UUID_RE.test(record.clientId) ? record.clientId : null,
    recipient: record.to.trim().toLowerCase(),
    cc: record.cc && record.cc.length > 0 ? record.cc.map((a) => a.trim().toLowerCase()) : null,
    // A one-time code or reset link is the content; keep only that it was sent.
    // The subject goes too: the sign-in code email carries the code in its
    // subject line, and another sender could do the same tomorrow.
    subject: sensitive ? emailKindLabel(record.kind) : record.subject || '',
    preview: sensitive ? null : buildEmailPreview(record.text, record.html),
    status: record.status,
    provider: record.provider,
    provider_message_id: record.providerMessageId ?? null,
    error: record.error ? record.error.slice(0, 1000) : null,
    route: ctx?.route ?? null,
    request_id: ctx?.requestId ?? null,
  };
}

/**
 * Record one send attempt. Never throws.
 *
 * Awaited by sendEmail rather than fired and forgotten: the Edge Runtime may
 * end the isolate once the response is out, and the scheduled jobs that send
 * most transactional mail return as soon as their loop does.
 */
export async function recordEmailDelivery(record: EmailDeliveryRecord): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    const { error } = await client.from(TABLE).insert(toDeliveryRow(record));
    if (error) log.error('Failed to record email delivery', error, { kind: record.kind });
  } catch (error) {
    log.error('Failed to record email delivery', error as Error, { kind: record.kind });
  }
}

// ============================================================================
// READ SIDE
// ============================================================================

export interface DeliveryGroup {
  groupKey: string;
  kind: string;
  batchId: string | null;
  firstAt: string;
  lastAt: string;
  subject: string;
  preview: string | null;
  recipient: string;
  cc: string[] | null;
  total: number;
  sent: number;
  failed: number;
  status: 'sent' | 'completed' | 'partial' | 'failed';
  lastError: string | null;
  providerMessageId: string | null;
}

export interface DeliveryGroupFilters {
  kinds?: string[];
  status?: string;
  search?: string;
  recipientType?: 'single' | 'multiple';
  limit: number;
  offset: number;
}

function requireClient(): ReturnType<typeof createClient> {
  const client = getClient();
  if (!client) throw new Error('email delivery log is not configured');
  return client;
}

type PageRow = {
  group_key: string;
  kind: string;
  batch_id: string | null;
  first_at: string;
  last_at: string;
  subject: string;
  preview: string | null;
  recipient: string;
  cc: string[] | null;
  total: number | string;
  sent: number | string;
  failed: number | string;
  status: DeliveryGroup['status'];
  last_error: string | null;
  provider_message_id: string | null;
  total_count: number | string;
};

/**
 * One page of sends (a batch is one row), newest first, with the total.
 * Campaigns and individual messages are excluded: History shows them through
 * their own, richer rows.
 */
export async function listDeliveryGroups(
  filters: DeliveryGroupFilters,
): Promise<{ groups: DeliveryGroup[]; total: number }> {
  const { data, error } = await requireClient().rpc('email_history_page', {
    p_exclude_kinds: [...KINDS_IN_CAMPAIGN_HISTORY],
    p_kinds: filters.kinds && filters.kinds.length > 0 ? filters.kinds : null,
    p_status: filters.status ?? null,
    p_search: filters.search?.trim() ? filters.search.trim() : null,
    p_recipient_type: filters.recipientType ?? null,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throw new Error(`email history query failed: ${error.message}`);
  const rows = (data ?? []) as PageRow[];
  return {
    groups: rows.map((r) => ({
      groupKey: r.group_key,
      kind: r.kind,
      batchId: r.batch_id,
      firstAt: r.first_at,
      lastAt: r.last_at,
      subject: r.subject,
      preview: r.preview,
      recipient: r.recipient,
      cc: r.cc,
      total: Number(r.total),
      sent: Number(r.sent),
      failed: Number(r.failed),
      status: r.status,
      lastError: r.last_error,
      providerMessageId: r.provider_message_id,
    })),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

/** Kinds that have been sent, with how many sends of each. */
export async function listDeliveryKinds(): Promise<{ kind: string; sends: number }[]> {
  const { data, error } = await requireClient().rpc('email_history_kinds', {
    p_exclude_kinds: [...KINDS_IN_CAMPAIGN_HISTORY],
  });
  if (error) throw new Error(`email kinds query failed: ${error.message}`);
  return ((data ?? []) as { kind: string; sends: number | string }[]).map((r) => ({
    kind: r.kind,
    sends: Number(r.sends),
  }));
}

export interface DeliveryRow {
  id: string;
  createdAt: string;
  kind: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  providerMessageId: string | null;
}

const ROW_COLUMNS = 'id, created_at, kind, recipient, subject, status, error, provider_message_id';

type StoredRow = {
  id: string;
  created_at: string;
  kind: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  provider_message_id: string | null;
};

function toDeliveryRowView(r: StoredRow): DeliveryRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    kind: r.kind,
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    error: r.error,
    providerMessageId: r.provider_message_id,
  };
}

/**
 * Every attempt inside one send, newest first: the recipients of a batch, or
 * the single email (a group key that is not a batch id is the row's own id).
 */
export async function listGroupDeliveries(groupKey: string): Promise<DeliveryRow[]> {
  const query = requireClient().from(TABLE).select(ROW_COLUMNS);
  const filtered = UUID_RE.test(groupKey)
    ? query.eq('id', groupKey)
    : query.eq('batch_id', groupKey);
  const { data, error } = await filtered.order('created_at', { ascending: false }).limit(2000);
  if (error) throw new Error(`email deliveries query failed: ${error.message}`);
  return ((data ?? []) as StoredRow[]).map(toDeliveryRowView);
}

/**
 * Every email sent to one client, newest first: rows attributed to them, plus
 * unattributed rows sent to their own sign-in address.
 *
 * Not "every row to their contact address": a linked client (a child on a
 * parent's mailbox, client-email-identity.ts) is mailed at the SHARED address,
 * so that would show each household member the others' email. Attributed rows
 * stay with their client; the mailbox owner keeps the unattributed rest.
 */
export async function listDeliveriesForClient(
  clientId: string,
  signInEmail: string | undefined,
  limit = 200,
): Promise<DeliveryRow[]> {
  if (!UUID_RE.test(clientId)) return [];
  const address = (signInEmail ?? '').trim().toLowerCase();
  // PostgREST filter grammar: commas and parentheses would break the list.
  const usableAddress = address && !/[,()"]/.test(address) ? address : '';
  const filter = usableAddress
    ? `client_id.eq.${clientId},and(client_id.is.null,recipient.eq.${usableAddress})`
    : `client_id.eq.${clientId}`;
  const { data, error } = await requireClient()
    .from(TABLE)
    .select(ROW_COLUMNS)
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`client deliveries query failed: ${error.message}`);
  return ((data ?? []) as StoredRow[]).map(toDeliveryRowView);
}
