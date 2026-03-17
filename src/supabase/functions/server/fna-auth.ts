/**
 * Shared FNA Authentication Helper
 * 
 * Centralised authentication for all FNA (Financial Needs Analysis) route modules.
 * Eliminates duplicated auth logic across Retirement, Risk Planning, Tax Planning,
 * Estate Planning, Investment INA, and Medical FNA route files.
 * 
 * Supports two authentication modes:
 * 1. Anon key (admin/development access) — returns a deterministic admin user
 * 2. Real user tokens — validated via Supabase Auth, returns the authenticated user
 * 
 * Usage:
 *   import { authenticateUser } from './fna-auth.ts';
 *   const user = await authenticateUser(c.req.header('Authorization'), 'my-module');
 * 
 * Phase 3 of the FNA uniformity alignment plan.
 * Moved from shared/ subdirectory to root server directory for bundler compatibility.
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createModuleLogger } from "./stderr-logger.ts";

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
 * Admin user constant — returned when the anon key is used for authentication.
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

  // Check if this is the anon key (for admin/development access)
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (token === anonKey) {
    log.info(`[${context}] Using anon key (admin access)`);
    return ADMIN_USER;
  }

  // Validate as a real user token
  try {
    const { data: { user }, error } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      log.error(`[${context}] Auth validation failed`, error);
      throw new Error('Unauthorized');
    }

    const authUser: FNAAuthUser = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'client',
    };

    log.info(`[${context}] User authenticated`, { userId: authUser.id });
    return authUser;
  } catch (err: unknown) {
    // Re-throw if it's already our Unauthorized error
    if (err instanceof Error && err.message === 'Unauthorized') {
      throw err;
    }
    log.error(`[${context}] Unexpected auth failure`, err);
    throw new Error('Unauthorized');
  }
}