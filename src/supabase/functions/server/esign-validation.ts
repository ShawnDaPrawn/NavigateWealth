/**
 * E-Signature Module Validation Schemas
 *
 * P1 — Zod validation for esign-routes.tsx
 * Compliance-critical: e-sign operations require strict input validation.
 */

import { z } from 'npm:zod';

// --- Envelope Context (for upload) ---

export const EnvelopeContextSchema = z
  .object({
    clientId: z.string().optional(),
    adviceCaseId: z.string().optional(),
    requestId: z.string().optional(),
    productId: z.string().optional(),
    title: z.string().min(1, 'Envelope title is required').max(300),
    message: z.string().max(5000).optional(),
    expiryDays: z.number().int().min(1).max(365).optional(),
  })
  .passthrough();

// --- Signers ---

export const SignerSchema = z
  .object({
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
  })
  .passthrough();

export const DraftSignersSchema = z.object({
  signers: z.array(SignerSchema).min(1, 'At least one signer is required'),
});

export const InviteSignersSchema = z.object({
  signers: z.array(SignerSchema).min(1, 'At least one signer is required'),
  message: z.string().max(2000).optional(),
  siteUrl: z.string().max(500).optional(),
});

// --- Fields ---

export const EsignFieldSchema = z
  .object({
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
  })
  .passthrough();

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

export const SignEnvelopeSchema = z
  .object({
    signerId: z.string().min(1, 'Signer ID is required'),
    signatureData: z.string().optional(),
    fieldValues: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export const RejectEnvelopeSchema = z.object({
  signerId: z.string().min(1, 'Signer ID is required'),
  reason: z.string().min(1, 'Rejection reason is required').max(2000),
});

// --- Signer Portal ---

export const SignerValidateSchema = z.object({
  token: z.string().min(1, 'Signer token is required'),
});

export const SignerSubmitSchema = z
  .object({
    token: z.string().min(1, 'Signer token is required'),
    fieldValues: z.record(z.string(), z.string()).optional(),
    signatureData: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// SIGNER PORTAL — snake_case wire format (Stage B / B2)
// ============================================================================
//
// READ THIS BEFORE ADDING A SCHEMA HERE.
//
// There are TWO e-sign APIs with different wire formats, and confusing them is
// not hypothetical — it already happened in this file:
//
//   * SENDER-facing (`esign-sender-*-routes.ts`) — camelCase. The schemas
//     above (SignEnvelopeSchema, RejectEnvelopeSchema, …) belong to these and
//     are correctly wired.
//   * SIGNER-facing (`esign-signer-*-routes.ts`) — snake_case. Consumed by
//     `src/components/esign-signer/services/esignSignerService.ts`, which posts
//     `access_token` / `signature_data` / `field_values`. These are PUBLIC
//     routes: the caller is an unauthenticated third party holding a link.
//
// `SignerSubmitSchema` above was written for the signer routes but in the
// SENDER format (`token`, `signatureData`, `fieldValues` — the last as a
// record, where the handler actually iterates an ARRAY of
// `{ field_id, value }`). It has never been wired to anything. Attaching it to
// `/signer/submit` would have rejected every real signature submission in
// production. It is left in place rather than deleted only because deleting it
// is a separate decision from this change; see A19 in the remediation plan.
//
// The schemas below were derived by reading each handler's own destructuring
// and its own `if (!x) return 400` guards, so they reject exactly what the
// handler already rejects and nothing more. `.passthrough()` throughout: these
// are a GATE against missing/malformed required input, not a closed contract,
// and an unknown extra field must never be the reason a signature fails.

/** POST /signer/submit — handler requires access_token AND signature_data. */
export const SignerSubmitBodySchema = z
  .object({
    access_token: z.string().min(1, 'access_token required'),
    signature_data: z.string().min(1, 'signature_data required'),
    // Iterated as an array of { field_id, value }; entries missing either are
    // skipped by the handler, so they are tolerated rather than rejected here.
    field_values: z
      .array(
        z.object({ field_id: z.string().optional(), value: z.unknown().optional() }).passthrough(),
      )
      .optional(),
    consent_version: z.string().optional(),
    consent_accepted_at: z.string().optional(),
    signing_reason: z.string().optional(),
    signature_telemetry: z.unknown().optional(),
  })
  .passthrough();

/** POST /signer/reject — handler requires access_token only; reason is free-form. */
export const SignerRejectBodySchema = z
  .object({
    access_token: z.string().min(1, 'access_token required'),
    reason: z.string().max(2000).optional(),
  })
  .passthrough();

/**
 * POST /signer/resend-otp and POST /signer/verify-otp.
 *
 * `otp` is deliberately NOT required here. The handler only demands it when
 * `signer.requires_otp` is true, which is known solely after the token lookup —
 * so requiring it in middleware would reject valid no-OTP envelopes. That check
 * stays in the handler.
 */
export const SignerOtpBodySchema = z
  .object({
    access_token: z.string().min(1, 'access_token required'),
    otp: z.string().optional(),
    access_code: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// API keys and webhooks (B2 burn-down, 2026-08-22)
// ============================================================================
//
// Derived from each handler's own destructuring, per A19 — the six schemas
// higher in this file were written against an imagined API shape and would have
// rejected live traffic, so nothing here is guessed.
//
// The CREATE routes use `validateBody`: they do a bare `await c.req.json()`
// today via `.catch(() => ({}))` and then reject an empty body themselves, so
// a 400 is already the outcome. The PATCH routes use `validateOptionalBody`:
// they treat an absent body as "change nothing" and return 200, and turning
// that into a 400 would be a behaviour change on a live route.

/** POST /api-keys — `name` is the only field the handler requires. */
export const CreateApiKeySchema = z
  .object({
    name: z.string().min(1, 'A name is required').max(200),
    scopes: z.array(z.string()).optional(),
    expiresAt: z.string().optional(),
  })
  .passthrough();

/** PATCH /api-keys/:id — every field optional; an empty patch is a valid no-op.
 *  `expiresAt` accepts null explicitly, which the handler reads as "clear it". */
export const UpdateApiKeySchema = z
  .object({
    name: z.string().max(200).optional(),
    active: z.boolean().optional(),
    scopes: z.array(z.string()).optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .passthrough();

/** POST /webhooks — the handler additionally runs `assertPublicHttpsUrl` on the
 *  URL and filters `events` against KNOWN_WEBHOOK_EVENTS. Both stay in the
 *  handler: the SSRF check is a network-policy decision, not a shape one, and
 *  the event filter drops unknown values rather than rejecting the request. */
export const CreateWebhookSchema = z
  .object({
    url: z.string().min(1, 'A valid https URL is required'),
    events: z.array(z.string()).min(1, 'At least one event subscription is required'),
    description: z.string().optional(),
  })
  .passthrough();

/** PATCH /webhooks/:id — every field optional; an empty patch is a valid no-op. */
export const UpdateWebhookSchema = z
  .object({
    url: z.string().optional(),
    events: z.array(z.string()).optional(),
    active: z.boolean().optional(),
    description: z.string().optional(),
  })
  .passthrough();
