/**
 * P5.3 — Escalating reminder service.
 *
 * The scheduler calls `runReminderSweep` on an hourly cadence. For each
 * active envelope we look at each pending signer and decide whether a
 * reminder should fire right now, based on the envelope's `ReminderConfig`
 * and the audit trail of previous reminders.
 *
 * Two modes are supported:
 *
 *   - `fixed`       — send every `remind_interval_days` until
 *                     `max_reminders` is reached. Legacy default.
 *
 *   - `escalating`  — a non-linear schedule (default `[3, 7, 10, 13]` days
 *                     since invitation). Each offset fires at most once per
 *                     signer. This is what we recommend in the UI.
 *
 * Plus an `urgent_reminder` tier that fires once when the envelope is
 * within `remind_before_expiry_days` of its expiry.
 *
 * The sweep is idempotent:
 *   - each "reminder tier" records a `reminder_sent` audit event with a
 *     `tier` field in metadata (`'fixed'`, `'escalating:{index}'`, or
 *     `'urgent'`). A tier is skipped if the audit trail already contains
 *     an event for it.
 *   - no state mutates other than the audit trail and the best-effort
 *     email/SMS send.
 *
 * SMS delivery piggybacks on the signer's `sms_opt_in` flag and mirrors
 * Phase 5.1 wiring. Failures in either channel are logged but don't block
 * the other channel.
 *
 * Senders are not notified of reminder fire events. Reminders are a
 * signer-facing nudge — if the sender wanted real-time notifications they
 * already have them via `every_event` mode.
 */

import type { EsignAuditEvent, EsignEnvelope, EsignSigner } from './esign-types.ts';
import { getAllEnvelopes, getAuditTrail, getEnvelopeSigners, logAuditEvent } from './esign-services.tsx';
import { getReminderConfig, type ReminderConfig } from './esign-automation.ts';
import { sendSigningReminder } from './email-service.tsx';
import { sendReminderSms } from './sms-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('esign-reminder-service');

// ============================================================================
// TYPES
// ============================================================================

export interface ReminderSweepResult {
  scannedCount: number;
  eligibleEnvelopeCount: number;
  remindersSent: number;
  smsRemindersSent: number;
  errors: Array<{ envelopeId: string; error: string }>;
  durationMs: number;
}

/** Internal — reasons we'd fire a reminder on a given signer. */
type Tier = { id: string; channelSuffix: string };

// ============================================================================
// HELPERS
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVE_ENVELOPE_STATUSES = new Set<EsignEnvelope['status']>([
  'sent',
  'in_progress',
  'partially_signed',
]);

const PENDING_SIGNER_STATUSES = new Set<EsignSigner['status']>([
  'pending',
  'sent',
  'viewed',
  'otp_verified',
]);

function tierAlreadyFired(auditEvents: EsignAuditEvent[], signerId: string, tier: string): boolean {
  return auditEvents.some(
    (ev) =>
      ev.action === 'reminder_sent' &&
      (ev.metadata as Record<string, unknown> | undefined)?.signerId === signerId &&
      (ev.metadata as Record<string, unknown> | undefined)?.tier === tier,
  );
}

function countRemindersForSigner(auditEvents: EsignAuditEvent[], signerId: string): number {
  return auditEvents.filter(
    (ev) =>
      ev.action === 'reminder_sent' &&
      (ev.metadata as Record<string, unknown> | undefined)?.signerId === signerId,
  ).length;
}

function lastReminderAt(auditEvents: EsignAuditEvent[], signerId: string): number | null {
  let max = 0;
  for (const ev of auditEvents) {
    if (
      ev.action === 'reminder_sent' &&
      (ev.metadata as Record<string, unknown> | undefined)?.signerId === signerId
    ) {
      const t = new Date(ev.at).getTime();
      if (Number.isFinite(t) && t > max) max = t;
    }
  }
  return max > 0 ? max : null;
}

/**
 * Decide which reminder tier (if any) should fire for a single signer
 * right now. Returns `null` if no reminder should be sent.
 */
