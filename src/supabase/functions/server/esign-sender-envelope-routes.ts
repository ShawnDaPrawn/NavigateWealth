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
import { belongsToFirm } from './esign-firm-scope.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  getSignerByToken,
  getClientEnvelopes,
  updateEnvelopeStatus,
  updateSignerStatus,
  updateFieldValue,
  checkEnvelopeCompletion,
  logAuditEvent,
} from './esign-services.ts';
import {
  verifyOTP,
  markOTPVerified,
  clearOTP,
  generateAndStoreOTP,
  verifyAccessCode,
  isOTPRequired,
} from './esign-otp.ts';
import { createSigningInviteEmail } from './esign-email-templates.ts';
import { sendEmail } from './email-service.ts';
import { sendOtpSms } from './sms-service.ts';
import { enqueue as enqueueInAppNotification } from './esign-inapp-notifications.ts';
import { enqueueCompletion } from './esign-completion-queue.ts';

const log = createModuleLogger('esign-sender-envelope-routes');

const app = new Hono();

app.get('/clients/:clientId/envelopes', async (c) => {
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
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to fetch envelopes',
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * POST /envelopes/:envelopeId/signers/:signerId/otp/send
 * Send OTP to signer
 */
app.post('/envelopes/:envelopeId/signers/:signerId/otp/send', rateLimit('OTP_SEND'), async (c) => {
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
});

/**
 * POST /envelopes/:envelopeId/signers/:signerId/verify
 * Verify OTP and access code
 */
app.post('/envelopes/:envelopeId/signers/:signerId/verify', rateLimit('OTP_VERIFY'), async (c) => {
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
});

/**
 * POST /envelopes/:envelopeId/sign
 * Submit signature
 */
app.post(
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
          const sorted = [...allSigners].sort((a, b) => (a.order || 0) - (b.order || 0));
          const nextSigner = sorted.find((s) => s.status === 'pending');

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
app.post('/envelopes/:envelopeId/reject', async (c) => {
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

export default app;
