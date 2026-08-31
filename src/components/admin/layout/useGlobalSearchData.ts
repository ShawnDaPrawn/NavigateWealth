/**
 * useGlobalSearchData - React Query hook for global account search.
 *
 * Fetches client and personnel lists for the GlobalSearch command palette.
 *
 * Cache discipline: this hook uses the SAME query keys and fetchers as the
 * Clients module (useClientList) and Personnel module (usePersonnel), so each
 * cache entry always holds the module's shape (`Client[]` / `Personnel[]`)
 * regardless of which consumer fetched first. The palette's own view
 * (`SearchableAccount`) is derived per-consumer via `select`, never stored.
 *
 * Storing a search-shaped array under the shared key is what previously broke
 * search→profile navigation: after the Clients module cached `Client[]`, the
 * palette read objects with no `type` field, so navigateToAccount received
 * `undefined` and the module switch fell through to the dashboard.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchClientList } from '../modules/client-management';
import { personnelApi } from '../modules/personnel';
import type { Client } from '../modules/client-management';
import type { Personnel } from '../modules/personnel';
import { clientKeys, personnelKeys } from '../../../utils/queryKeys';

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clientToSearchable(client: Client): SearchableAccount {
  const accountStatus = client.accountStatus || 'active';
  const displayStatus = client.deleted ? 'closed' : client.suspended ? 'suspended' : accountStatus;
  const statusLabel = String(displayStatus);

  return {
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email ?? '',
    type: 'client',
    status: statusLabel,
    meta: capitalize(statusLabel),
  };
}

function personnelToSearchable(person: Personnel): SearchableAccount {
  return {
    id: person.id,
    firstName: person.firstName ?? '',
    lastName: person.lastName ?? '',
    email: person.email ?? '',
    type: 'personnel',
    status: person.status ?? 'active',
    meta: (person.role || 'staff').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

// Module-scope select functions: stable identity, so React Query only re-runs
// the mapping when the underlying cached data changes.
function selectSearchableClients(clients: Client[]): SearchableAccount[] {
  return clients.map(clientToSearchable);
}

function selectSearchablePersonnel(personnel: Personnel[]): SearchableAccount[] {
  return personnel.map(personnelToSearchable);
}

function includesSearch(account: SearchableAccount, normalizedSearch: string): boolean {
  if (!normalizedSearch) return true;
  const fn = (account.firstName ?? '').toLowerCase();
  const ln = (account.lastName ?? '').toLowerCase();
  const em = (account.email ?? '').toLowerCase();
  return (
    fn.includes(normalizedSearch) ||
    ln.includes(normalizedSearch) ||
    `${fn} ${ln}`.includes(normalizedSearch) ||
    em.includes(normalizedSearch)
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useGlobalSearchData(enabled: boolean, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const hasSearchQuery = normalizedSearch.length >= 2;
  const shouldFetch = enabled && hasSearchQuery;

  // Same key + queryFn as useClientList — the entry always caches Client[].
  const { data: allClients = [], isLoading: clientsLoading } = useQuery({
    queryKey: clientKeys.lists(),
    queryFn: fetchClientList,
    select: selectSearchableClients,
    staleTime: 5 * 60 * 1000,
    enabled: shouldFetch,
  });

  // Same key + queryFn as usePersonnel() — the entry always caches Personnel[].
  const { data: allPersonnel = [], isLoading: personnelLoading } = useQuery({
    queryKey: personnelKeys.list(),
    queryFn: () => personnelApi.fetch(),
    select: selectSearchablePersonnel,
    staleTime: 5 * 60 * 1000,
    enabled: shouldFetch,
  });

  const clients = useMemo(
    () =>
      hasSearchQuery
        ? allClients.filter((account) => includesSearch(account, normalizedSearch))
        : [],
    [allClients, hasSearchQuery, normalizedSearch],
  );

  const personnel = useMemo(
    () =>
      hasSearchQuery
        ? allPersonnel.filter((account) => includesSearch(account, normalizedSearch))
        : [],
    [allPersonnel, hasSearchQuery, normalizedSearch],
  );

  return {
    clients,
    personnel,
    isLoading: shouldFetch && (clientsLoading || personnelLoading),
    hasSearchQuery,
  };
}
