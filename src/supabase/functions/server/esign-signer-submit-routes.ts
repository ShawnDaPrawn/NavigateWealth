import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { requireIdempotency } from './idempotency.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { getRequestMetadata, audActor } from './esign-route-helpers.ts';
import {
  getEnvelopeDetails,
  getEnvelopeSigners,
  getSignerByToken,
  updateEnvelopeStatus,
  updateSignerStatus,
  updateFieldValue,
  checkEnvelopeCompletion,
  rotateSignerToken,
  logAuditEvent,
} from './esign-services.ts';
import { createSigningInviteEmail } from './esign-email-templates.ts';
import { sendEmail } from './email-service.ts';
import {
  shouldDeliverSenderEvent,
  queueForDigest,
  SenderEvent,
} from './esign-notification-prefs.ts';
import { emitWebhookEvent } from './webhook-service.ts';
import { enqueue as enqueueInAppNotification } from './esign-inapp-notifications.ts';
import { enqueueCompletion } from './esign-completion-queue.ts';

const log = createModuleLogger('esign-signer-submit-routes');

// Lazy Supabase admin client (sender lookups). Must not be top-level.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const app = new Hono();

/**
 * POST /signer/submit
 * Submit signature (public endpoint)
 */
app.post('/signer/submit', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
  try {
    const body = await c.req.json();
    const {
      access_token,
      signature_data,
      field_values,
      // P6.3/6.4/6.5 — evidence payload captured client-side and stamped
      // onto the signer record for the completion certificate.
      consent_version,
      consent_accepted_at,
      signing_reason,
      signature_telemetry,
    } = body;

    if (!access_token || !signature_data) {
      return c.json({ error: 'access_token and signature_data required' }, 400);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Check if already signed
    if (signer.status === 'signed') {
      return c.json({ error: 'Document already signed' }, 400);
    }

    // Check if OTP verification is required but not done
    if (signer.requires_otp && !signer.otp_verified) {
      return c.json({ error: 'OTP verification required before signing' }, 403);
    }

    // P6.6 — if the envelope requires KBA, the check must have been
    // completed before submit. We surface a soft error so the client
    // can route the signer through the KBA step.
    try {
      const envelopeForKba = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForKba?.kba_required && signer.kba?.status !== 'passed') {
        return c.json({ error: 'Identity verification (KBA) is required before signing' }, 403);
      }
    } catch (kbaErr) {
      log.warn('KBA gate check failed; allowing submit:', { error: String(kbaErr) });
    }

    // Update field values
    if (field_values && Array.isArray(field_values)) {
      for (const fv of field_values) {
        if (fv.field_id && fv.value !== undefined) {
          await updateFieldValue(fv.field_id, fv.value);
        }
      }
    }

    // Update signer status + P6 evidence stamps
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signer.id, 'signed', {
      signed_at: new Date().toISOString(),
      signature_data,
      ip_address: ip,
      user_agent: userAgent,
      consent_version: typeof consent_version === 'string' ? consent_version : undefined,
      consent_accepted_at:
        typeof consent_accepted_at === 'string' ? consent_accepted_at : new Date().toISOString(),
      signing_reason:
        typeof signing_reason === 'string' ? signing_reason.trim() || undefined : undefined,
      signature_telemetry:
        signature_telemetry && typeof signature_telemetry === 'object'
          ? signature_telemetry
          : undefined,
    });

    // P5.6 — single-use semantics: once a signer has successfully submitted,
    // rotate their access token so the original invite link cannot be
    // replayed to re-open the signing UI. The fresh token is indexed but
    // not communicated anywhere, effectively burning the URL.
    try {
      await rotateSignerToken(signer.id, 'post_submit');
    } catch {
      /* best-effort */
    }

    // Log audit event
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'signed',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id, signerName: signer.name },
    });

    // Check if envelope is complete
    const isComplete = await checkEnvelopeCompletion(signer.envelope_id);

    if (isComplete) {
      // P7.5 — enqueue the expensive completion workflow (burn-in +
      // certificate + seal + upload) for the background drainer. The
      // signer request returns immediately; the UI observes a
      // `completing` envelope until the drainer finishes.
      await enqueueCompletion(signer.envelope_id);

      await logAuditEvent({
        envelopeId: signer.envelope_id,
        actorType: 'system',
        action: 'envelope_completion_queued',
        ip,
        userAgent,
        metadata: { allSignersCompleted: true, queued: true },
      });
    } else {
      // Not all signers have signed yet — handle next-signer notification and progress updates
      const envelopeForProgress = await getEnvelopeDetails(signer.envelope_id);
      const currentMode = envelopeForProgress?.signing_mode || 'sequential';
      const allSigners = await getEnvelopeSigners(signer.envelope_id);
      const sorted = [...allSigners].sort((a, b) => (a.order || 0) - (b.order || 0));
      const signedCount = sorted.filter((s) => s.status === 'signed').length;
      const totalSigners = sorted.length;

      // Update envelope to partially_signed
      await updateEnvelopeStatus(signer.envelope_id, 'partially_signed');

      // Sequential mode: notify next pending signer in order
      if (currentMode === 'sequential') {
        const nextSigner = sorted.find((s) => s.status === 'pending');

        if (nextSigner) {
          try {
            const signingUrl = `https://www.navigatewealth.co/sign?token=${nextSigner.access_token}`;

            const emailContent = createSigningInviteEmail({
              signerName: nextSigner.name,
              envelopeTitle: envelopeForProgress?.title || 'Document',
              senderName: 'Navigate Wealth',
              signingLink: signingUrl,
              message: envelopeForProgress?.message,
            });

            const emailSent = await sendEmail({
              to: nextSigner.email,
              subject: `Signature Request: ${envelopeForProgress?.title || 'Document'}`,
              html: emailContent.html,
              text: emailContent.text,
            });

            if (emailSent) {
              await updateSignerStatus(nextSigner.id, 'sent', {
                invite_sent_at: new Date().toISOString(),
              });
            }

            await logAuditEvent({
              envelopeId: signer.envelope_id,
              actorType: 'system',
              action: 'invite_sent',
              email: nextSigner.email,
              ip,
              userAgent,
              metadata: {
                signerId: nextSigner.id,
                signerName: nextSigner.name,
                signingMode: 'sequential',
                triggeredBy: signer.id,
              },
            });

            log.info(
              `Sequential signing: notified next signer ${nextSigner.email} (order ${nextSigner.order})`,
            );
          } catch (notifyErr) {
            log.error('Failed to notify next signer after public submit:', notifyErr);
            // Non-critical: signing still succeeded, don't fail the response
          }
        }
      }
      // Parallel mode: no next-signer notification needed (all already invited)

      // Notify sender (admin) of per-signer progress — respects P5.2
      // per-user notification prefs. If mode is `completion_only` or `off`
      // we skip the email entirely; if `digest` we enqueue it for the
      // nightly tick rather than blasting every signer event to inbox.
      try {
        if (envelopeForProgress?.created_by_user_id) {
          const { data: senderUser } = await getSupabase().auth.admin.getUserById(
            envelopeForProgress.created_by_user_id,
          );
          const senderEmail = senderUser?.user?.email;

          if (senderEmail) {
            const decision = await shouldDeliverSenderEvent(
              envelopeForProgress.created_by_user_id,
              'signer.signed' as SenderEvent,
            );
            const progressSubject = `Progress: ${signer.name} signed "${envelopeForProgress.title}" (${signedCount}/${totalSigners})`;
            const progressText = `${signer.name} has signed "${envelopeForProgress.title}". Progress: ${signedCount} of ${totalSigners} signers completed.`;
            const progressHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                  <h2 style="color: white; margin: 0; font-size: 18px;">Signing Progress Update</h2>
                </div>
                <div style="background: #ffffff; padding: 24px 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                  <p style="color: #374151; margin: 0 0 16px;">
                    <strong>${signer.name}</strong> has signed <strong>${envelopeForProgress.title}</strong>.
                  </p>
                  <div style="background: #F9FAFB; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px;">Progress: ${signedCount} of ${totalSigners} signers completed</p>
                    <div style="background: #E5E7EB; border-radius: 4px; height: 8px; overflow: hidden;">
                      <div style="background: #4F46E5; height: 100%; width: ${Math.round((signedCount / totalSigners) * 100)}%; border-radius: 4px;"></div>
                    </div>
                  </div>
                  <p style="color: #9CA3AF; font-size: 12px; margin: 16px 0 0;">
                    Mode: ${currentMode === 'sequential' ? 'Sequential' : 'Parallel'} signing
                  </p>
                </div>
              </div>`;

            if (decision.deliver) {
              await sendEmail({
                to: senderEmail,
                subject: progressSubject,
                html: progressHtml,
                text: progressText,
              });
            } else if (decision.digest) {
              await queueForDigest({
                userId: envelopeForProgress.created_by_user_id,
                event: 'signer.signed',
                envelopeId: envelopeForProgress.id,
                envelopeTitle: envelopeForProgress.title,
                subject: progressSubject,
                body: progressText,
              });
            }

            // P5.7 — bell-UI copy. Always emitted regardless of email
            // preferences so senders retain an in-product log of activity.
            void enqueueInAppNotification({
              userId: envelopeForProgress.created_by_user_id,
              type: 'signer.signed',
              title: `${signer.name} signed`,
              body: `${signer.name} signed "${envelopeForProgress.title}" (${signedCount}/${totalSigners}).`,
              envelopeId: envelopeForProgress.id,
              signerId: signer.id,
              metadata: { signed_count: signedCount, total_signers: totalSigners },
            });
          }
        }
      } catch (progressEmailErr) {
        log.error('Failed to send progress notification to sender:', progressEmailErr);
        // Non-critical
      }

      // P5.4 — fan-out to firm webhooks. Fire-and-forget.
      if (envelopeForProgress) {
        void emitWebhookEvent({
          firmId: envelopeForProgress.firm_id || 'standalone',
          eventType: 'signer.signed',
          envelopeId: envelopeForProgress.id,
          payload: {
            signer: { id: signer.id, name: signer.name, email: signer.email, order: signer.order },
            envelope: {
              id: envelopeForProgress.id,
              title: envelopeForProgress.title,
              status: envelopeForProgress.status,
            },
            progress: {
              signed_count: signedCount,
              total_signers: totalSigners,
              complete: isComplete,
            },
          },
        });
      }
    }

    // Get envelope details for response
    const envelope = await getEnvelopeDetails(signer.envelope_id);

    return c.json({
      success: true,
      signed: true,
      envelope_complete: isComplete,
      envelope_id: signer.envelope_id,
      envelope_title: envelope?.title,
    });
  } catch (error: unknown) {
    log.error('❌ Submit signature error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to submit signature' },
      500,
    );
  }
});

/**
 * POST /signer/reject
 * Reject document (public endpoint)
 */
app.post('/signer/reject', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
  try {
    const body = await c.req.json();
    const { access_token, reason } = body;

    if (!access_token) {
      return c.json({ error: 'access_token required' }, 400);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Update signer status
    const { ip, userAgent } = getRequestMetadata(c);
    await updateSignerStatus(signer.id, 'declined', {
      declined_at: new Date().toISOString(),
      decline_reason: reason || 'No reason provided',
    });

    // Update envelope status to declined
    await updateEnvelopeStatus(signer.envelope_id, 'declined');

    // Log audit event
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'declined',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id, signerName: signer.name, reason },
    });

    log.info(`Signer ${signer.email} declined envelope ${signer.envelope_id}`);

    // Notify sender (admin) about the decline — respects P5.2 prefs.
    // Decline is a terminal event: even `completion_only` senders see it.
    // `off` still suppresses.
    try {
      const envelopeForNotify = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForNotify?.created_by_user_id) {
        const { data: senderUser } = await getSupabase().auth.admin.getUserById(
          envelopeForNotify.created_by_user_id,
        );
        const senderEmail = senderUser?.user?.email;

        if (senderEmail) {
          const declineDecision = await shouldDeliverSenderEvent(
            envelopeForNotify.created_by_user_id,
            'signer.declined' as SenderEvent,
          );
          const declineSubject = `Declined: ${signer.name} declined to sign "${envelopeForNotify.title}"`;
          const declineText = `${signer.name} (${signer.email}) has declined to sign "${envelopeForNotify.title}". ${reason ? `Reason: ${reason}` : 'No reason provided.'}`;
          const declineHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #DC2626, #F59E0B); padding: 24px 32px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 18px;">Document Declined</h2>
              </div>
              <div style="background: #ffffff; padding: 24px 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; margin: 0 0 16px;">
                  <strong>${signer.name}</strong> (${signer.email}) has declined to sign <strong>${envelopeForNotify.title}</strong>.
                </p>
                ${
                  reason
                    ? `
                <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0 0 4px; color: #92400E; font-size: 12px; font-weight: 600;">Reason provided:</p>
                  <p style="margin: 0; color: #78350F; font-size: 14px;">${reason}</p>
                </div>`
                    : ''
                }
                <p style="color: #6B7280; font-size: 13px; margin: 16px 0 0;">
                  The envelope status has been updated to <strong>Declined</strong>. You may void this envelope and create a new one if needed.
                </p>
              </div>
            </div>`;

          if (declineDecision.deliver) {
            await sendEmail({
              to: senderEmail,
              subject: declineSubject,
              html: declineHtml,
              text: declineText,
            });
            log.info(`Decline notification sent to sender ${senderEmail}`);
          } else if (declineDecision.digest) {
            await queueForDigest({
              userId: envelopeForNotify.created_by_user_id,
              event: 'signer.declined',
              envelopeId: envelopeForNotify.id,
              envelopeTitle: envelopeForNotify.title,
              subject: declineSubject,
              body: declineText,
            });
            log.info(`Decline queued for digest for ${senderEmail}`);
          } else {
            log.info(`Decline suppressed for sender ${senderEmail} (mode=${declineDecision.mode})`);
          }

          // P5.7 — bell-UI copy (always enqueue; bell stays truthful
          // regardless of email delivery preferences).
          void enqueueInAppNotification({
            userId: envelopeForNotify.created_by_user_id,
            type: 'envelope.declined',
            title: `${signer.name} declined`,
            body: `${signer.name} declined to sign "${envelopeForNotify.title}".${reason ? ` Reason: ${reason}` : ''}`,
            envelopeId: envelopeForNotify.id,
            signerId: signer.id,
            metadata: { reason: reason ?? null },
          });
        }
      }
    } catch (notifyErr) {
      log.error('Failed to send decline notification to sender:', notifyErr);
      // Non-critical: decline still succeeded
    }

    // P5.4 — webhook fan-out for decline.
    try {
      const envelopeForHook = await getEnvelopeDetails(signer.envelope_id);
      if (envelopeForHook) {
        void emitWebhookEvent({
          firmId: envelopeForHook.firm_id || 'standalone',
          eventType: 'signer.declined',
          envelopeId: envelopeForHook.id,
          payload: {
            signer: { id: signer.id, name: signer.name, email: signer.email },
            envelope: { id: envelopeForHook.id, title: envelopeForHook.title, status: 'declined' },
            reason: reason || null,
          },
        });
      }
    } catch (hookErr) {
      log.error('Failed to emit decline webhook:', hookErr);
    }

    return c.json({
      success: true,
      rejected: true,
      envelope_id: signer.envelope_id,
    });
  } catch (error: unknown) {
    log.error('❌ Reject document error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to reject document' },
      500,
    );
  }
});

export default app;
