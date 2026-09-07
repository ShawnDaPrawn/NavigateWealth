/**
 * Auth Middleware
 *
 * Provides authentication and authorization guards for routes.
 *
 * Bundler Stability Fix 3.3.3
 */

import { Context, Next } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { logger } from './stderr-logger.ts';
import { resolveTrustedRole } from './constants.ts';
import * as kv from './kv_store.tsx';
import { readTokenIssuedAt } from './jwt-claims.ts';

declare module 'npm:hono' {
  interface ContextVariableMap {
    userId: string;
    userRole: string;
    user: unknown;
    requestId: string;
    userEmail: string | undefined;
    profile: unknown;
  }
}

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/**
 * Authentication Error Class
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code: string = 'AUTH_ERROR',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const TWO_FACTOR_GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * The ONE account-security policy: reject deleted, suspended, stale-2FA and
 * REVOKED-SESSION accounts. Exported so `fna-auth.ts` applies the same rules
 * rather than a second, weaker copy — a suspended user was previously still
 * able to reach every route behind the FNA gateway (14 modules covering FNA,
 * tax, estate, wills and form-prefill), because that gateway validated the
 * token and stopped there.
 *
 * Do not fork this. Two divergent account-security policies is precisely the
 * drift that produced S12.
 *
 * SESSION REVOCATION (`sessionsValidFrom`)
 * ----------------------------------------
 * A password change must invalidate every session that existed before it —
 * otherwise the credential rotation that a compromised user performs leaves
 * the attacker's stolen session alive, which is the one outcome the change was
 * meant to prevent.
 *
 * GoTrue can revoke refresh tokens, but only for a session whose JWT the
 * caller holds: `auth.admin.signOut(jwt, scope)` takes an access token, not a
 * user id. That covers the self-service path and NOT an administrator
 * resetting someone else's password. So revocation is enforced here as well,
 * where every authenticated route already passes: `security:{userId}` carries
 * a `sessionsValidFrom` stamp, and any access token minted before it is
 * refused. Both halves are used together — the GoTrue call kills the refresh
 * token so the session cannot be renewed, this check kills the access token
 * already in the attacker's hands before it expires.
 *
 * EVERY caller now passes the `iat`. The first version of this made the
 * parameter optional and left four hand-rolled auth paths — `ai-advisor.ts`,
 * `ai-intelligence.tsx`, `tasks-digest-routes.ts` and the admin check in
 * `auth-routes.ts` — calling it with one argument. All four already had the
 * raw token in scope, so that was not "cannot tell", it was "did not ask": a
 * revoked token kept working on those routes, the paid AI endpoints included.
 * They pass it now, and `session-revocation.test.ts` pins the behaviour.
 *
 * The parameter stays optional, and null still fails OPEN, for one reason: a
 * FUTURE caller that genuinely cannot produce an `iat` must degrade to today's
 * behaviour rather than locking every user out of its routes on the first
 * password change anyone performs. It is not a licence to omit it — if you are
 * holding a token, pass `readTokenIssuedAt(token)`.
 *
 * Naming the two role guards adjacently in prose is deliberately avoided here:
 * `auth-middleware-cost.test.ts` greps this source for the redundant
 * `requireAuth`-then-role-guard pairing, and a comment containing that literal
 * sequence reads to it as a real route registration.
 */
export async function enforceAccountSecurity(
  userId: string,
  issuedAtSeconds?: number | null,
): Promise<void> {
  let status: Record<string, unknown> | null;
  try {
    status = (await kv.get(`security:${userId}`)) as Record<string, unknown> | null;
  } catch (error) {
    logger.error('Account security state lookup failed', error);
    throw new AuthError(
      'Security status is temporarily unavailable',
      503,
      'SECURITY_STATE_UNAVAILABLE',
    );
  }

  if (!status) return;
  if (status.deleted === true) {
    throw new AuthError('Account is closed', 403, 'ACCOUNT_DELETED');
  }
  if (status.suspended === true) {
    throw new AuthError('Account is suspended', 403, 'ACCOUNT_SUSPENDED');
  }
  const sessionsValidFrom =
    typeof status.sessionsValidFrom === 'string'
      ? Date.parse(status.sessionsValidFrom)
      : Number.NaN;
  if (
    Number.isFinite(sessionsValidFrom) &&
    typeof issuedAtSeconds === 'number' &&
    Number.isFinite(issuedAtSeconds)
  ) {
    // One second of slack: `iat` has second granularity, so a token minted in
    // the same second as the stamp is the NEW session, not an old one.
    if (issuedAtSeconds * 1000 < sessionsValidFrom - 1000) {
      throw new AuthError(
        'Your session ended because the account password changed. Please sign in again.',
        401,
        'SESSION_REVOKED',
      );
    }
  }

  if (status.twoFactorEnabled === true) {
    const verifiedAt =
      typeof status.last2faVerifiedAt === 'string'
        ? new Date(status.last2faVerifiedAt).getTime()
        : Number.NaN;
    if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt >= TWO_FACTOR_GRACE_MS) {
      throw new AuthError('Two-factor verification required', 403, 'TWO_FACTOR_REQUIRED');
    }
  }
}

