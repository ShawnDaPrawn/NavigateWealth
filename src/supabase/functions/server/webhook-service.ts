/**
 * P5.4 — Webhook outbox.
 *
 * Goals:
 *   - Durable at-least-once delivery. Producer writes to the outbox KV and
 *     returns; the scheduler tick drains it.
 *   - HMAC-SHA256 body signing (header `X-Navigate-Signature: sha256=<hex>`).
 *   - Exponential backoff with jitter. Capped total attempts → dead-letter
 *     queue for manual replay.
 *   - Per-firm subscriptions, CRUD via the REST API.
 *   - Replay from UI (dev console / audit desk).
 *
 * Non-goals:
 *   - High throughput; this is a low-volume event stream. O(subs × events)
 *     per minute is fine.
 *   - Strong ordering. Consumers must tolerate out-of-order delivery and
 *     use the `event_id` to dedupe.
 *
 * Wire points:
 *   - `emitWebhookEvent` is called alongside the existing email dispatch
 *     in the e-sign workflow (signer.signed, envelope.completed, etc.).
 *   - `flushWebhookOutbox` is driven by `esign-scheduler.ts`, running once
 *     per minute.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { SenderEvent } from './esign-notification-prefs.ts';

const log = createModuleLogger('webhook-service');

// ============================================================================
// TYPES
// ============================================================================

export interface WebhookSubscription {
  id: string;
  firm_id: string;
  /** User who created the sub — used for audit. Not used for scoping. */
  created_by_user_id: string;
  url: string;
  /** 32+ bytes of opaque entropy. Persisted — the sub owner sees it once. */
  secret: string;
  events: SenderEvent[];
  active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
  last_success_at?: string;
  last_failure_at?: string;
  last_failure_message?: string;
}

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'dead';

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  firm_id: string;
  event_id: string;
  event_type: SenderEvent;
  envelope_id?: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: WebhookDeliveryStatus;
  /** Earliest time this delivery may be attempted. */
  next_attempt_at: string;
  last_attempt_at?: string;
  last_error?: string;
  response_code?: number;
  created_at: string;
  delivered_at?: string;
}

export interface FlushResult {
  attempted: number;
  delivered: number;
  retried: number;
  deadLettered: number;
}

// ============================================================================
// CONFIG
// ============================================================================

const KEYS = {
  subById: (id: string) => `esign:webhook:sub:${id}`,
  subsByFirm: (firmId: string) => `esign:webhook:subs_by_firm:${firmId}`,
  deliveryById: (id: string) => `esign:webhook:delivery:${id}`,
  pendingIndex: 'esign:webhook:outbox:pending',
  dlqIndex: 'esign:webhook:outbox:dlq',
  recentIndex: 'esign:webhook:outbox:recent', // last ~500 for UI listing
} as const;

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 60 * 1000;                    // 1 minute
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;           // 24h cap
const FLUSH_BATCH_SIZE = 25;
const REQUEST_TIMEOUT_MS = 15_000;
const RECENT_KEEP = 500;

