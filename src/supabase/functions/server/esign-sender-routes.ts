/**
 * esign sender envelope-actions + KBA routes (Phase 5 decomposition).
 * ==================================================================
 *
 * Extracted verbatim from esign-routes.tsx: the sender-side envelope
 * operations and the KBA gate — client envelope list, sender-driven OTP
 * send/verify, sign, reject, audit / document / certificate reads, discard
 * (DELETE), recall, remind, signed-PDF download, evidence-pack, reminder-
 * config, signing-mode, audit export, and the diagnostics/kba + signer/kba
 * routes. Mounted via `esignRoutes.route('/', senderRoutes)`. This is the last
 * route group to leave esign-routes.tsx (which becomes a thin mount file).
 * Behaviour-preserving; guarded by the sender-actions contract group.
 *
 * NOTE: this also repairs a latent issue — the sender-OTP verify route uses
 * clearOTP/verifyOTP/markOTPVerified/generateAndStoreOTP/verifyAccessCode,
 * which had been dropped from esign-routes' imports when the signer token-flow
 * was extracted; they are correctly imported here where the routes now live.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { SignEnvelopeSchema, RejectEnvelopeSchema } from './esign-validation.ts';
import { getRequestMetadata, audActor, resolveFirmId } from './esign-route-helpers.ts';
import type { SignerRecord } from './esign-route-helpers.ts';
import { belongsToFirm } from './esign-firm-scope.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  getSignerByToken,
  getClientEnvelopes,
  getAuditTrail,
  updateEnvelopeStatus,
  updateSignerStatus,
  updateFieldValue,
  checkEnvelopeCompletion,
  rotateSignerToken,
  logAuditEvent,
} from './esign-services.ts';
import { downloadDocument, getDocumentUrl, getCertificateUrl } from './esign-storage.ts';
import {
  verifyOTP,
  markOTPVerified,
  clearOTP,
  generateAndStoreOTP,
  verifyAccessCode,
  isOTPRequired,
} from './esign-otp.ts';
import { generateCompletionCertificate, getCertificate } from './esign-certificates.ts';
import { createSigningInviteEmail } from './esign-email-templates.ts';
import { buildEvidencePack } from './esign-evidence-export.ts';
import { getReminderConfig, setReminderConfig } from './esign-automation.ts';
import { runKbaCheck, getKbaStatus } from './kba-service.ts';
import { sendEmail, sendSigningReminder, sendRecallNotification } from './email-service.ts';
import { sendOtpSms } from './sms-service.ts';
import { emitWebhookEvent } from './webhook-service.ts';
import { enqueue as enqueueInAppNotification } from './esign-inapp-notifications.ts';
import { enqueueCompletion } from './esign-completion-queue.ts';

const log = createModuleLogger('esign-sender-routes');

const senderRoutes = new Hono();

senderRoutes.get('/clients/:clientId/envelopes', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const clientId = c.req.param('clientId')!;
    const clientEmail = c.req.query('email') || undefined;

    // Portal clients may only fetch their own CRM id (aligns with client-portal-routes.ts).
    // Staff/adviser/admin callers continue to use this route for arbitrary client envelopes.
    if (ctx.role === 'client' && ctx.userId !== clientId) {
      return c.json({ error: 'Forbidden: You may only view your own envelopes' }, 403);
    }

    const envelopes = await getClientEnvelopes(clientId, clientEmail);

    // P6.9 — a client can legitimately span firms on a multi-tenant
    // install, but the caller should only ever see envelopes that
    // belong to their firm (or standalone envelopes).
    const scoped = (envelopes as Array<Record<string, unknown>>).filter((e) =>
      belongsToFirm(ctx.user, { firm_id: (e.firm_id as string | undefined) ?? null }),
    );

    return c.json({ envelopes: scoped });
  } catch (error: unknown) {
    log.error('❌ Get client envelopes error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch envelopes' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * POST /envelopes/:envelopeId/signers/:signerId/otp/send
 * Send OTP to signer
 */
