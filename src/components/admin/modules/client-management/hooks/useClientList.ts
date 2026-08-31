/**
 * useClientList — React Query hook for the client list.
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Client, ApiUser } from '../types';
import { clientApi } from '../api';
import { clientKeys } from './queryKeys';
import { normalizeClientProfileKv } from '../normalizeClientProfileKv';
import { resolvePersonName } from '../../../../../utils/personName';
import { parseContract, BaseClientSchema } from '../../../../../shared/contracts';
import { ClientListEnvelopeSchema } from '../contracts';

/** Transform raw API user into application-level Client model */
function transformApiUser(user: ApiUser): Client {
  const normalizedProfile = normalizeClientProfileKv(user.profile);
  const pi = normalizedProfile?.personalInformation;
  const rawProfile = (user.profile ?? undefined) as Record<string, unknown> | undefined;
  const personalIdentifier = pi?.idNumber?.trim() || pi?.passportNumber?.trim() || 'Not provided';

  const { firstName, lastName } = resolvePersonName({
    profileFirstName:
      pi?.firstName ||
      (rawProfile?.firstName as string | undefined) ||
      (rawProfile?.first_name as string | undefined),
    profileLastName:
      pi?.lastName ||
      (rawProfile?.lastName as string | undefined) ||
      (rawProfile?.surname as string | undefined) ||
      (rawProfile?.last_name as string | undefined),
    metadataFirstName: user.user_metadata?.firstName,
    metadataLastName: user.user_metadata?.surname,
    fullName: user.name,
    fallbackFirstName: 'Unknown',
    fallbackLastName: 'User',
  });

  return {
    id: user.id,
    firstName,
    lastName,
    preferredName: firstName,
    email: user.email,
    idNumber: personalIdentifier,
    createdAt: user.created_at,
    applicationNumber: user.application_number,
    applicationStatus: user.application_status || 'unknown',
    accountType: user.account_type,
    deleted: user.deleted || false,
    suspended: user.suspended || false,
    accountStatus: user.account_status || undefined,
    profile: normalizedProfile,
    application: user.application,
  };
}

/**
 * Fetch and transform the full client list.
 *
 * Shared by useClientList and the GlobalSearch data hook so every consumer of
 * the `clientKeys.lists()` cache entry stores the same `Client[]` shape —
 * storing a different shape under the shared key breaks whichever consumer
 * reads the other's cached data.
 */
export async function fetchClientList(): Promise<Client[]> {
  const data = await clientApi.getClients();

  // Report-only (F8). The fallback below is load-bearing precisely because
  // this response shape has drifted before — `users` was renamed to
  // `clients` — and the fallback's failure mode is a silent empty list that
  // reads as "no clients". parseContract never throws and never alters the
  // payload, so this adds signal without adding a failure mode.
  parseContract(ClientListEnvelopeSchema, data, { endpoint: 'GET profile/all-users' });

  // Server returns { clients: [...], total, page, ... } (PaginatedClientResponse)
  // Defensive: handle both legacy .users and current .clients shapes (§9.3)
  const rawUsers = Array.isArray(data.clients)
    ? data.clients
    : Array.isArray(data.users)
      ? data.users
      : [];

  return rawUsers.map((user) => {
    const client = transformApiUser(user);
    // The transform's contract with the rest of the module is that it
    // returns something BaseClient-shaped. Checking its OUTPUT rather than
    // its input is what makes this meaningful: `resolvePersonName` supplies
    // name fallbacks, so a missing name is not a violation, but a missing
    // `id` or `email` is — and both come straight from the server.
    parseContract(BaseClientSchema, client, { endpoint: 'GET profile/all-users → Client' });
    return client;
  });
}

export function useClientList() {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: loading } = useQuery({
    queryKey: clientKeys.lists(),
    queryFn: fetchClientList,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refetch = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
  }, [queryClient]);

  return { clients, loading, refetch };
}