// ============================================================================
// HMAC HELPERS
// ============================================================================

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const bytes = new Uint8Array(sigBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function generateSecret(): string {
  // 32 bytes → 64 hex chars. Plenty of entropy.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function nextBackoffDelayMs(attempts: number): number {
  // attempts is the number of failed attempts so far (1, 2, 3, ...)
  const raw = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
  // +/- 20% jitter.
  const jitter = raw * (0.8 + Math.random() * 0.4);
  return Math.floor(jitter);
}

// ============================================================================
// INDEX HELPERS
// ============================================================================

async function getIndex(key: string): Promise<string[]> {
  const raw = await kv.get(key);
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function addToIndex(key: string, id: string): Promise<void> {
  const ids = await getIndex(key);
  if (!ids.includes(id)) {
    ids.push(id);
    await kv.set(key, ids);
  }
}

async function removeFromIndex(key: string, id: string): Promise<void> {
  const ids = await getIndex(key);
  const filtered = ids.filter((x) => x !== id);
  if (filtered.length !== ids.length) {
    await kv.set(key, filtered);
  }
}

async function addToRecent(id: string): Promise<void> {
  const ids = await getIndex(KEYS.recentIndex);
  ids.push(id);
  const trimmed = ids.length > RECENT_KEEP ? ids.slice(-RECENT_KEEP) : ids;
  await kv.set(KEYS.recentIndex, trimmed);
}

// ============================================================================
// SUBSCRIPTION CRUD
// ============================================================================

export async function createSubscription(params: {
  firmId: string;
  userId: string;
  url: string;
  events: SenderEvent[];
  description?: string;
}): Promise<WebhookSubscription> {
  const now = new Date().toISOString();
  const sub: WebhookSubscription = {
    id: crypto.randomUUID(),
    firm_id: params.firmId,
    created_by_user_id: params.userId,
    url: params.url,
    secret: generateSecret(),
    events: params.events,
    active: true,
    description: params.description,
    created_at: now,
    updated_at: now,
  };
  await kv.set(KEYS.subById(sub.id), sub);
  await addToIndex(KEYS.subsByFirm(params.firmId), sub.id);
  log.info(`Webhook subscription created: id=${sub.id} firm=${params.firmId} url=${params.url}`);
  return sub;
}

export async function listSubscriptionsByFirm(firmId: string): Promise<WebhookSubscription[]> {
  const ids = await getIndex(KEYS.subsByFirm(firmId));
  const subs = await Promise.all(ids.map((id) => kv.get(KEYS.subById(id))));
  return subs.filter(Boolean) as WebhookSubscription[];
}

export async function getSubscription(id: string): Promise<WebhookSubscription | null> {
  return (await kv.get(KEYS.subById(id))) as WebhookSubscription | null;
}

export async function updateSubscription(
  id: string,
  patch: Partial<Pick<WebhookSubscription, 'url' | 'events' | 'active' | 'description'>>,
): Promise<WebhookSubscription | null> {
  const existing = await getSubscription(id);
  if (!existing) return null;
  const updated: WebhookSubscription = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  await kv.set(KEYS.subById(id), updated);
  return updated;
}

export async function rotateSubscriptionSecret(id: string): Promise<WebhookSubscription | null> {
  const existing = await getSubscription(id);
  if (!existing) return null;
  const updated: WebhookSubscription = {
    ...existing,
    secret: generateSecret(),
    updated_at: new Date().toISOString(),
  };
  await kv.set(KEYS.subById(id), updated);
  return updated;
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const existing = await getSubscription(id);
  if (!existing) return false;
  await removeFromIndex(KEYS.subsByFirm(existing.firm_id), id);
  await kv.del(KEYS.subById(id));
  return true;
}

// ============================================================================
// EMIT
// ============================================================================

/**
 * Publish an e-signature event. Matching active subscriptions receive a
 * queued delivery which will be drained by `flushWebhookOutbox`.
 *
 * This is fire-and-forget with a defensive try/catch — webhook failures
 * must never take down the originating business flow.
 */
export async function emitWebhookEvent(params: {
  firmId: string;
  eventType: SenderEvent;
  envelopeId?: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const subs = await listSubscriptionsByFirm(params.firmId);
    const matching = subs.filter((s) => s.active && s.events.includes(params.eventType));
    if (matching.length === 0) return;

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();

    for (const sub of matching) {
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        subscription_id: sub.id,
        firm_id: sub.firm_id,
        event_id: eventId,
        event_type: params.eventType,
        envelope_id: params.envelopeId,
        payload: {
          event: params.eventType,
          event_id: eventId,
          envelope_id: params.envelopeId,
          firm_id: sub.firm_id,
          emitted_at: now,
          data: params.payload,
        },
        attempts: 0,
        status: 'pending',
        next_attempt_at: now,
        created_at: now,
      };
      await kv.set(KEYS.deliveryById(delivery.id), delivery);
      await addToIndex(KEYS.pendingIndex, delivery.id);
      await addToRecent(delivery.id);
    }
    log.info(
      `Webhook event queued: type=${params.eventType} subs=${matching.length} envelope=${params.envelopeId ?? 'n/a'}`,
    );
  } catch (err) {
    log.error('emitWebhookEvent failed:', err);
  }
}

// ============================================================================
// FLUSH
// ============================================================================

/**
 * Drain up to FLUSH_BATCH_SIZE pending deliveries whose `next_attempt_at`
 * is in the past. Called by the scheduler on a tight cadence.
 */
export async function flushWebhookOutbox(): Promise<FlushResult> {
  const result: FlushResult = { attempted: 0, delivered: 0, retried: 0, deadLettered: 0 };
  const pendingIds = await getIndex(KEYS.pendingIndex);
  if (pendingIds.length === 0) return result;

  const now = Date.now();
  // Cap the work per tick.
  const batch = pendingIds.slice(0, FLUSH_BATCH_SIZE);

  for (const id of batch) {
    const delivery = (await kv.get(KEYS.deliveryById(id))) as WebhookDelivery | null;
    if (!delivery) {
      await removeFromIndex(KEYS.pendingIndex, id);
      continue;
    }
    if (delivery.status !== 'pending') {
      await removeFromIndex(KEYS.pendingIndex, id);
      continue;
    }
    if (new Date(delivery.next_attempt_at).getTime() > now) {
      // Not yet due — leave in queue.
      continue;
    }

    const sub = await getSubscription(delivery.subscription_id);
    if (!sub || !sub.active) {
      delivery.status = 'failed';
      delivery.last_error = 'Subscription missing or inactive';
      await kv.set(KEYS.deliveryById(delivery.id), delivery);
      await removeFromIndex(KEYS.pendingIndex, delivery.id);
      continue;
    }

    result.attempted += 1;
    const attemptResult = await attemptDelivery(sub, delivery);

    if (attemptResult.ok) {
      delivery.status = 'delivered';
      delivery.delivered_at = new Date().toISOString();
      delivery.last_attempt_at = delivery.delivered_at;
      delivery.response_code = attemptResult.status;
      await kv.set(KEYS.deliveryById(delivery.id), delivery);
      await removeFromIndex(KEYS.pendingIndex, delivery.id);
      // Mark sub as healthy.
      await kv.set(KEYS.subById(sub.id), {
        ...sub,
        last_success_at: new Date().toISOString(),
        last_failure_message: undefined,
        updated_at: new Date().toISOString(),
      });
      result.delivered += 1;
    } else {
      delivery.attempts += 1;
      delivery.last_error = attemptResult.error;
      delivery.response_code = attemptResult.status;
      delivery.last_attempt_at = new Date().toISOString();

      if (delivery.attempts >= MAX_ATTEMPTS) {
        delivery.status = 'dead';
        await kv.set(KEYS.deliveryById(delivery.id), delivery);
        await removeFromIndex(KEYS.pendingIndex, delivery.id);
        await addToIndex(KEYS.dlqIndex, delivery.id);
        result.deadLettered += 1;
      } else {
        const delayMs = nextBackoffDelayMs(delivery.attempts);
        delivery.next_attempt_at = new Date(now + delayMs).toISOString();
        await kv.set(KEYS.deliveryById(delivery.id), delivery);
        result.retried += 1;
      }

      // Flag the sub so operators can see recent failures.
      await kv.set(KEYS.subById(sub.id), {
        ...sub,
        last_failure_at: new Date().toISOString(),
        last_failure_message: attemptResult.error?.slice(0, 300),
        updated_at: new Date().toISOString(),
      });
    }
  }

  return result;
}

async function attemptDelivery(
  sub: WebhookSubscription,
  delivery: WebhookDelivery,
): Promise<{ ok: true; status: number } | { ok: false; status?: number; error: string }> {
  const body = JSON.stringify(delivery.payload);
  let signature: string;
  try {
    signature = await hmacSha256Hex(sub.secret, body);
  } catch (err) {
    return { ok: false, error: `HMAC signing failed: ${getErrMsg(err)}` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(sub.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Navigate-Signature': `sha256=${signature}`,
        'X-Navigate-Event': delivery.event_type,
        'X-Navigate-Delivery-Id': delivery.id,
        'X-Navigate-Event-Id': delivery.event_id,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.status >= 200 && resp.status < 300) {
      return { ok: true, status: resp.status };
    }
    const errText = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, error: `HTTP ${resp.status}${errText ? `: ${errText.slice(0, 200)}` : ''}` };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: getErrMsg(err) };
  }
}

