/**
 * useRequests — React Query hook for request data management.
 *
 * Guidelines §6  — All server state managed by React Query.
 * Guidelines §11.2 — Deterministic query keys from centralized registry.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { requestApi } from '../api';
import { Request, ListRequestsFilters, CreateRequestRequest } from '../types';
import { requestKeys } from './queryKeys';

interface UseRequestsOptions extends ListRequestsFilters {
  autoFetch?: boolean;
}

export function useRequests(options: UseRequestsOptions = {}) {
  const queryClient = useQueryClient();
  const { autoFetch, ...filters } = options;

  const { data: requests = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: requestKeys.list(filters),
    queryFn: () => requestApi.getAll(filters),
    enabled: autoFetch !== false,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (request: CreateRequestRequest) => requestApi.create(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => requestApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
    },
  });

  // Backward-compatible wrappers
  const createRequest = useCallback(async (request: CreateRequestRequest) => {
    try {
      const newRequest = await createMutation.mutateAsync(request);
      return { success: true, data: newRequest };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create request';
      return { success: false, error: errorMessage };
    }
  }, [createMutation]);

  const deleteRequest = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete request';
      return { success: false, error: errorMessage };
    }
  }, [deleteMutation]);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: requestKeys.lists() });
  }, [queryClient]);

  return {
    requests,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch requests') : null,
    refetch,
    createRequest,
    deleteRequest,
  };
}

/**
 * Hook to get a single request by ID
 */
export function useRequest(id: string | null) {
  const { data: request = null, isLoading: loading, error: queryError } = useQuery({
    queryKey: requestKeys.detail(id || ''),
    queryFn: () => requestApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const queryClient = useQueryClient();
  const refetch = useCallback(async () => {
    if (id) {
      await queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) });
    }
  }, [id, queryClient]);

  return {
    request,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch request') : null,
    refetch,
  };
}
