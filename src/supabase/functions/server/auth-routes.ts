// Authentication Security Routes
// Implements secure authentication endpoints with rate limiting, logging, and validation

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { checkRateLimit, clearRateLimit, RATE_LIMITS } from './rateLimiter.ts';
import { logAuthEvent } from './authLogger.ts';
import {
  validatePassword,
  validateEmail,
  validatePhoneNumber,
  sanitizeInput,
} from './passwordValidator.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { SUPER_ADMIN_EMAIL } from './constants.ts';
import type { Context } from 'npm:hono';
import {
  extractClientIp,
  getBlockedIpAddress,
  getBlockedIpAddressWarning,
} from '../../../shared/submissions/blockedIpAddresses.ts';
import adminAuthRoutes from './auth-admin-routes.ts';
import { isTrustedRedirectOrigin } from './cors-origin.ts';
import {
  requireSuperAdmin,
  requirePrimaryAuth,
  enforceAccountSecurity,
  AuthError,
} from './auth-mw.ts';
import { validateBody } from './validate.ts';
import {
  SignupValidateSchema,
  SignupSchema,
  EmailOnlySchema,
  EmailAndUserIdSchema,
  LoginFailureSchema,
  ConfirmEmailSchema,
  LoginSchema,
  PasswordResetSchema,
} from './auth-validation.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const authRoutes = new Hono();
const log = createModuleLogger('auth-routes');

// Super-admin / dev-only auth utilities (Phase 7 max-lines split).
authRoutes.route('/', adminAuthRoutes);

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/**
 * Anon-key client, for the two routes that act ON BEHALF OF an anonymous
 * caller: `/login` (verify a password) and `/password-reset` (send a recovery
 * mail).
 *
 * Deliberately NOT `getSupabase()`. The service-role key bypasses GoTrue's
 * credential check — `signInWithPassword` under it is not a question with a
 * wrong answer — so using it on a login route would convert an authentication
 * into an impersonation. Separate factory, separate name, so the two cannot be
 * confused at a call site.
 *
 * `persistSession: false` because this is a server: a shared, module-scoped
 * client that remembered the last successful login would hand that session to
 * whoever called next.
 */
const getAnonClient = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Canonical site URL, used whenever a caller-supplied origin is not trusted.
 * Overridable so a staging deploy sends its links to staging. Mirrors the
 * helper of the same name in `auth-signup.ts`; read per call so a test can
 * stub the environment.
 */
function siteUrlFallback(): string {
  return Deno.env.get('SITE_URL') || 'https://www.navigatewealth.co';
}

// Helper function to get client IP
function getClientIP(c: Context): string {
  return extractClientIp((headerName) => c.req.header(headerName)) || 'unknown';
}

// Helper function to get user agent
function getUserAgent(c: Context): string {
  return c.req.header('User-Agent') || 'unknown';
}

/**
 * POST /auth/signup-validate
 * Server-side signup validation with rate limiting
 * Does NOT create the user - just validates the input
 */
