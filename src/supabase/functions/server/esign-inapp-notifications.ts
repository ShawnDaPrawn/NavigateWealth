/**
 * P5.7 — In-app notifications for the e-signature dashboard.
 *
 * A deliberately small KV-backed service: each notification is a single
 * JSON record keyed by id, plus a per-user index of ids in reverse
 * chronological order and a cached unread counter.
 *
 * Consumers should prefer `enqueue()` over writing keys directly so the
 * index + counter stay consistent. Reads use `list()` which tolerates a
 * corrupt or missing index gracefully.
 *
 * This module is intentionally decoupled from email/webhook delivery — a
 * single sender action (completion, decline, expiry, reminder) fans out
 * to all enabled channels independently. The bell UI only subscribes to
 * this queue; the other channels have their own outboxes.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-inapp-notifications');

/** Maximum notifications retained per user. Older entries roll off. */
const MAX_PER_USER = 100;

export type InAppNotificationType =
  | 'envelope.completed'
  | 'envelope.declined'
  | 'envelope.expired'
  | 'envelope.recalled'
  | 'signer.signed'
  | 'reminder.sent'
  | 'system';

export interface InAppNotification {
  id: string;
  user_id: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  /** Envelope the notification relates to, when applicable. */
  envelope_id?: string;
  /** Signer involved in the event, when applicable. */
  signer_id?: string;
  /** ISO-8601 creation timestamp. */
  created_at: string;
  /** ISO-8601 read timestamp; absent while unread. */
  read_at?: string;
  /** Free-form metadata for the UI (e.g. envelope title). */
  metadata?: Record<string, unknown>;
}

async function readIndex(userId: string): Promise<string[]> {
  try {
    const raw = await kv.get(EsignKeys.notificationsByUser(userId));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function writeIndex(userId: string, ids: string[]): Promise<void> {
  await kv.set(EsignKeys.notificationsByUser(userId), ids);
}

async function readUnread(userId: string): Promise<number> {
  try {
    const raw = await kv.get(EsignKeys.notificationsUnread(userId));
    return typeof raw === 'number' && raw >= 0 ? raw : 0;
  } catch {
    return 0;
  }
}

async function writeUnread(userId: string, count: number): Promise<void> {
  await kv.set(EsignKeys.notificationsUnread(userId), Math.max(0, count));
}

/**
 * Enqueue a notification for a user. Best-effort — callers should never
 * fail their primary workflow if notifications cannot be written.
 */
export async function enqueue(params: {
  userId: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  envelopeId?: string;
  signerId?: string;
  metadata?: Record<string, unknown>;
}): Promise<InAppNotification | null> {
  if (!params.userId) return null;
  try {
    const id = crypto.randomUUID();
    const record: InAppNotification = {
      id,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      envelope_id: params.envelopeId,
      signer_id: params.signerId,
      created_at: new Date().toISOString(),
      metadata: params.metadata,
    };

    await kv.set(EsignKeys.notification(id), record);

    const index = await readIndex(params.userId);
    index.unshift(id);
    const trimmed = index.slice(0, MAX_PER_USER);
    const dropped = index.slice(MAX_PER_USER);
    await writeIndex(params.userId, trimmed);

    // Best-effort cleanup of rolled-off notifications.
    for (const staleId of dropped) {
      try { await kv.del(EsignKeys.notification(staleId)); } catch { /* ignore */ }
    }

    const unread = await readUnread(params.userId);
    await writeUnread(params.userId, unread + 1);

    return record;
  } catch (error: unknown) {
    log.warn('Failed to enqueue in-app notification', error);
    return null;
  }
}

/** List the most recent notifications for a user (newest first). */
export async function list(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ items: InAppNotification[]; unread: number; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), MAX_PER_USER);
  const index = await readIndex(userId);
  const unread = await readUnread(userId);

  const ids = index.slice(0, options.unreadOnly ? MAX_PER_USER : limit);
  const records = await Promise.all(
    ids.map((id) => kv.get(EsignKeys.notification(id))),
  );

  let items = records.filter((r): r is InAppNotification => !!r && typeof r === 'object');
  if (options.unreadOnly) {
    items = items.filter((r) => !r.read_at).slice(0, limit);
  }

  return { items, unread, total: index.length };
}

/** Mark a single notification as read. Idempotent. */
export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  try {
    const record = await kv.get(EsignKeys.notification(notificationId));
    if (!record || record.user_id !== userId) return false;
    if (record.read_at) return true;

    const updated: InAppNotification = {
      ...record,
      read_at: new Date().toISOString(),
    };
    await kv.set(EsignKeys.notification(notificationId), updated);

    const unread = await readUnread(userId);
    await writeUnread(userId, unread - 1);
    return true;
  } catch (error: unknown) {
    log.warn('Failed to mark notification read', error);
    return false;
  }
}

/** Mark every notification in the user's queue as read. */
export async function markAllRead(userId: string): Promise<number> {
  try {
    const index = await readIndex(userId);
    const now = new Date().toISOString();
    let changed = 0;
    for (const id of index) {
      const record = await kv.get(EsignKeys.notification(id));
      if (!record || record.read_at) continue;
      await kv.set(EsignKeys.notification(id), { ...record, read_at: now });
      changed += 1;
    }
    await writeUnread(userId, 0);
    return changed;
  } catch (error: unknown) {
    log.warn('Failed to mark all notifications read', error);
    return 0;
  }
}
