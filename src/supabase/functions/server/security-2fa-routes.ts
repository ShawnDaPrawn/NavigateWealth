/**
 * Security 2FA + suspend routes (Phase 5 decomposition).
 * =======================================================
 *
 * Extracted verbatim from security.tsx. No logic changes.
 *
 * Routes owned here:
 *   POST /:userId/suspend         — suspend/unsuspend a user account (admin only)
 *   POST /:userId/2fa             — toggle two-factor authentication
 *   POST /:userId/2fa/send-code   — generate and email a 2FA verification code
 *   POST /:userId/2fa/verify-code — verify 2FA code; auto-suspends after 15 failures
 *
 * @module server/security-2fa-routes
 */
import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendEmail,
  sendTwoFactorEmail,
  createEmailTemplate,
  getFooterSettings,
} from './email-service.ts';
import { requireAuth, requirePrimaryAuth } from './auth-mw.ts';
import { SuspendUserSchema, Toggle2FASchema, Verify2FACodeSchema } from './security-validation.ts';
import { escapeHtml, formatZodError } from './shared-validation-utils.ts';
import {
  getSupabase,
  logSafeError,
  ensureSelfOrAdmin,
  ensureAdmin,
  ensureCanAdministerTarget,
  resolveDeliveryEmail,
  resolveSecurityContact,
  type UserSecurityStatus,
} from './security-shared.ts';
import { secureRandomDigits, constantTimeEqual } from './crypto-utils.ts';
import { readTokenSessionId } from './jwt-claims.ts';
import {
  clearSessionTwoFactor,
  recordSessionTwoFactor,
} from './repositories/two-factor-session-repository.ts';
import { checkRateLimit } from './rateLimiter.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const app = new Hono();
const log = createModuleLogger('security');

/**
 * Atomic ceiling on 2FA code guesses per account, in front of the per-code
 * (3) and cumulative (15) counters below. Those counters are read-modify-write
 * on KV, so a burst of concurrent requests all read the same count and every
 * one of them got to guess; the Postgres limiter serialises on an advisory lock
 * and cannot be raced. Generous enough that a person mistyping never meets it.
 */
const TWO_FACTOR_VERIFY_LIMIT = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
};

/** The Bearer token on this request — already verified by the route's guard. */
function bearerToken(c: Context): string | undefined {
  return c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
}

/**
 * Only the account holder may request or answer their own 2FA challenge.
 *
 * These used `ensureSelfOrAdmin`, which let an admin trigger codes to a
 * client's inbox and submit guesses against them. A verification only means
 * something for the session that performed it, and an admin's session is not
 * the client's.
 */
function ensureSelf(c: Context, targetUserId: string): Response | null {
  return c.get('userId') === targetUserId
    ? null
    : c.json({ success: false, error: 'Forbidden' }, 403);
}

/**
 * Tell the account holder their second factor was switched off. Best-effort:
 * the change has already been made, and a mail outage must not undo it or
 * report it as failed. The notice is the account holder's one chance to learn
 * that somebody with their session did this.
 */
async function sendTwoFactorDisabledNotice(userId: string, byAdmin: boolean): Promise<void> {
  try {
    const { data } = await getSupabase().auth.admin.getUserById(userId);
    const { email, firstName } = await resolveSecurityContact(
      userId,
      data?.user?.email,
      data?.user?.user_metadata,
    );
    if (!email) return;
    const footerSettings = await getFooterSettings();
    const source = byAdmin ? 'by a Navigate Wealth administrator' : 'from your account';
    const html = createEmailTemplate(
      `
        <p>Hello ${escapeHtml(firstName)},</p>
        <p>Two-factor authentication was just <strong>turned off</strong> ${source}.</p>
        <p style="color: #d97706; background-color: #fffbeb; padding: 12px; border-radius: 6px; border: 1px solid #fcd34d;">
          <strong>Didn't do this?</strong> Change your password and contact Navigate Wealth support immediately.
        </p>
      `,
      {
        title: 'Security Notice',
        subtitle: 'Two-factor authentication disabled',
        greeting: '',
        footerSettings,
      },
    );
    await sendEmail({
      to: email,
      subject: 'Navigate Wealth security notice: two-factor authentication turned off',
      html,
      text: `Two-factor authentication was just turned off ${source}. If this wasn't you, change your password and contact Navigate Wealth support immediately.`,
    });
  } catch (error) {
    log.error('Could not send the 2FA-disabled notice', { error: String(error) });
  }
}

