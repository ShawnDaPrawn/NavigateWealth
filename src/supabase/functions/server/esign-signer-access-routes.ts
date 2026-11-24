import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { SignerValidateSchema } from './esign-validation.ts';
import { getRequestMetadata, FieldRecord } from './esign-route-helpers.ts';
import { checkRateLimit } from './rateLimiter.ts';
import { getEnvelopeDetails, getSignerByToken, logAuditEvent } from './esign-services.ts';
import { getDocumentUrl } from './esign-storage.ts';
import { generateAndStoreOTP, hasRecentOTP, OTP_VALID_MINUTES } from './esign-otp.ts';
import { createOTPEmail } from './esign-email-templates.ts';
import { getConsentByVersion } from './esign-consent-registry.ts';
import { getFirmBranding, toPublicBranding } from './esign-branding-service.ts';
import { sendEmail } from './email-service.ts';
import { sendOtpSms } from './sms-service.ts';
import type { Context } from 'npm:hono';
import type { EsignEnvelope, EsignSigner } from './esign-types.ts';
import {
  assertActiveSigningState,
  getMissingSignerFactors,
  isSignerTurn,
} from './esign-signer-guards.ts';

const log = createModuleLogger('esign-signer-access-routes');

const app = new Hono();

app.get('/sign-by-token/:token', async (c) => {
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

    try {
      assertActiveSigningState(envelope, signer);
    } catch (stateError) {
      return c.json(
        { error: stateError instanceof Error ? stateError.message : 'Unavailable' },
        410,
      );
    }
    const missingFactors = getMissingSignerFactors(envelope, signer);
    if (missingFactors.length > 0) {
      return c.json({
        challenge: {
          envelope_id: envelope.id,
          envelope_title: envelope.title,
          signer_id: signer.id,
          signer_email: signer.email,
          missing_factors: missingFactors,
        },
      });
    }

    // Get document URL
    const documentUrl = envelope.document
      ? await getDocumentUrl(envelope.document.storage_path)
      : null;

    // Filter fields for this signer
    const allFields = Array.isArray(envelope.fields)
      ? (envelope.fields as unknown as FieldRecord[])
      : [];
    const signerFields = allFields.filter((f: FieldRecord) => f.signer_id === signer.id);

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

/** A code issued this recently is reused rather than replaced on re-open. */
const AUTO_OTP_REUSE_MS = 60 * 1000;

/**
 * Email (and, for opted-in signers, text) a fresh verification code when the
 * signer opens their link. Best-effort: a failure is logged and the signer can
 * still press "resend".
 */
async function autoSendSignerOtp(
  c: Context,
  envelope: Pick<EsignEnvelope, 'id' | 'title'>,
  signer: Pick<EsignSigner, 'id' | 'name' | 'email' | 'phone' | 'sms_opt_in'>,
): Promise<void> {
  try {
    if (await hasRecentOTP(signer.id, AUTO_OTP_REUSE_MS)) return;

    const { otp, error: otpError } = await generateAndStoreOTP(signer.id);
    if (otpError || !otp) {
      log.warn('Failed to generate auto-sent OTP:', { error: String(otpError) });
      return;
    }

    const emailContent = createOTPEmail({
      signerName: signer.name,
      otp,
      envelopeTitle: envelope.title,
      expiresInMinutes: OTP_VALID_MINUTES,
    });
    const emailSent = await sendEmail({
      kind: 'esign_code',
      to: signer.email,
      subject: `Verification Code: ${envelope.title}`,
      html: emailContent.html,
      text: emailContent.text,
    });

    let smsDelivered = false;
    if (signer.sms_opt_in && signer.phone) {
      try {
        smsDelivered = (await sendOtpSms({ to: signer.phone, otp, envelopeTitle: envelope.title }))
          .delivered;
      } catch (smsErr) {
        log.warn('Auto-sent OTP SMS failed:', { error: String(smsErr) });
      }
    }

    const { ip, userAgent } = getRequestMetadata(c);
    await logAuditEvent({
      envelopeId: envelope.id,
      actorType: 'system',
      action: 'otp_sent',
      email: signer.email,
      ip,
      userAgent,
      metadata: {
        signerId: signer.id,
        note: 'Auto-sent on access',
        channels: { email: !!emailSent, sms: smsDelivered },
      },
    });
  } catch (err) {
    log.warn('Failed to auto-send OTP:', { error: String(err) });
  }
}

/**
 * POST /signer/validate
 * Validate access token and get signer session data (public endpoint)
 */
app.post('/signer/validate', rateLimit('SIGNER_ACCESS'), async (c) => {
  try {
    const body = await c.req.json();
    const parsed = SignerValidateSchema.safeParse({ token: body.access_token });
    if (!parsed.success) {
      return c.json({ error: 'access_token required', ...formatZodError(parsed.error) }, 400);
    }
    const access_token = parsed.data.token;

    // Rate limit check (IP based to prevent scanning)
    const { ip } = getRequestMetadata(c);
    const rateLimitResult = await checkRateLimit(ip, 'esign_token_validate', {
      maxAttempts: 60, // 1 per minute on average
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 15 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      return c.json({ error: rateLimitResult.reason }, 429);
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

    try {
      assertActiveSigningState(envelope, signer);
    } catch (stateError) {
      return c.json(
        { error: stateError instanceof Error ? stateError.message : 'Document unavailable' },
        410,
      );
    }

    const allSigners = envelope.signers || [];
    const sortedAllSigners = [...allSigners].sort((a, b) => (a.order || 0) - (b.order || 0));
    const signerOrder = signer.order || 1;
    const isTurn = isSignerTurn(envelope, signer);
    const signersSummary = sortedAllSigners.map((s) => ({
      order: s.order,
      name: s.name,
      role: s.role,
      status: s.status,
      is_current: s.id === signer.id,
    }));
    const missingFactors = getMissingSignerFactors(envelope, signer);
    // Opening the link sends the code — the signer should never have to ask
    // for one. This used to sit at the end of the handler, AFTER the early
    // return below, so for exactly the signers who needed a code it never ran
    // and every signer had to press "resend".
    if (missingFactors.includes('otp') && isTurn) {
      await autoSendSignerOtp(c, envelope, signer);
    }
    if (missingFactors.length > 0) {
      return c.json({
        envelope_id: envelope.id,
        envelope_title: envelope.title,
        envelope_status: envelope.status,
        signer_id: signer.id,
        signer_name: signer.name,
        signer_email: signer.email,
        signer_status: signer.status,
        signer_order: signerOrder,
        otp_required: signer.requires_otp,
        otp_verified: signer.otp_verified,
        access_code_required: !!signer.access_code,
        missing_factors: missingFactors,
        is_turn: isTurn,
        all_signers: signersSummary,
        challenge_required: true,
      });
    }

    // Get document URL
    const documentUrl = envelope.document
      ? await getDocumentUrl(envelope.document.storage_path)
      : null;

    // Filter fields for this signer
    const allFields2 = Array.isArray(envelope.fields)
      ? (envelope.fields as unknown as FieldRecord[])
      : [];
    const signerFields = allFields2.filter((f: FieldRecord) => f.signer_id === signer.id);

    // What signers BEFORE this one have already completed, so a later signer
    // sees the document as it stands — the original PDF alone hid the
    // earlier entries until the final copy. Read-only and only from signers
    // who have finished; geometry and the value, nothing else.
    const finishedSignerIds = new Set(
      (Array.isArray(envelope.signers)
        ? (envelope.signers as unknown as Array<Record<string, unknown>>)
        : []
      )
        .filter((s) => s.status === 'signed' && s.id !== signer.id)
        .map((s) => s.id as string),
    );
    const completedFields = allFields2
      .filter(
        (f: FieldRecord) =>
          finishedSignerIds.has(f.signer_id as string) &&
          // An attachment's value is a storage marker (`attachment:<id>`), not
          // document content; the signed PDF skips it, so the screen does too.
          f.type !== 'attachment' &&
          typeof f.value === 'string' &&
          (f.value as string).trim() !== '',
      )
      .map((f: FieldRecord) => ({
        id: f.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        value: f.value,
      }));

    // Determine if it's this signer's turn based on signing mode
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
      log.warn('Failed to load signer profile (non-critical):', { error: String(profileErr) });
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
      log.warn('Failed to load firm branding for signer (non-critical):', {
        error: String(brandErr),
      });
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
      completed_fields: completedFields,
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

export default app;
