/**
 * useRoAClientContext Hook
 *
 * Fetches the full client/adviser context packet used to snapshot RoA drafts.
 */

import { useQuery } from '@tanstack/react-query';
import { adviceEngineApi } from '../api';
import { adviceEngineKeys } from './queryKeys';

export function useRoAClientContext(clientId: string | undefined) {
  return useQuery({
    queryKey: adviceEngineKeys.roa.clientContext(clientId || ''),
    queryFn: async () => {
      if (!clientId) return null;
      return await adviceEngineApi.roa.getClientContext(clientId);
    },
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}