senderRoutes.post(
  '/envelopes/:envelopeId/signers/:signerId/otp/send',
  rateLimit('OTP_SEND'),
  async (c) => {
    try {
      const envelopeId = c.req.param('envelopeId')!;
      const signerId = c.req.param('signerId')!;

      // Check if OTP is required
      const required = await isOTPRequired(signerId);
      if (!required) {
        return c.json({ error: 'OTP not required for this signer' }, 400);
      }

      // Generate and store OTP
      const { otp, error } = await generateAndStoreOTP(signerId);

      if (error || !otp) {
        return c.json({ error: error || 'Failed to generate OTP' }, 500);
      }

      // Get signer info
      const signers = await getEnvelopeSigners(envelopeId);
      const signer = signers.find((s) => s.id === signerId);

      if (!signer) {
        return c.json({ error: 'Signer not found' }, 404);
      }

      // Send OTP via email
      const emailSent = await sendEmail({
        to: signer.email,
        subject: `Your Verification Code for Navigate Wealth E-Signature`,
        html: `
        <h2>Your Verification Code</h2>
        <p>Hi ${signer.name},</p>
        <p>Your one-time verification code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `,
      });

      if (!emailSent) {
        return c.json({ error: 'Failed to send OTP email' }, 500);
      }

      // Log audit event
      const { ip, userAgent } = getRequestMetadata(c);
      await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'otp_sent',
        email: signer.email,
        ip,
        userAgent,
        metadata: { signerId, channel: 'email' },
      });

      // P5.1 — parallel OTP delivery via SMS (opt-in + phone required).
      // Email remains the primary channel so the audit trail always shows
      // an `otp_sent` event even when SMS is offline.
      let smsChannel: { delivered: boolean; provider: string } | null = null;
      if (signer.sms_opt_in && signer.phone) {
        try {
          const envelope = await getEnvelopeDetails(envelopeId);
          const smsResult = await sendOtpSms({
            to: signer.phone,
            otp,
            envelopeTitle: envelope?.title,
          });
          smsChannel = { delivered: smsResult.delivered, provider: smsResult.provider };
          if (smsResult.delivered) {
            await logAuditEvent({
              envelopeId,
              actorType: 'system',
              action: 'otp_sent',
              email: signer.email,
              phone: signer.phone,
              ip,
              userAgent,
              metadata: {
                signerId,
                channel: 'sms',
                provider: smsResult.provider,
                messageId: smsResult.messageId,
              },
            });
          }
        } catch (smsErr) {
          log.warn(`SMS OTP failed for signer ${signerId}: ${getErrMsg(smsErr)}`);
        }
      }

      return c.json({
        success: true,
        channels: { email: true, sms: smsChannel?.delivered ?? false },
      });
    } catch (error: unknown) {
      log.error('❌ Send OTP error:', error);
      return c.json({ error: error instanceof Error ? error.message : 'Failed to send OTP' }, 500);
    }
  },
);

/**
 * POST /envelopes/:envelopeId/signers/:signerId/verify
 * Verify OTP and access code
 */
senderRoutes.post(
  '/envelopes/:envelopeId/signers/:signerId/verify',
  rateLimit('OTP_VERIFY'),
  async (c) => {
    try {
      const envelopeId = c.req.param('envelopeId')!;
      const signerId = c.req.param('signerId')!;

      const body = await c.req.json();
      const { otp, accessCode } = body;

      // Verify access code (if provided)
      if (accessCode) {
        const accessCodeResult = await verifyAccessCode(signerId, accessCode);
        if (!accessCodeResult.valid) {
          return c.json({ error: accessCodeResult.error || 'Invalid access code' }, 401);
        }
      }

      // Verify OTP
      const otpResult = await verifyOTP(signerId, otp);
      if (!otpResult.valid) {
        return c.json({ error: otpResult.error || 'Invalid OTP' }, 401);
      }

      // Mark as verified
      await markOTPVerified(signerId);
      await clearOTP(signerId);

      // Update signer status
      await updateSignerStatus(signerId, 'viewed', {
        viewed_at: new Date().toISOString(),
      });

      // Log audit event
      const signers = await getEnvelopeSigners(envelopeId);
      const signer = signers.find((s) => s.id === signerId);
      const { ip, userAgent } = getRequestMetadata(c);

      await logAuditEvent({
        envelopeId,
        actorType: audActor(signer),
        actorId: signerId,
        action: 'otp_verified',
        email: signer?.email,
        ip,
        userAgent,
        metadata: { signerId },
      });

      return c.json({ success: true, verified: true });
    } catch (error: unknown) {
      log.error('❌ Verify OTP error:', error);
      return c.json({ error: error instanceof Error ? error.message : 'Verification failed' }, 500);
    }
  },
);

/**
 * POST /envelopes/:envelopeId/sign
 * Submit signature
 */
