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

export function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

export async function updateStoredPrimaryEmail(userId: string, newEmail: string) {
  const profileKey = `user_profile:${userId}:personal_info`;
  const existingProfile = (await kv.get(profileKey)) as Record<string, unknown> | null;
  if (!existingProfile) return;

  const nextProfile: Record<string, unknown> = {
    ...existingProfile,
    email: newEmail,
    updatedAt: new Date().toISOString(),
  };

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
