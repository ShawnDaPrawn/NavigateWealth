/**
 * useClient Hook
 * 
 * Fetches client details by ID.
 * Used for hydrating client data in RoA drafts.
 * 
 * @module advice-engine/hooks/useClient
 */

import { useQuery } from '@tanstack/react-query';
import { adviceEngineApi } from '../api';
import type { Client } from '../types';
import { adviceEngineKeys } from './queryKeys';

/**
 * Hook to fetch client details
 * 
 * @param clientId - Client ID to fetch
 * @returns Query result with client data
 */
export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: adviceEngineKeys.client(clientId || ''),
    queryFn: async () => {
      if (!clientId) return null;
      return await adviceEngineApi.clients.getClient(clientId);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}