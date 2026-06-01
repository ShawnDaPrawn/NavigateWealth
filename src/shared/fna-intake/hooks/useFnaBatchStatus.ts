/**
 * useFnaBatchStatus — React Query hook for the FNA batch status endpoint
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/utils/api';
import { fnaKeys } from '@/utils/queryKeys';

export interface BatchFNAStatusItem {
  key: string;
  status: 'published' | 'draft' | 'client_draft' | 'submitted' | 'not_started' | 'error';
  data: Record<string, unknown> | null;
  intakeSessionId?: string;
}

interface BatchFNAStatusResponse {
  success: boolean;
  data: BatchFNAStatusItem[];
}

export function useFnaBatchStatus(clientId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery<BatchFNAStatusItem[], Error>({
    queryKey: fnaKeys.batchStatus(clientId ?? ''),
    queryFn: async () => {
      const response = await api.get<BatchFNAStatusResponse>(
        `/fna/batch-status/client/${clientId}`,
      );
      if (!response.success || !response.data) {
        throw new Error('Batch FNA status response was unsuccessful');
      }
      return response.data;
    },
    enabled: options?.enabled ?? !!clientId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useInvalidateFnaBatchStatus() {
  const queryClient = useQueryClient();
  return (clientId: string) => {
    queryClient.invalidateQueries({ queryKey: fnaKeys.batchStatus(clientId) });
  };
}
