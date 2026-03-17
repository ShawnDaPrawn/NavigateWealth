/**
 * Personnel Module Constants
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized constants for personnel module including role labels, colors,
 * and configuration values.
 */

import type { UserRole, PersonnelStatus, Capability } from './types';
import type { AdminModule } from '../../layout/types';
import { SUPER_ADMIN_EMAIL } from '../../../../utils/auth/constants';

// ============================================================================
// ROLE CONSTANTS
// ============================================================================

/**
 * Human-readable labels for personnel roles
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  adviser: 'Financial Adviser',
  paraplanner: 'Paraplanner',
  compliance: 'Compliance Officer',
  viewer: 'Viewer',
};

/**
 * Color classes for personnel roles (Tailwind CSS)
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  adviser: 'bg-green-100 text-green-800 border-green-200',
  paraplanner: 'bg-orange-100 text-orange-800 border-orange-200',
  compliance: 'bg-red-100 text-red-800 border-red-200',
  viewer: 'bg-gray-100 text-gray-800 border-gray-200',
};

// ============================================================================
// STATUS CONSTANTS
// ============================================================================

/**
 * Human-readable labels for personnel status
 */
export const STATUS_LABELS: Record<PersonnelStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Pending',
};

/**
 * Color classes for personnel status (Tailwind CSS)
 */
export const STATUS_COLORS: Record<PersonnelStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
};

// ============================================================================
// FSCA STATUS CONSTANTS
// ============================================================================

/**
 * Human-readable labels for FSCA status
 */
export const FSCA_STATUS_LABELS = {
  active: 'Active',
  debarred: 'Debarred',
  pending: 'Pending',
} as const;

/**
 * Color classes for FSCA status (Tailwind CSS)
 */
export const FSCA_STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  debarred: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
} as const;

// ============================================================================
// COMMISSION ENTITY CONSTANTS
// ============================================================================

/**
 * Human-readable labels for commission entity
 */
export const COMMISSION_ENTITY_LABELS = {
  personal: 'Personal',
  company: 'Company',
} as const;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default commission split percentage
 */
export const DEFAULT_COMMISSION_SPLIT = 70;

/**
 * Default filter values
 */
export const DEFAULT_FILTERS = {
  search: '',
  roles: [],
  statuses: [],
  branches: [],
} as const;

// ============================================================================
// MODULE PERMISSION REGISTRY
// ============================================================================

/**
 * Canonical registry of all admin modules available for permission assignment.
 * Dashboard is always accessible and excluded from the permission grid.
 */
export const PERMISSIONED_MODULES: AdminModule[] = [
  'clients',
  'esign',
  'personnel',
  'advice-engine',
  'product-management',
  'resources',
  'publications',
  'compliance',
  'tasks',
  'applications',
  'quotes',
  'communication',
  'marketing',
  'reporting',
  'calendar',
  'ai-management',
];

/**
 * Modules that are always accessible regardless of permissions.
 * Super admin bypass is handled at the hook level, not here.
 */
export const ALWAYS_ACCESSIBLE_MODULES: AdminModule[] = ['dashboard', 'notes'];

/**
 * Super admin email — imported from centralised auth constants.
 * This user bypasses all permission checks.
 * Re-exported for backward compatibility within the personnel module.
 */
export { SUPER_ADMIN_EMAIL };

/**
 * Default module access for newly invited personnel (secure by default — no access)
 */
export const DEFAULT_MODULE_ACCESS: Record<string, { access: boolean }> = {};

/**
 * Role-based module access presets.
 * Applied when a role is selected during invite to provide a sensible starting point.
 * Users can refine module access before sending the invitation and further
 * customise capabilities after creation via the personnel drawer.
 */
export const ROLE_MODULE_PRESETS: Record<string, AdminModule[]> = {
  adviser: [
    'clients',
    'applications',
    'advice-engine',
    'esign',
    'tasks',
    'calendar',
    'communication',
    'resources',
    'quotes',
  ],
  paraplanner: [
    'clients',
    'advice-engine',
    'resources',
    'tasks',
    'calendar',
    'quotes',
  ],
  compliance: [
    'compliance',
    'reporting',
    'clients',
    'calendar',
  ],
  admin: [...PERMISSIONED_MODULES],
};

