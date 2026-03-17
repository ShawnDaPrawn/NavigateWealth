/**
 * useClientList — React Query hook for the client list.
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Client, ApiUser, ClientProfile, ProfileData } from '../types';
import { clientApi } from '../api';
import { clientKeys } from './queryKeys';

/**
 * Normalize profile data from the server response.
 *
 * The server returns `profile` as flat `ProfileData` (the raw KV value
 * from `user_profile:{userId}:personal_info`), but the `ClientProfile`
 * interface nests it under `personalInformation`. This function detects
 * the shape and normalizes to `ClientProfile` so downstream code that
 * accesses `profile.personalInformation.xxx` works regardless of the
 * server response shape.
 *
 * §9.3 — API response type synchronisation
 */
function normalizeProfile(raw: unknown): ClientProfile | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  // Already in ClientProfile format — has a personalInformation sub-object
  if (obj.personalInformation && typeof obj.personalInformation === 'object') {
    return obj as ClientProfile;
  }
  // Flat ProfileData — wrap it
  return { personalInformation: obj as ProfileData };
}

/** Transform raw API user into application-level Client model */
function transformApiUser(user: ApiUser): Client {
  const normalizedProfile = normalizeProfile(user.profile);
  const pi = normalizedProfile?.personalInformation;

  return {
    id: user.id,
    firstName:
      user.user_metadata?.firstName ||
      pi?.firstName ||
      user.name?.split(' ')[0] ||
      'Unknown',
    lastName:
      user.user_metadata?.surname ||
      pi?.lastName ||
      user.name?.split(' ').slice(1).join(' ') ||
      'User',
    preferredName:
      user.user_metadata?.firstName ||
      pi?.firstName ||
      user.name?.split(' ')[0] ||
      'Unknown',
    email: user.email,
    idNumber:
      pi?.idNumber ||
      pi?.passportNumber ||
      'Not provided',
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

export function useClientList() {
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading: loading } = useQuery({
    queryKey: clientKeys.lists(),
    queryFn: async () => {
      const data = await clientApi.getClients();
      // Server returns { clients: [...], total, page, ... } (PaginatedClientResponse)
      // Defensive: handle both legacy .users and current .clients shapes (§9.3)
      const rawUsers = Array.isArray(data.clients)
        ? data.clients
        : Array.isArray(data.users)
          ? data.users
          : [];
      return rawUsers.map(transformApiUser);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const refetch = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
  }, [queryClient]);

  return { clients, loading, refetch };
}