authRoutes.post('/signup-validate', validateBody(SignupValidateSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  const blockedIpAddress = getBlockedIpAddress(ip);

  if (blockedIpAddress) {
    await logAuthEvent('signup_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: getBlockedIpAddressWarning(blockedIpAddress),
    });

    return c.json(
      {
        error: getBlockedIpAddressWarning(blockedIpAddress),
        blocked: true,
        warning: true,
        blockedIpAddress,
      },
      403,
    );
  }

  try {
    const { email, password, firstName, surname, phoneNumber, countryCode } = await c.req.json();

    // Rate limiting - check by IP and email
    const ipRateLimit = await checkRateLimit(ip, 'signup', RATE_LIMITS.SIGNUP);
    if (!ipRateLimit.allowed) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: ipRateLimit.reason,
      });

      return c.json(
        {
          error: 'Too many signup attempts. Please try again later.',
          blocked: true,
          resetAt: ipRateLimit.resetAt,
        },
        429,
      );
    }

    const emailRateLimit = await checkRateLimit(email, 'signup', RATE_LIMITS.SIGNUP);
    if (!emailRateLimit.allowed) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: emailRateLimit.reason,
      });

      return c.json(
        {
          error: 'Too many signup attempts. Please try again later.',
          blocked: true,
          resetAt: emailRateLimit.resetAt,
        },
        429,
      );
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: emailValidation.error,
      });

      return c.json({ error: emailValidation.error, field: 'email' }, 400);
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      await logAuthEvent('signup_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Weak password: ' + passwordValidation.errors.join(', '),
      });

      return c.json(
        {
          error: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
          field: 'password',
        },
        400,
      );
    }

    // Validate name fields
    if (!firstName || firstName.trim().length < 1) {
      return c.json({ error: 'First name is required', field: 'firstName' }, 400);
    }

    if (!surname || surname.trim().length < 1) {
      return c.json({ error: 'Surname is required', field: 'surname' }, 400);
    }

    // Validate phone number
    if (phoneNumber) {
      const phoneValidation = validatePhoneNumber(phoneNumber, countryCode || '+27');
      if (!phoneValidation.isValid) {
        return c.json({ error: phoneValidation.error, field: 'phoneNumber' }, 400);
      }
    }

    // Sanitize inputs
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedSurname = sanitizeInput(surname);

    // All validations passed
    await logAuthEvent('signup_attempt', email, true, {
      ip,
      userAgent,
      metadata: { validation: 'passed' },
    });

    return c.json(
      {
        valid: true,
        message: 'Validation passed',
        sanitized: {
          firstName: sanitizedFirstName,
          surname: sanitizedSurname,
        },
      },
      200,
    );
  } catch (error) {
    await logAuthEvent('signup_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return c.json(
      {
        error: 'Validation failed. Please try again.',
      },
      500,
    );
  }
});

/**
 * POST /auth/signup
 * Create a new user with admin privileges (auto-confirm email)
 * Use this for manual signup/seeding when email service is not available
 */