senderRoutes.post(
  '/envelopes/:envelopeId/sign',
  requireIdempotency(),
  rateLimit('SIGNER_SUBMIT'),
  async (c) => {
    try {
      const envelopeId = c.req.param('envelopeId')!;

      const body = await c.req.json();
      const parsed = SignEnvelopeSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
      }
      const { signerId, signatureData, fieldValues } = parsed.data;

      if (!signatureData) {
        return c.json({ error: 'signatureData required' }, 400);
      }

      // Get signer
      const signers = await getEnvelopeSigners(envelopeId);
      const signer = signers.find((s) => s.id === signerId);

      if (!signer) {
        return c.json({ error: 'Signer not found' }, 404);
      }

      // Check if already signed
      if (signer.status === 'signed') {
        return c.json({ error: 'Already signed' }, 400);
      }

      // Update field values
      if (fieldValues && Array.isArray(fieldValues)) {
        for (const fv of fieldValues) {
          if (fv.fieldId && fv.value !== undefined) {
            await updateFieldValue(fv.fieldId, fv.value);
          }
        }
      }

      // Update signer status
      const { ip, userAgent } = getRequestMetadata(c);
      await updateSignerStatus(signerId, 'signed', {
        signed_at: new Date().toISOString(),
        signature_data: signatureData,
        ip_address: ip,
        user_agent: userAgent,
      });

      // Log audit event
      await logAuditEvent({
        envelopeId,
        actorType: audActor(signer),
        actorId: signerId,
        action: 'signed',
        email: signer.email,
        ip,
        userAgent,
        metadata: { signerId, signerName: signer.name },
      });

      // Check if envelope is complete
      const isComplete = await checkEnvelopeCompletion(envelopeId);

      if (isComplete) {
        // P7.5 — enqueue the expensive completion workflow (burn-in +
        // certificate + seal + upload) for the background drainer. The
        // signer request returns in < 1s even for large PDFs; the UI
        // observes a `completing` envelope until the drainer finishes.
        await enqueueCompletion(envelopeId);

        await logAuditEvent({
          envelopeId,
          actorType: 'system',
          action: 'envelope_completion_queued',
          ip,
          userAgent,
          metadata: { allSignersCompleted: true, queued: true },
        });
      } else {
        // Not all signers have signed — handle next-signer notification based on signing mode
        const envelopeForMode = await getEnvelopeDetails(envelopeId);
        const adminSignMode = envelopeForMode?.signing_mode || 'sequential';

        // Update envelope to partially_signed
        await updateEnvelopeStatus(envelopeId, 'partially_signed');

        // Sequential mode: notify next pending signer in order
        if (adminSignMode === 'sequential') {
          const allSigners = await getEnvelopeSigners(envelopeId);
          const sorted = [...allSigners].sort(
            (a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0),
          );
          const nextSigner = sorted.find((s: SignerRecord) => s.status === 'pending');

          if (nextSigner) {
            try {
              const signingUrl = `https://www.navigatewealth.co/sign?token=${nextSigner.access_token}`;

              const emailContent = createSigningInviteEmail({
                signerName: nextSigner.name,
                envelopeTitle: envelopeForMode?.title || 'Document',
                senderName: 'Navigate Wealth',
                signingLink: signingUrl,
                message: envelopeForMode?.message,
              });

              const emailSent = await sendEmail({
                to: nextSigner.email,
                subject: `Signature Request: ${envelopeForMode?.title || 'Document'}`,
                html: emailContent.html,
                text: emailContent.text,
              });

              if (emailSent) {
                await updateSignerStatus(nextSigner.id, 'sent', {
                  invite_sent_at: new Date().toISOString(),
                });
              }

              await logAuditEvent({
                envelopeId,
                actorType: 'system',
                action: 'invite_sent',
                email: nextSigner.email,
                ip,
                userAgent,
                metadata: {
                  signerId: nextSigner.id,
                  signerName: nextSigner.name,
                  signingMode: 'sequential',
                  triggeredBy: signerId,
                },
              });

              log.info(
                `Sequential signing: notified next signer ${nextSigner.email} (order ${nextSigner.order})`,
              );
            } catch (notifyErr) {
              log.error('Failed to notify next signer:', notifyErr);
              // Non-critical: signing still succeeded
            }
          }
        }
        // Parallel mode: no next-signer notification needed (all already invited)
      }

      return c.json({
        success: true,
        signed: true,
        envelopeComplete: isComplete,
      });
    } catch (error: unknown) {
      log.error('❌ Sign error:', error);
      return c.json({ error: error instanceof Error ? error.message : 'Signing failed' }, 500);
    }
  },
);

