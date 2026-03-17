/**
 * Personnel Module Index
 * Navigate Wealth Admin Dashboard
 * 
 * Barrel export for the Personnel module's public API.
 */

// Main module component
export { PersonnelModule } from './PersonnelModule';

// Types
export type {
  Personnel,
  PersonnelDocument,
  PersonnelQualifications,
  PersonnelStatus,
  UserRole,
  FSCAStatus,
  CommissionEntity,
  InvitePersonnelInput,
  UpdatePersonnelInput,
  AddPersonnelDocumentInput,
  PersonnelFilters,
  ClientSummary,
  SuperAdminProfile,
  InviteUserFormValues,
  PermissionSet,
  ModuleAccess,
  UpdatePermissionsInput,
  Capability,
} from './types';

// API
export { personnelApi } from './api';

// Hooks
export {
  // Query hooks
  usePersonnel,
  usePersonnelById,
  usePersonnelClients,
  useSuperAdmin,
  personnelKeys,
  
  // Mutation hooks
  useInvitePersonnel,
  useUpdatePersonnel,
  useDeletePersonnel,
  useAddPersonnelDocument,
  useUpdateSuperAdmin,
  
  // Permission hooks
  usePermissions,
  useAllPermissions,
  usePermissionAudit,
  useUpdatePermissions,
  useCurrentUserPermissions,
  permissionKeys,
  
  // Utility hooks
  usePersonnelFilters,
} from './hooks';

// Constants
export {
  ROLE_LABELS,
  ROLE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  FSCA_STATUS_LABELS,
  FSCA_STATUS_COLORS,
  COMMISSION_ENTITY_LABELS,
  DEFAULT_COMMISSION_SPLIT,
  DEFAULT_FILTERS,
  PERMISSIONED_MODULES,
  ALWAYS_ACCESSIBLE_MODULES,
  SUPER_ADMIN_EMAIL,
  DEFAULT_MODULE_ACCESS,
  MODULE_CAPABILITIES,
  CAPABILITY_LABELS,
  CAPABILITY_COLORS,
  QUERY_STALE_TIME,
  QUERY_GC_TIME,
  SEARCH_DEBOUNCE_MS,
  MAX_DOCUMENT_SIZE_MB,
  ALLOWED_DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from './constants';

export type { CapabilityMeta } from './constants';

// Schemas
export {
  inviteUserSchema,
  updateProfileSchema,
  commissionSchema,
} from './schema';