/**
 * Personnel Module Types
 * Navigate Wealth Admin Dashboard
 * 
 * All TypeScript type definitions for the Personnel module.
 */

import type { AdminModule } from '../../layout/types';

// ============================================================================
// ENUMS & UNIONS
// ============================================================================

/**
 * User role types
 */
export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'adviser' 
  | 'paraplanner' 
  | 'compliance' 
  | 'viewer';

/**
 * Personnel status types
 */
export type PersonnelStatus = 'active' | 'suspended' | 'pending';

/**
 * FSCA compliance status types
 */
export type FSCAStatus = 'active' | 'debarred' | 'pending';

/**
 * Commission entity types
 */
export type CommissionEntity = 'personal' | 'company';

// ============================================================================
// MODULE PERMISSIONS
// ============================================================================

/**
 * Granular capability within a module.
 * 
 * Generic capabilities (available in most modules):
 *  - view:    Read-only access (implicitly granted when access is true)
 *  - create:  Create new records
 *  - edit:    Modify existing records
 *  - delete:  Delete / archive records
 * 
 * Module-specific capabilities:
 *  - publish:  Publish content (publications, resources)
 *  - approve:  Approve submissions (applications, compliance)
 *  - send:     Send communications (communication)
 *  - export:   Export data / generate reports (reporting, clients)
 *  - manage_permissions: Edit other users' permissions (personnel)
 */
export type Capability =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'publish'
  | 'approve'
  | 'send'
  | 'export'
  | 'manage_permissions';

/**
 * Access configuration for a single module
 */
export interface ModuleAccess {
  /** Whether the user can access this module */
  access: boolean;

  /** Granular capabilities within the module (Phase 2).
   *  When empty or undefined, user has view-only access.
   *  When populated, only listed capabilities are granted. */
  capabilities?: Capability[];
}

/**
 * Permission set for a personnel member (stored separately from profile)
 * KV key: permissions:{personnelId}
 */
export interface PermissionSet {
  /** Personnel ID this permission set belongs to */
  personnelId: string;

  /** Module-level access grants (allowlist model) */
  modules: Partial<Record<AdminModule, ModuleAccess>>;

  /** ISO 8601 timestamp of last update */
  updatedAt: string;

  /** Personnel ID of the user who last updated these permissions */
  updatedBy: string;
}

/**
 * Input type for updating permissions
 */
export interface UpdatePermissionsInput {
  /** Personnel ID to update */
  personnelId: string;

  /** Module access map (partial — only changed modules need to be sent) */
  modules: Partial<Record<AdminModule, ModuleAccess>>;
}

// ============================================================================
// DATABASE ENTITIES
// ============================================================================

/**
 * Personnel qualifications structure
 */
export interface PersonnelQualifications {
  /** Has RE5 certification */
  re5: boolean;
  
  /** Has Certified Financial Planner certification */
  cfp: boolean;
  
  /** Has Code of Business certification */
  cob: boolean;
  
  /** Other qualifications (array of names) */
  other?: string[];
}

/**
 * Personnel document entity (database record)
 * 
 * Represents a document associated with a personnel member
 * (certificates, ID, CV, etc.)
 */
export interface PersonnelDocument {
  /** Document unique identifier */
  id: string;
  
  /** Document display name */
  name: string;
  
  /** Document type/category */
  type: string;
  
  /** Document download URL */
  url: string;
  
  /** Upload timestamp (ISO 8601) */
  uploadedAt: string;
}

/**
 * Personnel entity (database record)
 * 
 * Represents a staff member in the Navigate Wealth admin system.
 * Field names use snake_case to match database schema.
 */
export interface Personnel {
  /** Personnel unique identifier */
  id: string;
  
  /** Full name (computed field for frontend compatibility) */
  name: string;
  
  /** First name */
  firstName: string;
  
  /** Last name */
  lastName: string;
  
  /** Email address */
  email: string;
  
  /** User role */
  role: UserRole;
  
