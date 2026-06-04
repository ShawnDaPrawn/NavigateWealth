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
import { requireAuth } from './auth-mw.ts';
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

    // Send email notification if requested
    if (emailPassword && user.user.email) {
      try {
        log.info(`📧 Sending password reset notification to ${user.user.email}`);

        const footerSettings = await getFooterSettings();

        // Construct email content manually since we don't have a specific template for this yet
        // and we need to include the dynamic password which might not be safe to store in a template default

        const title = 'Password Reset Notification';
        const subtitle = 'Your account password has been reset by an administrator';
        const greeting = `Hello ${user.user.user_metadata?.firstName || 'Client'},`;

        const bodyContent = `
          <p>Your password for the Navigate Wealth Admin Panel has been reset.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">New Password</p>
            <p style="margin: 4px 0 0 0; font-size: 18px; font-family: monospace; color: #111827; font-weight: 600;">${newPassword}</p>
          </div>
          <p><strong>Username:</strong> ${user.user.email}</p>
          <p>Please use these credentials to log in to your account.</p>
          <p style="color: #d97706; background-color: #fffbeb; padding: 12px; border-radius: 6px; border: 1px solid #fcd34d;">
            <strong>Security Tip:</strong> We strongly encourage you to change this password after your first login for safety and security.
          </p>
        `;

        // Extract project ID from Supabase URL
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        // If running locally or on edge, construct the login URL appropriately
        // For now, using the base URL + /login which is standard for SPAs hosted on Supabase or similar
        // Or better, just point to the origin if known, but we don't have request origin easily here for the frontend app
        // Let's assume the app is hosted where the user logs in.
        // A safe bet is usually the frontend URL. Since I don't have a FRONTEND_URL env, I'll use a generic approach or try to infer.
        // Actually, for this specific environment, I know it's a PWA.

        // Let's use a generic "Log In" link that points to the main app URL if possible,
        // or just omit the link if we can't be sure.
        // However, the user asked for "Log In Now" button.
        // I'll try to use the Referer header from the request if available as a base, or default to a standard URL.
        const origin = c.req.header('origin') || c.req.header('referer') || supabaseUrl;
        const buttonUrl = `${origin.replace(/\/$/, '')}/login`;
        const buttonLabel = 'Log In Now';

        const emailHtml = createEmailTemplate(bodyContent, {
          title,
          subtitle,
          greeting,
          buttonUrl,
          buttonLabel,
          footerSettings,
        });

        const textBody = `
Password Reset Notification
Your account password has been reset by an administrator.

New Password: ${newPassword}
Username: ${user.user.email}

Please use these credentials to log in to your account.
We strongly encourage you to change this password after your first login for safety and security.

Log In: ${buttonUrl}
        `.trim();

        await sendEmail({
          to: user.user.email,
          subject: 'Your Password Has Been Reset',
          html: emailHtml,
          text: textBody,
        });

        log.info('✅ Password reset email sent');
      } catch (emailError) {
        // Log but don't fail the request since password was already changed
        log.error('⚠️ Failed to send password reset email:', emailError);
      }
    }

    // Update security status
    const securityStatus = (await kv.get(`security:${userId}`)) || {};
    securityStatus.passwordLastChanged = new Date().toISOString();
    await kv.set(`security:${userId}`, securityStatus);

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
app.get('/:userId/status', requireAuth, async (c) => {
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
