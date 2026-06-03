/**
 * esign signer token-flow routes (Phase 5 decomposition).
 * =======================================================
 *
 * Extracted verbatim from esign-routes.tsx: the public, signer-access-token
 * authenticated signing experience — sign-by-token landing, validate +
 * OTP send/verify, signature submit, reject, signed-PDF download,
 * saved-signature, attachments list/upload, and pause. This is the legally-
 * significant OTP + signature-submission core. Mounted via
 * `esignRoutes.route('/', signerRoutes)`. Defines its own lazy admin Supabase
 * client (the one local helper the block used). Behaviour-preserving, guarded
 * by the signer token-flow contract group landed ahead of this cut.
 */
import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { requireIdempotency } from './idempotency.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { SignerValidateSchema, OtpVerifySchema } from './esign-validation.ts';
import { getRequestMetadata, audActor, ensureStorageBuckets } from './esign-route-helpers.ts';
import { checkRateLimit } from './rateLimiter.ts';
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
import {
  downloadDocument,
  getDocumentUrl,
  calculateHash,
  uploadAttachment,
  getAttachmentUrl,
} from './esign-storage.ts';
import {
  verifyOTP,
  markOTPVerified,
  clearOTP,
  generateAndStoreOTP,
  verifyAccessCode,
} from './esign-otp.ts';
import { generateCompletionCertificate } from './esign-certificates.ts';
import { createSigningInviteEmail, createOTPEmail } from './esign-email-templates.ts';
import { getConsentByVersion } from './esign-consent-registry.ts';
import { getFirmBranding, toPublicBranding } from './esign-branding-service.ts';
import { sendEmail } from './email-service.ts';
import { sendOtpSms } from './sms-service.ts';
import { shouldDeliverSenderEvent, queueForDigest } from './esign-notification-prefs.ts';
import { emitWebhookEvent } from './webhook-service.ts';
import { enqueue as enqueueInAppNotification } from './esign-inapp-notifications.ts';
import { enqueueCompletion } from './esign-completion-queue.ts';

const log = createModuleLogger('esign-signer-routes');

// Lazy Supabase admin client (sender lookups). Must not be top-level.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const signerRoutes = new Hono();

signerRoutes.get('/sign-by-token/:token', async (c) => {
  try {
    const token = c.req.param('token')!;

    // Get signer by token
    const signer = await getSignerByToken(token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired signing link' }, 404);
    }

    // Get envelope
    const envelope = await getEnvelopeDetails(signer.envelope_id);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Get document URL
    const documentUrl = envelope.document
      ? await getDocumentUrl(envelope.document.storage_path)
      : null;

    // Filter fields for this signer
    const signerFields = envelope.fields.filter((f: FieldRecord) => f.signer_id === signer.id);

    // P6.4 — resolve the consent text the signer should see. Envelopes
    // created after P6 have `consent_version` pinned at send-time; for
    // anything legacy we fall back to the currently active version.
    const consent = await getConsentByVersion(envelope.consent_version as string | undefined);

    return c.json({
      envelope: {
        id: envelope.id,
        title: envelope.title,
        message: envelope.message,
        status: envelope.status,
        document: {
          ...envelope.document,
          url: documentUrl,
        },
        // P6.4 / P6.5 / P6.6 — surface the evidence-grade envelope
        // settings the signer must acknowledge.
        consent: { id: consent.id, text: consent.text },
        signing_reason_required: !!envelope.signing_reason_required,
        signing_reason_prompt: envelope.signing_reason_prompt ?? null,
        kba_required: !!envelope.kba_required,
      },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        status: signer.status,
        requires_otp: signer.requires_otp,
        otp_verified: signer.otp_verified,
        kba_status: signer.kba?.status ?? null,
      },
      fields: signerFields,
    });
  } catch (error: unknown) {
    log.error('❌ Get signing info error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch signing information' },
      500,
    );
  }
});

// ==================== SIGNER PUBLIC ENDPOINTS (No Auth Required) ====================

/**
 * POST /signer/validate
 * Validate access token and get signer session data (public endpoint)
 */
