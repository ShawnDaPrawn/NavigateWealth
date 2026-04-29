/**
 * usePermissions Hook
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hooks for personnel module-level permissions.
 * 
 * Provides:
 *  - usePermissions(personnelId)    — admin use: fetch/manage a user's permissions
 *  - useUpdatePermissions()         — admin use: mutation to save permission changes
 *  - useCurrentUserPermissions()    — sidebar & module use: resolved permissions + capabilities
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { personnelApi } from '../api';
import { personnelKeys } from './usePersonnel';
import type { PermissionSet, UpdatePermissionsInput, Capability } from '../types';
import type { AdminModule } from '../../../layout/types';
import { QUERY_STALE_TIME, QUERY_GC_TIME, ALWAYS_ACCESSIBLE_MODULES } from '../constants';

// ============================================================================
// QUERY KEY EXTENSIONS — Re-exported from central registry
// ============================================================================

export { permissionKeys } from '../../../../../utils/queryKeys';
import { permissionKeys } from '../../../../../utils/queryKeys';

// ============================================================================
// ADMIN: Fetch permissions for a specific personnel member
// ============================================================================

export function usePermissions(personnelId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: permissionKeys.detail(personnelId),
    queryFn: () => personnelApi.fetchPermissions(personnelId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!personnelId,
  });
}

// ============================================================================
// ADMIN: Fetch all permissions (for personnel table summary)
// ============================================================================

export function useAllPermissions(enabled: boolean = true) {
  return useQuery({
    queryKey: [...permissionKeys.all, 'all'] as const,
    queryFn: () => personnelApi.fetchAllPermissions(),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled,
  });
}

// ============================================================================
// ADMIN: Fetch permission audit trail for a specific personnel member
// ============================================================================

export function usePermissionAudit(personnelId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...permissionKeys.all, 'audit', personnelId] as const,
    queryFn: () => personnelApi.fetchPermissionAudit(personnelId),
    staleTime: 30 * 1000, // 30 seconds — audit data changes infrequently
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!personnelId,
  });
}

// ============================================================================
// ADMIN: Mutation to update permissions
// ============================================================================

export function useUpdatePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdatePermissionsInput) => {
      return personnelApi.updatePermissions(input);
    },
    onSuccess: (data, variables) => {
      // Invalidate specific permissions
      queryClient.invalidateQueries({ queryKey: permissionKeys.detail(variables.personnelId) });
      // Also invalidate "me" in case admin is editing their own permissions
      queryClient.invalidateQueries({ queryKey: permissionKeys.me() });
      // Invalidate the bulk permissions query (personnel table summary)
      queryClient.invalidateQueries({ queryKey: [...permissionKeys.all, 'all'] });
      // Invalidate audit trail for this personnel member
      queryClient.invalidateQueries({ queryKey: [...permissionKeys.all, 'audit', variables.personnelId] });
      toast.success('Module permissions updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to update permissions:', error);
      toast.error(`Failed to update permissions: ${error.message}`);
    },
  });
}

// ============================================================================
// SIDEBAR + MODULE: Current user's resolved permissions
// ============================================================================

interface ResolvedPermissions {
  /** Whether the current user is the hardcoded super admin */
  isSuperAdmin: boolean;

  /** Check if the current user can access a specific module */
  can: (module: AdminModule) => boolean;

  /**
   * Check if the current user has a specific capability within a module.
   * 
   * Behaviour:
   *  - Super admin: always true
   *  - Module not accessible: always false
   *  - `view` capability: always true when module is accessible
   *  - No capabilities stored (legacy / Phase 1 data): all capabilities granted
   *    (backwards-compatible — if capabilities array is undefined/empty,
   *     the user has full module access until an admin explicitly restricts them)
   *  - Otherwise: checks if the capability is in the stored array
   */
  canDo: (module: AdminModule, capability: Capability) => boolean;

  /** List of all accessible module IDs */
  accessibleModules: AdminModule[];

  /** The raw permission data (for advanced use) */
  permissions: (PermissionSet & { isSuperAdmin: boolean }) | undefined;

  /** Whether permissions are still loading */
  isLoading: boolean;
}

/**
 * Hook for the current authenticated user's module permissions.
 * 
 * Super admin (shawn@navigatewealth.co) always returns true for all modules
 * and all capabilities.
 * 
 * Other users are checked against their stored permission set.
 * Dashboard is always accessible.
 * 
 * @example
 * ```tsx
 * const { can, canDo, isSuperAdmin, isLoading } = useCurrentUserPermissions();
 * 
 * // Module-level check (sidebar)
 * if (can('publications')) { ... }
 * 
 * // Capability-level check (within a module)
 * if (canDo('publications', 'publish')) { ... }
 * if (canDo('personnel', 'manage_permissions')) { ... }
 * ```
 */
export function useCurrentUserPermissions(): ResolvedPermissions {
  const { data, isLoading } = useQuery({
    queryKey: permissionKeys.me(),
    queryFn: () => personnelApi.fetchMyPermissions(),
    staleTime: 2 * 60 * 1000, // 2 minutes — slightly longer for sidebar stability
    gcTime: QUERY_GC_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Permissions are stable — avoid re-fetching on every module navigation
  });

  const isSuperAdmin = data?.isSuperAdmin === true;

  const can = (module: AdminModule): boolean => {
    // Always-accessible modules
    if (ALWAYS_ACCESSIBLE_MODULES.includes(module)) return true;
    // Super admin bypass
    if (isSuperAdmin) return true;
    // While permissions are still loading, show all modules optimistically
    // to prevent the sidebar from appearing empty during initial load.
    // Once resolved, restricted items will be hidden.
    if (isLoading) return true;
    // Check stored permissions
    return data?.modules?.[module]?.access === true;
  };

  const canDo = (module: AdminModule, capability: Capability): boolean => {
    // Super admin bypass — all capabilities
    if (isSuperAdmin) return true;
    // While loading, grant all capabilities optimistically (same reasoning as can())
    if (isLoading) return true;
    // Module must be accessible first
    if (!can(module)) return false;
    // View is always granted when module is accessible
    if (capability === 'view') return true;

    const modulePerms = data?.modules?.[module];
    if (!modulePerms) return false;

    // Backwards compatibility: if capabilities array is not set,
    // treat the user as having full access within the module.
    // This preserves Phase 1 behaviour where access: true meant everything.
    if (!modulePerms.capabilities || modulePerms.capabilities.length === 0) {
      return true;
    }

    return modulePerms.capabilities.includes(capability);
  };

  // Build accessible modules list
  const allModules: AdminModule[] = [
    'dashboard', 'clients', 'esign', 'personnel', 'advice-engine',
    'product-management', 'resources', 'publications', 'compliance',
    'tasks', 'notes', 'applications', 'quotes', 'submissions', 'communication',
    'marketing', 'reporting', 'calendar', 'issues', 'ai-management',
  ];

  const accessibleModules = allModules.filter(can);

  return {
    isSuperAdmin,
    can,
    canDo,
    accessibleModules,
    permissions: data,
    isLoading,
  };
}
