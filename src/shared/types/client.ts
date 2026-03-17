/**
 * Shared Client Types
 * Single source of truth for Frontend and Backend (§9.3)
 *
 * These types define the API contract between the server and frontend.
 * When the server adds, removes, or renames fields, the corresponding
 * type here must be updated in the same logical change.
 */

// ============================================================================
// ENUMS & STATUS UNIONS
// ============================================================================

/** Account lifecycle status — drives colour vocabulary per §8.3 */
export type AccountStatus = 'active' | 'approved' | 'suspended' | 'closed';

/** Application processing status */
export type ApplicationStatus =
  | 'none'
  | 'incomplete'
  | 'pending'
  | 'approved'
  | 'declined';

/** Account type */
export type AccountType = 'personal' | 'business';

/** User roles in the system */
export type UserRole =
  | 'client'
  | 'admin'
  | 'super_admin'
  | 'super-admin'
  | 'adviser'
  | 'compliance_officer'
  | 'paraplanner';

// ============================================================================
// BASE CLIENT (§9.2 — Shared BaseClient type)
// ============================================================================

/**
 * BaseClient — the minimal, shared shape that every module-level Client
 * type MUST extend.
 *
 * This exists to:
 *   - Prevent N divergent Client interfaces across modules
 *   - Guarantee a common contract for cross-module utilities (e.g.
 *     deriveAccountStatus, communication recipient lists, client pickers)
 *   - Allow safe casting between module-specific Client variants when
 *     only the core identity fields are needed
 *
 * When a module needs extra fields, it extends BaseClient:
 *
 *   interface CommunicationClient extends BaseClient {
 *     hasEmailOptIn: boolean;
 *     hasWhatsAppOptIn: boolean;
 *   }
 *
 * The `id` field is the canonical user identifier (Supabase Auth UID).
 * Some legacy APIs return `user_id` instead — the mapping layer in the
 * module's api.ts or hook must normalise to `id`.
 */
export interface BaseClient {
  /** Canonical user identifier (Supabase Auth UID) */
  id: string;
  /** First name */
  firstName: string;
  /** Last name / surname */
  lastName: string;
  /** Primary email address */
  email: string;
  /** Phone / cellphone (optional) */
  phone?: string;
  /** National ID or passport number (optional) */
  idNumber?: string;
  /** Account lifecycle status — see §12.3 */
  accountStatus?: AccountStatus | string;
}

// ============================================================================
// SECURITY (§12.3 — Multi-Entry KV Consistency)
// ============================================================================

/**
 * Security KV entry — stored at `security:{userId}`
 *
 * This entry and the profile entry (user_profile:{userId}:personal_info)
 * form a multi-entry pair. Both MUST be updated together via Promise.all()
 * when an entity's lifecycle state changes. See Guidelines §12.3.
 */
export interface ClientSecurity {
  suspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspensionReason?: string;
  reason?: string;
  deleted: boolean;
  deletedAt?: string;
  closedBy?: string;
  closureReason?: string;
  previousAccountStatus?: string;
  wasSuspendedBeforeClosure?: boolean;
  twoFactorEnabled?: boolean;
}

// ============================================================================
// ADDRESS
// ============================================================================

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

// ============================================================================
// API RESPONSE WRAPPERS (§10 — Error Contracts)
// ============================================================================

/**
 * Standard success response shape used across all server endpoints.
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Standard error response shape — consistent error contract (§10).
 */
export interface ErrorResponse {
  success?: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
}

/**
 * Paginated response wrapper — used by list endpoints.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ============================================================================
// DERIVED DISPLAY UTILITIES (§7.1)
// ============================================================================

/**
 * Status indicator configuration entry — config-driven per §5.3 / §8.3.
 * Used by the status colour vocabulary table.
 */
export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Standard status colour vocabulary mapping.
 * Green = Active/Success, Amber = Warning/Suspended, Red = Closed/Error.
 */
export type StatusConfigMap = Record<AccountStatus, StatusConfig>;