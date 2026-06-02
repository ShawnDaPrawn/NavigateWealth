/**
 * Security email-change routes (Phase 5 decomposition).
 * ======================================================
 *
 * Extracted verbatim from security.tsx. No logic changes.
 *
 * Routes owned here:
 *   POST /:userId/email-change/request  — initiate dual-verification email change
 *   POST /:userId/email-change/resend   — resend one or both verification codes
 *   POST /:userId/email-change/verify   — verify codes and commit the email update
 *
 * @module server/security-email-change-routes
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireAuth } from './auth-mw.ts';
import {
  RequestEmailChangeSchema,
  VerifyEmailChangeSchema,
  ResendEmailChangeCodeSchema,
} from './security-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  getSupabase,
  logSafeError,
  ensureSelfOrAdmin,
  isAdminRole,
  verifyCurrentPassword,
  normalizeEmail,
  emailChangeKey,
  EMAIL_CHANGE_EXPIRY_MS,
  EMAIL_CHANGE_MAX_ATTEMPTS,
  createCodePair,
  getEmailChangeSummary,
  getPendingEmailChange,
  writeActivityLog,
  updateStoredPrimaryEmail,
  sendEmailChangeInitiatedNotice,
  sendEmailChangeCodeEmail,
  sendEmailChangeCompletedNotice,
  sha256Hex,
  type PendingEmailChangeRequest,
} from './security-shared.ts';

const app = new Hono();
const log = createModuleLogger('security');

/**
 * POST /security/:userId/email-change/request
 * Initiate an auth email change with dual verification.
 */
