/**
 * Authorization helpers for form prefill routes.
 *
 * Access model: prefill is an adviser/admin workflow, and client-scoped access
 * follows the SAME policy as every other client-scoped surface — self, platform
 * admin, or the server-resolved assigned adviser (`client-access.ts`).
 *
 * WHY THIS CHANGED (2026-08-22)
 * -----------------------------
 * This module used to allow any adviser to prefill any client, with a comment
 * saying assignment scoping was "intentionally not enforced". That was a
 * coherent decision while nothing else enforced assignment. P1.4 changed the
 * facts: the FNA family now requires an assignment, and prefill reads
 * `user_profile:{clientId}:personal_info`, `client_keys` and
 * `policies:{clientId}` — the same client PII — and returns it as proposed
 * field values.
 *
 * So the looser policy was not an inconsistency to tidy up. It was a **bypass**:
 * an adviser refused client B's FNA could call `POST /form-prefill/resolve`
 * with B's id and any valid form id, and read B's personal information, ID
 * number and policies out of the response. Two policies disagreeing about the
 * same adviser and the same client is a hole in whichever one is stricter.
 *
 * WHAT DID NOT CHANGE
 * -------------------
 * Platform administrators — `admin`, `super_admin`, `super-admin` — are allowed
 * across all clients, unconditionally, before any adviser resolution runs. A
 * super-admin identity resolves through `resolveTrustedRole`'s email allowlist
 * to `super_admin`, so the allowlist path is unaffected too. That is pinned by
 * test, not left to inspection.
 *
 * The only behaviour change is that an adviser with no server-resolvable
 * assignment to a client can no longer prefill for that client — which is
 * exactly the access P1.4 decided they should not have.
 */

import { requireRealUserForIntakeAdmin, isFnaAdminRole, type FNAAuthUser } from './fna-auth.ts';
import { assertClientAccess, ClientAccessError } from './client-access.ts';
import { intakeForbidden } from './fna-intake-errors.ts';

/** Prefill is an adviser/admin workflow — block clients and synthetic admin. */
export function requirePrefillUser(user: FNAAuthUser): void {
  requireRealUserForIntakeAdmin(user);
  if (!isFnaAdminRole(user.role)) {
    throw intakeForbidden();
  }
}

/**
 * Authorize this caller for this client, using the shared policy.
 *
 * Denials are re-thrown as `intakeForbidden()` rather than surfacing
 * `ClientAccessError` directly: both prefill route files map `FnaIntakeError`
 * to its own status and everything else to a 500, so letting the shared error
 * escape would turn a deliberate 403 into an opaque server fault.
 *
 * The shared policy logs the denial with caller id, role and client id before
 * throwing, which is what makes "adviser missing an assignment record"
 * distinguishable from "someone probing ids" once this is live.
 */
export async function assertPrefillClientAccess(
  user: FNAAuthUser,
  clientId: string,
): Promise<void> {
  try {
    await assertClientAccess({ id: user.id, role: user.role }, clientId, 'form-prefill');
  } catch (error) {
    if (error instanceof ClientAccessError) throw intakeForbidden();
    throw error;
  }
}