// ============================================================================
// MODULE CAPABILITIES REGISTRY (Phase 2)
// ============================================================================

/**
 * Describes a single capability with label and description for the UI.
 */
export interface CapabilityMeta {
  /** Machine-readable key */
  key: Capability;
  /** Human-readable label */
  label: string;
  /** Short description shown in tooltip / helper text */
  description: string;
}

/**
 * Module capabilities registry.
 * Maps each permissioned module to its available granular capabilities.
 * 
 * `view` is implicitly granted when a module has `access: true` and is
 * therefore NOT listed here — it exists in the type union for runtime
 * checks but never appears in the editor grid.
 */
export const MODULE_CAPABILITIES: Record<AdminModule, CapabilityMeta[]> = {
  // ── Always accessible ────────────────────────────────────────
  dashboard: [], // no capabilities — always accessible

  // ── Operations ───────────────────────────────────────────────
  applications: [
    { key: 'create',  label: 'Create',  description: 'Submit new applications' },
    { key: 'edit',    label: 'Edit',    description: 'Modify application details' },
    { key: 'approve', label: 'Approve', description: 'Approve or reject applications' },
    { key: 'export',  label: 'Export',  description: 'Export application data' },
  ],
  tasks: [
    { key: 'create', label: 'Create', description: 'Create new tasks' },
    { key: 'edit',   label: 'Edit',   description: 'Edit task details and status' },
    { key: 'delete', label: 'Delete', description: 'Delete or archive tasks' },
  ],
  calendar: [
    { key: 'create', label: 'Create', description: 'Create events and reminders' },
    { key: 'edit',   label: 'Edit',   description: 'Modify event details' },
    { key: 'delete', label: 'Delete', description: 'Remove events' },
    { key: 'export', label: 'Export', description: 'Export calendar data' },
  ],

  // ── Manage ───────────────────────────────────────────────────
  clients: [
    { key: 'create', label: 'Create',  description: 'Add new clients' },
    { key: 'edit',   label: 'Edit',    description: 'Modify client profiles' },
    { key: 'delete', label: 'Delete',  description: 'Archive or remove clients' },
    { key: 'export', label: 'Export',  description: 'Export client data' },
  ],
  esign: [
    { key: 'create', label: 'Create',  description: 'Create new envelopes' },
    { key: 'edit',   label: 'Edit',    description: 'Modify envelope details' },
    { key: 'send',   label: 'Send',    description: 'Send envelopes for signing' },
    { key: 'delete', label: 'Delete',  description: 'Void or delete envelopes' },
  ],
  personnel: [
    { key: 'create',             label: 'Invite',             description: 'Invite new personnel members' },
    { key: 'edit',               label: 'Edit',               description: 'Modify personnel profiles' },
    { key: 'delete',             label: 'Suspend',            description: 'Suspend personnel access' },
    { key: 'manage_permissions', label: 'Manage Permissions', description: 'Edit module & capability permissions' },
  ],
  'advice-engine': [
    { key: 'create', label: 'Create', description: 'Start new AI conversations & RoAs' },
    { key: 'edit',   label: 'Edit',   description: 'Modify drafts and settings' },
    { key: 'export', label: 'Export', description: 'Export advice documents' },
  ],
  'product-management': [
    { key: 'create', label: 'Create', description: 'Add products and providers' },
    { key: 'edit',   label: 'Edit',   description: 'Modify product schemas' },
    { key: 'delete', label: 'Delete', description: 'Remove products or providers' },
  ],
  resources: [
    { key: 'create',  label: 'Create',  description: 'Create new forms and resources' },
    { key: 'edit',    label: 'Edit',    description: 'Modify form builder content' },
    { key: 'delete',  label: 'Delete',  description: 'Delete resources' },
    { key: 'publish', label: 'Publish', description: 'Publish forms for client use' },
  ],
  publications: [
    { key: 'create',  label: 'Create',  description: 'Write new articles' },
    { key: 'edit',    label: 'Edit',    description: 'Modify existing articles' },
    { key: 'delete',  label: 'Delete',  description: 'Delete articles' },
    { key: 'publish', label: 'Publish', description: 'Publish or unpublish articles' },
  ],

  // ── Risk & Compliance ────────────────────────────────────────
  compliance: [
    { key: 'create',  label: 'Create',  description: 'Create compliance records' },
    { key: 'edit',    label: 'Edit',    description: 'Modify compliance entries' },
    { key: 'approve', label: 'Approve', description: 'Approve compliance items' },
    { key: 'export',  label: 'Export',  description: 'Export compliance reports' },
  ],
  reporting: [
    { key: 'create', label: 'Create', description: 'Create new report definitions' },
    { key: 'edit',   label: 'Edit',   description: 'Modify report configurations' },
    { key: 'export', label: 'Export', description: 'Run and export reports' },
  ],

  // ── Growth ───────────────────────────────────────────────────
  communication: [
    { key: 'create', label: 'Compose', description: 'Create email or WhatsApp messages' },
    { key: 'edit',   label: 'Edit',    description: 'Edit templates and drafts' },
    { key: 'send',   label: 'Send',    description: 'Send communications to clients' },
    { key: 'delete', label: 'Delete',  description: 'Delete templates or history' },
  ],
  marketing: [
    { key: 'create',  label: 'Create',  description: 'Create social media posts' },
    { key: 'edit',    label: 'Edit',    description: 'Edit post content and scheduling' },
    { key: 'publish', label: 'Publish', description: 'Publish posts to connected accounts' },
    { key: 'delete',  label: 'Delete',  description: 'Delete posts' },
  ],

  // ── Quotes (mapped to Requests module) ───────────────────────
  quotes: [
    { key: 'create',  label: 'Create',  description: 'Submit new requests' },
    { key: 'edit',    label: 'Edit',    description: 'Modify request details' },
    { key: 'approve', label: 'Approve', description: 'Approve or reject requests' },
    { key: 'delete',  label: 'Delete',  description: 'Delete request templates' },
  ],

  // ── Submissions ──────────────────────────────────────────────
  submissions: [
    { key: 'create',  label: 'Create',  description: 'Submit new submissions' },
    { key: 'edit',    label: 'Edit',    description: 'Modify submission details' },
    { key: 'approve', label: 'Approve', description: 'Approve or reject submissions' },
  ],

  // ── Notes (always accessible — no capabilities required) ────
  notes: [],

  // ── AI Management ───────────────────────────────────────────
  'ai-management': [
    { key: 'edit',   label: 'Configure', description: 'Modify AI agent settings and prompts' },
    { key: 'create', label: 'Manage KB', description: 'Add and manage knowledge base content' },
    { key: 'export', label: 'Export',    description: 'Export analytics and feedback data' },
  ],
};

