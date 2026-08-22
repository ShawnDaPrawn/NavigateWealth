/**
 * Shared FNA Authentication Helper
 *
 * Centralised authentication for all FNA (Financial Needs Analysis) route modules.
 * Eliminates duplicated auth logic across Retirement, Risk Planning, Tax Planning,
 * Estate Planning, Investment INA, and Medical FNA route files.
 *
 * Accepts only real user access tokens validated through Supabase Auth.
 *
 * Usage:
 *   import { authenticateUser } from './fna-auth.ts';
 *   const user = await authenticateUser(c.req.header('Authorization'), 'my-module');
 *
 * Phase 3 of the FNA uniformity alignment plan.
 * Moved from shared/ subdirectory to root server directory for bundler compatibility.
 */

import type { Context } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { resolveTrustedRole } from './constants.ts';
import { enforceAccountSecurity, AuthError } from './auth-mw.ts';

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const log = createModuleLogger('fna-auth');

/**
 * Authenticated user shape returned by authenticateUser.
 * All FNA modules receive this consistent type.
 */
export interface FNAAuthUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Authenticate a user from the Authorization header.
 *
 * @param authHeader - The raw Authorization header value (may be null or undefined)
 * @param moduleName - Optional module name for contextual logging (e.g. 'retirement-fna')
 * @returns The authenticated user object
 * @throws Error('Unauthorized') if authentication fails
 */
export async function authenticateUser(
  authHeader: string | null | undefined,
  moduleName?: string,
): Promise<FNAAuthUser> {
  const context = moduleName || 'fna';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    log.error(`[${context}] No auth header or invalid format`);
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];

  // Validate as a real user token
  try {
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      log.error(`[${context}] Auth validation failed`, error);
      throw new Error('Unauthorized');
    }

    // Same account-security policy as every auth-mw route (P1.5). Without this
    // a SUSPENDED or DELETED user kept full access to everything behind this
    // gateway — FNA, tax, estate, wills, form-prefill — for as long as their
    // JWT stayed valid, because suspending an account never invalidates an
    // already-issued token. Throws AuthError (403), preserved by the catch
    // below and mapped by fnaErrorResponse.
    await enforceAccountSecurity(user.id);

    // Role from trusted sources only — isFnaAdminRole grants admin powers to
    // 'adviser' as well, so privileged values in client-editable user_metadata
    // must not be honoured here either. See resolveTrustedRole in constants.ts.
    const authUser: FNAAuthUser = {
      id: user.id,
      email: user.email || '',
      role: resolveTrustedRole(user),
    };

    log.info(`[${context}] User authenticated`, { userId: authUser.id });
    return authUser;
  } catch (err: unknown) {
    // Re-throw if it's already our Unauthorized error
    if (err instanceof Error && err.message === 'Unauthorized') {
      throw err;
    }
    // An AuthError carries a deliberate status and code (ACCOUNT_SUSPENDED,
    // ACCOUNT_DELETED, TWO_FACTOR_REQUIRED). Flattening it to a generic
    // 'Unauthorized' would turn a 403 "you are suspended" into a 401 "log in
    // again", which sends the user round a login loop that cannot succeed.
    if (err instanceof AuthError) {
      throw err;
    }
    log.error(`[${context}] Unexpected auth failure`, err);
    throw new Error('Unauthorized', { cause: err });
  }
}

/** True when authenticateUser rejected the request. */
export function isFnaUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message === 'Unauthorized';
}

/** Map FNA route errors to correct HTTP status (401 for auth failures). */
export function fnaErrorResponse(c: Context, error: unknown) {
  if (isFnaUnauthorized(error)) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Account-security rejections carry their own status and code. Matched
  // structurally rather than by message text, so the reason survives to the
  // client — AuthContext.tsx keys off `code === 'TWO_FACTOR_REQUIRED'`.
  if (error instanceof AuthError) {
    return c.json(
      { success: false, error: error.message, code: error.code },
      error.statusCode as 403,
    );
  }

  if (error instanceof Error && error.name === 'FnaIntakeError' && 'status' in error) {
    const intakeError = error as { status: number; message: string };
    return c.json({ success: false, error: intakeError.message }, intakeError.status as 400);
  }

  if (error && typeof error === 'object' && 'issues' in error) {
    return c.json(
      {
        success: false,
        error: 'Validation failed',
        details: (error as { issues: unknown }).issues,
      },
      400,
    );
  }

  const message = getErrMsg(error);
  if (/not found/i.test(message)) {
    return c.json({ success: false, error: message }, 404);
  }
  if (/unauthorized|forbidden|access denied/i.test(message)) {
    return c.json({ success: false, error: message }, 403);
  }
  if (/already submitted|already accepted|cannot be (submitted|updated|accepted)/i.test(message)) {
    return c.json({ success: false, error: message }, 422);
  }

  return c.json({ success: false, error: message }, 500);
}

/** True when the user is the synthetic admin identity from anon-key auth. */
export function isSyntheticAdminUser(user: FNAAuthUser): boolean {
  return user.id === 'admin';
}

/** Client-owned intake writes require a real authenticated user JWT. */
export function requireRealUserForClientWrite(user: FNAAuthUser): void {
  if (isSyntheticAdminUser(user)) {
    throw new Error('Unauthorized');
  }
}

/** Admin intake mutations (accept, request-info) require a real user JWT. */
export function requireRealUserForIntakeAdmin(user: FNAAuthUser): void {
  requireRealUserForClientWrite(user);
}

export function isFnaAdminRole(role: string): boolean {
  return role === 'admin' || role === 'super_admin' || role === 'super-admin' || role === 'adviser';
}