authRoutes.post('/signup', validateBody(SignupSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);
  const blockedIpAddress = getBlockedIpAddress(ip);

  if (blockedIpAddress) {
    await logAuthEvent('signup_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: getBlockedIpAddressWarning(blockedIpAddress),
    });

    return c.json(
      {
        error: getBlockedIpAddressWarning(blockedIpAddress),
        blocked: true,
        warning: true,
        blockedIpAddress,
      },
      403,
    );
  }

  try {
    const { email, password, metadata } = await c.req.json();

    // SECURITY: never let the client set privileged fields via signup metadata.
    // The auth middleware derives role from user_metadata.role, so accepting a
    // caller-supplied `role` (or status flags) here is a privilege-escalation
    // vector (an attacker could self-provision a super_admin). Strip them.
    const safeMetadata: Record<string, unknown> = { ...(metadata || {}) };
    for (const privileged of ['role', 'accountStatus', 'adviserAssigned', 'suspended']) {
      delete safeMetadata[privileged];
    }

    // Create user with admin client (bypasses email verification if email_confirm is true)
    const { data, error } = await getSupabase().auth.admin.createUser({
      email,
      password,
      user_metadata: safeMetadata,
      email_confirm: true,
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    if (!data.user) {
      return c.json({ error: 'Failed to create user' }, 500);
    }

    await logAuthEvent('signup_success', email, true, {
      userId: data.user.id,
      ip,
      userAgent,
      method: 'admin_create_user',
    });

    return c.json(
      {
        success: true,
        user: data.user,
        message: 'User created and verified successfully',
      },
      200,
    );
  } catch (error) {
    log.error('Signup error', error);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

/**
 * POST /auth/login  — authentication with the rate limit IN the path
 * ==================================================================
 *
 * WHY THIS ROUTE EXISTS
 * ---------------------
 * `/login-validate` below is a pre-flight check: the browser asks "may I try?",
 * this server answers, and then the browser authenticates against GoTrue on
 * its own. Every part of that works — except that the second step does not
 * depend on the first. A client that simply skips the question, or any caller
 * that was never a browser, goes straight to
 * `POST /auth/v1/token?grant_type=password` and the 5-attempts-in-15-minutes
 * lockout never runs. The limiter was next to the auth path rather than in it,
 * which makes it a UX nicety rather than a control.
 *
 * This route performs the authentication itself, after the limit, so the two
 * cannot be separated. The limiter is now load-bearing: attempt six fails
 * because this endpoint refuses to call GoTrue, not because a cooperative
 * client decided not to.
 *
 * WHAT IT DOES NOT CLAIM
 * ----------------------
 * GoTrue is still reachable directly — it has to be; it is a hosted service on
 * a public URL, and the SPA's own session refresh talks to it. What changes is
 * that the application's OWN login path can no longer be used to bypass the
 * lockout, and the SPA no longer offers a working example of how. Supabase's
 * built-in per-IP limits remain the floor for anyone going around it.
 *
 * SESSION HANDLING
 * ----------------
 * Returns the GoTrue session verbatim so the client can install it with
 * `setSession()`. Nothing is minted, signed or cached here — this server never
 * becomes a second issuer of credentials, which would be a far larger change
 * than closing a rate-limit hole.
 *
 * The anon key is used for the sign-in itself, exactly as the browser would.
 * The service-role key is never involved in checking a password: it would
 * succeed regardless of the password, and using it here would turn a
 * credential check into a credential bypass one refactor from now.
 */
authRoutes.post('/login', validateBody(LoginSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  // Same IP block-list that guards signup — applied before any work is done.
  const blockedIpAddress = getBlockedIpAddress(ip);
  if (blockedIpAddress) {
    log.warn('Blocked login from abusive IP address', { blockedIpAddress });
    return c.json({ error: getBlockedIpAddressWarning(blockedIpAddress), warning: true }, 403);
  }

  let email = '';
  try {
    const body = (await c.req.json()) as { email: string; password: string };
    email = body.email;
    const { password } = body;

    // Super-admin exemption, kept deliberately narrow — see the long note on
    // the same check in /login-validate. It exempts ONE hardcoded address from
    // rate limiting and nothing else; the password is still verified below.
    const isSuperAdmin = email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    if (!isSuperAdmin) {
      // Two dimensions, both enforced. IP first so a single attacker cannot
      // walk a dictionary of addresses to get a fresh bucket per guess.
      for (const [identifier, label] of [
        [ip, 'ip'],
        [email, 'email'],
      ] as const) {
        const limit = await checkRateLimit(identifier, 'login', RATE_LIMITS.LOGIN);
        if (!limit.allowed) {
          await logAuthEvent('login_attempt', email, false, {
            ip,
            userAgent,
            errorMessage: `Rate limit exceeded (${label})`,
          });
          if (limit.blocked) {
            await logAuthEvent('account_locked', email, false, {
              ip,
              userAgent,
              errorMessage: limit.reason,
            });
          }
          const retryAfter = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000));
          c.header('Retry-After', String(retryAfter));
          return c.json(
            {
              error: 'Too many login attempts. Please try again later.',
              blocked: true,
              resetAt: limit.resetAt,
            },
            429,
          );
        }
      }
    }

    // Authenticate as the browser would: anon key, no elevated privilege.
    const { data, error } = await getAnonClient().auth.signInWithPassword({ email, password });

    if (error || !data?.session || !data?.user) {
      await logAuthEvent('login_failure', email, false, {
        ip,
        userAgent,
        errorMessage: error?.message ?? 'No session returned',
      });
      // One message for "no such account" and for "wrong password" — the
      // difference between them is exactly what an enumeration probe is after.
      return c.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 401);
    }

    // Correct credentials clear the counters, so a user who mistyped four
    // times and then succeeded is not one slip away from a 30-minute lockout.
    await clearRateLimit(ip, 'login');
    await clearRateLimit(email, 'login');

    await logAuthEvent('login_success', email, true, { userId: data.user.id, ip, userAgent });

    return c.json({ success: true, session: data.session, user: data.user }, 200);
  } catch (error) {
    log.error('Login error', error);
    await logAuthEvent('login_failure', email || undefined, false, {
      ip,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return c.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, 401);
  }
});

/**
 * POST /auth/password-reset — reset email with the rate limit IN the path
 * =======================================================================
 *
 * The sibling of `/login` above, and it exists for the same reason.
 * `/password-reset-request` (below) is called by the client AFTER it has
 * already asked GoTrue to send the email, so the 3-per-hour limit it applies
 * has nothing left to prevent — the message is gone by the time the counter
 * moves. This route sends the email itself, on the far side of the limit.
 *
 * ALWAYS 200, ALWAYS THE SAME BODY
 * --------------------------------
 * Unknown address, rate-limited, malformed, GoTrue outage — every outcome
 * returns the identical message. A caller cannot tell an account that exists
 * from one that does not, and cannot tell that it has been throttled, which
 * would otherwise itself confirm that the address is worth attacking.
 */
authRoutes.post('/password-reset', validateBody(PasswordResetSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  /** The one response this route is allowed to give. */
  const genericResponse = () =>
    c.json(
      {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      },
      200,
    );

  try {
    const { email, redirectTo } = (await c.req.json()) as {
      email: string;
      redirectTo?: string;
    };

    for (const [identifier, label] of [
      [ip, 'ip'],
      [email, 'email'],
    ] as const) {
      const limit = await checkRateLimit(identifier, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
      if (!limit.allowed) {
        await logAuthEvent('password_reset_request', email, false, {
          ip,
          userAgent,
          errorMessage: `Rate limit exceeded (${label})`,
        });
        return genericResponse();
      }
    }

    if (!validateEmail(email).isValid) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Invalid email format',
      });
      return genericResponse();
    }

    // Where the recovery link is allowed to land.
    //
    // A reset link IS a credential: whoever opens it can set the password. So
    // the destination must never be chosen by the caller — and validating
    // `redirectTo` against the request's own `Origin` header would be exactly
    // that, since an attacker supplies both and a same-origin check between two
    // attacker-supplied values always passes. (It did, in the first version of
    // this route.)
    //
    // `isTrustedRedirectOrigin` checks the configured allow-list instead, and
    // fails CLOSED: an unrecognised origin — or no allow-list at all — falls
    // back to the canonical site. A wrong-but-canonical redirect is a support
    // ticket; an attacker-chosen one is account takeover.
    const requestOrigin = c.req.header('origin');
    const trustedBase = (
      isTrustedRedirectOrigin(requestOrigin) ? requestOrigin! : siteUrlFallback()
    ).replace(/\/+$/, '');

    const safeRedirect =
      redirectTo && redirectTo.startsWith(`${trustedBase}/`)
        ? redirectTo
        : `${trustedBase}/reset-password`;

    const { error } = await getAnonClient().auth.resetPasswordForEmail(email, {
      redirectTo: safeRedirect,
    });

    if (error) {
      // Logged, never surfaced: which addresses fail is the enumeration signal.
      log.warn('Password reset dispatch failed', { error: error.message });
    }

    await logAuthEvent('password_reset_request', email, true, { ip, userAgent });
    return genericResponse();
  } catch (error) {
    log.error('Password reset error', error);
    return genericResponse();
  }
});

