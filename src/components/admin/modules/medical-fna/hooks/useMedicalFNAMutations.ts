/**
 * useMedicalFNAMutations Hook
 * React Query mutations for Medical FNA CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { MedicalFnaAPI } from '../api';
import type { MedicalFNAInputs } from '../types';

const QUERY_KEYS = {
  all: ['medical-fna'] as const,
  list: (clientId: string) => ['medical-fna', 'list', clientId] as const,
  detail: (fnaId: string) => ['medical-fna', 'detail', fnaId] as const,
  latestPublished: (clientId: string) => ['medical-fna', 'latest-published', clientId] as const,
};

export { QUERY_KEYS as MEDICAL_FNA_QUERY_KEYS };

export function useMedicalFNAMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (clientId: string) => MedicalFnaAPI.createMedicalFNA(clientId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      toast.success('Medical FNA draft created successfully');
    },
    onError: (error) => {
      console.error('useMedicalFNAMutations — create failed:', error);
      toast.error('Failed to create Medical FNA draft');
    },
  });

  const updateInputsMutation = useMutation({
    mutationFn: ({ fnaId, inputs }: { fnaId: string; inputs: Partial<MedicalFNAInputs> }) =>
      MedicalFnaAPI.updateMedicalFNAInputs(fnaId, inputs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
    },
    onError: (error) => {
      console.error('useMedicalFNAMutations — updateInputs failed:', error);
      toast.error('Failed to update Medical FNA inputs');
    },
  });

  const calculateMutation = useMutation({
    mutationFn: (fnaId: string) => MedicalFnaAPI.calculateMedicalFNA(fnaId),
    onError: (error) => {
      console.error('useMedicalFNAMutations — calculate failed:', error);
      toast.error('Failed to calculate Medical FNA');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (fnaId: string) => MedicalFnaAPI.publishMedicalFNA(fnaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      toast.success('Medical FNA published successfully');
    },
    onError: (error) => {
      console.error('useMedicalFNAMutations — publish failed:', error);
      toast.error('Failed to publish Medical FNA');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (fnaId: string) => MedicalFnaAPI.unpublishMedicalFNA(fnaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      toast.success('Medical FNA unpublished — reverted to draft');
    },
    onError: (error) => {
      console.error('useMedicalFNAMutations — unpublish failed:', error);
      toast.error('Failed to unpublish Medical FNA');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (fnaId: string) => MedicalFnaAPI.archiveMedicalFNA(fnaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      toast.success('Medical FNA archived successfully');
    },
    onError: (error) => {
      console.error('useMedicalFNAMutations — archive failed:', error);
      toast.error('Failed to archive Medical FNA');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fnaId: string) => MedicalFnaAPI.deleteMedicalFNA(fnaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all });
      toast.success('Medical FNA deleted');
    },
    onError: (error) => {
      console.error('useMedicalFNAMutations — delete failed:', error);
      toast.error('Failed to delete Medical FNA');
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
