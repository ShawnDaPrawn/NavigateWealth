/**
 * Personnel Hooks Index
 * Navigate Wealth Admin Dashboard
 * 
 * Barrel export for all personnel-related React hooks.
 */

// Query hooks
export {
  usePersonnel,
  usePersonnelById,
  usePersonnelClients,
  useSuperAdmin,
  personnelKeys,
} from './usePersonnel';

// Mutation hooks
export {
  useInvitePersonnel,
  useCreatePersonnelAccount,
  useUpdatePersonnel,
  useDeletePersonnel,
  useAddPersonnelDocument,
  useResendPersonnelInvite,
  useCancelPersonnelInvite,
  useUpdateSuperAdmin,
  useBackfillAuthRoles,
} from './usePersonnelMutations';

// Permission hooks
export {
  usePermissions,
  useAllPermissions,
  usePermissionAudit,
  useUpdatePermissions,
  useCurrentUserPermissions,
  permissionKeys,
} from './usePermissions';

// Legacy hooks (kept for backward compatibility, to be migrated)
export { usePersonnelFilters } from './usePersonnelFilters';