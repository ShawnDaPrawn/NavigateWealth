/**
 * Custom Brand Templates Hook
 *
 * React Query hook for CRUD operations on custom brand templates
 * stored in KV store.
 *
 * @module social-media/hooks/useCustomTemplates
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { socialMediaAIApi } from '../api';
import { socialMediaKeys } from './queryKeys';
import type {
  CustomBrandTemplate,
  CreateCustomTemplateInput,
  UpdateCustomTemplateInput,
} from '../types';

export function useCustomTemplates() {
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: socialMediaKeys.ai.templates(),
    queryFn: () => socialMediaAIApi.getAllCustomTemplates(),
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateCustomTemplateInput) =>
      socialMediaAIApi.createCustomTemplate(input),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Custom template created');
        queryClient.invalidateQueries({ queryKey: socialMediaKeys.ai.templates() });
      } else {
        toast.error(response.error || 'Failed to create template');
      }
    },
    onError: (error: Error) => {
      toast.error(`Template creation failed: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCustomTemplateInput }) =>
      socialMediaAIApi.updateCustomTemplate(id, updates),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Template updated');
        queryClient.invalidateQueries({ queryKey: socialMediaKeys.ai.templates() });
      } else {
        toast.error(response.error || 'Failed to update template');
      }
    },
    onError: (error: Error) => {
      toast.error(`Template update failed: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => socialMediaAIApi.deleteCustomTemplate(id),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Template deleted');
        queryClient.invalidateQueries({ queryKey: socialMediaKeys.ai.templates() });
      } else {
        toast.error(response.error || 'Failed to delete template');
      }
    },
    onError: (error: Error) => {
      toast.error(`Template deletion failed: ${error.message}`);
    },
  });

  return {
    templates: (templatesQuery.data?.data || []) as CustomBrandTemplate[],
    templatesLoading: templatesQuery.isLoading,
    createTemplate: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTemplate: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTemplate: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