/**
 * POST /auth/login-validate
 * Server-side login validation with rate limiting
 * Returns whether credentials are valid and logs the attempt
 */
authRoutes.post('/login-validate', validateBody(EmailOnlySchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  try {
    const { email } = await c.req.json();

    // Super admin email - exempt from rate limiting.
    //
    // SECURITY-AUDIT A10: deliberately NOT widened to `isSuperAdminEmail()`.
    // Every other super-admin check moved to the allowlist, but this one runs
    // BEFORE authentication on an address taken straight from the request body,
    // and what it grants is exemption from login rate limiting. Widening it
    // would hand unlimited login attempts to more addresses — and, through the
    // SUPER_ADMIN_EMAILS env override, to whatever that variable happens to
    // contain. A brute-force bypass is the one place where the narrower rule is
    // the safer one, so this keeps the single owner identity on purpose.
    const isSuperAdmin = email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

    if (isSuperAdmin) {
      // Skip rate limiting for super admin
      await logAuthEvent('login_attempt', email, true, {
        ip,
        userAgent,
        metadata: { validation: 'passed', superAdmin: true },
      });

      return c.json({ success: true, superAdmin: true }, 200);
    }

    // Rate limiting - check by IP and email (only for non-super-admin users)
    const ipRateLimit = await checkRateLimit(ip, 'login', RATE_LIMITS.LOGIN);
    if (!ipRateLimit.allowed) {
      await logAuthEvent('login_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded',
      });

      // Log account locked event
      if (ipRateLimit.blocked) {
        await logAuthEvent('account_locked', email, false, {
          ip,
          userAgent,
          errorMessage: ipRateLimit.reason,
        });
      }

      // Generic message to prevent account enumeration
      return c.json(
        {
          error: 'Too many login attempts. Please try again later.',
          blocked: true,
          resetAt: ipRateLimit.resetAt,
        },
        429,
      );
    }

    const emailRateLimit = await checkRateLimit(email, 'login', RATE_LIMITS.LOGIN);
    if (!emailRateLimit.allowed) {
      await logAuthEvent('login_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded for email',
      });

      if (emailRateLimit.blocked) {
        await logAuthEvent('account_locked', email, false, {
          ip,
          userAgent,
          errorMessage: emailRateLimit.reason,
        });
      }

      return c.json(
        {
          error: 'Too many login attempts. Please try again later.',
          blocked: true,
          resetAt: emailRateLimit.resetAt,
        },
        429,
      );
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      await logAuthEvent('login_attempt', email, false, {
        ip,
        userAgent,
        errorMessage: 'Invalid email format',
      });

      // Generic error message (no account enumeration)
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    await logAuthEvent('login_attempt', email, true, {
      ip,
      userAgent,
      metadata: { validation: 'passed' },
    });

    return c.json({ valid: true }, 200);
  } catch (error) {
    await logAuthEvent('login_attempt', undefined, false, {
      ip,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    // Generic error message
    return c.json({ error: 'Invalid credentials' }, 401);
  }
});

/**
 * POST /auth/login-success
 * Called after successful login to clear rate limits and log success
 */
authRoutes.post('/login-success', validateBody(EmailAndUserIdSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  try {
    const { email, userId } = await c.req.json();

    // Clear rate limits for successful login
    await clearRateLimit(ip, 'login');
    await clearRateLimit(email, 'login');

    // Log successful login
    await logAuthEvent('login_success', email, true, {
      userId,
      ip,
      userAgent,
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    log.error('Login success log error', error);
    return c.json({ error: 'Failed to log login success' }, 500);
  }
});

/**
 * POST /auth/login-failure
 * Called after failed login to log the failure
 */
authRoutes.post('/login-failure', validateBody(LoginFailureSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  try {
    const { email, reason } = await c.req.json();

    // Log failed login
    await logAuthEvent('login_failure', email, false, {
      ip,
      userAgent,
      errorMessage: reason || 'Invalid credentials',
    });

    // Generic response (no account enumeration)
    return c.json({ error: 'Invalid credentials' }, 401);
  } catch (_error) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
});

/**
 * POST /auth/logout
 * Log user logout event
 */
authRoutes.post('/logout', validateBody(EmailAndUserIdSchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  try {
    const { email, userId } = await c.req.json();

    await logAuthEvent('logout', email, true, {
      userId,
      ip,
      userAgent,
    });

    return c.json({ success: true }, 200);
  } catch (error) {
    log.error('Logout error', error);
    return c.json({ success: true }, 200); // Don't fail logout on logging error
  }
});

/**
 * POST /auth/password-reset-request
 * Handle password reset request with rate limiting
 */
authRoutes.post('/password-reset-request', validateBody(EmailOnlySchema), async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  try {
    const { email } = await c.req.json();

    // Rate limiting
    const ipRateLimit = await checkRateLimit(ip, 'password_reset', RATE_LIMITS.PASSWORD_RESET);
    if (!ipRateLimit.allowed) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded',
      });

      // Generic message (no account enumeration)
      return c.json(
        {
          message: 'If an account exists with this email, a password reset link has been sent.',
        },
        200,
      );
    }

    const emailRateLimit = await checkRateLimit(
      email,
      'password_reset',
      RATE_LIMITS.PASSWORD_RESET,
    );
    if (!emailRateLimit.allowed) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Rate limit exceeded for email',
      });

      // Generic message (no account enumeration)
      return c.json(
        {
          message: 'If an account exists with this email, a password reset link has been sent.',
        },
        200,
      );
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      await logAuthEvent('password_reset_request', email, false, {
        ip,
        userAgent,
        errorMessage: 'Invalid email format',
      });

      // Generic message (no account enumeration)
      return c.json(
        {
          message: 'If an account exists with this email, a password reset link has been sent.',
        },
        200,
      );
    }

    // Log the request (success, but we don't reveal if account exists)
    await logAuthEvent('password_reset_request', email, true, {
      ip,
      userAgent,
    });

    // Generic success message (no account enumeration)
    return c.json(
      {
        message: 'If an account exists with this email, a password reset link has been sent.',
        success: true,
      },
      200,
    );
  } catch (_error) {
    // Generic message even on error (no account enumeration)
    return c.json(
      {
        message: 'If an account exists with this email, a password reset link has been sent.',
      },
      200,
    );
  }
});

