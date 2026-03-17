/**
 * useInvestmentINAMutations Hook
 * React Query mutations for Investment INA CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { InvestmentINAFnaAPI } from '../api';
import { INVESTMENT_INA_QUERY_KEYS } from './useInvestmentINAData';
import type { InvestmentINAInputs, InvestmentINAResults } from '../types';

interface CalculateParams {
  clientId: string;
  inputs: InvestmentINAInputs;
}

interface SaveSessionParams {
  clientId: string;
  inputs: InvestmentINAInputs;
  results: InvestmentINAResults | null;
  status: 'draft' | 'published';
}

export function useInvestmentINAMutations() {
  const queryClient = useQueryClient();

  const calculateMutation = useMutation({
    mutationFn: ({ clientId, inputs }: CalculateParams) =>
      InvestmentINAFnaAPI.calculateINA(clientId, inputs),
    onError: (error) => {
      console.error('useInvestmentINAMutations — calculate failed:', error);
      toast.error('Failed to calculate Investment INA');
    },
  });

  const saveSessionMutation = useMutation({
    mutationFn: ({ clientId, inputs, results, status }: SaveSessionParams) =>
      InvestmentINAFnaAPI.saveSession(clientId, inputs, results, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.sessions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.latestPublished(variables.clientId) });
      const action = variables.status === 'published' ? 'published' : 'saved as draft';
      toast.success(`Investment INA ${action} successfully`);
    },
    onError: (error, variables) => {
      console.error('useInvestmentINAMutations — saveSession failed:', error);
      const action = variables.status === 'published' ? 'publish' : 'save';
      toast.error(`Failed to ${action} Investment INA`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (sessionId: string) => InvestmentINAFnaAPI.publishSession(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.all });
      toast.success('Investment INA published successfully');
    },
    onError: (error) => {
      console.error('useInvestmentINAMutations — publish failed:', error);
      toast.error('Failed to publish Investment INA');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (sessionId: string) => InvestmentINAFnaAPI.unpublishSession(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.all });
      toast.success('Investment INA unpublished — reverted to draft');
    },
    onError: (error) => {
      console.error('useInvestmentINAMutations — unpublish failed:', error);
      toast.error('Failed to unpublish Investment INA');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => InvestmentINAFnaAPI.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVESTMENT_INA_QUERY_KEYS.all });
      toast.success('Investment INA deleted');
    },
    onError: (error) => {
      console.error('useInvestmentINAMutations — delete failed:', error);
      toast.error('Failed to delete Investment INA');
    },
  });

  return {
    calculateINA: calculateMutation.mutateAsync,
    saveSession: saveSessionMutation.mutateAsync,
    publishSession: publishMutation.mutateAsync,
    unpublishSession: unpublishMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
    isSaving: saveSessionMutation.isPending,
    isPublishing: publishMutation.isPending,
    isUnpublishing: unpublishMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
