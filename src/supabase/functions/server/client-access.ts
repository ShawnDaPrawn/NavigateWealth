import type { Context } from 'npm:hono';
import { resolveClientAdviserUserId } from './fna-intake-adviser-resolver.ts';

const PLATFORM_ADMIN_ROLES = new Set(['admin', 'super_admin', 'super-admin']);

export function isPlatformAdminRole(role: string | undefined): boolean {
  return !!role && PLATFORM_ADMIN_ROLES.has(role);
}

/**
 * Authorize access to a client-scoped record.
 *
 * Clients are self-only. Platform administrators may act across clients.
 * Advisers must be the server-resolved adviser assigned to the target client.
 * Other personnel roles are denied until a canonical assignment relationship
 * exists for them; authentication alone is never sufficient.
 */
export async function canAccessClient(c: Context, clientId: string): Promise<boolean> {
  const callerId = c.get('userId');
  const callerRole = c.get('userRole');

  if (callerId === clientId || isPlatformAdminRole(callerRole)) return true;
  if (callerRole !== 'adviser') return false;

  const assignedAdviserId = await resolveClientAdviserUserId(clientId);
  return assignedAdviserId === callerId;
}

export async function requireClientAccess(c: Context, clientId: string): Promise<Response | null> {
  if (await canAccessClient(c, clientId)) return null;
  return c.json(
    { error: 'Forbidden: client access is not authorized', code: 'FORBIDDEN_CLIENT' },
    403,
  );
}
