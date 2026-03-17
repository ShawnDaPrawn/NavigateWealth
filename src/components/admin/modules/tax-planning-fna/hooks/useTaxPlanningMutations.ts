/**
 * useTaxPlanningMutations Hook
 * React Query mutations for Tax Planning FNA CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { TaxPlanningFnaAPI } from '../api';
import { TAX_PLANNING_QUERY_KEYS } from './useTaxPlanningData';
import type {
  TaxPlanningInputs,
  TaxCalculationResults,
  AdjustmentLog,
  TaxRecommendation,
} from '../types';

interface SaveSessionParams {
  clientId: string;
  inputs: TaxPlanningInputs;
  finalResults: TaxCalculationResults;
  adjustments: AdjustmentLog[];
  recommendations: TaxRecommendation[];
  adviserNotes: string;
  status: 'draft' | 'published';
}

export function useTaxPlanningMutations() {
  const queryClient = useQueryClient();

  const saveSessionMutation = useMutation({
    mutationFn: ({ clientId, ...data }: SaveSessionParams) =>
      TaxPlanningFnaAPI.saveSession(clientId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: TAX_PLANNING_QUERY_KEYS.sessions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: TAX_PLANNING_QUERY_KEYS.latestPublished(variables.clientId) });
      const action = variables.status === 'published' ? 'published' : 'saved as draft';
      toast.success(`Tax Planning FNA ${action} successfully`);
    },
    onError: (error, variables) => {
      console.error('useTaxPlanningMutations — saveSession failed:', error);
      const action = variables.status === 'published' ? 'publish' : 'save';
      toast.error(`Failed to ${action} Tax Planning FNA`);
    },
  });

  return {
    saveSession: saveSessionMutation.mutateAsync,
    isSaving: saveSessionMutation.isPending,
    isPublishing: saveSessionMutation.isPending,
  };
}