// ============================================================================
// REPLAY / LISTING (for the admin UI)
// ============================================================================

export async function listRecentDeliveries(opts?: { limit?: number; status?: WebhookDeliveryStatus; firmId?: string }): Promise<WebhookDelivery[]> {
  const ids = await getIndex(KEYS.recentIndex);
  // newest first
  const ordered = [...ids].reverse().slice(0, opts?.limit ?? 100);
  const deliveries = (await Promise.all(ordered.map((id) => kv.get(KEYS.deliveryById(id))))).filter(
    Boolean,
  ) as WebhookDelivery[];
  return deliveries.filter((d) => {
    if (opts?.status && d.status !== opts.status) return false;
    if (opts?.firmId && d.firm_id !== opts.firmId) return false;
    return true;
  });
}

export async function listDeadLetters(firmId?: string): Promise<WebhookDelivery[]> {
  const ids = await getIndex(KEYS.dlqIndex);
  const deliveries = (await Promise.all(ids.map((id) => kv.get(KEYS.deliveryById(id))))).filter(
    Boolean,
  ) as WebhookDelivery[];
  return firmId ? deliveries.filter((d) => d.firm_id === firmId) : deliveries;
}

/**
 * Re-queue a delivery for another attempt. Valid for `failed` or `dead`
 * deliveries; no-op for `pending` / `delivered`.
 */
export async function replayDelivery(id: string): Promise<WebhookDelivery | null> {
  const delivery = (await kv.get(KEYS.deliveryById(id))) as WebhookDelivery | null;
  if (!delivery) return null;
  if (delivery.status === 'pending' || delivery.status === 'delivered') return delivery;
  delivery.status = 'pending';
  delivery.attempts = 0;
  delivery.next_attempt_at = new Date().toISOString();
  delivery.last_error = undefined;
  await kv.set(KEYS.deliveryById(id), delivery);
  await removeFromIndex(KEYS.dlqIndex, id);
  await addToIndex(KEYS.pendingIndex, id);
  log.info(`Webhook delivery replayed: id=${id}`);
  return delivery;
}
