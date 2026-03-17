/**
 * useClientProfile Hook for Medical FNA
 * Fetches client profile data for auto-population using the standard Client API
 */

import { useQuery } from '@tanstack/react-query';
import { clientApi } from '../../client-management/api';
import { medicalFnaKeys } from './queryKeys';

export function useClientProfile(clientId: string | undefined) {
  return useQuery({
    queryKey: medicalFnaKeys.clientProfile(clientId),
    queryFn: async () => {
      if (!clientId) return null;
      try {
        const response = await clientApi.fetchClientProfile(clientId);
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      } catch (error) {
        console.error('Error fetching client profile:', error);
        return null;
      }
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}