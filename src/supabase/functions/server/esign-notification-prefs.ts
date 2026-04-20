/**
 * P5.2 — Sender notification preferences.
 *
 * Every e-signature event that fans an email out to the *sender* (the admin
 * who created the envelope) goes through `shouldDeliverSenderEvent()`.
 * Callers pass `{ userId, event }`; this service returns a decision:
 *
 *   - `deliver: true`            send the email immediately
 *   - `deliver: false, digest`   queue into the daily digest outbox
 *   - `deliver: false`           honour an "off" preference (do nothing)
 *
 * A nightly tick (see `esign-scheduler.ts`) calls `flushDigests()` which
 * reads every pending digest entry, groups by user, and sends one summary
 * email per user.
 *
 * The preference record is stored in KV so this service stays self-contained
 * and does not require a new database table. Users can read/write their
 * preference via `GET /esign/me/notification-prefs` and
 * `PUT /esign/me/notification-prefs` (see esign-routes.tsx).
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { sendEmail } from './email-service.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const log = createModuleLogger('esign-notify-prefs');

// ============================================================================
// TYPES
// ============================================================================

/**
 * The four possible delivery modes for sender-facing events.
 *
 * - `every_event`: every signer-level event (signed / declined / viewed /
 *   completed) emails the sender immediately. This is the legacy behaviour.
 * - `completion_only`: only `envelope.completed` and `envelope.declined`
 *   email the sender. Progress events are suppressed entirely.
 * - `digest`: all events are queued and sent once per day (early morning
 *   UTC by default) as a single summary email.
 * - `off`: no sender emails at all. Use with caution.
 */
export type SenderNotificationMode =
  | 'every_event'
  | 'completion_only'
  | 'digest'
  | 'off';

/**
 * Event taxonomy. Keep in lockstep with `webhook-service.ts` so a user's
 * preferences apply consistently across email and webhook channels (§P5.4).
 */
export type SenderEvent =
  | 'signer.signed'        // one signer completed
  | 'signer.declined'      // one signer declined → envelope terminated
  | 'envelope.completed'   // all signers done
  | 'envelope.expired'     // auto-expired
  | 'signer.viewed'        // first-view tracking
  | 'envelope.recalled'    // sender pulled the envelope back
  // P7.2 — sent ≥ 7 days ago, never opened; sender gets a reminder.
  | 'envelope.stuck';

export interface NotificationPreferences {
  userId: string;
  mode: SenderNotificationMode;
  // Future extension: per-event toggles override `mode`. Left open now.
  perEvent?: Partial<Record<SenderEvent, boolean>>;
  updated_at: string;
}

// ============================================================================
// KV KEYS
// ============================================================================

const KEYS = {
  userPrefs: (userId: string) => `esign:notify:prefs:${userId}`,
  digestEntry: (userId: string, entryId: string) =>
    `esign:notify:digest:${userId}:${entryId}`,
  digestPrefix: (userId: string) => `esign:notify:digest:${userId}:`,
  allPrefsPrefix: () => `esign:notify:prefs:`,
};

// Default mode when a user has never touched preferences.
const DEFAULT_MODE: SenderNotificationMode = 'every_event';

// ============================================================================
// PREFERENCE CRUD
// ============================================================================

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const stored = await kv.get(KEYS.userPrefs(userId));
    if (stored && typeof stored === 'object' && 'mode' in stored) {
      return stored as NotificationPreferences;
    }
  } catch (err) {
    log.warn(`Prefs read failed for ${userId}: ${getErrMsg(err)}`);
  }
  return {
    userId,
    mode: DEFAULT_MODE,
    updated_at: new Date().toISOString(),
  };
}

export async function setPreferences(
  userId: string,
  update: { mode?: SenderNotificationMode; perEvent?: NotificationPreferences['perEvent'] },
): Promise<NotificationPreferences> {
  const existing = await getPreferences(userId);
  const next: NotificationPreferences = {
    ...existing,
    ...(update.mode ? { mode: update.mode } : {}),
    ...(update.perEvent ? { perEvent: { ...existing.perEvent, ...update.perEvent } } : {}),
    updated_at: new Date().toISOString(),
  };
  await kv.set(KEYS.userPrefs(userId), next);
  log.info(`Notification prefs updated for ${userId}: mode=${next.mode}`);
  return next;
}

// ============================================================================
// DELIVERY DECISION
// ============================================================================

export interface DeliveryDecision {
  deliver: boolean;       // true = send immediately
  digest: boolean;        // true = queue for daily digest
  reason: string;         // human-readable trace for the audit log
  mode: SenderNotificationMode;
}

/**
 * Compute whether a sender-bound email should be delivered right now, queued
 * into the daily digest, or dropped. Pure — makes no writes. Call
 * `queueForDigest()` if the decision is `digest: true`.
 */
