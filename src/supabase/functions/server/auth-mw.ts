/**
 * Auth Middleware
 * 
 * Provides authentication and authorization guards for routes.
 * 
 * Bundler Stability Fix 3.3.3
 */

import { Context, Next } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { logger } from "./stderr-logger.ts";
import { SUPER_ADMIN_EMAIL } from "./constants.ts";

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

/**
 * Authentication Error Class
 */
export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
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
  const { data: { user }, error } = await getSupabase().auth.getUser(token);
  
  if (error || !user) {
    logger.error('Auth context check failed', error);
    throw new AuthError('Invalid or expired session', 401, 'AUTH_INVALID');
  }

  // Resolve role: if the user's email matches the hardcoded super admin,
  // always treat them as super_admin regardless of user_metadata.
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const role = isSuperAdmin
    ? 'super_admin'
    : (user.user_metadata?.role || 'client');
  
  return {
    user,
    userId: user.id,
    role,
    token
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
async function resolveAuthUser(c: Context): Promise<ResolvedAuthUser | Response> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await getSupabase().auth.getUser(token);

  if (error || !user) {
    logger.error('Auth check failed', error);
    return c.json({ error: 'Invalid or expired session', code: 'AUTH_INVALID' }, 401);
  }

  // Resolve role with super admin email override
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const role = isSuperAdmin ? 'super_admin' : (user.user_metadata?.role || 'client');

  // Set user context on the Hono context for downstream handlers
  c.set('user', user);
  c.set('userId', user.id);
  c.set('userRole', role);

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
    return c.json({ error: 'Forbidden: Super Admin access required', code: 'FORBIDDEN_SUPER_ADMIN' }, 403);
  }

  await next();
}

/**
 * Helper to handle errors in routes
 */
export function handleError(c: Context, error: unknown) {
  logger.error('Route error', error);
  
  if (error instanceof AuthError) {
    return c.json({ error: error.message, code: error.code }, error.statusCode);
  }
  
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  const status = (error as Error & { status?: number })?.status || 500;
  return c.json({ error: message }, status);
}

/**
 * Require specific role (helper for manual checks)
 */
export function requireRole(ctx: { role: string }, allowedRoles: string[]) {
  if (!allowedRoles.includes(ctx.role)) {
    throw new AuthError(`Forbidden: Requires one of [${allowedRoles.join(', ')}]`, 403, 'FORBIDDEN');
  }
}