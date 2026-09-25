/**
 * Constants for Navigate Wealth Application
 * Centralized constants to prevent hard-coded values throughout the codebase
 */

import type { BackendApplicationStatus, FrontendApplicationStatus } from './types.ts';

// ============================================================================
// Email Configuration
// ============================================================================

/**
 * Admin email address for notifications
 */
export const ADMIN_EMAIL = 'info@navigatewealth.co';

/**
 * Super-admin email allowlist.
 *
 * Why an allowlist instead of a single string: a lone hardcoded super-admin is
 * a single point of failure. `isSuperAdminEmail()` (below) merges any emails
 * supplied via the `SUPER_ADMIN_EMAILS` env var, so a recovery admin can be
 * added or rotated via Supabase secrets WITHOUT a code deploy.
 *
 * ONLY ADDRESSES THAT ALREADY HAVE AN ACCOUNT BELONG HERE — in this set or in
 * the env var. Super-admin is granted by EMAIL, so an allowlisted address with
 * no account is a super-admin seat waiting for whoever registers it first:
 * the registrant picks the password, and the real inbox owner need only click
 * one confirmation link. A second "recovery" address sat here for months with
 * no account behind it, while an unauthenticated route created PRE-VERIFIED
 * accounts for any address — which made it a one-request super-admin. To add a
 * recovery admin: create and verify that account first, then list it in the
 * `SUPER_ADMIN_EMAILS` secret.
 *
 * Invariant: entries MUST be stored lowercased — all comparisons are
 * case-insensitive and go through `isSuperAdminEmail()`.
 */
export const SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set(['shawn@navigatewealth.co']);

/**
 * The canonical single owner identity.
 *
 * NOT DEPRECATED, AND DELIBERATELY NOT REMOVED. It carried an `@deprecated`
 * tag and a production-readiness item calling for its deletion; both were
 * wrong, and acting on either would have made this app less safe.
 *
 * There are exactly two backend readers, and neither should become
 * `isSuperAdminEmail()`:
 *
 *   1. `auth-routes.ts` — exempts this address from the per-ACCOUNT login
 *      lockout (it stays subject to the per-IP limit), on an email taken
 *      straight from the request body, BEFORE authentication. Widening it to
 *      the allowlist would extend the exemption to more addresses and —
 *      through the `SUPER_ADMIN_EMAILS` env override — to whatever that
 *      variable happens to contain at the time. See SECURITY-AUDIT A10, which
 *      already reached this conclusion and wrote it down at the call site.
 *   2. `client-management-super-admin-routes.ts` — resolves THE owner account to
 *      read or seed its profile. That is an identity lookup, not an
 *      authorization decision; "the owner" is singular by definition and an
 *      allowlist would make it ambiguous.
 *
 * The rule to carry forward: AUTHORIZATION goes through `isSuperAdminEmail()`,
 * which honours the full allowlist and the deploy-free env override. Narrowing
 * is the safer direction for a pre-auth exemption, and singular is the correct
 * shape for an owner lookup — so those two stay here, on purpose.
 */
export const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';

/**
 * Returns true if `email` belongs to a super-admin.
 *
 * Compares case-insensitively against the hardcoded {@link SUPER_ADMIN_EMAILS}
 * allowlist UNION any emails listed in the `SUPER_ADMIN_EMAILS` environment
 * variable (comma/semicolon/whitespace-separated). The env var is the
 * deploy-free recovery path. Returns false for empty/undefined input.
 *
 * Declared as a TYPE PREDICATE (`email is string`), not a plain boolean. The
 * checks this replaced were written `if (currentUserEmail && currentUserEmail
 * .toLowerCase() === SUPER_ADMIN_EMAIL...)`, and that leading truthiness test
 * narrowed the optional away for the rest of the block. Swapping in a
 * boolean-returning call silently dropped the narrowing, so a
 * `string | undefined` flowed into a `string` field and only `deno check`
 * caught it — the SPA tsc run excludes the edge source. The predicate is sound
 * (every `true` path requires a non-empty string) and restores the narrowing at
 * every call site rather than leaving each one to re-guard by hand.
 */
