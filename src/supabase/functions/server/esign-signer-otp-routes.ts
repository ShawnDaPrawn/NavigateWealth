import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { rateLimit } from './esign-rate-limit.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { OtpVerifySchema } from './esign-validation.ts';
import { getRequestMetadata, audActor } from './esign-route-helpers.ts';
import { checkRateLimit, RATE_LIMITS } from './rateLimiter.ts';
import {
  getEnvelopeDetails,
  getSignerByToken,
  updateSignerStatus,
  logAuditEvent,
} from './esign-services.ts';
import {
  verifyOTP,
  markOTPVerified,
  clearOTP,
  generateAndStoreOTP,
  verifyAccessCode,
} from './esign-otp.ts';
import { createOTPEmail } from './esign-email-templates.ts';
import { sendEmail } from './email-service.ts';
import { sendOtpSms } from './sms-service.ts';

const log = createModuleLogger('esign-signer-otp-routes');

const app = new Hono();

/**
 * POST /signer/verify-otp
 * Verify OTP for signer (public endpoint)
 */
app.post('/signer/verify-otp', rateLimit('OTP_VERIFY'), async (c) => {
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
    const rateLimitResult = await checkRateLimit(
      signer.id,
      'esign_otp_verify',
      RATE_LIMITS.EMAIL_VERIFICATION,
    );

    if (!rateLimitResult.allowed) {
      return c.json({ error: rateLimitResult.reason }, 429);
    }

    // Verify access code if required
    if (access_code) {
      const accessCodeResult = await verifyAccessCode(signer.id, access_code as string);
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
app.post('/signer/resend-otp', rateLimit('OTP_SEND'), async (c) => {
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
    const rateLimitResult = await checkRateLimit(signer.id, 'esign_otp_resend', {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 3 per hour
      blockDurationMs: 60 * 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      return c.json({ error: rateLimitResult.reason }, 429);
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

export default app;
