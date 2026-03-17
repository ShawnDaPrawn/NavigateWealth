/**
 * E-Signature Expiry Sweep Service
 *
 * Scans all active (sent/viewed/partially_signed) envelopes and transitions
 * those past their expiry date to `expired` status.
 *
 * Follows the dry-run-first pattern (§14.1):
 *   - dryRun=true  → reads + audits, no writes
 *   - dryRun=false → applies status transitions and notifies parties
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  updateEnvelopeStatus,
  logAuditEvent,
} from './esign-services.ts';
import { sendEmail } from './email-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { EsignEnvelope, EsignSigner } from './esign-types.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';

const log = createModuleLogger('esign-expiry');

const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Statuses that are eligible for automatic expiry
const EXPIRABLE_STATUSES = ['sent', 'viewed', 'partially_signed'];

export interface ExpirySweepResult {
  scannedCount: number;
  expiredCount: number;
  skippedCount: number;
  errors: Array<{ envelopeId: string; error: string }>;
  expired: Array<{
    envelopeId: string;
    title: string;
    status: string;
    expiresAt: string;
    signerCount: number;
    signedCount: number;
  }>;
  dryRun: boolean;
  durationMs: number;
}

/**
 * Run the expiry sweep.
 *
 * @param dryRun - If true (default), only report what would be expired. No writes.
 */
export async function runExpirySweep(dryRun = true): Promise<ExpirySweepResult> {
  const start = Date.now();
  log.info(`Starting expiry sweep (dryRun=${dryRun})...`);

  const result: ExpirySweepResult = {
    scannedCount: 0,
    expiredCount: 0,
    skippedCount: 0,
    errors: [],
    expired: [],
    dryRun,
    durationMs: 0,
  };

  try {
    // 1. Fetch all envelopes
    const allValues = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);

    // Filter for actual envelope objects (same guard as getAllEnvelopes)
    const envelopes = allValues.filter((item: Record<string, unknown>) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      item.id &&
      item.status &&
      item.document_id
    ) as unknown as EsignEnvelope[];

    // 2. Filter to expirable statuses
    const candidates = envelopes.filter(
      (e) => EXPIRABLE_STATUSES.includes(e.status) && e.expires_at
    );

    result.scannedCount = candidates.length;
    const now = new Date();

    for (const envelope of candidates) {
      try {
        const expiresAt = new Date(envelope.expires_at!);
        if (expiresAt >= now) {
          result.skippedCount++;
          continue;
        }

        // This envelope has expired
        const signers = await getEnvelopeSigners(envelope.id);
        const signedCount = signers.filter((s: EsignSigner) => s.status === 'signed').length;

        result.expired.push({
          envelopeId: envelope.id,
          title: envelope.title,
          status: envelope.status,
          expiresAt: envelope.expires_at!,
          signerCount: signers.length,
          signedCount,
        });

        if (!dryRun) {
          // 3. Transition to expired
          await updateEnvelopeStatus(envelope.id, 'expired', {
            expired_at: now.toISOString(),
          });

          // 4. Log audit event
          await logAuditEvent({
            envelopeId: envelope.id,
            actorType: 'system',
            action: 'envelope_expired_auto',
            metadata: {
              previousStatus: envelope.status,
              expiresAt: envelope.expires_at,
              signedCount,
              totalSigners: signers.length,
            },
          });

          // 5. Notify sender
          await notifyExpiry(envelope, signers, signedCount);
        }

        result.expiredCount++;
      } catch (err) {
        const errMsg = getErrMsg(err);
        log.error(`Error processing envelope ${envelope.id}: ${errMsg}`);
        result.errors.push({ envelopeId: envelope.id, error: errMsg });
      }
    }
  } catch (err) {
    log.error('Expiry sweep failed:', err);
    result.errors.push({ envelopeId: 'system', error: getErrMsg(err) });
  }

  result.durationMs = Date.now() - start;
  log.info(
    `Expiry sweep complete: scanned=${result.scannedCount}, expired=${result.expiredCount}, ` +
    `skipped=${result.skippedCount}, errors=${result.errors.length}, dryRun=${dryRun}, ` +
    `duration=${result.durationMs}ms`
  );

  return result;
}

/**
 * Notify the sender that an envelope has expired.
 * Best-effort: failures are logged but do not block the sweep.
 */
async function notifyExpiry(
  envelope: EsignEnvelope,
  signers: EsignSigner[],
  signedCount: number,
): Promise<void> {
  try {
    if (!envelope.created_by_user_id) return;

    const { data: userData } = await getSupabase().auth.admin.getUserById(
      envelope.created_by_user_id,
    );
    const senderEmail = userData?.user?.email;
    if (!senderEmail) return;

    const senderName =
      userData?.user?.user_metadata?.full_name ||
      userData?.user?.user_metadata?.name ||
      'there';

    const pendingSigners = signers
      .filter((s) => s.status !== 'signed')
      .map((s) => s.name)
      .join(', ');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Envelope Expired</h2>
        <p>Hi ${senderName},</p>
        <p>The following envelope has expired because it was not fully signed before the deadline:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Title</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${envelope.title}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Expired At</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(envelope.expires_at!).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Signed</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${signedCount} of ${signers.length}</td></tr>
          ${pendingSigners ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Pending</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pendingSigners}</td></tr>` : ''}
        </table>
        <p>You may create a new envelope if the document still needs to be signed.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Navigate Wealth E-Signature Platform</p>
      </div>
    `;

    await sendEmail({
      to: senderEmail,
      subject: `Expired: ${envelope.title}`,
      html,
      text: `Envelope "${envelope.title}" has expired. ${signedCount} of ${signers.length} signers completed. Pending: ${pendingSigners || 'none'}.`,
    });

    log.info(`Expiry notification sent to ${senderEmail} for envelope ${envelope.id}`);
  } catch (err) {
    log.error(`Failed to send expiry notification for envelope ${envelope.id}:`, err);
    // Best-effort — don't throw
  }
}