/**
 * POST /security/:userId/suspend
 * Suspend a user account (admin only)
 */
app.post('/:userId/suspend', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const denied = ensureAdmin(c);
    if (denied) return denied;
    // An admin cannot suspend a super-admin (or lift a super-admin's suspension).
    const deniedTarget = await ensureCanAdministerTarget(c, userId);
    if (deniedTarget) return deniedTarget;
    const body = await c.req.json();

    const parsed = SuspendUserSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const { suspended, reason } = parsed.data;
    // Attributed to the VERIFIED caller. The body's `adminId` is still accepted
    // for compatibility but no longer recorded: a request that said who made it
    // could say anyone.
    const adminId = c.get('userId') as string;

    log.info(
      `${suspended ? '🔒' : '🔓'} ${suspended ? 'Suspending' : 'Unsuspending'} user: ${userId}`,
    );

    // Get or create security status
    const securityStatus: UserSecurityStatus = (await kv.get(`security:${userId}`)) || {
      suspended: false,
      twoFactorEnabled: false,
    };

    // Update suspension status
    securityStatus.suspended = suspended;
    if (suspended) {
      securityStatus.suspendedAt = new Date().toISOString();
      securityStatus.suspendedBy = adminId;
      securityStatus.suspendedReason = reason || 'No reason provided';
    } else {
      delete securityStatus.suspendedAt;
      delete securityStatus.suspendedBy;
      delete securityStatus.suspendedReason;
      // Reset cumulative 2FA failure counter when admin unsuspends —
      // if the suspension was caused by 2FA failures, the client
      // should get a clean slate.
      await kv.del(`2fa_failures:${userId}`);
    }

    await kv.set(`security:${userId}`, securityStatus);

    // Log activity
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: suspended ? 'account_suspended' : 'account_unsuspended',
      timestamp,
      success: true,
      metadata: { adminId, reason },
    });

    await AdminAuditService.record({
      actorId: adminId,
      actorRole: c.get('userRole') as string,
      category: 'security',
      action: suspended ? 'account_suspended' : 'account_unsuspended',
      summary: suspended ? 'Suspended an account' : 'Lifted an account suspension',
      severity: 'warning',
      entityType: 'user',
      entityId: userId,
    });

    log.info(`✅ User ${suspended ? 'suspended' : 'unsuspended'} successfully`);

    return c.json({
      success: true,
      status: securityStatus,
      message: `Account ${suspended ? 'suspended' : 'unsuspended'} successfully`,
    });
  } catch (error) {
    const errorMsg = logSafeError('Error updating suspension status', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/2fa
 * Toggle two-factor authentication
 */
app.post('/:userId/2fa', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;
    // An admin switching off a super-admin's second factor is the first step of
    // taking the account over.
    const deniedTarget = await ensureCanAdministerTarget(c, userId);
    if (deniedTarget) return deniedTarget;
    const body = await c.req.json();

    const parsed = Toggle2FASchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const { enabled } = parsed.data;
    const method = (body as Record<string, unknown>).method;

    log.info(`🔑 ${enabled ? 'Enabling' : 'Disabling'} 2FA for user: ${userId}`);

    const securityStatus: UserSecurityStatus = (await kv.get(`security:${userId}`)) || {
      suspended: false,
      twoFactorEnabled: false,
    };

    const wasEnabled = securityStatus.twoFactorEnabled === true;
    securityStatus.twoFactorEnabled = enabled;
    await kv.set(`security:${userId}`, securityStatus);

    const actorId = c.get('userId') as string;
    const byAdmin = actorId !== userId;
    if (!enabled) {
      // Verified sessions are meaningless once the factor is off; clearing them
      // means switching it back on starts every session unverified.
      await clearSessionTwoFactor(userId).catch((error) =>
        log.warn('Could not clear 2FA sessions', { error: String(error) }),
      );
      if (wasEnabled) await sendTwoFactorDisabledNotice(userId, byAdmin);
    }
    if (byAdmin) {
      await AdminAuditService.record({
        actorId,
        actorRole: c.get('userRole') as string,
        category: 'security',
        action: enabled ? 'two_factor_enabled_by_admin' : 'two_factor_disabled_by_admin',
        summary: `${enabled ? 'Enabled' : 'Disabled'} two-factor authentication on another account`,
        severity: enabled ? 'info' : 'warning',
        entityType: 'user',
        entityId: userId,
      });
    }

    // Log activity
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: enabled ? '2fa_enabled' : '2fa_disabled',
      timestamp,
      success: true,
      metadata: { method },
    });

    log.info(`✅ 2FA ${enabled ? 'enabled' : 'disabled'} successfully`);

    return c.json({
      success: true,
      status: securityStatus,
    });
  } catch (error) {
    const errorMsg = logSafeError('Error toggling 2FA', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/2fa/send-code
 * Generate and send 2FA verification code via email
 */
app.post('/:userId/2fa/send-code', requirePrimaryAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const denied = ensureSelf(c, userId);
    if (denied) return denied;

    log.info(`📧 Generating 2FA code for user: ${userId}`);

    // Get user details from Supabase
    const { data: user, error: getUserError } = await getSupabase().auth.admin.getUserById(userId);

    if (getUserError || !user) {
      log.error('❌ User not found:', getUserError);
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Deliver to the client's contact inbox, not necessarily their sign-in
    // address: a client enrolled on a household mailbox signs in with a derived
    // alias, and a login code that never arrives is a lockout.
    //
    // Never to an address named in the request. This used to fall back to a
    // body-supplied `email`, and a second factor delivered wherever the caller
    // asks is no second factor.
    const targetEmail = await resolveDeliveryEmail(userId, user.user?.email);

    if (!targetEmail) {
      log.error('❌ No email address found for user');
      return c.json({ success: false, error: 'No email address found for user' }, 400);
    }

    // Generate 6-digit code.
    //
    // CSPRNG, not Math.random(). `Math.random()` is a fast non-cryptographic
    // PRNG whose internal state is recoverable from a handful of observed
    // outputs, after which every subsequent code is predictable (CWE-338) —
    // and this is the code that stands between a stolen password and a client's
    // account. `secureRandomDigits` draws from crypto.getRandomValues with
    // rejection sampling, so the digits are uniform and unpredictable.
    //
    // The e-sign OTP path (esign-otp.ts) has always used the CSPRNG helper;
    // this login path was written before crypto-utils.ts existed and was the
    // last Math.random()-derived secret left in the server.
    const code = secureRandomDigits(6);

    // Store code with expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await kv.set(`2fa:${userId}:code`, {
      code,
      expiresAt,
      attempts: 0,
    });

    log.info(`🔑 Generated 2FA code for user ${userId}, expires at ${expiresAt}`);

    // Use the existing static import here. The dynamic import path has been
    // failing in production edge runtime, which blocks the login flow for
    // users who have email-based 2FA enabled.
    await sendTwoFactorEmail(targetEmail, code);

    // Log activity
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: '2fa_code_sent',
      timestamp,
      success: true,
    });

    log.info(`✅ 2FA code sent successfully to ${targetEmail}`);

    return c.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    const errorMsg = logSafeError('Error sending 2FA code', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/2fa/verify-code
 * Verify 2FA code
 *
 * Tracks cumulative failed attempts across codes. After 15 cumulative
 * failures the account is automatically suspended and alert emails are
 * sent to both the client and the admin team.
 *
 * On success the verifying SESSION is recorded (see
 * repositories/two-factor-session-repository.ts); that, not the account-wide
 * `last2faVerifiedAt` timestamp, is what unlocks the rest of the API.
 */
app.post('/:userId/2fa/verify-code', requirePrimaryAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const denied = ensureSelf(c, userId);
    if (denied) return denied;
    const body = await c.req.json();

    const parsed = Verify2FACodeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const { code } = parsed.data;

    log.info(`🔍 Verifying 2FA code for user: ${userId}`);

    // ── Check if the account is already suspended ────────────────
    const securityStatus: UserSecurityStatus = (await kv.get(`security:${userId}`)) || {
      suspended: false,
      twoFactorEnabled: false,
    };

    if (securityStatus.suspended) {
      log.info('❌ Account is suspended — rejecting 2FA verification');
      return c.json(
        {
          success: false,
          error: 'Your account has been suspended. Please contact Navigate Wealth support.',
        },
        403,
      );
    }

    // ── Atomic guess ceiling (fails closed) ──────────────────────
    const limit = await checkRateLimit(userId, '2fa_verify', TWO_FACTOR_VERIFY_LIMIT);
    if (!limit.allowed) {
      return c.json(
        {
          success: false,
          error: 'Too many verification attempts. Please wait and request a new code.',
        },
        429,
      );
    }

    // ── Get stored code ──────────────────────────────────────────
    const storedData = await kv.get(`2fa:${userId}:code`);

    if (!storedData) {
      log.info('❌ No 2FA code found or code expired');
      return c.json(
        { success: false, error: 'Invalid or expired code. Please request a new one.' },
        400,
      );
    }

    // Check if expired
    if (new Date(storedData.expiresAt) < new Date()) {
      log.info('❌ 2FA code expired');
      await kv.del(`2fa:${userId}:code`);
      return c.json({ success: false, error: 'Code has expired. Please request a new one.' }, 400);
    }

    // Check per-code attempts (max 3 per individual code)
    if (storedData.attempts >= 3) {
      log.info('❌ Too many failed attempts for this code');
      await kv.del(`2fa:${userId}:code`);
      return c.json(
        { success: false, error: 'Too many failed attempts. Please request a new code.' },
        400,
      );
    }

    // ── Verify code ──────────────────────────────────────────────
    // Constant-time compare: `!==` returns as soon as two characters differ,
    // so its timing leaks how many leading digits were correct — enough to
    // recover a code digit-by-digit rather than guessing all 10^6 (CWE-208).
    // Same helper every other secret comparison in the server uses.
    if (!constantTimeEqual(String(storedData.code ?? ''), String(code ?? ''))) {
      log.info('❌ Invalid 2FA code');

      // Increment per-code attempts
      await kv.set(`2fa:${userId}:code`, {
        ...storedData,
        attempts: storedData.attempts + 1,
      });

      // ── Increment cumulative failure counter ───────────────────
      const failureRecord = (await kv.get(`2fa_failures:${userId}`)) || { count: 0 };
      const newCount = failureRecord.count + 1;
      await kv.set(`2fa_failures:${userId}`, {
        count: newCount,
        lastFailedAt: new Date().toISOString(),
      });

      // Log failed attempt
      const timestamp = new Date().toISOString();
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await kv.set(`activity:${userId}:${logId}`, {
        id: logId,
        userId,
        type: '2fa_verification_failed',
        timestamp,
        success: false,
        metadata: { cumulativeFailures: newCount },
      });

      // ── 15 cumulative failures → suspend + alert emails ────────
      const MAX_CUMULATIVE_FAILURES = 15;
      if (newCount >= MAX_CUMULATIVE_FAILURES) {
        log.info(
          `🚨 User ${userId} reached ${MAX_CUMULATIVE_FAILURES} cumulative 2FA failures — suspending account`,
        );

        // Suspend the account (multi-entry consistency: security + profile)
        securityStatus.suspended = true;
        securityStatus.suspendedAt = new Date().toISOString();
        securityStatus.suspendedBy = 'system';
        securityStatus.suspendedReason = `Automatic suspension: ${MAX_CUMULATIVE_FAILURES} failed two-factor authentication attempts`;
        await kv.set(`security:${userId}`, securityStatus);

        // Also update the profile entry if it exists (§12.3 multi-entry consistency)
        const profileKeys = await kv.getByPrefix(`user_profile:${userId}:`);
        if (profileKeys && profileKeys.length > 0) {
          for (const profile of profileKeys) {
            if (profile && typeof profile === 'object' && 'accountStatus' in profile) {
              (profile as Record<string, unknown>).accountStatus = 'suspended';
            }
          }
          // Re-persist — we need the key names; getByPrefix returns values only,
          // so we target the known personal_info facet.
          const personalInfo = await kv.get(`user_profile:${userId}:personal_info`);
          if (personalInfo) {
            personalInfo.accountStatus = 'suspended';
            await kv.set(`user_profile:${userId}:personal_info`, personalInfo);
          }
        }

        // Delete the current code to prevent further attempts
        await kv.del(`2fa:${userId}:code`);

        // Log the suspension activity
        const suspLogId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await kv.set(`activity:${userId}:${suspLogId}`, {
          id: suspLogId,
          userId,
          type: 'account_suspended',
          timestamp: new Date().toISOString(),
          success: true,
          metadata: {
            reason: securityStatus.suspendedReason,
            trigger: '2fa_cumulative_failures',
          },
        });

        // ── Send alert emails (non-blocking) ─────────────────────
        try {
          const { data: supabaseUser } = await getSupabase().auth.admin.getUserById(userId);
          // Profile first — `user_metadata` is the signup snapshot, so greeting
          // from it addresses a renamed client by the wrong name.
          const { email: clientEmail, firstName: clientName } = await resolveSecurityContact(
            userId,
            supabaseUser?.user?.email,
            supabaseUser?.user?.user_metadata,
          );
          const footerSettings = await getFooterSettings();

          // 1) Email to client — security warning
          if (clientEmail) {
            const clientHtml = createEmailTemplate(
              `
                <p>Hello ${clientName},</p>
                <p>We are writing to inform you that your Navigate Wealth account has been <strong>temporarily suspended</strong> due to repeated unsuccessful two-factor authentication attempts.</p>
                <p>This is a precautionary security measure to protect your account from unauthorised access.</p>
                <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #fecaca;">
                  <p style="margin: 0; color: #991b1b; font-weight: 600;">What does this mean?</p>
                  <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #7f1d1d;">
                    <li>You will not be able to log in until your account is reviewed</li>
                    <li>Your financial data remains secure and unchanged</li>
                    <li>Our team has been notified and will investigate</li>
                  </ul>
                </div>
                <p>If this was you attempting to log in, please contact our support team to have your account reinstated. If you did not make these attempts, your account is now protected from further unauthorised access.</p>
              `,
              {
                title: 'Account Security Alert',
                subtitle: 'Your account has been temporarily suspended',
                greeting: '',
                buttonUrl: 'https://www.navigatewealth.co/contact',
                buttonLabel: 'Contact Support',
                footerNote:
                  'If you have any concerns, contact us immediately at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672025" style="color: #6d28d9;">012 667 2025</a>.',
                footerSettings,
              },
            );
            await sendEmail({
              to: clientEmail,
              subject: 'Security Alert: Your Navigate Wealth Account Has Been Suspended',
              html: clientHtml,
              text: `Security Alert — Your Navigate Wealth account has been temporarily suspended due to ${MAX_CUMULATIVE_FAILURES} failed two-factor authentication attempts. This is a security precaution. Please contact support at info@navigatewealth.co or call 012 667 2025 to reinstate your account.`,
            });
            log.info('✅ Client suspension alert email sent');
          }

          // 2) Email to admin — incident notification
          const adminEmail = 'info@navigatewealth.co';
          const adminHtml = createEmailTemplate(
            `
              <p>A client account has been <strong>automatically suspended</strong> due to excessive failed two-factor authentication attempts.</p>
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 4px 8px; color: #6b7280; font-size: 14px;">User ID</td><td style="padding: 4px 8px; font-weight: 600; font-size: 14px;">${userId}</td></tr>
                  <tr><td style="padding: 4px 8px; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 4px 8px; font-weight: 600; font-size: 14px;">${clientEmail || 'Unknown'}</td></tr>
                  <tr><td style="padding: 4px 8px; color: #6b7280; font-size: 14px;">Name</td><td style="padding: 4px 8px; font-weight: 600; font-size: 14px;">${clientName}</td></tr>
                  <tr><td style="padding: 4px 8px; color: #6b7280; font-size: 14px;">Failed Attempts</td><td style="padding: 4px 8px; font-weight: 600; font-size: 14px; color: #dc2626;">${MAX_CUMULATIVE_FAILURES}</td></tr>
                  <tr><td style="padding: 4px 8px; color: #6b7280; font-size: 14px;">Suspended At</td><td style="padding: 4px 8px; font-weight: 600; font-size: 14px;">${new Date().toLocaleString('en-ZA')}</td></tr>
                </table>
              </div>
              <p>Please review this incident in the Admin Panel and contact the client if appropriate. The account can be unsuspended from the Client Management module.</p>
            `,
            {
              title: '2FA Security Incident',
              subtitle: 'Automatic account suspension triggered',
              greeting: '',
              footerSettings,
            },
          );
          await sendEmail({
            to: adminEmail,
            subject: `🚨 Security Alert: Account Suspended — ${clientEmail || userId}`,
            html: adminHtml,
            text: `Security Alert — Account ${userId} (${clientEmail || 'unknown email'}) has been automatically suspended after ${MAX_CUMULATIVE_FAILURES} failed 2FA attempts. Please review in the Admin Panel.`,
          });
          log.info('✅ Admin suspension alert email sent');
        } catch (emailErr) {
          // Email failures must not block the suspension response
          log.error('⚠️ Failed to send 2FA suspension alert emails:', emailErr);
        }

        return c.json(
          {
            success: false,
            error:
              'Your account has been suspended due to too many failed verification attempts. Please contact Navigate Wealth support.',
            suspended: true,
          },
          403,
        );
      }

      const perCodeRemaining = 3 - storedData.attempts - 1;
      return c.json(
        {
          success: false,
          error: `Invalid code. ${perCodeRemaining} attempt${perCodeRemaining !== 1 ? 's' : ''} remaining for this code.`,
        },
        400,
      );
    }

    // ── Code is valid ────────────────────────────────────────────
    await kv.del(`2fa:${userId}:code`);

    // Reset cumulative failure counter on success
    await kv.del(`2fa_failures:${userId}`);

    // Unlock THIS sign-in — the one whose token presented the code. The gate in
    // auth-mw checks the verification against the session, so another sign-in
    // (an attacker's, with a stolen password) still has to pass its own.
    const sessionId = readTokenSessionId(bearerToken(c));
    if (sessionId) {
      await recordSessionTwoFactor(userId, sessionId);
    } else {
      log.warn('2FA verified on a token with no session id; nothing to unlock');
    }

    // Kept for display ("last verified") only; it no longer grants access.
    securityStatus.last2faVerifiedAt = new Date().toISOString();
    await kv.set(`security:${userId}`, securityStatus);

    // Log successful verification
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: '2fa_verified',
      timestamp,
      success: true,
    });

    log.info(`✅ 2FA code verified successfully for user ${userId}`);

    return c.json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error) {
    const errorMsg = logSafeError('Error verifying 2FA code', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default app;
