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
 * Super admin email address
 */
export const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';

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
  'in_progress': 'application_in_progress',
  'pending': 'submitted_for_review', // Pending = waiting for admin review (auto-submitted from signup)
  'submitted': 'submitted_for_review',
  'approved': 'approved',
  'declined': 'declined',
  'invited': 'invited',
} as const;

/**
 * Reverse map: Frontend status to backend status
 */
export const REVERSE_STATUS_MAP: Record<FrontendApplicationStatus, BackendApplicationStatus | null> = {
  'no_application': null,
  'application_in_progress': 'in_progress',
  'submitted_for_review': 'submitted',
  'approved': 'approved',
  'declined': 'declined',
  'invited': 'invited',
} as const;

/**
 * Valid statuses for submitted applications (used in admin filters)
 */
export const SUBMITTED_STATUSES: BackendApplicationStatus[] = [
  'pending',   // New signups waiting for review
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
  'in_progress': 50,
  'pending': 100, // Pending applications are auto-submitted from signup
  'submitted': 100,
  'approved': 100,
  'declined': 100,
  'invited': 10,  // Invited — minimal data only
} as const;

/**
 * Default sort column mapping (camelCase to snake_case)
 */
export const SORT_COLUMN_MAP: Record<string, string> = {
  'submittedAt': 'submitted_at',
  'createdAt': 'created_at',
  'updatedAt': 'updated_at',
  'submitted_at': 'submitted_at',
  'created_at': 'created_at',
  'updated_at': 'updated_at',
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
    USER_NOT_FOUND: 'The user associated with this application no longer exists in the authentication system. The application cannot be processed.',
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