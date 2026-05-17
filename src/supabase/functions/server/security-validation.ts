/**
 * Security Module Validation Schemas
 *
 * P1 — Zod validation for security.tsx
 */

import { z } from 'npm:zod';

export const LogActivitySchema = z.object({
  type: z.string().min(1, 'Activity type is required').max(100),
  success: z.boolean().optional(),
  errorMessage: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  emailPassword: z.boolean().optional(),
});

export const SuspendUserSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(1000).optional(),
  adminId: z.string().optional(),
});

export const Toggle2FASchema = z.object({
  enabled: z.boolean(),
});

export const Send2FACodeSchema = z.object({
  method: z.enum(['email', 'sms']).optional().default('email'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
});

export const Verify2FACodeSchema = z.object({
  code: z.string().min(4).max(10),
});

export const RequestEmailChangeSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string().min(1).optional(),
});

export const VerifyEmailChangeSchema = z.object({
  requestId: z.string().min(1).optional(),
  currentEmailCode: z.string().trim().length(6).optional(),
  newEmailCode: z.string().trim().length(6),
});

export const ResendEmailChangeCodeSchema = z.object({
  requestId: z.string().min(1).optional(),
  target: z.enum(['current', 'new', 'both']).optional().default('both'),
});
