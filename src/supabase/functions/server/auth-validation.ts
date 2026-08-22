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

// ============================================================================
// auth-admin-routes.ts — the three super-admin utilities
// ============================================================================
//
// All three are gated by the shared SUPER_ADMIN_PASSWORD secret, so `secretKey`
// is the field whose absence makes the rest meaningless — the same rule the
// schemas above apply to `email`.
//
// ONE DELIBERATE BEHAVIOUR DELTA, worth stating rather than discovering: a
// request that is BOTH malformed and unauthorised now returns 400 where it
// previously returned 403, because the gate runs before the handler's secret
// check. That leaks nothing — neither response says anything about the secret,
// and a request with no secret at all is not valid under any reading.

/** POST /create-superadmin — `email`/`password` stay optional because the
 *  handler runs `validateEmail`/`validatePassword` on them and returns its own
 *  field-level errors, which are better than anything a schema would say. */
export const CreateSuperAdminSchema = z
  .object({
    secretKey: z.string().min(1, 'secretKey is required'),
    email: z.string().max(320).optional(),
    password: z.string().optional(),
  })
  .passthrough();

/** POST /clear-rate-limit — `email` is required: the handler passes it straight
 *  to `clearRateLimit(email, 'login')`, and an undefined bucket key clears
 *  nothing while reporting success. */
export const ClearRateLimitSchema = z
  .object({ secretKey: z.string().min(1, 'secretKey is required'), email })
  .passthrough();

/** POST /ensure-dev-user — `email` and `password` are required for a stronger
 *  reason than tidiness: the handler calls `email.toLowerCase()` and passes
 *  `password` to `updateUserById`. A missing email currently throws inside the
 *  handler and surfaces as a 500; this turns that into a 400. */
export const EnsureDevUserSchema = z
  .object({
    secretKey: z.string().min(1, 'secretKey is required'),
    email,
    password: z.string().min(1, 'Password is required'),
  })
  .passthrough();

// ============================================================================
// auth-signup.ts — POST /auth-signup/signup
// ============================================================================
//
// NOT the same route as `POST /auth/signup` above, despite the name. This one
// is mounted at `/auth-signup` (mount-core.ts) and is **the endpoint the SPA
// actually calls** — `authService.ts` and `SignupPage.tsx` both target
// `/auth-signup/signup`. `POST /auth/signup` has no caller in the SPA.
//
// So the signup route that got a schema in B2 was the one nobody uses, and the
// live one had none. The gate was on the wrong door.
//
// The four required fields mirror the handler's own guard exactly
// (`if (!email || !password || !firstName || !surname) return 400`), so this is
// a like-for-like replacement of a hand-rolled check, not a new restriction.

/** POST /auth-signup/signup — the signup endpoint the SPA calls. */
export const PublicSignupSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required'),
    firstName: z.string().min(1, 'First name is required').max(200),
    surname: z.string().min(1, 'Surname is required').max(200),
    countryCode: z.string().max(10).optional(),
    phoneNumber: z.string().max(50).optional(),
  })
  .passthrough();
