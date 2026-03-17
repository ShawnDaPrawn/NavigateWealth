/**
 * usePersonnel Hook
 * 
 * Fetches personnel list (advisors).
 * 
 * @module advice-engine/hooks/usePersonnel
 */

import { useQuery } from '@tanstack/react-query';
import { adviceEngineApi } from '../api';
import type { Personnel } from '../types';
import { adviceEngineKeys } from './queryKeys';

export function usePersonnel() {
  return useQuery({
    queryKey: adviceEngineKeys.personnel(),
    queryFn: async () => {
      const data = await adviceEngineApi.personnel.getPersonnel();
      return data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false, // Personnel list is stable — avoid re-fetching on every module navigation
  });
}