signerRoutes.post('/signer/validate', rateLimit('SIGNER_ACCESS'), async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SignerValidateSchema.safeParse({ token: body.access_token });
    if (!parsed.success) {
      return c.json({ error: 'access_token required', ...formatZodError(parsed.error) }, 400);
    }
    const access_token = parsed.data.token;

    // Rate limit check (IP based to prevent scanning)
    const { ip } = getRequestMetadata(c);
    const rateLimit = await checkRateLimit(ip, 'esign_token_validate', {
      maxAttempts: 60, // 1 per minute on average
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    // Get envelope
    const envelope = await getEnvelopeDetails(signer.envelope_id);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Check if envelope is expired
    const now = new Date();
    const expiresAt = new Date(envelope.expires_at);
    if (now > expiresAt) {
      return c.json({ error: 'Document has expired' }, 410);
    }

    // Get document URL
    const documentUrl = envelope.document
      ? await getDocumentUrl(envelope.document.storage_path)
      : null;

    // Filter fields for this signer
    const signerFields = envelope.fields.filter((f: FieldRecord) => f.signer_id === signer.id);

    // Determine if it's this signer's turn based on signing mode
    const allSigners = envelope.signers || [];
    const sortedAllSigners = [...allSigners].sort(
      (a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0),
    );
    const signerOrder = signer.order || 1;
    const signingMode = envelope.signing_mode || 'sequential';

    // In parallel mode, all signers can sign at any time.
    // In sequential mode, a signer can only sign when all lower-order signers have signed.
    const isTurn =
      signingMode === 'parallel'
        ? true
        : sortedAllSigners
            .filter((s: SignerRecord) => (s.order || 0) < signerOrder)
            .every((s: SignerRecord) => s.status === 'signed');

    // Build a summary of all signers (non-sensitive) for the waiting UI
    const signersSummary = sortedAllSigners.map((s: SignerRecord) => ({
      order: s.order,
      name: s.name,
      role: s.role,
      status: s.status,
      is_current: s.id === signer.id,
    }));

    // ── Look up the signer's saved signature profile (Phase 1 — signature reuse).
    // Keyed by lowercased email so a returning signer sees their adopted
    // signature pre-loaded across envelopes, no matter which firm sent it.
    let savedSignature: string | null = null;
    let savedInitials: string | null = null;
    try {
      const profileKey = `esign:signer-profile:${(signer.email || '').toLowerCase().trim()}`;
      const profile = (await kv.get(profileKey)) as {
        signature?: string;
        initials?: string;
      } | null;
      if (profile && typeof profile === 'object') {
        savedSignature = typeof profile.signature === 'string' ? profile.signature : null;
        savedInitials = typeof profile.initials === 'string' ? profile.initials : null;
      }
    } catch (profileErr) {
      log.warn('Failed to load signer profile (non-critical):', { error: profileErr instanceof Error ? profileErr.message : String(profileErr) });
    }

    // Auto-send OTP if required and not verified
    if (signer.requires_otp && !signer.otp_verified) {
      try {
        // Generate OTP
        const { otp, error: otpError } = await generateAndStoreOTP(signer.id);

        if (!otpError && otp) {
          // Send OTP Email
          const emailContent = createOTPEmail({
            signerName: signer.name,
            otp,
            envelopeTitle: envelope.title,
            expiresInMinutes: 15,
          });

          await sendEmail({
            to: signer.email,
            subject: `Verification Code: ${envelope.title}`,
            html: emailContent.html,
            text: emailContent.text,
          });

          // Log audit event
          const { ip, userAgent } = getRequestMetadata(c);
          await logAuditEvent({
            envelopeId: envelope.id,
            actorType: 'system',
            action: 'otp_sent',
            email: signer.email,
            ip,
            userAgent,
            metadata: { signerId: signer.id, note: 'Auto-sent on access' },
          });

          log.info(`✅ Auto-sent OTP to ${signer.email} for signer ${signer.id}`);
        }
      } catch (err) {
        log.warn('❌ Failed to auto-send OTP:', { error: err instanceof Error ? err.message : String(err) });
        // We don't block the response, but we log the error
      }
    }

    // P8.6 — Pull firm branding (logo + accent colour) so the signer
    // page can theme without an extra round-trip. Best-effort: any
    // failure leaves branding null and the signer falls back to the
    // built-in defaults baked into the React client.
    let branding: ReturnType<typeof toPublicBranding> = null;
    try {
      const firmId = (envelope as { firm_id?: string }).firm_id;
      if (firmId) {
        const record = await getFirmBranding(firmId);
        branding = toPublicBranding(record);
      }
    } catch (brandErr) {
      log.warn('Failed to load firm branding for signer (non-critical):', { error: brandErr instanceof Error ? brandErr.message : String(brandErr) });
    }

    // P8.7 — Surface the signer's preferred language so the UI can
    // hydrate translations on first paint without a separate fetch.
    // Defaults to English when not set.
    const signerLanguage = ((signer as { language?: string }).language || 'en')
      .toLowerCase()
      .slice(0, 5);

    // Return session data
    return c.json({
      envelope_id: envelope.id,
      envelope_title: envelope.title,
      envelope_message: envelope.message,
      envelope_status: envelope.status,
      document_url: documentUrl,
      document_filename: envelope.document?.original_filename,
      document_page_count: envelope.document?.page_count,
      signer_id: signer.id,
      signer_name: signer.name,
      signer_email: signer.email,
      signer_role: signer.role,
      signer_status: signer.status,
      signer_order: signerOrder,
      signer_language: signerLanguage,
      otp_required: signer.requires_otp,
      otp_verified: signer.otp_verified,
      access_code_required: !!signer.access_code,
      is_turn: isTurn,
      all_signers: signersSummary,
      fields: signerFields,
      saved_signature: savedSignature,
      saved_initials: savedInitials,
      branding,
    });
  } catch (error: unknown) {
    log.error('❌ Validate token error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to validate token' },
      500,
    );
  }
});

