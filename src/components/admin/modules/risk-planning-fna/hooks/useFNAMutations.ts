/**
 * useFNAMutations Hook
 * React Query mutations for FNA CRUD operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { RiskPlanningFnaAPI } from '../api';
import type { InformationGatheringInput, PublishedFNA } from '../types';
import { logError } from '../../../../../utils/errorUtils';
import { riskFnaKeys } from './queryKeys';

export function useFNAMutations() {
  const queryClient = useQueryClient();
  
  // Create FNA
  const createMutation = useMutation({
    mutationFn: ({ clientId, inputData }: { clientId: string; inputData: Partial<InformationGatheringInput> }) =>
      RiskPlanningFnaAPI.create(clientId, inputData),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: riskFnaKeys.list(data.clientId) });
        toast.success('FNA draft created successfully');
      } else {
        toast.error('Failed to create FNA draft');
      }
    },
    onError: (error) => {
      logError(error, 'useFNAMutations - createFNA');
      toast.error('An error occurred while creating the FNA');
    },
  });
  
  // Update FNA
  const updateMutation = useMutation({
    mutationFn: ({ fnaId, ...updates }: { fnaId: string } & Partial<PublishedFNA>) =>
      RiskPlanningFnaAPI.update(fnaId, updates),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: riskFnaKeys.detail(data.id) });
        queryClient.invalidateQueries({ queryKey: riskFnaKeys.list(data.clientId) });
        toast.success('FNA updated successfully');
      } else {
        toast.error('Failed to update FNA');
      }
    },
    onError: (error) => {
      logError(error, 'useFNAMutations - updateFNA');
      toast.error('An error occurred while updating the FNA');
    },
  });
  
  // Publish FNA
  const publishMutation = useMutation({
    mutationFn: (fnaId: string) => RiskPlanningFnaAPI.publish(fnaId),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: riskFnaKeys.detail(data.id) });
        queryClient.invalidateQueries({ queryKey: riskFnaKeys.list(data.clientId) });
        toast.success('FNA published successfully');
      } else {
        toast.error('Failed to publish FNA');
      }
    },
    onError: (error) => {
      logError(error, 'useFNAMutations - publishFNA');
      toast.error('An error occurred while publishing the FNA');
    },
  });
  
  // Archive FNA
  const archiveMutation = useMutation({
    mutationFn: (fnaId: string) => RiskPlanningFnaAPI.archive(fnaId),
    onSuccess: (_success, fnaId) => {
      queryClient.invalidateQueries({ queryKey: riskFnaKeys.all });
      toast.success('FNA archived successfully');
    },
    onError: (error) => {
      logError(error, 'useFNAMutations - archiveFNA');
      toast.error('An error occurred while archiving the FNA');
    },
  });
  
  return {
    createFNA: createMutation.mutateAsync,
    updateFNA: updateMutation.mutateAsync,
    publishFNA: publishMutation.mutateAsync,
    archiveFNA: archiveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isPublishing: publishMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}