export async function shouldDeliverSenderEvent(
  userId: string | undefined,
  event: SenderEvent,
): Promise<DeliveryDecision> {
  if (!userId) {
    return { deliver: true, digest: false, reason: 'no userId — cannot enforce prefs', mode: DEFAULT_MODE };
  }
  const prefs = await getPreferences(userId);
  const mode = prefs.mode;

  // Per-event override takes precedence.
  const override = prefs.perEvent?.[event];
  if (override === true) return { deliver: true, digest: false, reason: 'per-event override on', mode };
  if (override === false) return { deliver: false, digest: false, reason: 'per-event override off', mode };

  switch (mode) {
    case 'off':
      return { deliver: false, digest: false, reason: 'mode=off', mode };
    case 'every_event':
      return { deliver: true, digest: false, reason: 'mode=every_event', mode };
    case 'completion_only': {
      const isTerminal = event === 'envelope.completed'
        || event === 'envelope.declined' as SenderEvent  // widen: decline is considered terminal
        || event === 'signer.declined'
        || event === 'envelope.expired';
      return {
        deliver: isTerminal,
        digest: false,
        reason: isTerminal ? 'mode=completion_only (terminal event)' : 'mode=completion_only (suppressed)',
        mode,
      };
    }
    case 'digest':
      return { deliver: false, digest: true, reason: 'mode=digest (queued)', mode };
  }
}

// ============================================================================
// DIGEST QUEUE
// ============================================================================

export interface DigestEntry {
  id: string;
  userId: string;
  event: SenderEvent;
  envelopeId: string;
  envelopeTitle: string;
  subject: string;
  body: string;
  queued_at: string;
}

export async function queueForDigest(entry: Omit<DigestEntry, 'id' | 'queued_at'>): Promise<void> {
  const id = crypto.randomUUID();
  const record: DigestEntry = {
    ...entry,
    id,
    queued_at: new Date().toISOString(),
  };
  await kv.set(KEYS.digestEntry(entry.userId, id), record);
}

/**
 * Run the nightly flush. For every user with pending digest entries, send a
 * single summary email and delete the entries. Called from the scheduler.
 */
export async function flushDigests(): Promise<{ usersNotified: number; entriesSent: number }> {
  const result = { usersNotified: 0, entriesSent: 0 };

  try {
    const allEntries = await kv.getByPrefix('esign:notify:digest:') as DigestEntry[];
    if (!allEntries.length) {
      log.info('No pending digest entries to flush');
      return result;
    }

    // Group by userId. KV doesn't guarantee order, so sort after grouping.
    const byUser = new Map<string, DigestEntry[]>();
    for (const entry of allEntries) {
      if (!entry || !entry.userId) continue;
      const list = byUser.get(entry.userId) || [];
      list.push(entry);
      byUser.set(entry.userId, list);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    for (const [userId, entries] of byUser) {
      entries.sort((a, b) => a.queued_at.localeCompare(b.queued_at));
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (!email) {
          log.warn(`Digest skipped for ${userId}: no email`);
          continue;
        }

        const html = renderDigestHtml(entries);
        const text = renderDigestText(entries);
        await sendEmail({
          to: email,
          subject: `Daily e-signature digest (${entries.length} event${entries.length === 1 ? '' : 's'})`,
          html,
          text,
        });

        // Clear delivered entries.
        for (const entry of entries) {
          await kv.del(KEYS.digestEntry(userId, entry.id));
        }
        result.usersNotified += 1;
        result.entriesSent += entries.length;
      } catch (err) {
        log.error(`Digest flush failed for ${userId}: ${getErrMsg(err)}`);
      }
    }
  } catch (err) {
    log.error(`flushDigests outer failure: ${getErrMsg(err)}`);
  }

  log.info(`Digest flush complete: ${result.usersNotified} users, ${result.entriesSent} entries`);
  return result;
}

function renderDigestHtml(entries: DigestEntry[]): string {
  const rows = entries.map(e => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:#6b7280;font-size:12px;">${e.event}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${e.envelopeTitle}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${new Date(e.queued_at).toLocaleString('en-ZA')}</td>
    </tr>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
      <h2 style="margin:0 0 12px;color:#111827;">E-signature digest</h2>
      <p style="margin:0 0 16px;color:#4b5563;">You have ${entries.length} event${entries.length === 1 ? '' : 's'} from the past 24 hours.</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="margin:16px 0 0;color:#9ca3af;font-size:11px;">Change delivery preferences in E-Signature → Settings → Notifications.</p>
    </div>`;
}

function renderDigestText(entries: DigestEntry[]): string {
  const lines = entries.map(e => `- [${e.event}] ${e.envelopeTitle} (${e.queued_at})`);
  return `E-signature digest (${entries.length} events)\n\n${lines.join('\n')}\n\nChange preferences in E-Signature → Settings → Notifications.`;
}