/**
 * POST /signer/verify-otp
 * Verify OTP for signer (public endpoint)
 */
signerRoutes.post('/signer/verify-otp', rateLimit('OTP_VERIFY'), async (c) => {
  try {
    const body = await c.req.json();
    const { access_token, access_code } = body as Record<string, unknown>;
    const otpParsed = OtpVerifySchema.safeParse({ otp: body.otp });

    if (!access_token || !otpParsed.success) {
      return c.json(
        {
          error: 'access_token and valid otp required',
          ...(otpParsed.success ? {} : formatZodError(otpParsed.error)),
        },
        400,
      );
    }
    const otp = otpParsed.data.otp;

    // Get signer by token (needed for rate limiting by user ID)
    const signer = await getSignerByToken(access_token as string);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Rate limit check (Per signer to prevent OTP guessing)
    const rateLimit = await checkRateLimit(
      signer.id,
      'esign_otp_verify',
      RATE_LIMITS.EMAIL_VERIFICATION,
    );

    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    // Verify access code if required
    if (access_code) {
      const accessCodeResult = await verifyAccessCode(signer.id, access_code);
      if (!accessCodeResult.valid) {
        return c.json({ error: accessCodeResult.error || 'Invalid access code' }, 401);
      }
    }

    // Verify OTP
    const otpResult = await verifyOTP(signer.id, otp);
    if (!otpResult.valid) {
      return c.json({ error: otpResult.error || 'Invalid OTP' }, 401);
    }

    // Mark as verified
    await markOTPVerified(signer.id);
    await clearOTP(signer.id);

    // Update signer status
    await updateSignerStatus(signer.id, 'viewed', {
      viewed_at: new Date().toISOString(),
    });

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'otp_verified',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id },
    });

    return c.json({
      success: true,
      verified: true,
      message: 'OTP verified successfully',
    });
  } catch (error: unknown) {
    log.error('❌ Verify OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Verification failed' }, 500);
  }
});

/**
 * POST /signer/resend-otp
 * Resend OTP to signer (public endpoint)
 */
