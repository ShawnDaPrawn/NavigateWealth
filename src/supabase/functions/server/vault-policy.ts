/**
 * What an AI agent may do with a login. Two settings decide it, one on each
 * side, and the stricter one wins:
 *
 *   the login's AI use     — off · ask · allowed
 *   the agent's passwords  — never · ask · allowed
 *
 * Seeing a login and reading its skills needs the login not to be hidden and
 * its service to be in the agent's reach. Getting the password (or a one-time
 * code) is then `deny`, `ask` (a person approves under Activity) or `go`.
 */
import type { VaultConnection, VaultSummary } from '../../../shared/password-manager.ts';

export type Scope = Pick<VaultConnection, 'serviceIds' | 'passwords'>;

/** Whether the agent can reach a service at all. */
export function reachesService(conn: Pick<VaultConnection, 'serviceIds'>, serviceId: string) {
  return conn.serviceIds === null || conn.serviceIds.includes(serviceId);
}

/** Whether the agent can find the login and read its skills. */
export function canSee(conn: Scope, item: Pick<VaultSummary, 'aiUse' | 'serviceId'>) {
  return item.aiUse !== 'off' && reachesService(conn, item.serviceId);
}

/** Whether a password request goes straight through, waits for a person, or is refused. */
export function passwordMode(
  conn: Scope,
  item: Pick<VaultSummary, 'aiUse' | 'serviceId'>,
): 'go' | 'ask' | 'deny' {
  if (!canSee(conn, item) || conn.passwords === 'never') return 'deny';
  if (conn.passwords === 'ask' || item.aiUse === 'ask') return 'ask';
  return 'go';
}
