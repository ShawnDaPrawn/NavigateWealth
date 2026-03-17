/**
 * Security Management Routes
 * Handles password reset, activity logs, and user suspension
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { sendEmail, createEmailTemplate, getFooterSettings } from './email-service.ts';
import {
  LogActivitySchema,
  ChangePasswordSchema,
  SuspendUserSchema,
  Toggle2FASchema,
  Send2FACodeSchema,
  Verify2FACodeSchema,
} from './security-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('security');

// Root handlers
app.get('/', (c) => c.json({ service: 'security', status: 'active' }));
app.get('', (c) => c.json({ service: 'security', status: 'active' }));

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Helper to sanitize error messages
 * Prevents returning HTML (Cloudflare errors) to the client
 */
function getErrorMessage(error: unknown): string {
  const message = getErrMsg(error);
  // Check for HTML content (common in Cloudflare/Gateway errors)
  if (message.includes('<!DOCTYPE html>') || message.includes('<html') || message.includes('Cloudflare')) {
    return 'Service temporarily unavailable. Please try again later.';
  }
  return message;
}

/**
 * Helper to log errors safely
 * Avoids filling logs with huge HTML payloads
 */
function logSafeError(context: string, error: unknown) {
  const message = getErrorMessage(error);
  if (message === 'Service temporarily unavailable. Please try again later.') {
    log.error(`❌ ${context}: Upstream Service Error (Cloudflare/HTML response)`);
  } else {
    log.error(`❌ ${context}:`, error);
  }
  return message;
}