/**
 * Get auth context manually (for non-middleware use).
 * Throws AuthError on failure — suitable for try/catch patterns in route handlers.
 */
export async function getAuthContext(c: Context) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Unauthorized: Missing token', 401, 'AUTH_REQUIRED');
  }

  const token = authHeader.split(' ')[1];
  const {
    data: { user },
    error,
  } = await getSupabase().auth.getUser(token);

  if (error || !user) {
    logger.error('Auth context check failed', error);
    throw new AuthError('Invalid or expired session', 401, 'AUTH_INVALID');
  }

  await enforceAccountSecurity(user.id, readTokenIssuedAt(token));

  // Resolve role from trusted sources only (super-admin allowlist,
  // app_metadata, NW_ADMIN_EMAILS) — privileged values in client-editable
  // user_metadata are NOT honoured. See resolveTrustedRole in constants.ts.
  const role = resolveTrustedRole(user);

  return {
    user,
    userId: user.id,
    role,
    token,
  };
}

/** Resolved auth context returned by resolveAuthUser on success. */
interface ResolvedAuthUser {
  user: any;
  userId: string;
  role: string;
}

/**
 * Shared auth resolution for middleware functions.
 *
 * Extracts the Bearer token, validates the user via Supabase Auth,
 * resolves the effective role (with super-admin email override),
 * and sets context variables (user, userId, userRole) on the Hono context.
 *
 * Returns the resolved auth context on success, or a 401 JSON Response
 * on failure. Callers should check `result instanceof Response` to
 * distinguish the two cases.
 */
async function resolveAuthUser(
  c: Context,
  enforceSecurityState = true,
): Promise<ResolvedAuthUser | Response> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const {
    data: { user },
    error,
  } = await getSupabase().auth.getUser(token);

  if (error || !user) {
    logger.error('Auth check failed', error);
    return c.json({ error: 'Invalid or expired session', code: 'AUTH_INVALID' }, 401);
  }

  if (enforceSecurityState) {
    try {
      await enforceAccountSecurity(user.id, readTokenIssuedAt(token));
    } catch (securityError) {
      if (securityError instanceof AuthError) {
        return c.json(
          { error: securityError.message, code: securityError.code },
          securityError.statusCode as 401 | 403 | 503,
        );
      }
      throw securityError;
    }
  }

  // Resolve role from trusted sources only (super-admin allowlist,
  // app_metadata, NW_ADMIN_EMAILS) — privileged values in client-editable
  // user_metadata are NOT honoured. See resolveTrustedRole in constants.ts.
  const role = resolveTrustedRole(user);

  // Set user context on the Hono context for downstream handlers
  c.set('user', user);
  c.set('userId', user.id);
  c.set('userRole', role);
  c.set('userEmail', user.email);

  return { user, userId: user.id, role };
}

/**
 * Require valid authentication session
 */
export async function requireAuth(c: Context, next: Next) {
  const result = await resolveAuthUser(c);
  if (result instanceof Response) return result;

  await next();
}

/**
 * Require a valid primary Supabase session without applying the account-state
 * gate. Only challenge/status endpoints should use this so a 2FA user can
 * complete the factor that unlocks normal APIs.
 */
export async function requirePrimaryAuth(c: Context, next: Next) {
  const result = await resolveAuthUser(c, false);
  if (result instanceof Response) return result;
  await next();
}

/**
 * Require admin role
 */
export async function requireAdmin(c: Context, next: Next) {
  const result = await resolveAuthUser(c);
  if (result instanceof Response) return result;

  if (result.role !== 'admin' && result.role !== 'super_admin' && result.role !== 'super-admin') {
    return c.json({ error: 'Forbidden: Admin access required', code: 'FORBIDDEN_ADMIN' }, 403);
  }

  await next();
}

/**
 * Require super-admin role
 */
export async function requireSuperAdmin(c: Context, next: Next) {
  const result = await resolveAuthUser(c);
  if (result instanceof Response) return result;

  if (result.role !== 'super_admin' && result.role !== 'super-admin') {
    return c.json(
      { error: 'Forbidden: Super Admin access required', code: 'FORBIDDEN_SUPER_ADMIN' },
      403,
    );
  }

  await next();
}

/**
 * Helper to handle errors in routes
 */
export function handleError(c: Context, error: unknown) {
  logger.error('Route error', error);

  if (error instanceof AuthError) {
    return new Response(JSON.stringify({ error: error.message, code: error.code }), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  const status = (error as Error & { status?: number })?.status || 500;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Require specific role (helper for manual checks)
 */
export function requireRole(ctx: { role: string }, allowedRoles: string[]) {
  if (!allowedRoles.includes(ctx.role)) {
    throw new AuthError(
      `Forbidden: Requires one of [${allowedRoles.join(', ')}]`,
      403,
      'FORBIDDEN',
    );
  }
}
