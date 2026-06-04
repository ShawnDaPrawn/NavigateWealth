import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { requireIdempotency } from './idempotency.ts';
import { getRequestMetadata, resolveFirmId, SignerRecord } from './esign-route-helpers.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  updateEnvelopeStatus,
  updateSignerStatus,
  rotateSignerToken,
  logAuditEvent,
} from './esign-services.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { sendSigningReminder, sendRecallNotification } from './email-service.ts';
import { emitWebhookEvent } from './webhook-service.ts';
import { enqueue as enqueueInAppNotification } from './esign-inapp-notifications.ts';

const log = createModuleLogger('esign-sender-lifecycle-routes');

const app = new Hono();

/**
 * DELETE /envelopes/:envelopeId
 * Discard an envelope.
 *
 * Allowed when:
 *  - status is 'draft'  (no signers have been notified)
 *  - status is 'sent' or 'viewed' and NO signer has completed signing
 *
 * For sent/viewed envelopes, recall-notification emails are sent to all
 * signers so they know the envelope has been discarded.
 *
 * Completed, voided, or partially-signed (any signer has signed) envelopes
 * cannot be discarded — use void/recall for those.
 */
app.delete('/envelopes/:envelopeId', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId')!;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      // Envelope already deleted or not found, treat as success (idempotency)
      return c.json({
        success: true,
        deleted: true,
      });
    }

    // P6.8 — Soft-delete semantics.
    //
    // For draft/sent/viewed envelopes with no signatures yet, we now
    // soft-delete (stamp `deleted_at`) instead of hard-deleting. Admins
    // can list and restore envelopes via the recovery bin for 90 days;
    // the scheduler permanently purges anything older than that
    // retention window.
    //
    // Completed / partially_signed / voided envelopes are never
    // deletable via this route — use `void` or the recovery bin's
    // purge operation for those.
    if (envelope.deleted_at) {
      return c.json({ success: true, deleted: true, already: true });
    }

    const signers = await getEnvelopeSigners(envelopeId);
    const anyoneSigned = signers.some((s: SignerRecord) => s.status === 'signed');

    const discardableStatuses = ['draft', 'sent', 'viewed'];
    if (!discardableStatuses.includes(envelope.status)) {
      return c.json(
        {
          error: `Cannot discard an envelope with status "${envelope.status}". Use void for completed or partially-signed envelopes.`,
        },
        400,
      );
    }

    if (anyoneSigned) {
      return c.json(
        {
          error:
            'Cannot discard this envelope because one or more recipients have already signed. Use void instead.',
        },
        400,
      );
    }

    // P6.9 — firm scope check before any mutating action.
    const callerFirm = resolveFirmId(user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const wasSent = envelope.status === 'sent' || envelope.status === 'viewed';

    // If the envelope was already sent, notify signers that it has been discarded
    if (wasSent && signers.length > 0) {
      for (const signer of signers) {
        try {
          await sendRecallNotification({
            signerEmail: signer.email,
            signerName: signer.name,
            envelopeTitle: envelope.title,
            reason: 'Discarded by admin',
          });
        } catch (emailError) {
          log.error(`Failed to send discard notification to ${signer.email}:`, emailError);
          // Continue — best-effort notification
        }
      }

      // P5.6 — rotate tokens on any pending signer so the old signing
      // links are inert even if the envelope is later restored and
      // resent (new tokens would be issued on resend).
      for (const s of signers) {
        try {
          await rotateSignerToken(s.id, 'soft_deleted');
        } catch {
          /* best-effort */
        }
      }
    }

    // ---- Soft-delete: stamp deleted_at on the envelope record ----
    const reason = c.req.query('reason') || 'Discarded by admin';
    const envRaw = await kv.get(EsignKeys.envelope(envelopeId));
    if (envRaw) {
      await kv.set(EsignKeys.envelope(envelopeId), {
        ...envRaw,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        delete_reason: reason,
        updated_at: new Date().toISOString(),
      });
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: user.id,
      action: 'soft_deleted',
      email: user.email || 'admin@system',
      ip,
      userAgent,
      metadata: {
        deletedAt: new Date().toISOString(),
        previousStatus: envelope.status,
        signersNotified: wasSent ? signers.length : 0,
        reason,
      },
    });

    log.info(
      `Envelope ${envelopeId} soft-deleted (was ${envelope.status}, ${signers.length} signers)`,
    );

    // Admin audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: user.id,
      actorRole: 'admin',
      category: 'security',
      action: 'esign_envelope_soft_deleted',
      summary: `Envelope moved to recovery bin: ${envelope.title}`,
      severity: 'warning',
      entityType: 'envelope',
      entityId: envelopeId,
      metadata: { previousStatus: envelope.status, signersNotified: wasSent ? signers.length : 0 },
    }).catch(() => {});

    return c.json({
      success: true,
      deleted: true,
      soft_deleted: true,
      recovery_window_days: 90,
      notifiedSigners: wasSent ? signers.length : 0,
    });
  } catch (error: unknown) {
    log.error('Delete envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to delete envelope',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /envelopes/:envelopeId/recall
 * Recall a sent envelope (stops the signing process)
 */
app.post(
  '/envelopes/:envelopeId/recall',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      // Authenticate
      const ctx = await getAuthContext(c);
      const user = ctx.user;
      const envelopeId = c.req.param('envelopeId')!;
      const body = await c.req.json();
      const { reason } = body;

      // Get envelope details
      const envelope = await getEnvelopeDetails(envelopeId);

      if (!envelope) {
        return c.json({ error: 'Envelope not found' }, 404);
      }

      // Only allow recall of sent/viewed/partially_signed envelopes
      const recallableStatuses = ['sent', 'viewed', 'partially_signed'];
      if (!recallableStatuses.includes(envelope.status)) {
        return c.json(
          {
            error: `Cannot recall envelope with status: ${envelope.status}. Only sent, viewed, or partially signed envelopes can be recalled.`,
          },
          400,
        );
      }

      // Update envelope status to recalled
      await updateEnvelopeStatus(envelopeId, 'voided', {
        voided_at: new Date().toISOString(),
        void_reason: reason || 'Recalled by admin',
      });

      // Update all pending signers to declined status and rotate their
      // access tokens so stale signing URLs become inert. (P5.6)
      const signers = await getEnvelopeSigners(envelopeId);
      for (const signer of signers) {
        if (signer.status === 'pending' || signer.status === 'viewed') {
          await updateSignerStatus(signer.id, 'declined', {
            declined_at: new Date().toISOString(),
            decline_reason: 'Envelope recalled by admin',
          });
        }
        try {
          await rotateSignerToken(signer.id, 'envelope_recalled');
        } catch {
          /* best-effort */
        }
      }

      // Log audit event
      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'admin',
        actorId: user.id,
        action: 'recalled',
        email: user.email || 'admin@system',
        ip,
        userAgent,
        metadata: {
          recalledAt: new Date().toISOString(),
          reason: reason || 'No reason provided',
        },
      });

      // Send recall notification emails to all signers
      log.info(`📧 Sending recall notifications to ${signers.length} signers`);
      for (const signer of signers) {
        try {
          await sendRecallNotification({
            signerEmail: signer.email,
            signerName: signer.name,
            envelopeTitle: envelope.title,
            reason,
          });
          log.info('✅ Recall notification sent to:', { email: signer.email });
        } catch (emailError) {
          log.error(`❌ Failed to send recall notification to ${signer.email}:`, emailError);
          // Continue with other signers even if one fails
        }
      }

      // Admin audit trail (non-blocking — §12.2)
      AdminAuditService.record({
        actorId: user.id,
        actorRole: 'admin',
        category: 'security',
        action: 'esign_envelope_recalled',
        summary: `Envelope recalled: ${envelope.title}`,
        severity: 'warning',
        entityType: 'envelope',
        entityId: envelopeId,
        metadata: { reason: reason || 'No reason provided', signerCount: signers.length },
      }).catch(() => {});

      // P5.4 — webhook fan-out for recall.
      void emitWebhookEvent({
        firmId: envelope.firm_id || 'standalone',
        eventType: 'envelope.recalled',
        envelopeId,
        payload: {
          envelope: { id: envelope.id, title: envelope.title, status: 'voided' },
          reason: reason || null,
          signer_count: signers.length,
        },
      });

      // P5.7 — bell-UI copy for the actor (typically the sender).
      if (envelope.created_by_user_id) {
        void enqueueInAppNotification({
          userId: envelope.created_by_user_id,
          type: 'envelope.recalled',
          title: 'Envelope recalled',
          body: `You recalled "${envelope.title}".${reason ? ` Reason: ${reason}` : ''}`,
          envelopeId,
          metadata: { reason: reason || null },
        });
      }

      return c.json({
        success: true,
        recalled: true,
        envelope: await getEnvelopeDetails(envelopeId),
      });
    } catch (error: unknown) {
      log.error('❌ Recall envelope error:', error);
      const status = error instanceof AuthError ? error.statusCode : 500;
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to recall envelope',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
);

