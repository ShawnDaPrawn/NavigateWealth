/**
 * useFnaBatchStatus — React Query hook for the FNA batch status endpoint
 *
 * Wraps GET /fna/batch-status/client/:clientId with proper cache control
 * and stale-time management. Returns the raw batch response; callers are
 * responsible for transforming results into their UI-level data model.
 *
 * Query key: fnaKeys.batchStatus(clientId)  (from /utils/queryKeys.ts)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../../utils/api';
import { fnaKeys } from '../../../../../utils/queryKeys';

// ── Types ──────────────────────────────────────────────────────────────

/** Shape of each item returned by the batch endpoint */
export interface BatchFNAStatusItem {
  key: string;
  status: 'published' | 'draft' | 'not_started' | 'error';
  data: Record<string, unknown> | null;
}

/** Full API response shape */
interface BatchFNAStatusResponse {
  success: boolean;
  data: BatchFNAStatusItem[];
}

// ── Hook ───────────────────────────────────────────────────────────────

/**
 * Fetch all FNA module statuses for a client in a single request.
 *
 * @param clientId - The client whose FNA statuses to fetch.
 * @param options.enabled - Whether the query should run (default: true when clientId is truthy).
 */
export function useFnaBatchStatus(
  clientId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<BatchFNAStatusItem[], Error>({
    queryKey: fnaKeys.batchStatus(clientId ?? ''),
    queryFn: async () => {
      const response = await api.get<BatchFNAStatusResponse>(
        `/fna/batch-status/client/${clientId}`
      );
      if (!response.success || !response.data) {
        throw new Error('Batch FNA status response was unsuccessful');
      }
      return response.data;
    },
    enabled: options?.enabled ?? !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes — FNA statuses change infrequently
    gcTime: 10 * 60 * 1000,   // 10 minutes garbage collection
  });
}

/**
 * Helper to imperatively invalidate the batch status cache for a client.
 * Useful after publishing/saving an FNA from another module.
 */
export function useInvalidateFnaBatchStatus() {
  const queryClient = useQueryClient();

  return (clientId: string) => {
    queryClient.invalidateQueries({ queryKey: fnaKeys.batchStatus(clientId) });
  };
}
