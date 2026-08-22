import type { Context } from 'npm:hono';
import { resolveClientAdviserUserId } from './fna-intake-adviser-resolver.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('client-access');

const PLATFORM_ADMIN_ROLES = new Set(['admin', 'super_admin', 'super-admin']);

export function isPlatformAdminRole(role: string | undefined): boolean {
  return !!role && PLATFORM_ADMIN_ROLES.has(role);
}

/** The caller, however the route happened to authenticate them. */
export interface ClientAccessCaller {
  id: string | undefined;
  role: string | undefined;
}

/**
 * Authorize access to a client-scoped record — the single policy.
 *
 * Clients are self-only. Platform administrators may act across clients.
 * Advisers must be the server-resolved adviser assigned to the target client.
 * Other personnel roles (paraplanner, compliance, viewer) are denied until a
 * canonical assignment relationship exists for them; authentication alone is
 * never sufficient.
 *
 * Two gateways feed this: auth-mw routes, which put the caller on the Hono
 * context, and the FNA gateway (`fna-auth.authenticateUser`), which returns a
 * user object and sets nothing. Both must land on ONE policy — a second,
 * divergent copy is what produced S12 and S14 — so the context-reading form
 * below is a thin adapter over this function rather than its own rules.
 */
export async function canAccessClientAs(
  caller: ClientAccessCaller,
  clientId: string,
): Promise<boolean> {
  // Fail closed on a missing caller id rather than letting `undefined ===
  // undefined` authorize a request with no identity against a record with no
  // owner.
  if (!caller.id || !clientId) return false;

  if (caller.id === clientId || isPlatformAdminRole(caller.role)) return true;
  if (caller.role !== 'adviser') return false;

  const assignedAdviserId = await resolveClientAdviserUserId(clientId);
  return assignedAdviserId === caller.id;
}

export async function canAccessClient(c: Context, clientId: string): Promise<boolean> {
  return canAccessClientAs({ id: c.get('userId'), role: c.get('userRole') }, clientId);
}

export async function requireClientAccess(c: Context, clientId: string): Promise<Response | null> {
  if (await canAccessClient(c, clientId)) return null;
  return c.json(
    { error: 'Forbidden: client access is not authorized', code: 'FORBIDDEN_CLIENT' },
    403,
  );
}

/**
 * Thrown when a caller is not authorized for a client-scoped record.
 *
 * The FNA route files are uniformly `try { ... } catch (error) { return
 * fnaErrorResponse(c, error); }`, so throwing lets a denial be one awaited
 * line inside the handler while the existing catch renders it. `fnaErrorResponse`
 * matches this structurally, so the 403 and its code survive to the client
 * instead of being flattened into a generic failure.
 */
export class ClientAccessError extends Error {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN_CLIENT';

  constructor(message = 'Forbidden: client access is not authorized') {
    super(message);
    this.name = 'ClientAccessError';
  }
}

/**
 * Assert that `caller` may act on `clientId`, or throw {@link ClientAccessError}.
 *
 * `resource` names what was being reached for; it only ever reaches the log,
 * never the response, because telling a stranger which record they just failed
 * to open is itself a disclosure.
 */
export async function assertClientAccess(
  caller: ClientAccessCaller,
  clientId: string | undefined | null,
  resource: string,
): Promise<void> {
  if (typeof clientId === 'string' && (await canAccessClientAs(caller, clientId))) return;

  // Logged at warn with the inputs needed to tell "attacker" from "adviser
  // whose assignment record is missing" — the two look identical from a 403.
  log.warn('Client-scoped access denied', {
    resource,
    clientId: clientId ?? null,
    callerId: caller.id ?? null,
    callerRole: caller.role ?? null,
  });
  throw new ClientAccessError();
}

/**
 * Assert access to a record that carries its own owner, e.g. a stored FNA.
 *
 * A record with no `clientId` is denied rather than allowed: an unowned record
 * is exactly the case where "check the owner" silently becomes "check nothing".
 */
export async function assertRecordClientAccess(
  caller: ClientAccessCaller,
  record: { clientId?: string | null; client_id?: string | null } | null | undefined,
  resource: string,
): Promise<void> {
  const owner = record?.clientId ?? record?.client_id ?? null;
  await assertClientAccess(caller, owner, resource);
}
