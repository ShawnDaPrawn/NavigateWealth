/**
 * P7.2 — Stuck-envelope alerts.
 *
 * Scans all firms' open envelopes, identifies those that were sent
 * ≥ 7 days ago but have not been opened by any signer, and notifies
 * the sender (email + in-app bell + webhook). Each envelope only
 * alerts once per cooldown window (default 7 days) so the sender
 * isn't spammed every hour.
 *
 * Integration points:
 *   • Called by the reminder sweep scheduler.
 *   • Can be triggered manually via `POST /maintenance/stuck-alert-sweep`.
 *   • Respects the sender's notification preferences
 *     (`shouldDeliverSenderEvent`) — digest/off senders get the bell
 *     and webhook, not the email.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { sendEmail } from './email-service.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { shouldDeliverSenderEvent } from './esign-notification-prefs.ts';
import { emitWebhookEvent } from './webhook-service.ts';
import { enqueue as enqueueInAppNotification } from './esign-inapp-notifications.ts';
import { logAuditEvent } from './esign-services.tsx';
import type { EsignEnvelope, EsignSigner } from './esign-types.ts';

const log = createModuleLogger('esign-stuck-alerts');

/** How long a single envelope waits between stuck-alerts. */
const ALERT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Envelopes must be this old (sent) before the first stuck-alert fires. */
const STUCK_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export interface StuckSweepResult {
  scanned: number;
  alerted: number;
  skippedCooldown: number;
  failed: number;
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function isEnvelopeRecord(item: unknown): item is EsignEnvelope {
  return !!item
    && typeof item === 'object'
    && typeof (item as { id?: unknown }).id === 'string'
    && typeof (item as { status?: unknown }).status === 'string';
}

async function alertedRecently(envelopeId: string): Promise<boolean> {
  const stamp = await kv.get(EsignKeys.stuckAlert(envelopeId));
  if (!stamp || typeof stamp !== 'string') return false;
  const age = Date.now() - new Date(stamp).getTime();
  return age < ALERT_COOLDOWN_MS;
}

async function stampAlert(envelopeId: string): Promise<void> {
  await kv.set(EsignKeys.stuckAlert(envelopeId), new Date().toISOString());
}

async function resolveSender(userId: string | undefined): Promise<{ email: string; name: string } | null> {
  if (!userId) return null;
  try {
    const { data } = await getSupabase().auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return null;
    const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
    const name = typeof meta?.full_name === 'string'
      ? meta.full_name as string
      : typeof meta?.name === 'string'
        ? meta.name as string
        : 'there';
    return { email, name };
  } catch (err) {
    log.warn(`Failed to resolve sender for user ${userId}: ${String(err)}`);
    return null;
  }
}

function renderEmail(params: {
  senderName: string;
  envelopeTitle: string;
  days: number;
  signerCount: number;
  dashboardLink: string;
}): { html: string; text: string; subject: string } {
  const { senderName, envelopeTitle, days, signerCount, dashboardLink } = params;
  const subject = `Reminder: "${envelopeTitle}" has been sitting unopened`;
  const text = [
    `Hi ${senderName},`,
    '',
    `You sent "${envelopeTitle}" ${days} day${days === 1 ? '' : 's'} ago and none of the ${signerCount} recipient${signerCount === 1 ? '' : 's'} have opened it yet.`,
    '',
    'Consider sending a reminder, checking the recipient email, or voiding the envelope if it is no longer needed.',
    '',
    `Open in Navigate Wealth: ${dashboardLink}`,
  ].join('\n');
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:560px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">Envelope still unopened</h2>
      <p>Hi ${senderName},</p>
      <p>
        You sent <strong>"${envelopeTitle}"</strong>
        ${days} day${days === 1 ? '' : 's'} ago and none of the
        ${signerCount} recipient${signerCount === 1 ? '' : 's'} have
        opened it yet.
      </p>
      <p>
        Common next steps: resend the invite, verify the recipient's
        email address, or void the envelope if it is no longer
        relevant.
      </p>
      <p style="margin-top:24px;">
        <a href="${dashboardLink}"
           style="display:inline-block;background:#6d28d9;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
          Open in Navigate Wealth
        </a>
      </p>
    </div>
  `;
  return { html, text, subject };
}

/**
 * Run the stuck-envelope sweep. Returns summary counts. Best-effort:
 * a single failure does not abort the sweep.
 */
export async function runStuckAlertSweep(): Promise<StuckSweepResult> {
  const all = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
  const candidates = (all as unknown[]).filter(isEnvelopeRecord);
  const now = Date.now();

  let scanned = 0;
  let alerted = 0;
  let skippedCooldown = 0;
  let failed = 0;

  for (const envelope of candidates) {
    if (envelope.deleted_at) continue;
    if (!['sent', 'viewed', 'partially_signed'].includes(envelope.status)) continue;
    const sentAt = (envelope as { sent_at?: string }).sent_at;
    if (!sentAt) continue;
    const age = now - new Date(sentAt).getTime();
    if (age < STUCK_THRESHOLD_MS) continue;

    scanned += 1;

    try {
      const signerIdsRaw = await kv.get(EsignKeys.envelopeSigners(envelope.id));
      const signerIds: string[] = Array.isArray(signerIdsRaw) ? signerIdsRaw : [];
      const signers: EsignSigner[] = [];
      let opened = false;
      for (const id of signerIds) {
        const signer = await kv.get(EsignKeys.PREFIX_SIGNER + id);
        if (signer) {
          signers.push(signer);
          if (signer.viewed_at) opened = true;
        }
      }
      if (opened) continue;

      if (await alertedRecently(envelope.id)) {
        skippedCooldown += 1;
        continue;
      }

      const days = Math.floor(age / (24 * 60 * 60 * 1000));
      const senderId = envelope.created_by_user_id;
      const sender = await resolveSender(senderId);
      const dashboardLink = `https://www.navigatewealth.co/admin/esign?envelope=${envelope.id}`;

      // Email (respecting notification preferences).
      if (sender && senderId) {
        const pref = await shouldDeliverSenderEvent(senderId, 'envelope.stuck');
        if (pref.mode !== 'off' && pref.mode !== 'digest') {
          const { html, text, subject } = renderEmail({
            senderName: sender.name,
            envelopeTitle: envelope.title,
            days,
            signerCount: signers.length,
            dashboardLink,
          });
          await sendEmail({ to: sender.email, subject, html, text });
        }
      }

      // In-app bell — unconditional (cheap, user-owned).
      if (senderId) {
        void enqueueInAppNotification({
          userId: senderId,
          type: 'envelope.stuck',
          title: 'Envelope still unopened',
          body: `"${envelope.title}" has been sitting for ${days} day${days === 1 ? '' : 's'} without being opened.`,
          envelopeId: envelope.id,
          metadata: { days_since_sent: days, signer_count: signers.length },
        });
      }

      // Firm webhook.
      void emitWebhookEvent({
        firmId: envelope.firm_id || 'standalone',
        eventType: 'envelope.stuck',
        envelopeId: envelope.id,
        payload: {
          envelope: { id: envelope.id, title: envelope.title, status: envelope.status },
          days_since_sent: days,
          signer_count: signers.length,
        },
      });

      await logAuditEvent({
        envelopeId: envelope.id,
        actorType: 'system',
        action: 'stuck_alert_emitted',
        metadata: { days_since_sent: days, signer_count: signers.length },
      });

      await stampAlert(envelope.id);
      alerted += 1;
    } catch (err) {
      failed += 1;
      log.error(`Stuck-alert failed for envelope ${envelope.id}:`, err);
    }
  }

  log.info(`Stuck-alert sweep: scanned=${scanned} alerted=${alerted} cooldown=${skippedCooldown} failed=${failed}`);
  return { scanned, alerted, skippedCooldown, failed };
}
