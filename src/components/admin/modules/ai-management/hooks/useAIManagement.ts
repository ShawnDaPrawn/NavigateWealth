/**
 * AI Management Module — React Query Hooks
 *
 * All server state managed via React Query (§6, §11.2).
 * Hooks are narrowly scoped and named after intent.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiManagementKeys } from './queryKeys';
import { agentApi, vascoConfigApi, analyticsApi, feedbackApi, handoffApi, ragIndexApi } from '../api';
import { QUERY_STALE_TIME, ANALYTICS_STALE_TIME } from '../constants';
import type { HandoffStatus } from '../types';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// AGENT REGISTRY
// ============================================================================

export function useAgents() {
  return useQuery({
    queryKey: aiManagementKeys.agents(),
    queryFn: () => agentApi.getAgents(),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: aiManagementKeys.agent(id),
    queryFn: () => agentApi.getAgent(id),
    staleTime: QUERY_STALE_TIME,
    enabled: !!id,
  });
}

// ============================================================================
// VASCO CONFIG (Feature Flag)
// ============================================================================

export function useVascoConfig() {
  return useQuery({
    queryKey: aiManagementKeys.vascoConfig(),
    queryFn: () => vascoConfigApi.getConfig(),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useToggleVasco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => vascoConfigApi.updateConfig(enabled),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.vascoConfig() });
      toast.success(`Vasco ${data.enabled ? 'enabled' : 'disabled'} successfully`);
    },
    onError: () => {
      toast.error('Failed to update Vasco status');
    },
  });
}

// ============================================================================
// ANALYTICS
// ============================================================================

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: aiManagementKeys.analytics(),
    queryFn: () => analyticsApi.getSummary(),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

// ============================================================================
// FEEDBACK
// ============================================================================

export function useFeedback(limit = 50) {
  return useQuery({
    queryKey: aiManagementKeys.feedback(),
    queryFn: () => feedbackApi.getRecent(limit),
    staleTime: QUERY_STALE_TIME,
  });
}

// ============================================================================
// HANDOFFS
// ============================================================================

export function useHandoffs(status?: HandoffStatus) {
  return useQuery({
    queryKey: aiManagementKeys.handoffs(status),
    queryFn: () => handoffApi.getAll(status),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useUpdateHandoffStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: HandoffStatus }) =>
      handoffApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.all });
      toast.success('Handoff status updated');
    },
    onError: () => {
      toast.error('Failed to update handoff status');
    },
  });
}

// ============================================================================
// RAG INDEX
// ============================================================================

export function useRagIndexStatus() {
  return useQuery({
    queryKey: aiManagementKeys.ragIndex(),
    queryFn: () => ragIndexApi.getStatus(),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useTriggerReindex() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => ragIndexApi.triggerReindex(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.ragIndex() });
      toast.success(
        `Indexed ${result.articlesIndexed} articles (${result.totalChunks} chunks) in ${(result.durationMs / 1000).toFixed(1)}s`
      );
    },
    onError: () => {
      toast.error('Failed to trigger re-indexing');
    },
  });
}