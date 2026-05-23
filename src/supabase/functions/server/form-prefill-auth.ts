/**
 * Authorization helpers for form prefill routes.
 *
 * Access model (platform-wide): any authenticated adviser/admin may prefill any client.
 * Clients may only resolve their own clientId. Assignment scoping is intentionally
 * not enforced — if policy changes, gate in assertPrefillClientAccess only.
 */

import {
  isFnaAdminRole,
  requireRealUserForIntakeAdmin,
  type FNAAuthUser,
} from './fna-auth.ts';
import { intakeForbidden } from './fna-intake-errors.ts';

/** Prefill is an adviser/admin workflow — block clients and synthetic admin. */
export function requirePrefillUser(user: FNAAuthUser): void {
  requireRealUserForIntakeAdmin(user);
  if (!isFnaAdminRole(user.role)) {
    throw intakeForbidden();
  }
}

/** Platform-wide: advisers/admins may prefill any client; clients only their own record. */
export function assertPrefillClientAccess(user: FNAAuthUser, clientId: string): void {
  if (isFnaAdminRole(user.role)) return;
  if (user.id === clientId) return;
  throw intakeForbidden();
}