/**
 * POST /auth/password-change
 *
 * Records the change AND draws the session-revocation watermark for the
 * account. This is the path the RESET flow takes: `ResetPasswordPage` →
 * `updatePassword()` → `supabase.auth.updateUser({ password })`, which never
 * touches `/security/:userId/password` and so would otherwise rotate the
 * credential while leaving every pre-existing session alive.
 *
 * NOW REQUIRES AUTHENTICATION, and derives the identity from the token.
 * -------------------------------------------------------------------
 * It used to take `email` and `userId` from the request body with no auth at
 * all, which made it two things it should not have been: a way for anyone to
 * write arbitrary entries into another account's security log, and — once it
 * started revoking sessions — a way to sign an arbitrary user out by asserting
 * their id. The body values are now ignored in favour of the verified token.
 *
 * `requirePrimaryAuth`, not `requireAuth`: a user completing a password reset
 * may be mid-2FA or otherwise not yet past the full account gate, and this
 * endpoint must not be the thing that stops them finishing the reset. It still
 * proves possession of a valid session for the account it acts on, which is
 * the property that matters here.
 */
authRoutes.post('/password-change', requirePrimaryAuth, async (c) => {
  const ip = getClientIP(c);
  const userAgent = getUserAgent(c);

  const userId = c.get('userId') as string;
  const email = c.get('userEmail') as string | undefined;

  try {
    // Watermark at the caller's own token, so the session that just performed
    // the change survives and every older one does not. See
    // session-revocation.ts for why this is not `now`.
    const accessToken = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    const { revokeSessionsAfterCredentialChange } = await import('./session-revocation.ts');
    const revocation = await revokeSessionsAfterCredentialChange({
      userId,
      actor: 'self',
      accessToken,
      scope: 'others',
    });

    await logAuthEvent('password_change', email, true, {
      userId,
      ip,
      userAgent,
      metadata: { sessionsRevoked: revocation.stamped, goTrueRevoked: revocation.goTrueRevoked },
    });

    return c.json({ success: true, sessionsRevoked: revocation.stamped }, 200);
  } catch (error) {
    // The password itself has already changed by the time this runs, so a
    // failure here must not read as "the change failed". It IS worth logging
    // as a security event: a change whose sessions were not revoked is the
    // exact condition someone would want to find in the log later.
    log.error('Password-change bookkeeping failed', error);
    await logAuthEvent('password_change', email, false, {
      userId,
      ip,
      userAgent,
      errorMessage: 'Session revocation or logging failed',
    });
    return c.json({ error: 'Failed to log password change' }, 500);
  }
});

