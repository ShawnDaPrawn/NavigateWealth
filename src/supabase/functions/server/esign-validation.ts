/**
 * E-Signature Module Validation Schemas
 *
 * P1 — Zod validation for esign-routes.tsx
 * Compliance-critical: e-sign operations require strict input validation.
 */

import { z } from 'npm:zod';

// --- Envelope Context (for upload) ---

export const EnvelopeContextSchema = z.object({
  clientId: z.string().optional(),
  adviceCaseId: z.string().optional(),
  requestId: z.string().optional(),
  productId: z.string().optional(),
  title: z.string().min(1, 'Envelope title is required').max(300),
  message: z.string().max(5000).optional(),
  expiryDays: z.number().int().min(1).max(365).optional(),
}).passthrough();

// --- Signers ---

export const SignerSchema = z.object({
  name: z.string().min(1, 'Signer name is required').max(200),
  email: z.string().email('Valid signer email is required'),
  // P5.1 — phone is optional; server normalises to E.164 at send-time.
  phone: z.string().max(32).optional(),
  role: z.enum(['signer', 'witness', 'approver', 'cc']).optional().default('signer'),
  order: z.number().int().nonnegative().optional(),
  signerType: z.enum(['client', 'adviser', 'witness', 'external']).optional(),
  // P5.1 — per-signer SMS channel opt-in. Never inferred; always
  // explicit, per POPIA s69 direct-marketing consent.
  smsOptIn: z.boolean().optional(),
}).passthrough();

export const DraftSignersSchema = z.object({
  signers: z.array(SignerSchema).min(1, 'At least one signer is required'),
});

export const InviteSignersSchema = z.object({
  signers: z.array(SignerSchema).min(1, 'At least one signer is required'),
  message: z.string().max(2000).optional(),
  siteUrl: z.string().max(500).optional(),
});

// --- Fields ---

export const EsignFieldSchema = z.object({
  type: z.enum(['signature', 'initials', 'date', 'text', 'checkbox', 'radio', 'dropdown']),
  label: z.string().max(200).optional(),
  required: z.boolean().optional().default(true),
  page: z.number().int().nonnegative(),
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  signerId: z.string().optional(),
  value: z.string().optional(),
  options: z.array(z.string()).optional(),
}).passthrough();

export const UpdateFieldsSchema = z.object({
  fields: z.array(EsignFieldSchema).min(1, 'At least one field is required'),
});

export const UpdateFieldValueSchema = z.object({
  value: z.string().max(10000),
});

// --- OTP / Verification ---

export const OtpSendSchema = z.object({
  method: z.enum(['email', 'sms']).optional().default('email'),
});

export const OtpVerifySchema = z.object({
  otp: z.string().min(4).max(10),
});

// --- Sign / Reject ---

export const SignEnvelopeSchema = z.object({
  signerId: z.string().min(1, 'Signer ID is required'),
  signatureData: z.string().optional(),
  fieldValues: z.record(z.string(), z.string()).optional(),
}).passthrough();

export const RejectEnvelopeSchema = z.object({
  signerId: z.string().min(1, 'Signer ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(2000),
});

// --- Signer Portal ---

export const SignerValidateSchema = z.object({
  token: z.string().min(1, 'Signer token is required'),
});

export const SignerSubmitSchema = z.object({
  token: z.string().min(1, 'Signer token is required'),
  fieldValues: z.record(z.string(), z.string()).optional(),
  signatureData: z.string().optional(),
}).passthrough();
