/**
 * useTemplates — React Query hook for template data management.
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { templateApi } from '../api';
import { RequestTemplate, TemplateStatus, RequestCategory } from '../types';
import { requestKeys } from './queryKeys';

interface UseTemplatesOptions {
  status?: TemplateStatus[];
  category?: RequestCategory[];
  autoFetch?: boolean;
}

export function useTemplates(options: UseTemplatesOptions = {}) {
  const queryClient = useQueryClient();

  const filterParams: Record<string, unknown> = {};
  if (options.status) filterParams.status = options.status;
  if (options.category) filterParams.category = options.category;

  const { data: templates = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: requestKeys.templateList(filterParams),
    queryFn: () => templateApi.getAll(filterParams),
    enabled: options.autoFetch !== false,
    staleTime: 5 * 60 * 1000,
  });

  const invalidateTemplates = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: requestKeys.templates() }),
  [queryClient]);

  // Mutations
  const createMut = useMutation({
    mutationFn: (template: Partial<RequestTemplate>) => templateApi.create(template),
    onSuccess: () => { invalidateTemplates(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates, createNewVersion }: { id: string; updates: Partial<RequestTemplate>; createNewVersion?: boolean }) =>
      templateApi.update(id, updates, createNewVersion || false),
    onSuccess: () => { invalidateTemplates(); },
  });

  const duplicateMut = useMutation({
    mutationFn: (id: string) => templateApi.duplicate(id),
    onSuccess: () => { invalidateTemplates(); },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => templateApi.archive(id),
    onSuccess: () => { invalidateTemplates(); },
  });

  // Backward-compatible wrappers
  const createTemplate = useCallback(async (template: Partial<RequestTemplate>) => {
    try {
      const data = await createMut.mutateAsync(template);
      return { success: true, data };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
      return { success: false, error: errorMessage };
    }
  }, [createMut]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<RequestTemplate>, createNewVersion = false) => {
    try {
      const data = await updateMut.mutateAsync({ id, updates, createNewVersion });
      return { success: true, data };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      return { success: false, error: errorMessage };
    }
  }, [updateMut]);

  const duplicateTemplate = useCallback(async (id: string) => {
    try {
      const data = await duplicateMut.mutateAsync(id);
      return { success: true, data };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate template';
      return { success: false, error: errorMessage };
    }
  }, [duplicateMut]);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const data = await archiveMut.mutateAsync(id);
      return { success: true, data };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      return { success: false, error: errorMessage };
    }
  }, [archiveMut]);

  return {
    templates,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch templates') : null,
    refetch: invalidateTemplates,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    deleteTemplate,
    archiveTemplate: deleteTemplate,
  };
}

/**
 * Hook to get a single template by ID
 */
export function useTemplate(id: string | null) {
  const { data: template = null, isLoading: loading, error: queryError } = useQuery({
    queryKey: requestKeys.template(id || ''),
    queryFn: () => templateApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    template,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch template') : null,
  };
}
