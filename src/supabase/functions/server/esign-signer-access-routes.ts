import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { getAuthContext, AuthError } from './auth-mw.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { SignerValidateSchema } from './esign-validation.ts';
import { getRequestMetadata, SignerRecord, FieldRecord } from './esign-route-helpers.ts';
import { checkRateLimit } from './rateLimiter.ts';
import { getEnvelopeDetails, getSignerByToken, logAuditEvent } from './esign-services.ts';
import { getDocumentUrl } from './esign-storage.ts';
import { verifyAccessCode, generateAndStoreOTP } from './esign-otp.ts';
import { createOTPEmail } from './esign-email-templates.ts';
import { getConsentByVersion } from './esign-consent-registry.ts';
import { getFirmBranding, toPublicBranding } from './esign-branding-service.ts';
import { sendEmail } from './email-service.ts';

const log = createModuleLogger('esign-signer-access-routes');

const app = new Hono();

app.get('/sign-by-token/:token', async (c) => {
  try {
    const token = c.req.param('token');

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
    const allFields = Array.isArray(envelope.fields) ? (envelope.fields as FieldRecord[]) : [];
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
    const allFields2 = Array.isArray(envelope.fields) ? (envelope.fields as FieldRecord[]) : [];
    const signerFields = allFields2.filter((f: FieldRecord) => f.signer_id === signer.id);

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
      log.warn('Failed to load signer profile (non-critical):', profileErr);
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
          const { ip: auditIp, userAgent } = getRequestMetadata(c);
          await logAuditEvent({
            envelopeId: envelope.id,
            actorType: 'system',
            action: 'otp_sent',
            email: signer.email,
            ip: auditIp,
            userAgent,
            metadata: { signerId: signer.id, note: 'Auto-sent on access' },
          });

          log.info(`✅ Auto-sent OTP to ${signer.email} for signer ${signer.id}`);
        }
      } catch (err) {
        log.warn('❌ Failed to auto-send OTP:', err);
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
      log.warn('Failed to load firm branding for signer (non-critical):', brandErr);
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

export default app;
