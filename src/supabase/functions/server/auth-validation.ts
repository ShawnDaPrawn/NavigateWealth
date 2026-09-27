/**
 * Auth route validation schemas (Stage B / B2)
 * ============================================
 *
 * `auth-routes.ts` had 9 routes that accept a body and, before this, zero zod
 * parses — on the endpoints that handle credentials, password resets and
 * session events. Every one read `await c.req.json()` and used whatever came
 * back; only `/confirm-email` guarded a missing field. (Several of those routes
 * have since been removed as dead, unauthenticated surface.)
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

/**
 * POST /login — the ENFORCING login endpoint.
 *
 * Unlike the retired `/login-validate` (which only ever saw an address) this
 * one carries the password, because it performs the authentication itself
 * rather than advising a browser that is about to perform it elsewhere. See
 * the route for why that distinction is the whole point.
 *
 * No `.max()` on the password beyond a sanity bound: a length rule here would
 * reject long passphrases that the account may legitimately have been created
 * with, and this endpoint's job is to check a credential, not to re-litigate
 * the policy it was chosen under.
 */
export const LoginSchema = z
  .object({
    email,
    password: z.string().min(1, 'Password is required').max(1024),
  })
  .passthrough();

/** POST /password-reset — the ENFORCING reset endpoint (see the route). */
export const PasswordResetSchema = z
  .object({
    email,
    redirectTo: z.string().max(2048).optional(),
  })
  .passthrough();

/**
 * POST /confirm-email — the one route that already guarded its input
 * (`if (!email) return 400`), so this schema is a like-for-like replacement
 * rather than a new restriction.
 */
export const ConfirmEmailSchema = z.object({ email }).passthrough();

// ============================================================================
// auth-admin-routes.ts — the super-admin utility
// ============================================================================

/** POST /clear-rate-limit — super-admin session required (see the route).
 *  `email` is required: an undefined bucket key clears nothing while reporting
 *  success. */
export const ClearRateLimitSchema = z.object({ email }).passthrough();

// ============================================================================
// auth-signup.ts — POST /auth-signup/signup
// ============================================================================
//
// This is the ONLY signup route. It is mounted at `/auth-signup`
// (mount-core.ts) and is the endpoint the SPA calls — `authService.ts` and
// `SignupPage.tsx` both target `/auth-signup/signup`.
//
// A second one, `POST /auth/signup` in auth-routes.ts, had no caller and was
// removed: it created accounts with `email_confirm: true` for any address, with
// no rate limit, so anyone could hold a pre-verified account on an address they
// did not own — including a super-admin allowlist address with no account yet,
// which made it a one-request route to super-admin. Do not bring it back; an
// account must prove ownership of its address before it can sign in.
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
