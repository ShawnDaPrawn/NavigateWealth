/**
 * useGlobalSearchData - React Query hook for global account search.
 *
 * Fetches client and personnel lists for the GlobalSearch command palette.
 * Uses shared query keys so data is reused across modules.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientApi } from '../modules/client-management/api';
import { personnelApi } from '../modules/personnel/api';
import { clientKeys, personnelKeys } from '../../../utils/queryKeys';
import type { ApiUser } from '../modules/client-management/types';
import { resolvePersonName } from '../../../utils/personName';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchableAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  type: 'client' | 'personnel';
  status: string;
  meta: string;
}

// ============================================================================
// TRANSFORMERS
// ============================================================================

function transformApiUserToSearchable(user: ApiUser): SearchableAccount {
  const rawProfile = (user.profile ?? undefined) as Record<string, unknown> | undefined;
  const personalInformation = rawProfile?.personalInformation as Record<string, unknown> | undefined;

  const { firstName, lastName } = resolvePersonName({
    profileFirstName:
      (personalInformation?.firstName as string | undefined) ||
      (rawProfile?.firstName as string | undefined) ||
      (rawProfile?.first_name as string | undefined),
    profileLastName:
      (personalInformation?.lastName as string | undefined) ||
      (rawProfile?.lastName as string | undefined) ||
      (rawProfile?.surname as string | undefined) ||
      (rawProfile?.last_name as string | undefined),
    metadataFirstName: user.user_metadata?.firstName,
    metadataLastName: user.user_metadata?.surname,
    fullName: user.name,
    fallbackFirstName: 'Unknown',
    fallbackLastName: 'User',
  });

  const accountStatus = user.account_status || 'active';
  const displayStatus = user.deleted
    ? 'closed'
    : user.suspended
      ? 'suspended'
      : accountStatus;

  return {
    id: user.id,
    firstName,
    lastName,
    email: user.email,
    type: 'client',
    status: displayStatus,
    meta: displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1),
  };
}

function includesSearch(account: SearchableAccount, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true;
  return (
    account.firstName.toLowerCase().includes(normalizedSearch) ||
    account.lastName.toLowerCase().includes(normalizedSearch) ||
    `${account.firstName} ${account.lastName}`.toLowerCase().includes(normalizedSearch) ||
    account.email.toLowerCase().includes(normalizedSearch)
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useGlobalSearchData(enabled: boolean, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const hasSearchQuery = normalizedSearch.length >= 2;
  const shouldFetch = enabled && hasSearchQuery;

  const {
    data: allClients = [],
    isLoading: clientsLoading,
  } = useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      const data = await clientApi.getClients();
      const rawUsers = Array.isArray(data.users)
        ? data.users
        : Array.isArray(data.clients)
          ? data.clients
          : [];
      return rawUsers.map(transformApiUserToSearchable);
    },
    staleTime: 5 * 60 * 1000,
    enabled: shouldFetch,
  });

  const {
    data: allPersonnel = [],
    isLoading: personnelLoading,
  } = useQuery({
    queryKey: personnelKeys.lists(),
    queryFn: async () => {
      const list = await personnelApi.fetch();
      return list.map((p): SearchableAccount => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        type: 'personnel',
        status: p.status,
        meta: (p.role || 'staff').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: shouldFetch,
  });

  const clients = useMemo(
    () => (hasSearchQuery ? allClients.filter(account => includesSearch(account, normalizedSearch)) : []),
    [allClients, hasSearchQuery, normalizedSearch],
  );

  const personnel = useMemo(
    () => (hasSearchQuery ? allPersonnel.filter(account => includesSearch(account, normalizedSearch)) : []),
    [allPersonnel, hasSearchQuery, normalizedSearch],
  );

  return {
    clients,
    personnel,
    isLoading: shouldFetch && (clientsLoading || personnelLoading),
    hasSearchQuery,
  };
}