  /** Phone number */
  phone: string;
  
  /** Current status */
  status: PersonnelStatus;
  
  // Professional Information
  
  /** Job title/position */
  jobTitle?: string;
  
  /** Branch/office location */
  branch?: string;
  
  /** Manager's personnel ID (nullable) */
  managerId?: string | null;
  
  // Compliance Information
  
  /** FSP reference number */
  fspReference?: string;
  
  /** FSCA compliance status */
  fscaStatus?: FSCAStatus;
  
  /** Professional qualifications */
  qualifications?: PersonnelQualifications;
  
  // Commission Configuration
  
  /** Commission split percentage (0-100) */
  commissionSplit: number;
  
  /** Commission payment entity */
  commissionEntity?: CommissionEntity;
  
  // Legacy/Frontend Compatibility Fields
  
  /** Region (legacy field) */
  region?: string;
  
  /** Module access permissions (frontend only) */
  moduleAccess?: AdminModule[];
  
  /** Active status (legacy field) */
  active?: boolean;
  
  /** License number (legacy field) */
  licenseNo?: string;
  
  /** Associated documents */
  documents?: PersonnelDocument[];
  
  // Audit Fields
  
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Invite sent timestamp (ISO 8601, only for pending users) */
  invitedAt?: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Data required to invite a new personnel member
 */
export interface InvitePersonnelInput {
  /** First name */
  firstName: string;
  
  /** Last name */
  lastName: string;
  
  /** Email address */
  email: string;
  
  /** Assigned role */
  role: Exclude<UserRole, 'super_admin'>;
  
  /** Optional commission split (defaults to 70%) */
  commissionSplit?: number;
}

/**
 * Data for updating personnel profile
 */
export interface UpdatePersonnelInput {
  /** Personnel ID (required for updates) */
  id: string;

  /** First name */
  firstName?: string;

  /** Last name */
  lastName?: string;
  
  /** Phone number */
  phone?: string;
  
  /** Job title */
  jobTitle?: string;
  
  /** User role */
  role?: UserRole;
  
  /** Manager ID */
  managerId?: string | null;
  
  /** Branch location */
  branch?: string;
  
  /** Commission split percentage */
  commissionSplit?: number;
  
  /** Commission entity */
  commissionEntity?: CommissionEntity;
  
  /** FSP reference */
  fspReference?: string;
  
  /** FSCA status */
  fscaStatus?: FSCAStatus;
  
  /** Qualifications */
  qualifications?: PersonnelQualifications;
}

/**
 * Data for adding a personnel document
 */
export interface AddPersonnelDocumentInput {
  /** Personnel ID */
  personnelId: string;
  
  /** Document name */
  name: string;
  
  /** Document type */
  type: string;
  
  /** Document URL */
  url: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Filters for personnel list queries
 */
export interface PersonnelFilters {
  /** Search term (name or email) */
  search: string;
  
  /** Filter by roles */
  roles: UserRole[];
  
  /** Filter by statuses */
  statuses: PersonnelStatus[];
  
  /** Filter by branches */
  branches: string[];
}

// ============================================================================
// RELATED ENTITIES
// ============================================================================

/**
 * Client summary (for personnel's client book)
 */
export interface ClientSummary {
  /** Client unique identifier */
  id: string;
  
  /** Client full name */
  name: string;
  
  /** Client email */
  email: string;
  
  /** Client status */
  status: string;
  
  /** Assets under management */
  aum: number;
}

/**
 * Super Admin profile data
 */
export interface SuperAdminProfile {
  /** Profile ID */
  id: string;
  
  /** Full name */
  name: string;

  /** First name */
  firstName: string;

  /** Last name */
  lastName: string;
  
  /** Email address */
  email: string;
  
  /** Phone number */
  phone?: string;
  
  /** Company/organization name */
  company?: string;
  
  /** Last updated timestamp */
  updatedAt?: string;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

/**
 * Re-export form validation types from schema
 */
export type { InviteUserFormValues } from './schema';