app.post('/:userId/email-change/request', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId');
    const authUserId = c.get('userId') as string | undefined;
    const userRole = c.get('userRole') as string | undefined;
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;

    const body = await c.req.json();
    const parsed = RequestEmailChangeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const isAdminInitiated = isAdminRole(userRole) && authUserId !== userId;
    const { newEmail, currentPassword } = parsed.data;
    const normalizedNewEmail = normalizeEmail(newEmail);

    const { data: user, error: getUserError } = await getSupabase().auth.admin.getUserById(userId);
    if (getUserError || !user?.user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const currentEmail = normalizeEmail(user.user.email || '');
    if (!currentEmail) {
      return c.json({ success: false, error: 'Current email address is missing' }, 400);
    }

    if (normalizedNewEmail === currentEmail) {
      return c.json(
        { success: false, error: 'New email must be different from the current email' },
        400,
      );
    }

    if (!isAdminInitiated) {
      if (!currentPassword) {
        return c.json({ success: false, error: 'Current password is required' }, 400);
      }

      const currentPasswordValid = await verifyCurrentPassword(currentEmail, currentPassword);
      if (!currentPasswordValid) {
        return c.json({ success: false, error: 'Current password is incorrect' }, 400);
      }
    }

    const requestId = crypto.randomUUID();
    const initiatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_EXPIRY_MS).toISOString();
    const newEmailCodePair = await createCodePair();
    const currentEmailCodePair = !isAdminInitiated ? await createCodePair() : null;

    const request: PendingEmailChangeRequest = {
      id: requestId,
      userId,
      initiatedAt,
      expiresAt,
      requestedByUserId: authUserId,
      requestedByRole: userRole,
      requiresCurrentEmailCode: !isAdminInitiated,
      oldEmail: currentEmail,
      newEmail: normalizedNewEmail,
      currentEmailCodeHash: currentEmailCodePair?.hash,
      newEmailCodeHash: newEmailCodePair.hash,
      currentEmailCodeExpiresAt: currentEmailCodePair?.expiresAt,
      newEmailCodeExpiresAt: newEmailCodePair.expiresAt,
      currentEmailCodeAttempts: 0,
      newEmailCodeAttempts: 0,
    };

    await kv.set(emailChangeKey(userId), request);

    try {
      await sendEmailChangeInitiatedNotice(
        currentEmail,
        normalizedNewEmail,
        isAdminInitiated ? 'Navigate Wealth admin support' : 'Account owner',
      );

      if (currentEmailCodePair) {
        await sendEmailChangeCodeEmail(currentEmail, currentEmailCodePair.code, 'current');
      }

      await sendEmailChangeCodeEmail(normalizedNewEmail, newEmailCodePair.code, 'new');
    } catch (emailError) {
      await kv.del(emailChangeKey(userId));
      throw emailError;
    }

    await writeActivityLog(userId, 'email_change_requested', true, {
      requestedByUserId: authUserId,
      requestedByRole: userRole,
      newEmail: normalizedNewEmail,
      requiresCurrentEmailCode: !isAdminInitiated,
    });

    return c.json({
      success: true,
      message: 'Email change verification codes sent',
      pendingEmailChange: getEmailChangeSummary(request),
    });
  } catch (error) {
    const errorMsg = logSafeError('Error initiating email change', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/email-change/resend
 * Resend one or both email change verification codes.
 */
app.post('/:userId/email-change/resend', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId');
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;

    const body = await c.req.json();
    const parsed = ResendEmailChangeCodeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const request = await getPendingEmailChange(userId);
    if (!request) {
      return c.json({ success: false, error: 'No active email change request found' }, 404);
    }

    if (parsed.data.requestId && parsed.data.requestId !== request.id) {
      return c.json(
        { success: false, error: 'Email change request no longer matches the active session' },
        409,
      );
    }

    const nextRequest = { ...request };

    if (parsed.data.target === 'current' || parsed.data.target === 'both') {
      if (request.requiresCurrentEmailCode && !request.currentEmailVerifiedAt) {
        const pair = await createCodePair();
        nextRequest.currentEmailCodeHash = pair.hash;
        nextRequest.currentEmailCodeExpiresAt = pair.expiresAt;
        nextRequest.currentEmailCodeAttempts = 0;
        await sendEmailChangeCodeEmail(request.oldEmail, pair.code, 'current');
      }
    }

    if (parsed.data.target === 'new' || parsed.data.target === 'both') {
      if (!request.newEmailVerifiedAt) {
        const pair = await createCodePair();
        nextRequest.newEmailCodeHash = pair.hash;
        nextRequest.newEmailCodeExpiresAt = pair.expiresAt;
        nextRequest.newEmailCodeAttempts = 0;
        await sendEmailChangeCodeEmail(request.newEmail, pair.code, 'new');
      }
    }

    await kv.set(emailChangeKey(userId), nextRequest);
    await writeActivityLog(userId, 'email_change_code_resent', true, {
      target: parsed.data.target,
    });

    return c.json({
      success: true,
      message: 'Verification code resent',
      pendingEmailChange: getEmailChangeSummary(nextRequest),
    });
  } catch (error) {
    const errorMsg = logSafeError('Error resending email change codes', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

/**
 * POST /security/:userId/email-change/verify
 * Verify email change codes and update Supabase Auth.
 */
app.post('/:userId/email-change/verify', requireAuth, async (c) => {
  try {
    const userId = c.req.param('userId');
    const authUserId = c.get('userId') as string | undefined;
    const denied = ensureSelfOrAdmin(c, userId);
    if (denied) return denied;

    const body = await c.req.json();
    const parsed = VerifyEmailChangeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const request = await getPendingEmailChange(userId);
    if (!request) {
      return c.json({ success: false, error: 'No active email change request found' }, 404);
    }

    if (parsed.data.requestId && parsed.data.requestId !== request.id) {
      return c.json(
        { success: false, error: 'Email change request no longer matches the active session' },
        409,
      );
    }

    const nextRequest = { ...request };
    const nowIso = new Date().toISOString();

    if (request.requiresCurrentEmailCode && !request.currentEmailVerifiedAt) {
      if (!parsed.data.currentEmailCode) {
        return c.json(
          { success: false, error: 'Current email verification code is required' },
          400,
        );
      }

      if (!request.currentEmailCodeHash || !request.currentEmailCodeExpiresAt) {
        await kv.del(emailChangeKey(userId));
        return c.json(
          { success: false, error: 'Current email verification has expired. Please start again.' },
          400,
        );
      }

      if (new Date(request.currentEmailCodeExpiresAt).getTime() < Date.now()) {
        await kv.del(emailChangeKey(userId));
        return c.json(
          {
            success: false,
            error: 'Current email verification code has expired. Please start again.',
          },
          400,
        );
      }

      const currentHash = await sha256Hex(parsed.data.currentEmailCode.trim());
      if (currentHash !== request.currentEmailCodeHash) {
        nextRequest.currentEmailCodeAttempts += 1;
        if (nextRequest.currentEmailCodeAttempts >= EMAIL_CHANGE_MAX_ATTEMPTS) {
          await kv.del(emailChangeKey(userId));
          await writeActivityLog(userId, 'email_change_verification_failed', false, {
            stage: 'current_email',
            exhausted: true,
          });
          return c.json(
            {
              success: false,
              error: 'Too many incorrect current-email codes. Please start the email change again.',
            },
            400,
          );
        }

        await kv.set(emailChangeKey(userId), nextRequest);
        await writeActivityLog(userId, 'email_change_verification_failed', false, {
          stage: 'current_email',
          attempts: nextRequest.currentEmailCodeAttempts,
        });
        return c.json(
          { success: false, error: 'Current email verification code is incorrect' },
          400,
        );
      }

      nextRequest.currentEmailVerifiedAt = nowIso;
    }

    if (!request.newEmailCodeHash || !request.newEmailCodeExpiresAt) {
      await kv.del(emailChangeKey(userId));
      return c.json(
        { success: false, error: 'New email verification has expired. Please start again.' },
        400,
      );
    }

    if (new Date(request.newEmailCodeExpiresAt).getTime() < Date.now()) {
      await kv.del(emailChangeKey(userId));
      return c.json(
        { success: false, error: 'New email verification code has expired. Please start again.' },
        400,
      );
    }

    const newHash = await sha256Hex(parsed.data.newEmailCode.trim());
    if (newHash !== request.newEmailCodeHash) {
      nextRequest.newEmailCodeAttempts += 1;
      if (nextRequest.newEmailCodeAttempts >= EMAIL_CHANGE_MAX_ATTEMPTS) {
        await kv.del(emailChangeKey(userId));
        await writeActivityLog(userId, 'email_change_verification_failed', false, {
          stage: 'new_email',
          exhausted: true,
        });
        return c.json(
          {
            success: false,
            error: 'Too many incorrect new-email codes. Please start the email change again.',
          },
          400,
        );
      }

      await kv.set(emailChangeKey(userId), nextRequest);
      await writeActivityLog(userId, 'email_change_verification_failed', false, {
        stage: 'new_email',
        attempts: nextRequest.newEmailCodeAttempts,
      });
      return c.json({ success: false, error: 'New email verification code is incorrect' }, 400);
    }

    nextRequest.newEmailVerifiedAt = nowIso;

    const { error: updateError } = await getSupabase().auth.admin.updateUserById(userId, {
      email: request.newEmail,
      email_confirm: true,
    });
    if (updateError) {
      return c.json(
        { success: false, error: updateError.message || 'Failed to update auth email' },
        400,
      );
    }

    await updateStoredPrimaryEmail(userId, request.newEmail);
    await kv.del(emailChangeKey(userId));
    await writeActivityLog(userId, 'email_changed', true, {
      newEmail: request.newEmail,
      requestedByUserId: request.requestedByUserId,
      requestedByRole: request.requestedByRole,
    });

    try {
      await sendEmailChangeCompletedNotice(request.oldEmail, request.newEmail);
    } catch (emailError) {
      log.error('⚠️ Failed to send email change completion notices:', emailError);
    }

    return c.json({
      success: true,
      message: 'Email address updated successfully',
      email: request.newEmail,
      requiresReauth: authUserId === userId,
    });
  } catch (error) {
    const errorMsg = logSafeError('Error verifying email change', error);
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

export default app;
