/**
 * usePersonnel Hook
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hook for fetching all personnel members with filtering.
 */

import { useQuery } from '@tanstack/react-query';
import { personnelApi } from '../api';
import type { Personnel, PersonnelFilters } from '../types';
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '../constants';

// ============================================================================
// QUERY KEY FACTORY — Re-exported from central registry
// ============================================================================

export { personnelKeys } from '../../../../../utils/queryKeys';
import { personnelKeys } from '../../../../../utils/queryKeys';

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch all personnel members with optional filtering
 * 
 * @param filters - Optional filters to apply
 * @returns React Query result with personnel data
 * 
 * @example
 * ```tsx
 * const { data: personnel = [], isLoading } = usePersonnel({ 
 *   roles: ['adviser', 'paraplanner'],
 *   statuses: ['active']
 * });
 * ```
 */
export function usePersonnel(filters?: Partial<PersonnelFilters>) {
  return useQuery({
    queryKey: personnelKeys.list(filters),
    queryFn: () => personnelApi.fetch(filters),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

/**
 * Hook to fetch a single personnel member by ID
 * 
 * @param id - Personnel ID
 * @param enabled - Whether the query should run (default: true)
 * @returns React Query result with personnel data
 * 
 * @example
 * ```tsx
 * const { data: personnel, isLoading } = usePersonnelById('123');
 * ```
 */
export function usePersonnelById(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: personnelKeys.detail(id),
    queryFn: () => personnelApi.fetchById(id),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!id,
  });
}

/**
 * Hook to fetch clients assigned to a personnel member
 * 
 * @param personnelId - Personnel ID
 * @param enabled - Whether the query should run (default: false, must be explicitly enabled)
 * @returns React Query result with client summaries
 * 
 * @example
 * ```tsx
 * const { data: clients = [], isLoading } = usePersonnelClients(personnelId, true);
 * ```
 */
export function usePersonnelClients(personnelId: string, enabled: boolean = false) {
  return useQuery({
    queryKey: personnelKeys.clients(personnelId),
    queryFn: () => personnelApi.fetchClients(personnelId),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    enabled: enabled && !!personnelId,
  });
}

/**
 * Hook to fetch super admin profile
 * 
 * @returns React Query result with super admin profile
 * 
 * @example
 * ```tsx
 * const { data: superAdmin, isLoading } = useSuperAdmin();
 * ```
 */
export function useSuperAdmin() {
  return useQuery({
    queryKey: personnelKeys.superAdmin(),
    queryFn: () => personnelApi.fetchSuperAdmin(),
    staleTime: 5 * 60 * 1000, // 5 minutes — super admin identity is effectively static
    gcTime: QUERY_GC_TIME,
    retry: false,
    refetchOnMount: false, // Super admin identity never changes during a session
  });
}