/**
 * POST /envelopes/:envelopeId/remind
 * Send reminder to pending signers
 */
app.post(
  '/envelopes/:envelopeId/remind',
  requireIdempotency(),
  rateLimit('SENDER_MUTATE'),
  async (c) => {
    try {
      // Authenticate
      const ctx = await getAuthContext(c);
      const user = ctx.user;
      const envelopeId = c.req.param('envelopeId')!;

      // Get envelope details
      const envelope = await getEnvelopeDetails(envelopeId);

      if (!envelope) {
        return c.json({ error: 'Envelope not found' }, 404);
      }

      // Only allow reminders for active envelopes
      const remindableStatuses = ['sent', 'viewed', 'partially_signed'];
      if (!remindableStatuses.includes(envelope.status)) {
        return c.json(
          {
            error: `Cannot send reminders for envelope with status: ${envelope.status}`,
          },
          400,
        );
      }

      // Get all signers who haven't signed yet
      const signers = await getEnvelopeSigners(envelopeId);
      const pendingSigners = signers.filter((s) => s.status === 'pending' || s.status === 'viewed');

      if (pendingSigners.length === 0) {
        return c.json({ error: 'No pending signers to remind' }, 400);
      }

      // Send reminder emails to pending signers
      log.info(`📧 Sending reminders to ${pendingSigners.length} pending signers`);
      const remindersSent: Array<{ signerId: string; email: string; success: boolean }> = [];

      for (const signer of pendingSigners) {
        try {
          // P5.6 — rotate the signer's token on every manual reminder so any
          // leaked or cached previous link is invalidated.
          const rotated = await rotateSignerToken(signer.id, 'manual_reminder');
          const tokenForLink = rotated?.access_token ?? signer.access_token;
          const signingUrl = `https://www.navigatewealth.co/sign?token=${tokenForLink}`;

          await sendSigningReminder({
            signerEmail: signer.email,
            signerName: signer.name,
            envelopeTitle: envelope.title,
            signingUrl,
            expiresAt: envelope.expires_at,
          });

          remindersSent.push({
            signerId: signer.id,
            email: signer.email,
            name: signer.name,
          });
          log.info('✅ Reminder sent to:', { email: signer.email });

          // Log audit event for each reminder
          const { ip, userAgent } = getRequestMetadata(c);
          await logAuditEvent({
            envelopeId,
            actorType: 'admin',
            actorId: user.id,
            action: 'reminder_sent',
            email: signer.email,
            ip,
            userAgent,
            metadata: {
              signerId: signer.id,
              signerName: signer.name,
              sentAt: new Date().toISOString(),
            },
          });
        } catch (emailError) {
          log.error(`❌ Failed to send reminder to ${signer.email}:`, emailError);
          // Continue with other signers even if one fails
        }
      }

      return c.json({
        success: true,
        remindersSent,
        totalReminders: remindersSent.length,
      });
    } catch (error: unknown) {
      log.error('❌ Send reminder error:', error);
      const status = error instanceof AuthError ? error.statusCode : 500;
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to send reminders',
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
);

export default app;