/**
 * POST /envelopes/:envelopeId/reject
 * Reject signing
 */
senderRoutes.post('/envelopes/:envelopeId/reject', async (c) => {
  try {
    const envelopeId = c.req.param('envelopeId')!;

    const body = await c.req.json();
    const parsed = RejectEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { signerId, reason } = parsed.data;

    // Get signer
    const signers = await getEnvelopeSigners(envelopeId);
    const signer = signers.find((s) => s.id === signerId);

    if (!signer) {
      return c.json({ error: 'Signer not found' }, 404);
    }

    // Update signer status
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signerId, 'declined', {
      declined_at: new Date().toISOString(),
      decline_reason: reason,
    });

    // Log audit event
    await logAuditEvent({
      envelopeId,
      actorType: audActor(signer),
      actorId: signerId,
      action: 'declined',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId, reason },
    });

    return c.json({
      success: true,
      rejected: true,
    });
  } catch (error: unknown) {
    log.error('❌ Reject error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Rejection failed' }, 500);
  }
});

/**
 * GET /envelopes/:envelopeId/audit
 * Get audit trail
 */
senderRoutes.get('/envelopes/:envelopeId/audit', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    const events = await getAuditTrail(envelopeId);

    return c.json({ events });
  } catch (error: unknown) {
    log.error('❌ Get audit trail error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch audit trail' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * GET /envelopes/:envelopeId/document
 * Get document URL
 */
senderRoutes.get('/envelopes/:envelopeId/document', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope || !envelope.document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const url = await getDocumentUrl(envelope.document.storage_path);

    return c.json({ url });
  } catch (error: unknown) {
    log.error('❌ Get document URL error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get document URL' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * GET /envelopes/:envelopeId/certificate
 * Get certificate URL
 */
senderRoutes.get('/envelopes/:envelopeId/certificate', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    const certificate = await getCertificate(envelopeId);

    if (!certificate.exists) {
      return c.json({ error: 'Certificate not found' }, 404);
    }

    const url = await getCertificateUrl(certificate.storagePath!);

    return c.json({ url, certificate });
  } catch (error: unknown) {
    log.error('❌ Get certificate URL error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get certificate URL' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

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
senderRoutes.delete('/envelopes/:envelopeId', async (c) => {
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to delete envelope' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * POST /envelopes/:envelopeId/recall
 * Recall a sent envelope (stops the signing process)
 */
senderRoutes.post(
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
        JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to recall envelope' }),
        { status, headers: { 'Content-Type': 'application/json' } },
        );
    }
  },
);

/**
 * POST /envelopes/:envelopeId/remind
 * Send reminder to pending signers
 */
senderRoutes.post(
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
        JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send reminders' }),
        { status, headers: { 'Content-Type': 'application/json' } },
        );
    }
  },
);

/**
 * GET /envelopes/:envelopeId/download
 * Download completed envelope with signatures applied
 */
senderRoutes.get('/envelopes/:envelopeId/download', async (c) => {
  try {
    // Authenticate
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    // Get envelope details
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow download of completed envelopes
    if (envelope.status !== 'completed') {
      return c.json(
        {
          error: 'Only completed envelopes can be downloaded',
        },
        400,
      );
    }

    // Check if we have a pre-generated signed document
    if (envelope.signed_document_path) {
      const signedPdfBuffer = await downloadDocument(envelope.signed_document_path);

      if (signedPdfBuffer) {
        return new Response(signedPdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
          },
        });
      }
      // If buffer is null (file missing), fall back to on-the-fly generation below
    }

    // FALLBACK: On-the-fly generation (for legacy envelopes or if artifact missing)

    // Get original document path
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // 1. Download original PDF
    const pdfBuffer = await downloadDocument(documentPath);
    if (!pdfBuffer) {
      return c.json({ error: 'Failed to retrieve source document' }, 500);
    }

    // 2. Get signers to cross-reference
    const signers = await getEnvelopeSigners(envelopeId);

    // 3. Perform Burn-in
    try {
      const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        pdfBuffer,
        envelope.fields || [],
        signers,
      );

      // Try to merge certificate if available, otherwise just return burned PDF
      let finalPdfBuffer = burnedPdfBuffer;

      // Try to generate/fetch cert
      // We don't want to fail the download if cert generation fails here, just return the signed doc
      try {
        const { pdfBuffer: certBuffer } = await generateCompletionCertificate(envelopeId);
        if (certBuffer) {
          finalPdfBuffer = await PDFService.mergeCertificate(burnedPdfBuffer, certBuffer);
        }
      } catch (certError) {
        log.warn('Certificate merge failed during fallback download, returning signed doc only', {
          error: certError,
        });
      }

      return new Response(finalPdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${envelope.document?.original_filename?.replace('.pdf', '_signed.pdf') || 'signed_document.pdf'}"`,
        },
      });
    } catch (burnInError: unknown) {
      log.error('❌ Burn-in error:', burnInError);
      return c.json({ error: 'Failed to generate signed PDF' }, 500);
    }
  } catch (error: unknown) {
    log.error('❌ Download envelope error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to download envelope' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * GET /envelopes/:envelopeId/evidence-pack
 * P6.7 — download a ZIP bundling the signed PDF, certificate, audit
 * trail, manifest, consent copy, and every attachment. Admin-only.
 */
senderRoutes.get('/envelopes/:envelopeId/evidence-pack', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    // P6.9 — firm scoping. The current admin user must belong to the
    // same firm as the envelope (or the envelope must be 'standalone').
    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const callerFirm = resolveFirmId(ctx.user);
    const envelopeFirm = (envelope.firm_id as string | undefined) || 'standalone';
    if (envelopeFirm !== 'standalone' && envelopeFirm !== callerFirm) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const pack = await buildEvidencePack(envelopeId);
    if (!pack) return c.json({ error: 'Envelope not found' }, 404);

    await logAuditEvent({
      envelopeId,
      actorType: 'admin',
      actorId: ctx.user.id,
      action: 'evidence_pack_exported',
      email: ctx.user.email || 'admin@system',
      metadata: { bytes: pack.zip.length, filename: pack.filename },
    });

    return new Response(pack.zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${pack.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    log.error('Evidence pack export error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to build evidence pack' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

// ==================== REMINDER CONFIG ROUTES ====================

/**
 * GET /envelopes/:envelopeId/reminder-config
 * Get reminder configuration for an envelope
 */
senderRoutes.get('/envelopes/:envelopeId/reminder-config', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const config = await getReminderConfig(envelopeId);
    return c.json({ config });
  } catch (error: unknown) {
    log.error('Get reminder config error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get reminder config' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * PUT /envelopes/:envelopeId/reminder-config
 * Update reminder configuration for an envelope
 */
senderRoutes.put('/envelopes/:envelopeId/reminder-config', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId')!;

    const body = await c.req.json();
    const {
      auto_remind,
      schedule,
      remind_interval_days,
      max_reminders,
      remind_before_expiry_days,
      escalation_offsets_days,
    } = body;

    await setReminderConfig(envelopeId, {
      ...(auto_remind !== undefined && { auto_remind }),
      ...(schedule !== undefined && schedule !== null && { schedule }),
      ...(remind_interval_days !== undefined && { remind_interval_days }),
      ...(max_reminders !== undefined && { max_reminders }),
      ...(remind_before_expiry_days !== undefined && { remind_before_expiry_days }),
      ...(Array.isArray(escalation_offsets_days) && { escalation_offsets_days }),
    });

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'reminder_config_updated',
      ip,
      userAgent,
      email: user.email,
      metadata: body,
    });

    const updated = await getReminderConfig(envelopeId);
    return c.json({ config: updated });
  } catch (error: unknown) {
    log.error('Update reminder config error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update reminder config' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

/**
 * PATCH /envelopes/:envelopeId/signing-mode
 * Update signing mode (sequential/parallel) for an envelope
 */
senderRoutes.patch('/envelopes/:envelopeId/signing-mode', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const user = ctx.user;
    const envelopeId = c.req.param('envelopeId')!;

    const body = await c.req.json();
    const { signing_mode } = body;

    if (!signing_mode || !['sequential', 'parallel'].includes(signing_mode)) {
      return c.json({ error: 'signing_mode must be "sequential" or "parallel"' }, 400);
    }

    const envelope = await getEnvelopeDetails(envelopeId);
    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow changing mode on draft or sent envelopes
    if (!['draft', 'sent'].includes(envelope.status)) {
      return c.json(
        { error: `Cannot change signing mode for envelope with status: ${envelope.status}` },
        400,
      );
    }

    await updateEnvelopeStatus(envelopeId, envelope.status, { signing_mode });

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId,
      actorType: 'sender_user',
      actorId: user.id,
      action: 'signing_mode_changed',
      ip,
      userAgent,
      email: user.email,
      metadata: { from: envelope.signing_mode, to: signing_mode },
    });

    return c.json({ success: true, signing_mode });
  } catch (error: unknown) {
    log.error('Update signing mode error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to update signing mode' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

// ==================== PHASE 3: AUDIT TRAIL EXPORT ====================

/**
 * GET /envelopes/:envelopeId/audit/export
 * Export audit trail as CSV.
 */
senderRoutes.get('/envelopes/:envelopeId/audit/export', async (c) => {
  try {
    const ctx = await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;

    const events = await getAuditTrail(envelopeId);
    if (!events || events.length === 0) {
      return c.json({ error: 'No audit events found' }, 404);
    }

    // Build CSV
    const headers = ['Timestamp', 'Action', 'Actor Type', 'Actor Email', 'IP Address', 'Details'];
    const rows = events
      .sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          new Date(String(a.at || a.created_at || 0)).getTime() -
          new Date(String(b.at || b.created_at || 0)).getTime(),
      )
      .map((e: Record<string, unknown>) => {
        const timestamp = String(e.at || e.created_at || '');
        const action = String(e.action || '')
          .replace(/_/g, ' ')
          .toUpperCase();
        const actorType = String(e.actor_type || '');
        const actorEmail = String(e.email || '');
        const ip = String(e.ip || '');
        const details = e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : '';
        return `"${timestamp}","${action}","${actorType}","${actorEmail}","${ip}","${details}"`;
      });

    const csv = [headers.join(','), ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-trail-${envelopeId.slice(0, 8)}.csv"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
      },
    });
  } catch (error: unknown) {
    log.error('Audit export error:', error);
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to export audit trail' }),
      { status, headers: { 'Content-Type': 'application/json' } },
      );
  }
});

// `emitWebhookEvent` is imported above and invoked from the e-sign workflow
// (see /envelopes/:id/sign etc.); the webhook management routes were extracted
// to esign-webhooks-routes.ts. Keep the import referenced for the outbox tick.
void emitWebhookEvent;

/** GET /diagnostics/kba — admin: show which provider is wired. */
senderRoutes.get('/diagnostics/kba', async (c) => {
  try {
    await getAuthContext(c);
    return c.json({ success: true, ...getKbaStatus() });
  } catch (error: unknown) {
    const status = error instanceof AuthError ? error.statusCode : 500;
    return new Response(JSON.stringify({ error: getErrMsg(error) }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * POST /signer/kba — public; run (or re-run) a KBA check for the signer
 * associated with the supplied access token. Returns the result and
 * stamps it onto the signer record.
 */
senderRoutes.post('/signer/kba', rateLimit('SIGNER_ACCESS'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
    const token = String(body.access_token ?? '').trim();
    if (!token) return c.json({ error: 'access_token required' }, 400);
    const signer = await getSignerByToken(token);
    if (!signer) return c.json({ error: 'Invalid access token' }, 404);
    const envelope = await getEnvelopeDetails(signer.envelope_id);
    if (!envelope) return c.json({ error: 'Envelope not found' }, 404);

    const idNumber = typeof body.id_number === 'string' ? body.id_number : undefined;

    const result = await runKbaCheck({
      signerId: signer.id,
      envelopeId: signer.envelope_id,
      fullName: signer.name,
      email: signer.email,
      phone: signer.phone,
      idNumber,
    });

    await updateSignerStatus(signer.id, signer.status, {
      kba: {
        provider: result.provider,
        status: result.status,
        reference: result.reference,
        verified_at: result.verifiedAt ?? new Date().toISOString(),
      },
    });

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'signer',
      actorId: signer.id,
      action: 'kba_check',
      email: signer.email,
      metadata: {
        provider: result.provider,
        status: result.status,
        reference: result.reference,
      },
    });

    return c.json({
      success: result.status === 'passed' || result.status === 'skipped',
      provider: result.provider,
      status: result.status,
      action_url: result.actionUrl ?? null,
      details: result.details ?? null,
    });
  } catch (error: unknown) {
    log.error('Signer KBA error:', error);
    return c.json({ error: getErrMsg(error) }, 500);
  }
});

export default senderRoutes;
