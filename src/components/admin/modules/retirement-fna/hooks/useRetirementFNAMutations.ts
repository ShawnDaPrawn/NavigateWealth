/**
 * useRetirementFNAMutations Hook
 * React Query mutations for Retirement FNA CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { RetirementFnaAPI } from '../api';
import { RETIREMENT_FNA_QUERY_KEYS } from './useRetirementFNAData';
import type { RetirementFNAInputs } from '../types';

export function useRetirementFNAMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (clientId: string) => RetirementFnaAPI.create(clientId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.list(data.clientId) });
      toast.success('Retirement FNA draft created successfully');
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — create failed:', error);
      toast.error('Failed to create Retirement FNA draft');
    },
  });

  const updateInputsMutation = useMutation({
    mutationFn: ({ fnaId, inputs }: { fnaId: string; inputs: Partial<RetirementFNAInputs> }) =>
      RetirementFnaAPI.updateInputs(fnaId, inputs),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.list(data.clientId) });
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — updateInputs failed:', error);
      toast.error('Failed to update Retirement FNA inputs');
    },
  });

  const calculateMutation = useMutation({
    mutationFn: (fnaId: string) => RetirementFnaAPI.calculate(fnaId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.detail(data.id) });
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — calculate failed:', error);
      toast.error('Failed to calculate Retirement FNA');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (fnaId: string) => RetirementFnaAPI.publish(fnaId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.list(data.clientId) });
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.latestPublished(data.clientId) });
      toast.success('Retirement FNA published successfully');
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — publish failed:', error);
      toast.error('Failed to publish Retirement FNA');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (fnaId: string) => RetirementFnaAPI.unpublish(fnaId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.list(data.clientId) });
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.latestPublished(data.clientId) });
      toast.success('Retirement FNA unpublished — reverted to draft');
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — unpublish failed:', error);
      toast.error('Failed to unpublish Retirement FNA');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (fnaId: string) => RetirementFnaAPI.archive(fnaId),
    onSuccess: (_data, _fnaId) => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.all });
      toast.success('Retirement FNA archived successfully');
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — archive failed:', error);
      toast.error('Failed to archive Retirement FNA');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fnaId: string) => RetirementFnaAPI.delete(fnaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RETIREMENT_FNA_QUERY_KEYS.all });
      toast.success('Retirement FNA deleted');
    },
    onError: (error) => {
      console.error('useRetirementFNAMutations — delete failed:', error);
      toast.error('Failed to delete Retirement FNA');
    },
  });

  return {
    createFNA: createMutation.mutateAsync,
    updateInputs: updateInputsMutation.mutateAsync,
    calculate: calculateMutation.mutateAsync,
    publishFNA: publishMutation.mutateAsync,
    unpublishFNA: unpublishMutation.mutateAsync,
    archiveFNA: archiveMutation.mutateAsync,
    deleteFNA: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateInputsMutation.isPending,
    isCalculating: calculateMutation.isPending,
    isPublishing: publishMutation.isPending,
    isUnpublishing: unpublishMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
