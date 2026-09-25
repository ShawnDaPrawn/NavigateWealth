/**
 * Shared types, constants, and helper functions for security route sub-routers
 * (Phase 5 decomposition). Extracted verbatim from security.tsx.
 *
 * Imported by security-activity-routes.ts, security-password-routes.ts,
 * security-email-change-routes.ts, and security-2fa-routes.ts. No logic
 * changes from the originals.
 */
import { type Context } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { sendEmail, createEmailTemplate, getFooterSettings } from './email-service.ts';
import {
  readSharedEmailLink,
  resolveContactEmail,
  normalizeEmail as normalizeContactEmail,
} from './client-email-identity.ts';
import { resolveClientFirstName } from './client-display-name.ts';
import { resolveTrustedRole } from './constants.ts';
import { secureRandomDigits } from './crypto-utils.ts';

const log = createModuleLogger('security-shared');

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
export const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export const getPasswordVerifier = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

/**
 * Helper to sanitize error messages
 * Prevents returning HTML (Cloudflare errors) to the client
 */
export function getErrorMessage(error: unknown): string {
  const message = getErrMsg(error);
  // Check for HTML content (common in Cloudflare/Gateway errors)
  if (
    message.includes('<!DOCTYPE html>') ||
    message.includes('<html') ||
    message.includes('Cloudflare')
  ) {
    return 'Service temporarily unavailable. Please try again later.';
  }
  return message;
}

/**
 * Helper to log errors safely
 * Avoids filling logs with huge HTML payloads
 */
export function logSafeError(context: string, error: unknown) {
  const message = getErrorMessage(error);
  if (message === 'Service temporarily unavailable. Please try again later.') {
    log.error(`❌ ${context}: Upstream Service Error (Cloudflare/HTML response)`);
  } else {
    log.error(`❌ ${context}:`, error);
  }
  return message;
}

export interface ActivityLogEntry {
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

export interface UserSecurityStatus {
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

export interface PendingEmailChangeRequest {
  id: string;
  userId: string;
  initiatedAt: string;
  expiresAt: string;
  requestedByUserId?: string;
  requestedByRole?: string;
  requiresCurrentEmailCode: boolean;
  oldEmail: string;
  newEmail: string;
  currentEmailCodeHash?: string;
  newEmailCodeHash: string;
  currentEmailCodeExpiresAt?: string;
  newEmailCodeExpiresAt: string;
  currentEmailCodeAttempts: number;
  newEmailCodeAttempts: number;
  currentEmailVerifiedAt?: string;
  newEmailVerifiedAt?: string;
}

export interface EmailChangeSummary {
  requestId: string;
  newEmail: string;
  initiatedAt: string;
  expiresAt: string;
  requiresCurrentEmailCode: boolean;
  currentEmailVerified: boolean;
  newEmailVerified: boolean;
}

export const EMAIL_CHANGE_EXPIRY_MS = 15 * 60 * 1000;
export const EMAIL_CHANGE_CODE_EXPIRY_MS = 10 * 60 * 1000;
export const EMAIL_CHANGE_MAX_ATTEMPTS = 5;

export function isAdminRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'super-admin';
}

export function ensureSelfOrAdmin(c: Context, targetUserId: string): Response | null {
  const authUserId = c.get('userId') as string | undefined;
  const role = c.get('userRole') as string | undefined;

  if (authUserId === targetUserId || isAdminRole(role)) {
    return null;
  }

  return c.json({ success: false, error: 'Forbidden' }, 403);
}

export function ensureAdmin(c: Context): Response | null {
  const role = c.get('userRole') as string | undefined;
  if (isAdminRole(role)) {
    return null;
  }

  return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
}

function isSuperAdminRole(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'super-admin';
}

/**
 * The account-takeover guard for an admin acting on SOMEONE ELSE's account.
 *
 * `ensureSelfOrAdmin` answers "may this caller touch this account at all?" and
 * says yes to every admin for every account. On the routes that change who can
 * sign in — password reset, 2FA, suspension, sign-in email — that made `admin`
 * and `super_admin` the same role: any admin could set the owner's password
 * (no current password needed on an admin reset, and the owner told only if
 * the admin chose to send the email), sign in as the owner, and hold every
 * super-admin power. One phished admin was the whole platform.
 *
 * Run AFTER `ensureSelfOrAdmin`. Self-service passes; a super-admin passes; a
 * plain admin passes for every account except one whose TRUSTED role is
 * super-admin. The target is looked up fresh rather than taken from anything
 * the request says about it. If the lookup fails, the answer is no: a guard
 * that opens when its dependency is down is not a guard.
 */
export async function ensureCanAdministerTarget(
  c: Context,
  targetUserId: string,
): Promise<Response | null> {
  const actorId = c.get('userId') as string | undefined;
  const actorRole = c.get('userRole') as string | undefined;

  if (actorId === targetUserId) return null;
  if (!isAdminRole(actorRole)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (isSuperAdminRole(actorRole)) return null;

  const { data, error } = await getSupabase().auth.admin.getUserById(targetUserId);
  // No such user: nothing to protect, and the handler's own lookup answers 404.
  // GoTrue reports that as an error with status 404 rather than an empty result.
  if ((error as { status?: number } | null)?.status === 404) return null;
  if (error) {
    log.error('Target account lookup failed; refusing the admin action', {
      error: getErrMsg(error),
    });
    return c.json(
      { success: false, error: 'Could not verify the target account. Please try again.' },
      503,
    );
  }
  if (!data?.user) return null;

  if (isSuperAdminRole(resolveTrustedRole(data.user))) {
    return c.json(
      {
        success: false,
        error: 'Forbidden: only a super admin can change a super admin account',
        code: 'FORBIDDEN_SUPER_ADMIN_TARGET',
      },
      403,
    );
  }
  return null;
}

export async function verifyCurrentPassword(
  email: string,
  currentPassword: string,
): Promise<boolean> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is not configured');
  }