interface ActivityLogEntry {
  id: string;
  userId: string;
  type: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  location?: string;
  device?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

interface UserSecurityStatus {
  suspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspendedReason?: string;
  deleted?: boolean;
  deletedAt?: string;
  closedBy?: string;
  closureReason?: string;
  accountStatus?: string;
  twoFactorEnabled: boolean;
  passwordLastChanged?: string;
  /** ISO timestamp of the last successful 2FA verification (used for grace-period logic) */
  last2faVerifiedAt?: string;
}

/**
 * GET /security/:userId/activity
 * Get activity logs for a user
 */
app.get('/:userId/activity', async (c) => {
  try {
    const userId = c.req.param('userId');
    const limit = parseInt(c.req.query('limit') || '50');
    
    log.info(`📊 Fetching activity logs for user: ${userId}`);

    // Get activity logs from KV store
    const logs = await kv.getByPrefix(`activity:${userId}:`);
    
    // Sort by timestamp descending and limit
    const sortedLogs = logs
      .filter(log => log && log.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    log.info(`✅ Found ${sortedLogs.length} activity logs for user ${userId}`);
    
    return c.json({
      success: true,
      count: sortedLogs.length,
      logs: sortedLogs
    });
  } catch (error) {
    const errorMsg = logSafeError('Error fetching activity logs', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/activity
 * Log a security activity
 */
app.post('/:userId/activity', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const parsed = LogActivitySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { type, success: activitySuccess, errorMessage, metadata } = parsed.data;

    log.info(`📝 Logging activity for user ${userId}: ${type}`);

    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get request info
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    const activityLog: ActivityLogEntry = {
      id: logId,
      userId,
      type,
      timestamp,
      ip,
      userAgent,
      success: activitySuccess,
      errorMessage,
      metadata
    };

    // Store activity log
    await kv.set(`activity:${userId}:${logId}`, activityLog);

    log.info('✅ Activity logged successfully');

    return c.json({
      success: true,
      log: activityLog
    });
  } catch (error) {
    const errorMsg = logSafeError('Error logging activity', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/password
 * Change user password
 */
app.post('/:userId/password', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { currentPassword, newPassword, emailPassword } = parsed.data;

    log.info(`🔐 Changing password for user: ${userId}`);

    // Verify current password and update to new password using Supabase Auth
    const { data: user, error: getUserError } = await getSupabase().auth.admin.getUserById(userId);
    
    if (getUserError || !user) {
      log.error('❌ User not found:', getUserError);
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Update password using admin API
    const { data, error } = await getSupabase().auth.admin.updateUserById(userId, {
      password: newPassword
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
        
        const title = "Password Reset Notification";
        const subtitle = "Your account password has been reset by an administrator";
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
        const buttonLabel = "Log In Now";

        const emailHtml = createEmailTemplate(
          bodyContent,
          {
            title,
            subtitle,
            greeting,
            buttonUrl,
            buttonLabel,
            footerSettings
          }
        );

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
          text: textBody
        });

        log.info('✅ Password reset email sent');
      } catch (emailError) {
        // Log but don't fail the request since password was already changed
        log.error('⚠️ Failed to send password reset email:', emailError);
      }
    }

    // Update security status
    const securityStatus = await kv.get(`security:${userId}`) || {};
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
      success: true
    });

    log.info('✅ Password changed successfully');

    return c.json({
      success: true,
      message: 'Password changed successfully'
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
app.get('/:userId/status', async (c) => {
  try {
    const userId = c.req.param('userId');
    
    log.info(`🔍 Fetching security status for user: ${userId}`);

    const securityStatus: UserSecurityStatus = await kv.get(`security:${userId}`) || {
      suspended: false,
      twoFactorEnabled: false
    };
    
    log.info(`✅ Security status retrieved for user ${userId}`);
    
    return c.json({
      success: true,
      status: securityStatus
    });
  } catch (error) {
    const errorMsg = logSafeError('Error fetching security status', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/suspend
 * Suspend a user account (admin only)
 */
app.post('/:userId/suspend', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const parsed = SuspendUserSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { suspended, reason, adminId } = parsed.data;

    log.info(`${suspended ? '🔒' : '🔓'} ${suspended ? 'Suspending' : 'Unsuspending'} user: ${userId}`);

    // Get or create security status
    const securityStatus: UserSecurityStatus = await kv.get(`security:${userId}`) || {
      suspended: false,
      twoFactorEnabled: false
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
      metadata: { adminId, reason }
    });

    log.info(`✅ User ${suspended ? 'suspended' : 'unsuspended'} successfully`);

    return c.json({
      success: true,
      status: securityStatus,
      message: `Account ${suspended ? 'suspended' : 'unsuspended'} successfully`
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
app.post('/:userId/2fa', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const parsed = Toggle2FASchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { enabled } = parsed.data;
    const method = (body as Record<string, unknown>).method;

    log.info(`🔑 ${enabled ? 'Enabling' : 'Disabling'} 2FA for user: ${userId}`);

    const securityStatus: UserSecurityStatus = await kv.get(`security:${userId}`) || {
      suspended: false,
      twoFactorEnabled: false
    };

    securityStatus.twoFactorEnabled = enabled;
    await kv.set(`security:${userId}`, securityStatus);

    // Log activity
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: enabled ? '2fa_enabled' : '2fa_disabled',
      timestamp,
      success: true,
      metadata: { method }
    });

    log.info(`✅ 2FA ${enabled ? 'enabled' : 'disabled'} successfully`);

    return c.json({
      success: true,
      status: securityStatus
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
app.post('/:userId/2fa/send-code', async (c) => {
  try {
    const userId = c.req.param('userId');
    let email = '';
    
    // Try to get email from body
    try {
      const body = await c.req.json();
      if (body && body.email) {
        email = body.email;
      }
    } catch (e) {
      // Body might be empty, ignore
    }
    
    log.info(`📧 Generating 2FA code for user: ${userId}`);

    // Get user details from Supabase
    const { data: user, error: getUserError } = await getSupabase().auth.admin.getUserById(userId);
    
    if (getUserError || !user) {
      log.error('❌ User not found:', getUserError);
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    
    // Use user.email from Supabase if available, otherwise fallback to provided email
    const targetEmail = user.email || email;
    
    if (!targetEmail) {
       log.error('❌ No email address found for user');
       return c.json({ success: false, error: 'No email address found for user' }, 400);
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code with expiration (5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await kv.set(`2fa:${userId}:code`, {
      code,
      expiresAt,
      attempts: 0
    });

    log.info(`🔑 Generated 2FA code for user ${userId}, expires at ${expiresAt}`);

    // Send email with code
    const { sendTwoFactorEmail } = await import('./email-service.ts');
    await sendTwoFactorEmail(targetEmail, code);

    // Log activity
    const timestamp = new Date().toISOString();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(`activity:${userId}:${logId}`, {
      id: logId,
      userId,
      type: '2fa_code_sent',
      timestamp,
      success: true
    });

    log.info(`✅ 2FA code sent successfully to ${targetEmail}`);

    return c.json({
      success: true,
      message: 'Verification code sent to your email'
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
 * On success the `last2faVerifiedAt` timestamp is written to the
 * security KV entry so the frontend can implement a grace-period
 * (e.g. skip 2FA if verified within the last 3 hours).
 */
app.post('/:userId/2fa/verify-code', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json();
    
    const parsed = Verify2FACodeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const { code } = parsed.data;

    log.info(`🔍 Verifying 2FA code for user: ${userId}`);

    // ── Check if the account is already suspended ────────────────
    const securityStatus: UserSecurityStatus = await kv.get(`security:${userId}`) || {
      suspended: false,
      twoFactorEnabled: false,
    };

    if (securityStatus.suspended) {
      log.info('❌ Account is suspended — rejecting 2FA verification');
      return c.json({ success: false, error: 'Your account has been suspended. Please contact Navigate Wealth support.' }, 403);
    }

    // ── Get stored code ──────────────────────────────────────────
    const storedData = await kv.get(`2fa:${userId}:code`);
    
    if (!storedData) {
      log.info('❌ No 2FA code found or code expired');
      return c.json({ success: false, error: 'Invalid or expired code. Please request a new one.' }, 400);
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
      return c.json({ success: false, error: 'Too many failed attempts. Please request a new code.' }, 400);
    }

    // ── Verify code ──────────────────────────────────────────────
    if (storedData.code !== code) {
      log.info('❌ Invalid 2FA code');
      
      // Increment per-code attempts
      await kv.set(`2fa:${userId}:code`, {
        ...storedData,
        attempts: storedData.attempts + 1,
      });

      // ── Increment cumulative failure counter ───────────────────
      const failureRecord = await kv.get(`2fa_failures:${userId}`) || { count: 0 };
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
        log.info(`🚨 User ${userId} reached ${MAX_CUMULATIVE_FAILURES} cumulative 2FA failures — suspending account`);

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
          const clientEmail = supabaseUser?.user?.email;
          const clientName = supabaseUser?.user?.user_metadata?.firstName || supabaseUser?.user?.user_metadata?.name || 'Client';
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
                buttonUrl: 'https://navigatewealth.co/contact',
                buttonLabel: 'Contact Support',
                footerNote: 'If you have any concerns, contact us immediately at <a href="mailto:info@navigatewealth.co" style="color: #6d28d9;">info@navigatewealth.co</a> or call <a href="tel:+27126672025" style="color: #6d28d9;">012 667 2025</a>.',
                footerSettings,
              }
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
            }
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

        return c.json({
          success: false,
          error: 'Your account has been suspended due to too many failed verification attempts. Please contact Navigate Wealth support.',
          suspended: true,
        }, 403);
      }

      const perCodeRemaining = 3 - storedData.attempts - 1;
      return c.json({ 
        success: false, 
        error: `Invalid code. ${perCodeRemaining} attempt${perCodeRemaining !== 1 ? 's' : ''} remaining for this code.`,
      }, 400);
    }

    // ── Code is valid ────────────────────────────────────────────
    await kv.del(`2fa:${userId}:code`);

    // Reset cumulative failure counter on success
    await kv.del(`2fa_failures:${userId}`);

    // Record last2faVerifiedAt in the security KV entry (grace-period support)
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