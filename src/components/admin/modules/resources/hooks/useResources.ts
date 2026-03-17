/**
 * useResources — React Query hook for resource management.
 *
 * Server list state uses React Query; local filter state stays in useState (§11.1).
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { resourcesApi } from '../api';
import { FormDefinition, FormFilters, ResourceResponse } from '../types';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import { LetterRenderer } from '../components/LetterRenderer';
import { resourceKeys } from './queryKeys';

/** Transform API response into application-level FormDefinition */
function transformResource(resource: ResourceResponse): FormDefinition {
  return {
    id: resource.id,
    name: resource.title,
    category: resource.category || 'Forms',
    description: resource.description || '',
    version: resource.version || '1.0',
    lastUpdated: new Date(resource.createdAt).toLocaleDateString(),
    downloads: 0,
    size: 'Dynamic',
    isPopular: false,
    fields: [],
    clientTypes: resource.clientTypes || ['Universal'],
    component: resource.category === 'Letters' ? LetterRenderer : DynamicFormRenderer,
    blocks: resource.blocks || [],
    letterMeta: resource.letterMeta,
    status: resource.status || 'draft',
  };
}

export function useResources() {
  const queryClient = useQueryClient();

  // ── Server state via React Query ──
  const { data: forms = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: resourceKeys.lists(),
    queryFn: async () => {
      const response = await resourcesApi.getAll({});
      return response.map(transformResource);
    },
    staleTime: 5 * 60 * 1000,
  });

  const error = queryError
    ? (queryError instanceof Error ? queryError.message : 'Failed to fetch resources')
    : null;

  // ── Local UI state: filters (§11.1) ──
  const [filters, setFilters] = useState<FormFilters>({
    search: '',
    category: 'Forms',
    clientType: 'all',
    sortBy: 'name',
    sortDirection: 'asc',
    status: 'all',
  });

  // ── Derived / memoised data ──
  const filteredForms = useMemo(() => {
    let filtered = [...forms];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (form) =>
          form.name.toLowerCase().includes(searchLower) ||
          form.description.toLowerCase().includes(searchLower),
      );
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter((form) => form.category === filters.category);
    }

    if (filters.clientType !== 'all') {
      filtered = filtered.filter((form) =>
        form.clientTypes.includes(filters.clientType),
      );
    }

    // Phase 1: Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter((form) => form.status === filters.status);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'lastUpdated':
          comparison = new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
          break;
        case 'downloads':
          comparison = b.downloads - a.downloads;
          break;
      }
      return filters.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [forms, filters]);

  const categories = useMemo(() => {
    const STANDARD_CATEGORIES = ['Forms', 'Legal', 'Requests', 'Letters'];
    const fromData = forms.map((f) => f.category);
    const additional = Array.from(new Set(fromData))
      .filter((c) => !STANDARD_CATEGORIES.includes(c))
      .sort();
    return [...STANDARD_CATEGORIES, ...additional];
  }, [forms]);

  const clientTypes = useMemo(() => {
    const allTypes = forms.flatMap((f) => f.clientTypes);
    return Array.from(new Set(allTypes)).sort();
  }, [forms]);

  // ── Mutations ──
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: resourceKeys.lists() }),
    [queryClient],
  );

  const createMut = useMutation({
    mutationFn: (data: { title: string; category: string; description?: string; blocks?: unknown[]; clientTypes?: string[] }) =>
      resourcesApi.create(data),
    onSuccess: () => { invalidate(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { title?: string; category?: string; description?: string; blocks?: unknown[]; clientTypes?: string[]; status?: string } }) =>
      resourcesApi.update(id, updates),
    onSuccess: () => { invalidate(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => resourcesApi.delete(id),
    onSuccess: () => { invalidate(); },
  });

  const duplicateMut = useMutation({
    mutationFn: (id: string) => resourcesApi.duplicate(id),
    onSuccess: () => { invalidate(); },
  });

  // Backward-compatible wrappers
  const createResource = useCallback(async (data: { title: string; category: string; description?: string; blocks?: unknown[]; clientTypes?: string[] }) => {
    try {
      const result = await createMut.mutateAsync(data);
      toast.success('Resource created successfully');
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create resource';
      toast.error('Failed to create resource', { description: msg });
      throw err;
    }
  }, [createMut]);

  const updateResource = useCallback(async (id: string, updates: { title?: string; category?: string; description?: string; blocks?: unknown[]; clientTypes?: string[]; status?: string }) => {
    try {
      const result = await updateMut.mutateAsync({ id, updates });
      toast.success('Resource updated successfully');
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update resource';
      toast.error('Failed to update resource', { description: msg });
      throw err;
    }
  }, [updateMut]);

  const deleteResource = useCallback(async (id: string) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Resource deleted successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete resource';
      toast.error('Failed to delete resource', { description: msg });
      throw err;
    }
  }, [deleteMut]);

  const duplicateResource = useCallback(async (id: string) => {
    try {
      const result = await duplicateMut.mutateAsync(id);
      toast.success('Resource duplicated successfully');
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate resource';
      toast.error('Failed to duplicate resource', { description: msg });
      throw err;
    }
  }, [duplicateMut]);

  const updateFilters = useCallback((newFilters: Partial<FormFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      category: 'Forms',
      clientType: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      status: 'all',
    });
  }, []);

  return {
    forms,
    filteredForms,
    categories,
    clientTypes,
    loading,
    error,
    filters,
    createResource,
    updateResource,
    deleteResource,
    duplicateResource,
    updateFilters,
    resetFilters,
    refresh: invalidate,
  };
}