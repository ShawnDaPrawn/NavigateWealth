/**
 * P6.9 — Firm-scope helpers.
 *
 * Every e-sign read / mutation must be scoped to the caller's firm.
 * Firm identity must come from trusted app metadata. User metadata is
 * client-editable and therefore cannot define an authorization boundary.
 * This module centralises the
 * canonical resolution and provides two helpers that route handlers
 * should use:
 *
 *   • `resolveFirmId(user)` — the one and only place we map an
 *     authenticated user onto a firm id. Falls back to the user id
 *     so standalone installs remain isolated per authenticated user.
 *   • `assertFirmAccess(user, record)` — throws a 403 `Response` when
 *     the caller's firm doesn't match the record's `firm_id`, or
 *     denies records that do not carry an exact trusted firm scope.
 *   • `belongsToFirm(user, record)` — boolean variant for list filters.
 *
 * Keep this file dependency-free so it can be imported from anywhere
 * in the e-sign surface (routes, services, scheduler helpers, tests).
 */

export interface AuthenticatedUser {
  id: string;
  app_metadata?: Record<string, unknown>;
}

export interface FirmScopedRecord {
  firm_id?: string | null;
}

/**
 * Resolve the firm id for an authenticated user. Returns the user's
 * `firm_id` from trusted app metadata when present; otherwise falls back to
 * the user id. The fallback means single-admin / standalone installs
 * "just work" — every envelope they create is effectively in their
 * personal firm namespace.
 */
export function resolveFirmId(user: AuthenticatedUser): string {
  const fromMeta = user.app_metadata?.firm_id;
  return typeof fromMeta === 'string' && fromMeta.length > 0 ? fromMeta : user.id;
}

/** True only when the record belongs to the caller's exact trusted firm scope. */
export function belongsToFirm(user: AuthenticatedUser, record: FirmScopedRecord): boolean {
  const callerFirm = resolveFirmId(user);
  const recordFirm = record.firm_id;
  return typeof recordFirm === 'string' && recordFirm.length > 0 && recordFirm === callerFirm;
}

/**
 * Error thrown by `assertFirmAccess`. Routes can check `instanceof` to
 * convert it to the correct HTTP response without leaking details.
 */
export class FirmScopeError extends Error {
  readonly status = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'FirmScopeError';
  }
}

/**
 * Throws a `FirmScopeError` when the caller's firm doesn't match the
 * record's. Use in imperative/middleware contexts where a boolean
 * check is awkward.
 */
export function assertFirmAccess(
  user: AuthenticatedUser,
  record: FirmScopedRecord | null | undefined,
): void {
  if (!record) return;
  if (!belongsToFirm(user, record)) throw new FirmScopeError();
}
