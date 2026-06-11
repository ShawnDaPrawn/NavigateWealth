/**
 * Shared FNA Authentication Helper
 *
 * Centralised authentication for all FNA (Financial Needs Analysis) route modules.
 * Eliminates duplicated auth logic across Retirement, Risk Planning, Tax Planning,
 * Estate Planning, Investment INA, and Medical FNA route files.
 *
 * Supports two authentication modes:
 * 1. Anon key (admin access) — returns a deterministic admin user.
 *    ⚠️ KNOWN VULN (SECURITY-AUDIT C-7): the anon key is PUBLIC; this branch
 *    grants admin to anyone and must be removed during the frontend auth-token
 *    migration. Left in place for now because frontend callers depend on it.
 * 2. Real user tokens — validated via Supabase Auth, returns the authenticated user
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
import { constantTimeEqual } from './crypto-utils.ts';
import { resolveTrustedRole } from './constants.ts';

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
 * Admin user constant — returned when the anon key is used for authentication
 * (see the security-debt note in authenticateUser).
 */
const ADMIN_USER: FNAAuthUser = Object.freeze({
  id: 'admin',
  email: 'admin@system',
  role: 'admin',
});

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

  // ⚠️ SECURITY DEBT (SECURITY-AUDIT §8 C-7): this accepts the PUBLIC anon key
  // as full admin. The anon key ships in the browser bundle, so anyone can use
  // it to gain admin access to FNA/estate/form/communication endpoints. The
  // correct fix is a service-role-only check here — BUT several frontend
  // callers (communication/api.ts, WillDraftingFlow.tsx, …) currently send the
  // anon key as their bearer token, so removing this branch breaks them. This
  // MUST be removed as part of the frontend auth-token migration (SECURITY-AUDIT
  // §9); it is left in place only to avoid shipping a broken app in this pass.
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (anonKey && constantTimeEqual(token, anonKey)) {
    log.info(`[${context}] Using anon key (admin access — see SECURITY-AUDIT C-7)`);
    return ADMIN_USER;
  }

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