/**
 * Human-readable labels for capabilities (used in badge/chip display).
 */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  view:               'View',
  create:             'Create',
  edit:               'Edit',
  delete:             'Delete',
  publish:            'Publish',
  approve:            'Approve',
  send:               'Send',
  export:             'Export',
  manage_permissions: 'Manage Permissions',
};

/**
 * Icon-friendly color tokens per capability for visual distinction.
 */
export const CAPABILITY_COLORS: Record<Capability, string> = {
  view:               'text-gray-500',
  create:             'text-green-600',
  edit:               'text-blue-600',
  delete:             'text-red-600',
  publish:            'text-purple-600',
  approve:            'text-amber-600',
  send:               'text-cyan-600',
  export:             'text-indigo-600',
  manage_permissions: 'text-rose-600',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Stale time for React Query cache (30 seconds)
 */
export const QUERY_STALE_TIME = 30000;

/**
 * Garbage collection time for React Query cache (5 minutes)
 */
export const QUERY_GC_TIME = 5 * 60 * 1000;

/**
 * Debounce time for search input (milliseconds)
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Maximum file size for document uploads (5MB)
 */
export const MAX_DOCUMENT_SIZE_MB = 5;

/**
 * Allowed document types for uploads
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
] as const;

/**
 * Document type labels
 */
export const DOCUMENT_TYPE_LABELS = {
  re5: 'RE5 Certificate',
  cfp: 'CFP Certificate',
  cob: 'CoB Certificate',
  id: 'ID Document',
  cv: 'CV',
  other: 'Other',
} as const;