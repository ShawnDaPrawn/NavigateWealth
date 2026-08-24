/**
 * Client keys — React Query hooks.
 *
 * Moved verbatim out of client-management/hooks/useClientKeys.ts, together
 * with the API calls they wrap. The query keys still come from the shared
 * registry, so cache entries are unchanged by the move.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clientKeysApi } from './api';
import { clientKeys } from '../../../../utils/queryKeys';

/**
 * Fetch client key values
 */
export function useClientKeys(clientId: string) {
  return useQuery({
    queryKey: clientKeys.clientKeys.all(clientId),
    queryFn: () => clientKeysApi.getClientKeys(clientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!clientId,
  });
}

/**
 * Recalculate client key totals
 */
export function useRecalculateClientKeys() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => clientKeysApi.recalculateClientKeys(clientId),
    onSuccess: (_data, clientId) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.clientKeys.all(clientId) });
      toast.success('Keys recalculated successfully', {
        description: 'All client key totals have been updated',
      });
    },
    onError: (error: Error) => {
      toast.error('Recalculation failed', {
        description: error.message || 'Failed to recalculate client keys. Please try again.',
      });
    },
  });
}

/**
 * Get key history/audit trail
 */
export function useClientKeyHistory(clientId: string, keyId: string) {
  return useQuery({
    queryKey: clientKeys.clientKeys.history(clientId, keyId),
    queryFn: () => clientKeysApi.getClientKeyHistory(clientId, keyId),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!clientId && !!keyId,
  });
}