  const verifier = getPasswordVerifier();
  const { error } = await verifier.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  await verifier.auth.signOut().catch(() => undefined);
  return !error;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailChangeKey(userId: string): string {
  return `email_change:${userId}`;
}

/**
 * A six-digit verification code from a CSPRNG.
 *
 * This used `Math.random()`, whose internal state is recoverable from a handful
 * of observed outputs — and this server exposes plenty of them (activity-log
 * ids are built from it). These codes are what prove control of a mailbox
 * during an email change, which is how an account's sign-in identity moves, so
 * they come from `crypto.getRandomValues` like every other code here.
 */
export function generateSixDigitCode(): string {
  return secureRandomDigits(6);
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createCodePair() {
  const code = generateSixDigitCode();
  return {
    code,
    hash: await sha256Hex(code),
    expiresAt: new Date(Date.now() + EMAIL_CHANGE_CODE_EXPIRY_MS).toISOString(),
  };
}

export function getEmailChangeSummary(
  request: PendingEmailChangeRequest | null,
): EmailChangeSummary | null {
  if (!request) return null;
  return {
    requestId: request.id,
    newEmail: request.newEmail,
    initiatedAt: request.initiatedAt,
    expiresAt: request.expiresAt,
    requiresCurrentEmailCode: request.requiresCurrentEmailCode,
    currentEmailVerified: Boolean(request.currentEmailVerifiedAt),
    newEmailVerified: Boolean(request.newEmailVerifiedAt),
  };
}

export async function getPendingEmailChange(
  userId: string,
): Promise<PendingEmailChangeRequest | null> {
  const request = (await kv.get(emailChangeKey(userId))) as PendingEmailChangeRequest | null;
  if (!request) return null;

  if (new Date(request.expiresAt).getTime() < Date.now()) {
    await kv.del(emailChangeKey(userId));
    return null;
  }

  return request;
}

export async function writeActivityLog(
  userId: string,
  type: string,
  success: boolean,
  metadata?: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  await kv.set(`activity:${userId}:${logId}`, {
    id: logId,
    userId,
    type,
    timestamp,
    success,
    metadata,
  });
}

/**
 * The inbox to deliver a security message to for `userId`.
 *
 * A client enrolled on a household mailbox signs in with a derived alias, and
 * these flows would otherwise address that alias directly. Sub-addressing is
 * widely but not universally honoured, so a 2FA code or a reset password sent
 * to the alias can silently fail to arrive — and a login code that never
 * arrives is a lockout, not an inconvenience. Deliver to the address on the
 * profile instead; the alias stays the login identity, which is what the
 * message is usually telling the reader about.
 *
 * Falls back to the auth email whenever there is no link, so the ordinary case
 * is unchanged.
 */
export async function resolveDeliveryEmail(
  userId: string,
  authEmail: string | null | undefined,
): Promise<string> {
  return (await resolveSecurityContact(userId, authEmail)).email;
}

/**
 * Who a security message goes to, and what to call them — from ONE profile read.
 *
 * The name half exists for the same reason as the address half. These flows have
 * the auth user in hand and used to greet from its `user_metadata`, which is a
 * snapshot written when the account was created and corrected by nothing: an
 * admin who fixes a client's name on their profile does not touch it. So
 * "Hello Liezl," kept going to a client whose profile had said Kirtan for
 * months — the same defect that put the wrong name in his birthday greeting.
 *
 * Both halves are answered from a single `kv.get` because they always want the
 * same row, and a security email that reads the profile twice is two chances to
 * fail on a path where failure means a client cannot get back into their
 * account. On a read error both fall back to what the auth user already says,
 * so the message still goes out.
 */
export async function resolveSecurityContact(
  userId: string,
  authEmail: string | null | undefined,
  metadata?: Record<string, unknown> | null,
  nameFallback = 'Client',
): Promise<{ email: string; firstName: string }> {
  let profile: Record<string, unknown> | null = null;
  try {
    profile = (await kv.get(`user_profile:${userId}:personal_info`)) as Record<
      string,
      unknown
    > | null;
  } catch (error) {
    logSafeError('resolveSecurityContact', error);
  }

  return {
    email: resolveContactEmail(authEmail, profile) || normalizeContactEmail(authEmail),
    firstName: resolveClientFirstName(profile, metadata, nameFallback),
  };
}

export async function updateStoredPrimaryEmail(userId: string, newEmail: string) {
  const profileKey = `user_profile:${userId}:personal_info`;
  const existingProfile = (await kv.get(profileKey)) as Record<string, unknown> | null;
  if (!existingProfile) return;

  const nextProfile: Record<string, unknown> = {
    ...existingProfile,
    email: newEmail,
    updatedAt: new Date().toISOString(),
  };

  // A verified email change means this client now holds an address of their
  // own, so a household-mailbox link is stale: leaving it would keep routing
  // their mail to the guardian they just moved off.
  const link = readSharedEmailLink(existingProfile);
  if (link && normalizeContactEmail(newEmail) !== link.contactEmail) {
    delete nextProfile.sharedEmail;
  }

  const contactInformation =
    existingProfile.contactInformation &&
    typeof existingProfile.contactInformation === 'object' &&
    !Array.isArray(existingProfile.contactInformation)
      ? { ...(existingProfile.contactInformation as Record<string, unknown>), email: newEmail }
      : null;

  if (contactInformation) {
    nextProfile.contactInformation = contactInformation;
  }

  await kv.set(profileKey, nextProfile);
}

export async function sendEmailChangeInitiatedNotice(
  currentEmail: string,
  newEmail: string,
  requesterLabel: string,
) {
  const footerSettings = await getFooterSettings();
  const html = createEmailTemplate(
    `
      <p>A request was made to change the sign-in email address on your Navigate Wealth account.</p>
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Requested new email</p>
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">${newEmail}</p>
      </div>
      <p>Request source: <strong>${requesterLabel}</strong></p>
      <p>If this was not you, please contact Navigate Wealth support immediately so we can secure your account.</p>
    `,
    {
      title: 'Security Notice',
      subtitle: 'Email change requested',
      footerNote: 'If you do not recognise this request, contact support immediately.',
      footerSettings,
    },
  );

  const text = [
    'A request was made to change the sign-in email address on your Navigate Wealth account.',
    `Requested new email: ${newEmail}`,
    `Request source: ${requesterLabel}`,
    'If this was not you, please contact Navigate Wealth support immediately.',
  ].join('\n\n');

  const sent = await sendEmail({
    to: currentEmail,
    subject: 'Navigate Wealth security notice: email change requested',
    html,
    text,
  });
  if (!sent) {
    throw new Error('Failed to send current-email security notice');
  }
}

export async function sendEmailChangeCodeEmail(
  targetEmail: string,
  code: string,
  destinationLabel: string,
) {
  const footerSettings = await getFooterSettings();
  const html = createEmailTemplate(
    `
      <p>Use the verification code below to confirm the ${destinationLabel} email address for your Navigate Wealth account.</p>
      <div style="background-color: #f3f4f6; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Your verification code is:</p>
        <p style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</p>
      </div>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p style="color: #d97706; background-color: #fffbeb; padding: 12px; border-radius: 6px; border: 1px solid #fcd34d;">
        <strong>Security Tip:</strong> Never share this code with anyone. Navigate Wealth will never ask you for it by phone or chat.
      </p>
    `,
    {
      title: 'Email Change Verification',
      subtitle: `Confirm your ${destinationLabel} address`,
      footerNote: 'If you did not request this change, ignore this email and contact support.',
      footerSettings,
    },
  );

  const text = [
    `Your Navigate Wealth verification code for the ${destinationLabel} email address is ${code}.`,
    'This code expires in 10 minutes.',
    'If you did not request this change, ignore this email and contact support.',
  ].join('\n\n');

  const sent = await sendEmail({
    to: targetEmail,
    subject: `Navigate Wealth email change code: ${destinationLabel}`,
    html,
    text,
  });
  if (!sent) {
    throw new Error(`Failed to send ${destinationLabel} verification code`);
  }
}

export async function sendEmailChangeCompletedNotice(oldEmail: string, newEmail: string) {
  const footerSettings = await getFooterSettings();
  const recipients = [oldEmail, newEmail];

  const html = createEmailTemplate(
    `
      <p>Your Navigate Wealth sign-in email address has been updated successfully.</p>
      <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">New sign-in email</p>
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">${newEmail}</p>
      </div>
      <p>If you did not approve this change, contact support immediately.</p>
    `,
    {
      title: 'Email Updated',
      subtitle: 'Your sign-in email has changed',
      footerNote: 'If this update was not authorised by you, contact support immediately.',
      footerSettings,
    },
  );

  const text = [
    'Your Navigate Wealth sign-in email address has been updated successfully.',
    `New sign-in email: ${newEmail}`,
    'If you did not approve this change, contact support immediately.',
  ].join('\n\n');

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: 'Navigate Wealth sign-in email updated',
        html,
        text,
      }),
    ),
  );
  if (results.some((sent) => !sent)) {
    throw new Error('Failed to send one or more email change completion notices');
  }
}
