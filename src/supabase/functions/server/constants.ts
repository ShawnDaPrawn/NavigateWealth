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
 * Super-admin email allowlist (durable, recovery-safe).
 *
 * Why an allowlist instead of a single string: a lone hardcoded super-admin is
 * a single point of failure. If that one account is lost, compromised, or the
 * owner leaves, the only fallback was editing source and redeploying. The
 * allowlist provides a second, owner-controlled recovery identity, and
 * `isSuperAdminEmail()` (below) additionally merges any emails supplied via the
 * `SUPER_ADMIN_EMAILS` env var so a recovery admin can be added or rotated via
 * Supabase secrets WITHOUT a code deploy.
 *
 * Invariant: entries MUST be stored lowercased — all comparisons are
 * case-insensitive and go through `isSuperAdminEmail()`.
 */
export const SUPER_ADMIN_EMAILS: ReadonlySet<string> = new Set([
  'shawn@navigatewealth.co',
  'shawn.africantreasures@gmail.com', // Second recovery super-admin
]);

/**
 * Primary super-admin email — retained as the canonical owner identity and for
 * backward compatibility with call sites that still reference a single address.
 * New code should authorise via `isSuperAdminEmail()` so the full allowlist
 * (and the env-var override) is honoured.
 *
 * @deprecated Prefer `isSuperAdminEmail(email)` for authorization checks.
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

/**
 * Roles that grant elevated access somewhere in the backend (`requireAdmin`
 * accepts admin/super_admin; `isFnaAdminRole` additionally accepts adviser).
 * These must NEVER be honoured from client-editable `user_metadata`.
 */
const PRIVILEGED_ROLES: ReadonlySet<string> = new Set([
  'admin',
  'super_admin',
  'super-admin',
  'adviser',
]);

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
 *   4. `user_metadata.role`         → honoured ONLY for non-privileged values.
 *      user_metadata is editable by the user themself via
 *      `supabase.auth.updateUser({ data: { … } })`, so a privileged value
 *      here is treated as 'client' — otherwise any authenticated user could
 *      self-assign 'admin' and pass requireAdmin.
 */
export function resolveTrustedRole(user: RoleResolvableUser): string {
  if (isSuperAdminEmail(user.email)) return 'super_admin';

  const appRole = user.app_metadata?.role;
  if (typeof appRole === 'string' && appRole) return appRole;

  if (isAdminEmail(user.email)) return 'admin';

  const metaRole = user.user_metadata?.role;
  if (typeof metaRole === 'string' && metaRole && !PRIVILEGED_ROLES.has(metaRole)) {
    return metaRole;
  }
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
