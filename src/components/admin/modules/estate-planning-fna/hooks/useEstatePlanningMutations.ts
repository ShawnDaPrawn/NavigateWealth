/**
 * useEstatePlanningMutations Hook
 * React Query mutations for Estate Planning FNA CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { EstatePlanningAPI } from '../api';
import { ESTATE_PLANNING_QUERY_KEYS } from './useEstatePlanningData';
import type { EstatePlanningInputs, EstatePlanningResults } from '../types';

interface SaveSessionParams {
  clientId: string;
  inputs: EstatePlanningInputs;
  results: EstatePlanningResults | null;
  status: 'draft' | 'published';
  adviserNotes?: string;
}

export function useEstatePlanningMutations() {
  const queryClient = useQueryClient();

  const saveSessionMutation = useMutation({
    mutationFn: ({ clientId, inputs, results, status, adviserNotes }: SaveSessionParams) =>
      EstatePlanningAPI.saveSession(clientId, inputs, results, status, adviserNotes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.sessions(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.latestPublished(variables.clientId) });
      const action = variables.status === 'published' ? 'published' : 'saved as draft';
      toast.success(`Estate Planning FNA ${action} successfully`);
    },
    onError: (error, variables) => {
      console.error('useEstatePlanningMutations — saveSession failed:', error);
      const action = variables.status === 'published' ? 'publish' : 'save';
      toast.error(`Failed to ${action} Estate Planning FNA`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (sessionId: string) => EstatePlanningAPI.publishSession(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.all });
      toast.success('Estate Planning FNA published successfully');
    },
    onError: (error) => {
      console.error('useEstatePlanningMutations — publish failed:', error);
      toast.error('Failed to publish Estate Planning FNA');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (sessionId: string) => EstatePlanningAPI.unpublishSession(sessionId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.all });
      toast.success('Estate Planning FNA unpublished — reverted to draft');
    },
    onError: (error) => {
      console.error('useEstatePlanningMutations — unpublish failed:', error);
      toast.error('Failed to unpublish Estate Planning FNA');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => EstatePlanningAPI.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ESTATE_PLANNING_QUERY_KEYS.all });
      toast.success('Estate Planning FNA deleted');
    },
    onError: (error) => {
      console.error('useEstatePlanningMutations — delete failed:', error);
      toast.error('Failed to delete Estate Planning FNA');
    },
  });

  return {
    saveSession: saveSessionMutation.mutateAsync,
    publishSession: publishMutation.mutateAsync,
    unpublishSession: unpublishMutation.mutateAsync,
    deleteSession: deleteMutation.mutateAsync,
    isSaving: saveSessionMutation.isPending,
    isPublishing: publishMutation.isPending,
    isUnpublishing: unpublishMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