export function isSuperAdminEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (SUPER_ADMIN_EMAILS.has(normalized)) return true;

  // `typeof Deno` guard so this stays safe under the Node-based Vitest suite
  // (where `Deno` is undefined) while still reading the env var at runtime in
  // the Deno edge environment.
  const fromEnv = typeof Deno !== 'undefined' ? Deno.env.get('SUPER_ADMIN_EMAILS') : undefined;
  if (!fromEnv) return false;
  return fromEnv
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/**
 * Returns true if `email` is on the admin allowlist supplied via the
 * `NW_ADMIN_EMAILS` env var (comma/semicolon/whitespace-separated,
 * case-insensitive). This is the deploy-free recovery path for granting
 * admin when `app_metadata.role` has not been backfilled yet.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const fromEnv = typeof Deno !== 'undefined' ? Deno.env.get('NW_ADMIN_EMAILS') : undefined;
  if (!fromEnv) return false;
  return fromEnv
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

/** Minimal structural shape of a Supabase Auth user for role resolution. */
interface RoleResolvableUser {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

/**
 * Resolve a user's effective role from TRUSTED sources only.
 *
 * Trust order (SECURITY-AUDIT: privileged-role hardening, PR #106 review):
 *   1. Super-admin email allowlist  → 'super_admin'
 *   2. `app_metadata.role`          → trusted verbatim (only the service role
 *      can write app_metadata; users cannot)
 *   3. `NW_ADMIN_EMAILS` allowlist  → 'admin'
 *   4. Everyone else                → 'client'
 *
 * `user_metadata.role` is NEVER read. user_metadata is written by the user
 * themself (`supabase.auth.updateUser({ data: { role } })`), so any role taken
 * from it is a role the user chose. The first version of this function refused
 * only admin/super_admin/adviser from it and passed every other value through —
 * so any client could become 'compliance' or 'paraplanner' (roles that several
 * modules treat as staff with cross-client read access), and any string at all
 * defeated checks written as `role === 'client'`. Staff roles are granted by
 * writing `app_metadata.role`, which only the service role can do.
 */
export function resolveTrustedRole(user: RoleResolvableUser): string {
  if (isSuperAdminEmail(user.email)) return 'super_admin';

  const appRole = user.app_metadata?.role;
  if (typeof appRole === 'string' && appRole) return appRole;

  if (isAdminEmail(user.email)) return 'admin';

  return 'client';
}

// ============================================================================
// Database Configuration
// ============================================================================

/**
 * Database table names
 */
export const TABLES = {
  APPLICATIONS: 'personal_client_applications',
} as const;

/**
 * Database schema
 */
export const DATABASE_SCHEMA = 'public';

// ============================================================================
// Status Mappings
// ============================================================================

/**
 * Map backend status to frontend status
 * Backend stores: in_progress, pending, submitted, approved, declined
 * Frontend displays: no_application, application_in_progress, submitted_for_review, approved, declined
 */
export const STATUS_MAP: Record<BackendApplicationStatus, FrontendApplicationStatus> = {
  draft: 'no_application',
  in_progress: 'application_in_progress',
  pending: 'submitted_for_review', // Pending = waiting for admin review (auto-submitted from signup)
  submitted: 'submitted_for_review',
  approved: 'approved',
  declined: 'declined',
  invited: 'invited',
} as const;

/**
 * Reverse map: Frontend status to backend status
 */
export const REVERSE_STATUS_MAP: Record<
  FrontendApplicationStatus,
  BackendApplicationStatus | null
> = {
  no_application: null,
  application_in_progress: 'in_progress',
  submitted_for_review: 'submitted',
  approved: 'approved',
  declined: 'declined',
  invited: 'invited',
} as const;

/**
 * Valid statuses for submitted applications (used in admin filters)
 */
export const SUBMITTED_STATUSES: BackendApplicationStatus[] = [
  'pending', // New signups waiting for review
  'submitted',
  'approved',
  'declined',
] as const;

// ============================================================================
// Application Configuration
// ============================================================================

/**
 * Default completion percentage by status
 */
export const COMPLETION_PERCENTAGE: Record<BackendApplicationStatus, number> = {
  draft: 0,
  in_progress: 50,
  pending: 100, // Pending applications are auto-submitted from signup
  submitted: 100,
  approved: 100,
  declined: 100,
  invited: 10, // Invited — minimal data only
} as const;

/**
 * Default sort column mapping (camelCase to snake_case)
 */
export const SORT_COLUMN_MAP: Record<string, string> = {
  submittedAt: 'submitted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  submitted_at: 'submitted_at',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const;

/**
 * Default sort configuration
 */
export const DEFAULT_SORT = {
  COLUMN: 'submitted_at',
  ORDER: 'desc' as const,
} as const;

// ============================================================================
// Account Types
// ============================================================================

/**
 * Available account types
 */
export const ACCOUNT_TYPES = {
  PERSONAL: 'personal',
  BUSINESS: 'business',
} as const;

/**
 * Default account type
 */
export const DEFAULT_ACCOUNT_TYPE = ACCOUNT_TYPES.PERSONAL;

// ============================================================================
// User Roles
// ============================================================================

/**
 * User role types
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  CLIENT: 'client',
} as const;

/**
 * Personnel (staff) roles — any Auth user whose role is in this list
 * is a staff member and must NOT appear in the Client Management module.
 *
 * Guidelines §5.3 — Centralised, typed constant.
 */
export const PERSONNEL_ROLES = [
  'super_admin',
  'admin',
  'adviser',
  'paraplanner',
  'compliance',
  'viewer',
] as const;

export type PersonnelRole = (typeof PERSONNEL_ROLES)[number];

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  AUTH: {
    NO_TOKEN: 'Unauthorized - No token provided',
    INVALID_TOKEN: 'Unauthorized - Invalid token',
    NOT_ADMIN: 'Forbidden - Admin access required',
  },
  APPLICATION: {
    NOT_FOUND: 'Application not found',
    INVALID_STATUS: 'Application cannot be processed in current status',
    FETCH_FAILED: 'Failed to fetch applications',
    UPDATE_FAILED: 'Failed to update application',
    USER_NOT_FOUND:
      'The user associated with this application no longer exists in the authentication system. The application cannot be processed.',
  },
  GENERIC: {
    INTERNAL_ERROR: 'Internal server error',
  },
} as const;

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  APPLICATION: {
    APPROVED: 'Application approved successfully',
    DECLINED: 'Application declined successfully',
  },
} as const;
