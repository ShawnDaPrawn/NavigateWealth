/**
 * Security password + status routes (Phase 5 decomposition).
 * ===========================================================
 *
 * Extracted verbatim from security.tsx. No logic changes.
 *
 * Routes owned here:
 *   POST /:userId/password  — change user password
 *   GET  /:userId/status    — get user security status (suspension, 2FA, etc.)
 *
 * @module server/security-password-routes
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { sendEmail, createEmailTemplate, getFooterSettings } from './email-service.ts';
import { requireAuth, requirePrimaryAuth } from './auth-mw.ts';
import { revokeSessionsAfterCredentialChange } from './session-revocation.ts';
import { ChangePasswordSchema } from './security-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  getSupabase,
  logSafeError,
  ensureSelfOrAdmin,
  isAdminRole,
  verifyCurrentPassword,
  getPendingEmailChange,
  getEmailChangeSummary,
  resolveSecurityContact,
  type UserSecurityStatus,
} from './security-shared.ts';

const app = new Hono();
const log = createModuleLogger('security');

/**
 * POST /security/:userId/password
 * Change user password
 */
app.post('/:userId/password', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const authUserId = c.get('userId') as string | undefined;
    const userRole = c.get('userRole') as string | undefined;
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;
    const body = await c.req.json();

    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const { currentPassword, newPassword, emailPassword } = parsed.data;

    log.info(`🔐 Changing password for user: ${userId}`);

    // Verify current password and update to new password using Supabase Auth
    const { data: user, error: getUserError } = await getSupabase().auth.admin.getUserById(userId);

    if (getUserError || !user) {
      log.error('❌ User not found:', getUserError);
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const isAdminReset = isAdminRole(userRole) && authUserId !== userId;

    if (!isAdminReset) {
      const userEmail = user.user.email;
      if (!userEmail) {
        return c.json({ success: false, error: 'User email is missing' }, 400);
      }

      const currentPasswordValid = await verifyCurrentPassword(userEmail, currentPassword);
      if (!currentPasswordValid) {
        return c.json({ success: false, error: 'Current password is incorrect' }, 400);
      }

      if (currentPassword === newPassword) {
        return c.json(
          { success: false, error: 'New password cannot be the same as your current password' },
          400,
        );
      }
    }

    // Update password using admin API
    const { data: _data, error } = await getSupabase().auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      log.error('❌ Password update failed:', error);
      return c.json({ success: false, error: error.message }, 500);
    }

    // Every session that predates this change is now invalid (see
    // session-revocation.ts). Runs BEFORE the notification email so a failure
    // to send mail can never leave a rotated credential with live sessions
    // behind it.
    //
    // Self-service change: the caller is the account holder, so their own
    // token revokes the OTHER sessions at GoTrue and they stay signed in here.
    // Admin reset: no token for the target user exists, so only the watermark
    // is written — which is exactly the case the watermark was added for.
    const callerToken = isAdminReset
      ? undefined
      : c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    const revocation = await revokeSessionsAfterCredentialChange({
      userId,
      actor: isAdminReset ? 'admin' : 'self',
      accessToken: callerToken,
      scope: 'others',
    });

    // Notify the account holder.
    //
    // WHAT THIS DELIBERATELY NO LONGER DOES
    // -------------------------------------
    // The previous version of this branch put the new password, in plaintext,
    // into the body of an email — and into the SendGrid/SES account that
    // relayed it, the recipient's mailbox, and every backup of both. A
    // credential that has been emailed is a credential that has been
    // published: the reset was supposed to end an exposure, not create a
    // durable second copy of the replacement.
    //
    // It sends a single-use recovery LINK instead. The link is minted by
    // GoTrue, expires on the project's configured OTP lifetime, and is spent
    // the first time it is opened, so an intercepted message is worth far less
    // than an intercepted password — and the administrator performing the
    // reset never learns the credential either.
    //
    // `newPassword` is still what the account is set to; it is simply never
    // transmitted. An admin reset therefore hands the user a way back in
    // rather than a secret to memorise.
    if (emailPassword && user.user.email) {
      try {
        // Deliver to the contact inbox — a client on a household mailbox signs
        // in with a derived alias, and a link that never arrives is a lockout.
        // `Username` below stays the sign-in address: that is the thing the
        // reader has to type, and it is the point of the message.
        const { email: deliverTo, firstName } = await resolveSecurityContact(
          userId,
          user.user.email,
          user.user.user_metadata,
        );
        log.info('📧 Sending password reset notification');

        const footerSettings = await getFooterSettings();

        const origin = c.req.header('origin') || c.req.header('referer') || '';
        const redirectBase = origin ? origin.replace(/\/+$/, '') : 'https://www.navigatewealth.co';

        // Single-use recovery link, minted against the sign-in address (NOT
        // the delivery alias — the link authenticates the account, and the
        // account is keyed on user.user.email).
        const { data: linkData, error: linkError } = await getSupabase().auth.admin.generateLink({
          type: 'recovery',
          email: user.user.email,
          options: { redirectTo: `${redirectBase}/reset-password` },
        });

        const actionLink = linkData?.properties?.action_link;
        if (linkError || !actionLink) {
          // No link means no usable email. Say so in the log and send nothing,
          // rather than falling back to mailing the password — the fallback
          // this change exists to remove.
          log.error('❌ Could not generate recovery link; no reset email sent', linkError);
        } else {
          const title = 'Password Reset Notification';
          const subtitle = 'Your account password has been reset by an administrator';
          const greeting = `Hello ${firstName},`;

          const bodyContent = `
          <p>Your password for the Navigate Wealth Admin Panel has been reset by an administrator.</p>
          <p>For your security we do not send passwords by email. Use the button below to choose a new password — the link can only be used once, and it expires shortly.</p>
          <p><strong>Username:</strong> ${user.user.email}</p>
          <p style="color: #d97706; background-color: #fffbeb; padding: 12px; border-radius: 6px; border: 1px solid #fcd34d;">
            <strong>Didn't expect this?</strong> Contact us immediately — someone may have requested a reset on your account.
          </p>
        `;

          const emailHtml = createEmailTemplate(bodyContent, {
            title,
            subtitle,
            greeting,
            buttonUrl: actionLink,
            buttonLabel: 'Choose a new password',
            footerSettings,
          });

          const textBody = `
Password Reset Notification
Your account password has been reset by an administrator.

Username: ${user.user.email}

For your security we do not send passwords by email. Choose a new password here
(single use, expires shortly):

${actionLink}

Didn't expect this? Contact us immediately.
          `.trim();

          await sendEmail({
            to: deliverTo,
            subject: 'Your Password Has Been Reset',
            html: emailHtml,
            text: textBody,
          });

          log.info('✅ Password reset email sent');
        }
      } catch (emailError) {
        // Log but don't fail the request since password was already changed
        log.error('⚠️ Failed to send password reset email:', emailError);
      }
    }

    // `passwordLastChanged` is written by `stampSessionsValidFrom` above, in
    // the same record and the same write as `sessionsValidFrom`. Re-writing it
    // here would read the record back and put it again — and, on the unlucky
    // interleaving, overwrite the watermark with a copy taken before it was
    // set, silently un-revoking every session this route just revoked.

    // Log activity
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: 'password_changed',
      timestamp,
      success: true,
    });

    log.info('✅ Password changed successfully');

    return c.json({
      success: true,
      message: isAdminReset ? 'Password reset successfully' : 'Password changed successfully',
      sessionsRevoked: revocation.stamped,
    });
  } catch (error) {
    const errorMsg = logSafeError('Error changing password', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * GET /security/:userId/status
 * Get user security status (including suspension status)
 */
app.get('/:userId/status', requirePrimaryAuth, async (c) => {
  try {
    const userId = c.req.param('userId')!;
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;

    log.info(`🔍 Fetching security status for user: ${userId}`);

    const securityStatus: UserSecurityStatus = (await kv.get(`security:${userId}`)) || {
      suspended: false,
      twoFactorEnabled: false,
    };
    const pendingEmailChange = getEmailChangeSummary(await getPendingEmailChange(userId));

    log.info(`✅ Security status retrieved for user ${userId}`);

    return c.json({
      success: true,
      status: {
        ...securityStatus,
        pendingEmailChange,
      },
    });
  } catch (error) {
    const errorMsg = logSafeError('Error fetching security status', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default app;
