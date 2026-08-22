/**
 * Auth route validation schemas (Stage B / B2)
 * ============================================
 *
 * `auth-routes.ts` has 9 routes that accept a body and, before this, zero zod
 * parses — on the endpoints that handle credentials, password resets and
 * session events. Every one read `await c.req.json()` and used whatever came
 * back; only `/confirm-email` guarded a missing field.
 *
 * DERIVED FROM THE HANDLERS, NOT FROM AN IDEA OF THE API
 * -----------------------------------------------------
 * Each schema below mirrors exactly what its handler destructures. `email` is
 * required everywhere because every one of these routes is a per-account
 * operation whose remaining logic is meaningless without it — several currently
 * pass `undefined` straight into `checkRateLimit(email, …)`, which buckets every
 * anonymous attempt together and is a rate-limiting hole in its own right.
 *
 * Everything else stays OPTIONAL, and every schema is `.passthrough()`. These
 * are a gate against missing/malformed required input, not a closed contract:
 * a caller sending an extra field must never start failing because of this
 * change. Sibling schemas live in `security-validation.ts` for `security.tsx`.
 */

import { z } from 'npm:zod';

/** Reused so a change to the accepted email shape lands on every auth route at once. */
const email = z.string().min(1, 'Email is required').max(320);

/** POST /signup-validate */
export const SignupValidateSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required'),
    firstName: z.string().max(200).optional(),
    surname: z.string().max(200).optional(),
    phoneNumber: z.string().max(50).optional(),
    countryCode: z.string().max(10).optional(),
  })
  .passthrough();

/** POST /signup */
export const SignupSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required'),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/** POST /login-validate and POST /password-reset-request — email only. */
export const EmailOnlySchema = z.object({ email }).passthrough();

/** POST /login-success, POST /logout, POST /password-change. */
export const EmailAndUserIdSchema = z
  .object({ email, userId: z.string().optional() })
  .passthrough();

/** POST /login-failure — `reason` is recorded on the auth event. */
export const LoginFailureSchema = z
  .object({ email, reason: z.string().max(2000).optional() })
  .passthrough();

/**
 * POST /confirm-email — the one route that already guarded its input
 * (`if (!email) return 400`), so this schema is a like-for-like replacement
 * rather than a new restriction.
 */
export const ConfirmEmailSchema = z.object({ email }).passthrough();