/**
 * GET /auth/security-status
 * Get security status for admin dashboard
 * Requires admin authentication
 */
authRoutes.get('/security-status', async (c) => {
  try {
    // Check authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Same account-security policy as auth-mw (P1.2). This handler verifies the
    // token itself rather than going through requireAdmin, and so had skipped
    // the suspended/deleted/stale-2FA check entirely.
    try {
      await enforceAccountSecurity(user.id);
    } catch (securityError) {
      if (securityError instanceof AuthError) {
        return c.json(
          { error: securityError.message, code: securityError.code },
          securityError.statusCode as 403,
        );
      }
      throw securityError;
    }

    // Check if user is admin
    const userProfile = await kv.get(`user_profile:${user.id}:personal_info`);
    if (
      !userProfile ||
      (userProfile.role !== 'admin' &&
        userProfile.role !== 'super_admin' &&
        userProfile.role !== 'super-admin')
    ) {
      return c.json({ error: 'Forbidden - Admin access required' }, 403);
    }

    // Get security statistics
    const authLogger = await import('./authLogger.ts');
    const stats = await authLogger.getSecurityStats();

    return c.json(
      {
        success: true,
        stats,
        timestamp: new Date().toISOString(),
      },
      200,
    );
  } catch (_error) {
    return c.json({ error: 'Failed to fetch security status' }, 500);
  }
});

