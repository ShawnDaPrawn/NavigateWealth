/**
 * useGlobalSearchData — React Query hook for global account search.
 *
 * Fetches client and personnel lists for the GlobalSearch command palette.
 * Uses the same query keys as the module hooks so data is shared via cache.
 *
 * Guidelines §6  — All server state via React Query.
 * Guidelines §19.1 — Query keys from centralized registry.
 */

import { useQuery } from '@tanstack/react-query';
import { clientApi } from '../modules/client-management/api';
import { personnelApi } from '../modules/personnel/api';
import { clientKeys, personnelKeys } from '../../../utils/queryKeys';
import type { ApiUser } from '../modules/client-management/types';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchableAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  type: 'client' | 'personnel';
  /** Display-ready status label */
  status: string;
  /** Secondary info line: role for personnel, account status for clients */
  meta: string;
}

// ============================================================================
// TRANSFORMERS (pure — §7.1)
// ============================================================================

function transformApiUserToSearchable(user: ApiUser): SearchableAccount {
  const firstName =
    user.user_metadata?.firstName ||
    user.profile?.personalInformation?.firstName ||
    user.name?.split(' ')[0] ||
    'Unknown';
  const lastName =
    user.user_metadata?.surname ||
    user.profile?.personalInformation?.lastName ||
    user.name?.split(' ').slice(1).join(' ') ||
    'User';

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

// ============================================================================
// HOOK
// ============================================================================

/**
 * Fetches clients and personnel for the global search palette.
 *
 * @param enabled — only fetch when the dialog is open (avoids unnecessary requests)
 */
export function useGlobalSearchData(enabled: boolean) {
  const {
    data: clients = [],
    isLoading: clientsLoading,
  } = useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      const data = await clientApi.getClients();
      return data.users.map(transformApiUserToSearchable);
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  const {
    data: personnel = [],
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
    enabled,
  });

  return {
    clients,
    personnel,
    isLoading: clientsLoading || personnelLoading,
  };
}
