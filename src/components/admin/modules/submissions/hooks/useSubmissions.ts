/**
 * Submissions Manager — React Query Hooks
 *
 * §6  — All server state managed by React Query.
 * §11.2 — Deterministic query keys from centralised registry.
 * §3.1 — Hooks are the only consumers of the API layer.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { submissionsApi } from '../api';
import type { Submission, SubmissionsFilters, UpdateSubmissionInput } from '../types';
import { submissionsKeys } from './queryKeys';
import { pendingCountsKeys } from '../../../../../utils/queryKeys';

// ── useSubmissions ─────────────────────────────────────────────────────────────

export function useSubmissions(filters?: SubmissionsFilters) {
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading, error } = useQuery({
    queryKey: submissionsKeys.list(filters as Record<string, unknown>),
    queryFn: () => submissionsApi.list(filters),
    staleTime: 2 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSubmissionInput }) =>
      submissionsApi.update(id, input),
    onMutate: async ({ id, input }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: submissionsKeys.lists() });

      // Snapshot the current cache for rollback
      const queryKey = submissionsKeys.list(filters as Record<string, unknown>);
      const previousSubmissions = queryClient.getQueryData<Submission[]>(queryKey);

      // Optimistically update the cached list
      if (previousSubmissions) {
        queryClient.setQueryData<Submission[]>(queryKey, (old) =>
          (old ?? []).map((s) =>
            s.id === id
              ? { ...s, ...input, updatedAt: new Date().toISOString() }
              : s
          )
        );
      }

      return { previousSubmissions, queryKey };
    },
    onError: (_err, _vars, context) => {
      // Roll back to the snapshot on failure
      if (context?.previousSubmissions) {
        queryClient.setQueryData(context.queryKey, context.previousSubmissions);
      }
    },
    onSettled: () => {
      // Always refetch after mutation settles to ensure server truth
      queryClient.invalidateQueries({ queryKey: submissionsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: submissionsKeys.countNew() });
      // Refresh nav badge
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => submissionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: submissionsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: submissionsKeys.countNew() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
    },
  });

  const updateSubmission = useCallback(
    async (id: string, input: UpdateSubmissionInput) => {
      try {
        const updated = await updateMutation.mutateAsync({ id, input });
        return { success: true, data: updated };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
      }
    },
    [updateMutation]
  );

  const deleteSubmission = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
      }
    },
    [deleteMutation]
  );

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: submissionsKeys.lists() });
  }, [queryClient]);

  return {
    submissions,
    isLoading,
    error: error instanceof Error ? error.message : null,
    updateSubmission,
    deleteSubmission,
    refetch,
    isUpdating: updateMutation.isPending,
  };
}

// ── useSubmissionNewCount ──────────────────────────────────────────────────────

export function useSubmissionNewCount() {
  return useQuery({
    queryKey: submissionsKeys.countNew(),
    queryFn: () => submissionsApi.countNew(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}