/**
 * POST /auth/confirm-email
 * WORKAROUND: Legacy users created with email_confirm:false cannot sign in
 * because Supabase returns "Invalid login credentials" for unconfirmed emails.
 * This endpoint auto-confirms the email so the frontend can retry signInWithPassword.
 * Proper fix: all new signups now use email_confirm:true (see auth-signup.ts).
 * Searchable tag: // WORKAROUND: unconfirmed-email-login-fix
 */
authRoutes.post(
  '/confirm-email',
  requireSuperAdmin,
  validateBody(ConfirmEmailSchema),
  async (c) => {
    try {
      const { email } = await c.req.json();

      if (!email) {
        return c.json({ error: 'Email is required' }, 400);
      }

      const supabase = getSupabase();

      // Find the user by email
      const {
        data: { users },
        error: listError,
      } = await supabase.auth.admin.listUsers();
      if (listError) {
        log.error('Error listing users for email confirmation:', listError);
        return c.json({ error: 'Internal error' }, 500);
      }

      const user = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) {
        // Don't reveal whether the account exists (anti-enumeration)
        return c.json({ confirmed: false }, 200);
      }

      // If already confirmed, nothing to do
      if (user.email_confirmed_at) {
        return c.json({ confirmed: true, alreadyConfirmed: true }, 200);
      }

      // Confirm the email
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      if (updateError) {
        log.error('Error confirming email for user:', updateError);
        return c.json({ confirmed: false }, 200);
      }

      log.info('Auto-confirmed email for legacy user:', email);
      await AdminAuditService.record({
        actorId: c.get('userId') as string,
        actorRole: c.get('userRole') as string,
        category: 'security',
        action: 'legacy_email_confirmed',
        summary: 'Confirmed a legacy user email after super-admin review',
        severity: 'warning',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email },
      });
      return c.json({ confirmed: true }, 200);
    } catch (error) {
      log.error('confirm-email error:', error);
      return c.json({ confirmed: false }, 200);
    }
  },
);

export default authRoutes;
