/**
 * Hook to fetch client keys from KV store
 * Used for auto-populating fields from calculated totals
 */

import { useQuery } from '@tanstack/react-query';
import { clientApi } from '../../client-management/api';
import { clientDataKeys } from '../../../../../utils/queryKeys';

export function useClientKeys(clientId: string | undefined) {
  return useQuery({
    queryKey: clientDataKeys.byClient(clientId || ''),
    queryFn: () => {
      if (!clientId) {
        throw new Error('Client ID is required');
      }
      return clientApi.getClientKeys(clientId);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}