signerRoutes.post('/signer/resend-otp', rateLimit('OTP_SEND'), async (c) => {
  try {
    const body = await c.req.json();
    const { access_token } = body;

    if (!access_token) {
      return c.json({ error: 'access_token required' }, 400);
    }

    // Get signer by token
    const signer = await getSignerByToken(access_token);

    if (!signer) {
      return c.json({ error: 'Invalid access token' }, 404);
    }

    // Rate limit check (Per signer to prevent email spam)
    // Using slightly different config than verification
    const rateLimit = await checkRateLimit(signer.id, 'esign_otp_resend', {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 3 per hour
      blockDurationMs: 60 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    // Check if OTP is required
    if (!signer.requires_otp) {
      return c.json({ error: 'OTP not required for this signer' }, 400);
    }

    // Generate and store new OTP
    const { otp, error } = await generateAndStoreOTP(signer.id);

    if (error || !otp) {
      return c.json({ error: error || 'Failed to generate OTP' }, 500);
    }

    // Get envelope details for email
    const envelope = await getEnvelopeDetails(signer.envelope_id);
    const envelopeTitle = envelope ? envelope.title : 'Document';

    // Send OTP via email
    const emailContent = createOTPEmail({
      signerName: signer.name,
      otp,
      envelopeTitle,
      expiresInMinutes: 15,
    });

    const emailSent = await sendEmail({
      to: signer.email,
      subject: `Verification Code: ${envelopeTitle}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailSent) {
      return c.json({ error: 'Failed to send OTP email' }, 500);
    }

    // Log audit event
    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: 'system',
      action: 'otp_resent',
      email: signer.email,
      ip,
      userAgent,
      metadata: { signerId: signer.id, channel: 'email' },
    });

    // P5.1 — mirror OTP via SMS for opted-in signers.
    let smsDelivered = false;
    if (signer.sms_opt_in && signer.phone) {
      try {
        const smsResult = await sendOtpSms({
          to: signer.phone,
          otp,
          envelopeTitle,
        });
        smsDelivered = smsResult.delivered;
        if (smsResult.delivered) {
          await logAuditEvent({
            envelopeId: signer.envelope_id,
            actorType: 'system',
            action: 'otp_resent',
            email: signer.email,
            phone: signer.phone,
            ip,
            userAgent,
            metadata: {
              signerId: signer.id,
              channel: 'sms',
              provider: smsResult.provider,
              messageId: smsResult.messageId,
            },
          });
        }
      } catch (smsErr) {
        log.warn(`SMS OTP resend failed for signer ${signer.id}: ${getErrMsg(smsErr)}`);
      }
    }

    return c.json({
      success: true,
      message: 'OTP sent successfully',
      channels: { email: true, sms: smsDelivered },
    });
  } catch (error: unknown) {
    log.error('❌ Resend OTP error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to resend OTP' }, 500);
  }
});

/**
 * POST /signer/submit
 * Submit signature (public endpoint)
 */
signerRoutes.post('/signer/submit', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
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
      log.warn('KBA gate check failed; allowing submit:', { error: kbaErr instanceof Error ? kbaErr.message : String(kbaErr) });
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
      const sorted = [...allSigners].sort(
        (a: SignerRecord, b: SignerRecord) => (a.order || 0) - (b.order || 0),
      );
      const signedCount = sorted.filter((s: SignerRecord) => s.status === 'signed').length;
      const totalSigners = sorted.length;

      // Update envelope to partially_signed
      await updateEnvelopeStatus(signer.envelope_id, 'partially_signed');

      // Sequential mode: notify next pending signer in order
      if (currentMode === 'sequential') {
        const nextSigner = sorted.find((s: SignerRecord) => s.status === 'pending');

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
      envelope_title: envelope.title,
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
signerRoutes.post('/signer/reject', requireIdempotency(), rateLimit('SIGNER_SUBMIT'), async (c) => {
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

/**
 * GET /signer/download/:token
 * Download signed document using signer token (public endpoint)
 */
signerRoutes.get('/signer/download/:token', async (c) => {
  try {
    const token = c.req.param('token')!;

    // Get signer by token
    const signer = await getSignerByToken(token);

    if (!signer) {
      return c.json({ error: 'Invalid or expired signing link' }, 404);
    }

    // Get envelope details
    const envelopeId = signer.envelope_id;
    const envelope = await getEnvelopeDetails(envelopeId);

    if (!envelope) {
      return c.json({ error: 'Envelope not found' }, 404);
    }

    // Only allow download if completed
    if (envelope.status !== 'completed') {
      return c.json({ error: 'Document not completed yet' }, 400);
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
    }

    // FALLBACK: On-the-fly generation
    const documentPath = envelope.document?.storage_path;
    if (!documentPath) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // 1. Download original PDF
    const pdfBuffer = await downloadDocument(documentPath);
    if (!pdfBuffer) {
      return c.json({ error: 'Failed to retrieve source document' }, 500);
    }

    // 2. Get signers
    const signers = await getEnvelopeSigners(envelopeId);

    // 3. Perform Burn-in
    try {
      const { pdfBuffer: burnedPdfBuffer } = await PDFService.burnIn(
        pdfBuffer,
        envelope.fields || [],
        signers,
      );

      let finalPdfBuffer = burnedPdfBuffer;

      try {
        const { pdfBuffer: certBuffer } = await generateCompletionCertificate(envelopeId);
        if (certBuffer) {
          finalPdfBuffer = await PDFService.mergeCertificate(burnedPdfBuffer, certBuffer);
        }
      } catch (certError) {
        log.warn('Certificate merge failed during fallback download', { error: certError instanceof Error ? certError.message : String(certError) });
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
    log.error('❌ Signer download error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to download document' },
      500,
    );
  }
});

/**
 * POST /signer/saved-signature
 * Persist the signer's adopted signature/initials so it can be reused on
 * future envelopes addressed to the same email. Public endpoint — must
 * present a valid signing token, which scopes the operation to the email
 * the token was issued for. Either field is optional; only the provided
 * one(s) are written.
 */
signerRoutes.post('/signer/saved-signature', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    const signature = typeof body.signature === 'string' ? body.signature : null;
    const initials = typeof body.initials === 'string' ? body.initials : null;

    if (!accessToken) {
      return c.json({ error: 'access_token required' }, 400);
    }
    if (!signature && !initials) {
      return c.json({ error: 'signature or initials required' }, 400);
    }

    const { ip } = getRequestMetadata(c);
    const rateLimit = await checkRateLimit(ip, 'esign_saved_signature_save', {
      maxAttempts: 30,
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return c.json({ error: rateLimit.reason }, 429);
    }

    const signer = await getSignerByToken(accessToken);
    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    const email = (signer.email || '').toLowerCase().trim();
    if (!email) {
      return c.json({ error: 'Signer email missing' }, 400);
    }

    // Reject obviously oversized payloads (data URLs > ~512KB) to avoid KV bloat.
    const tooLarge = (s: string | null) => !!s && s.length > 600_000;
    if (tooLarge(signature) || tooLarge(initials)) {
      return c.json({ error: 'Signature image is too large. Please use a smaller image.' }, 413);
    }

    const profileKey = `esign:signer-profile:${email}`;
    const existing = (await kv.get(profileKey)) as { signature?: string; initials?: string } | null;
    const next = {
      signature: signature ?? existing?.signature ?? null,
      initials: initials ?? existing?.initials ?? null,
      updated_at: new Date().toISOString(),
    };
    await kv.set(profileKey, next);

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Save signer signature error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to save signature' },
      500,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Envelope attachment listing (admin / sender)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /envelopes/:envelopeId/attachments
 *
 * Authenticated read of every attachment uploaded by every signer for an
 * envelope. Returns presigned URLs valid for 1h so the sender's UI can
 * download / preview without proxying through the worker.
 */
signerRoutes.get('/envelopes/:envelopeId/attachments', async (c) => {
  try {
    await getAuthContext(c);
    const envelopeId = c.req.param('envelopeId')!;
    const records =
      ((await kv.get(EsignKeys.envelopeAttachments(envelopeId))) as Array<
        Record<string, unknown>
      >) ?? [];
    const enriched = await Promise.all(
      records.map(async (r) => ({
        ...r,
        url: await getAttachmentUrl(String(r.storage_path ?? '')),
      })),
    );
    return c.json({ attachments: enriched });
  } catch (err) {
    log.error('List attachments error:', err);
    const status = err instanceof AuthError ? err.statusCode : 500;
    return c.json(
      { error: err instanceof Error ? err.message : 'Failed to list attachments' },
      status,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// P3.5 — Signer attachment upload (public, token-scoped)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /signer/attachment
 *
 * Public endpoint a signer hits when filling an `attachment`-type field.
 * Authenticated by `access_token` only — same trust model as
 * `/signer/submit`.
 *
 * Request: multipart/form-data with:
 *   access_token (string)
 *   field_id     (string) — the attachment field this upload satisfies
 *   file         (File)   — the actual upload (PDF / image, ≤25MB)
 *
 * Response: { attachmentId, path, filename, size, mimeType, fieldId }
 *
 * Side effects:
 *   - File is stored in the ATTACHMENTS bucket under
 *     `${envelopeId}/${attachmentId}-${filename}`.
 *   - An attachment record is appended to the envelope's attachments
 *     index (KV) so the certificate renderer can list everything later.
 *   - The field's `value` is set to `attachment:${attachmentId}` so the
 *     completeness check on submit treats the field as filled.
 *   - Audit event `attachment_uploaded` is logged.
 */
signerRoutes.post('/signer/attachment', rateLimit('SIGNER_SUBMIT'), async (c) => {
  try {
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const accessToken =
      typeof body['access_token'] === 'string' ? (body['access_token'] as string) : '';
    const fieldId = typeof body['field_id'] === 'string' ? (body['field_id'] as string) : '';
    const file = body['file'];

    if (!accessToken) return c.json({ error: 'access_token required' }, 400);
    if (!fieldId) return c.json({ error: 'field_id required' }, 400);
    if (!(file instanceof File)) return c.json({ error: 'file required' }, 400);

    const signer = await getSignerByToken(accessToken);
    if (!signer) return c.json({ error: 'Invalid or expired access token' }, 404);
    if (signer.status === 'signed') return c.json({ error: 'Already signed' }, 409);

    // Confirm the field exists and is the attachment type assigned to this signer.
    const fields =
      ((await kv.get(EsignKeys.envelopeFields(signer.envelope_id))) as EsignField[]) ?? [];
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return c.json({ error: 'Field not found' }, 404);
    if (field.type !== 'attachment')
      return c.json({ error: 'Field is not an attachment field' }, 400);
    if (field.signer_id !== signer.id && field.signer_id !== signer.email) {
      return c.json({ error: 'Field is not assigned to this signer' }, 403);
    }

    await ensureStorageBuckets();

    const attachmentId = crypto.randomUUID();
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { path, error: uploadErr } = await uploadAttachment(
      signer.envelope_id,
      attachmentId,
      file.name,
      buffer,
      file.type,
    );
    if (uploadErr || !path) return c.json({ error: uploadErr ?? 'Upload failed' }, 400);

    // Record attachment in the per-envelope index so the certificate
    // renderer can iterate over them.
    const indexKey = EsignKeys.envelopeAttachments(signer.envelope_id);
    const existing = ((await kv.get(indexKey)) as Array<Record<string, unknown>>) ?? [];
    const record = {
      id: attachmentId,
      envelope_id: signer.envelope_id,
      field_id: fieldId,
      signer_id: signer.id,
      signer_email: signer.email,
      filename: file.name,
      mime_type: file.type,
      size_bytes: buffer.length,
      storage_path: path,
      hash: await calculateHash(buffer),
      uploaded_at: new Date().toISOString(),
    };
    await kv.set(indexKey, [...existing, record]);

    // Stamp the field value so completeness checks pass.
    await updateFieldValue(fieldId, `attachment:${attachmentId}`);

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'attachment_uploaded',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        fieldId,
        attachmentId,
        filename: record.filename,
        size: record.size_bytes,
        mimeType: record.mime_type,
      },
    });

    return c.json({
      success: true,
      attachmentId,
      path,
      filename: record.filename,
      size: record.size_bytes,
      mimeType: record.mime_type,
      fieldId,
    });
  } catch (err: unknown) {
    log.error('Attachment upload error:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Attachment upload failed' }, 500);
  }
});

/**
 * POST /signer/pause
 * Record an audit-trail entry that the signer paused signing and intends
 * to return later. Does not change envelope or signer status — the link
 * remains valid until envelope expiry. Public endpoint, token-scoped.
 */
signerRoutes.post('/signer/pause', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
    if (!accessToken) {
      return c.json({ error: 'access_token required' }, 400);
    }

    const signer = await getSignerByToken(accessToken);
    if (!signer) {
      return c.json({ error: 'Invalid or expired access token' }, 404);
    }

    const { ip, userAgent } = getRequestMetadata(c);
    const completedCount = Number.isFinite(body.completed_count as number)
      ? (body.completed_count as number)
      : undefined;
    const requiredCount = Number.isFinite(body.required_count as number)
      ? (body.required_count as number)
      : undefined;

    await logAuditEvent({
      envelopeId: signer.envelope_id,
      actorType: audActor(signer),
      actorId: signer.id,
      action: 'paused',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        signerId: signer.id,
        signerName: signer.name,
        completedCount,
        requiredCount,
      },
    });

    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('❌ Signer pause error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to record pause' },
      500,
    );
  }
});

export default signerRoutes;