export function computeReminderTier(args: {
  now: number;
  config: ReminderConfig;
  signer: EsignSigner;
  envelope: EsignEnvelope;
  auditEvents: EsignAuditEvent[];
}): Tier | null {
  const { now, config, signer, envelope, auditEvents } = args;

  if (!config.auto_remind) return null;
  if (!PENDING_SIGNER_STATUSES.has(signer.status)) return null;

  const inviteIso = signer.invite_sent_at;
  if (!inviteIso) return null;
  const invitedAt = new Date(inviteIso).getTime();
  if (!Number.isFinite(invitedAt)) return null;

  const remindersAlreadySent = countRemindersForSigner(auditEvents, signer.id);
  if (remindersAlreadySent >= config.max_reminders) return null;

  // Urgent tier first (only fires once). If the envelope is within the
  // urgency window and we haven't sent an urgent yet, fire now.
  const expiresAtIso = envelope.expires_at;
  if (expiresAtIso && config.remind_before_expiry_days > 0) {
    const expiresAt = new Date(expiresAtIso).getTime();
    if (Number.isFinite(expiresAt)) {
      const urgentWindowStart = expiresAt - config.remind_before_expiry_days * DAY_MS;
      if (now >= urgentWindowStart && now < expiresAt && !tierAlreadyFired(auditEvents, signer.id, 'urgent')) {
        return { id: 'urgent', channelSuffix: 'Urgent' };
      }
    }
  }

  if (config.schedule === 'escalating') {
    const offsets = config.escalation_offsets_days ?? [3, 7, 10, 13];
    const daysSinceInvite = (now - invitedAt) / DAY_MS;
    // Walk offsets in order, fire the earliest one that is due AND has
    // not fired yet. This naturally handles the case where the scheduler
    // missed a tick — we never skip a tier, just fire the next one.
    for (let idx = 0; idx < offsets.length; idx++) {
      const offset = offsets[idx];
      if (!Number.isFinite(offset) || offset <= 0) continue;
      const tierId = `escalating:${idx}`;
      if (tierAlreadyFired(auditEvents, signer.id, tierId)) continue;
      if (daysSinceInvite >= offset) {
        return { id: tierId, channelSuffix: `Nudge ${idx + 1}` };
      }
      // Offsets are ascending — if this one isn't due, none after it
      // will be either.
      break;
    }
    return null;
  }

  // Fixed cadence mode.
  const lastAt = lastReminderAt(auditEvents, signer.id) ?? invitedAt;
  const nextEligibleAt = lastAt + config.remind_interval_days * DAY_MS;
  if (now < nextEligibleAt) return null;
  const nextIndex = remindersAlreadySent + 1;
  return { id: `fixed:${nextIndex}`, channelSuffix: `Reminder ${nextIndex}` };
}

// ============================================================================
// PUBLIC: RUN SWEEP
// ============================================================================

/**
 * Walk all active envelopes and fire any reminders that are due.
 *
 * @param dryRun  When true, no emails/SMS are sent and no audit events
 *                are written. Useful for tests and diagnostics.
 */
export async function runReminderSweep(dryRun = false): Promise<ReminderSweepResult> {
  const start = Date.now();
  const result: ReminderSweepResult = {
    scannedCount: 0,
    eligibleEnvelopeCount: 0,
    remindersSent: 0,
    smsRemindersSent: 0,
    errors: [],
    durationMs: 0,
  };

  let envelopes: EsignEnvelope[];
  try {
    const raw = await getAllEnvelopes();
    envelopes = (raw as unknown as EsignEnvelope[]).filter((e) =>
      ACTIVE_ENVELOPE_STATUSES.has(e.status),
    );
  } catch (err) {
    log.error('Reminder sweep: failed to list envelopes:', err);
    result.errors.push({ envelopeId: '*', error: getErrMsg(err) });
    result.durationMs = Date.now() - start;
    return result;
  }

  result.scannedCount = envelopes.length;
  const now = Date.now();

  for (const envelope of envelopes) {
    try {
      const config = await getReminderConfig(envelope.id);
      if (!config.auto_remind) continue;

      const [signers, auditEvents] = await Promise.all([
        getEnvelopeSigners(envelope.id),
        getAuditTrail(envelope.id),
      ]);

      let firedForEnvelope = 0;

      for (const signer of signers) {
        const tier = computeReminderTier({ now, config, signer, envelope, auditEvents });
        if (!tier) continue;

        const signingUrl = `https://www.navigatewealth.co/sign?token=${signer.access_token}`;

        if (!dryRun) {
          // Best-effort email first.
          try {
            await sendSigningReminder({
              signerEmail: signer.email,
              signerName: signer.name,
              envelopeTitle: envelope.title,
              signingUrl,
              expiresAt: envelope.expires_at,
            });
            firedForEnvelope += 1;
          } catch (err) {
            log.error(`Reminder email failed for ${signer.email}:`, err);
            result.errors.push({
              envelopeId: envelope.id,
              error: `email:${signer.email}:${getErrMsg(err)}`,
            });
          }

          // Parallel SMS channel when opted in.
          if (signer.sms_opt_in && signer.phone) {
            try {
              const smsResult = await sendReminderSms({
                to: signer.phone,
                signerName: signer.name,
                envelopeTitle: envelope.title,
                signingUrl,
              });
              if (smsResult.delivered) {
                result.smsRemindersSent += 1;
              }
            } catch (err) {
              log.error(`Reminder SMS failed for ${signer.phone}:`, err);
              // Non-fatal.
            }
          }

          await logAuditEvent({
            envelopeId: envelope.id,
            actorType: 'system',
            action: 'reminder_sent',
            email: signer.email,
            metadata: {
              signerId: signer.id,
              signerName: signer.name,
              tier: tier.id,
              schedule: config.schedule ?? 'escalating',
              auto: true,
            },
          });
        } else {
          firedForEnvelope += 1;
        }

        result.remindersSent += 1;
      }

      if (firedForEnvelope > 0) {
        result.eligibleEnvelopeCount += 1;
      }
    } catch (err) {
      log.error(`Reminder sweep failed for envelope ${envelope.id}:`, err);
      result.errors.push({ envelopeId: envelope.id, error: getErrMsg(err) });
    }
  }

  result.durationMs = Date.now() - start;
  log.info(
    `Reminder sweep complete: scanned=${result.scannedCount}, envelopesAffected=${result.eligibleEnvelopeCount}, reminders=${result.remindersSent}, sms=${result.smsRemindersSent}, errors=${result.errors.length}, duration=${result.durationMs}ms`,
  );
  return result;
}
