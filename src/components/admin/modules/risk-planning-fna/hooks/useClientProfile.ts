/**
 * useClientProfile Hook
 * Fetches client profile data for auto-population
 */

import { useQuery } from '@tanstack/react-query';
import { RiskPlanningFnaAPI } from '../api';
import type { ClientProfileData } from '../types';
import { riskFnaKeys } from './queryKeys';

export function useClientProfile(clientId: string | undefined) {
  return useQuery<ClientProfileData | null>({
    queryKey: riskFnaKeys.clientProfile(clientId || ''),
    queryFn: () => {
      if (!clientId) return null;
      return RiskPlanningFnaAPI.getClientProfile(clientId);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}