/**
 * Knowledge Base — React Query Hooks (Phase 2)
 *
 * CRUD hooks for KB entries with optimistic cache invalidation.
 * Guidelines: §6, §11.2
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiManagementKeys } from './queryKeys';
import { kbApi } from '../api';
import { QUERY_STALE_TIME } from '../constants';
import type { CreateKBEntryInput, UpdateKBEntryInput } from '../types';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// READ — Entries List & Stats
// ============================================================================

export function useKBEntries() {
  return useQuery({
    queryKey: aiManagementKeys.kbEntries(),
    queryFn: () => kbApi.getAll(),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useKBStats() {
  return useQuery({
    queryKey: aiManagementKeys.kbStats(),
    queryFn: () => kbApi.getStats(),
    staleTime: QUERY_STALE_TIME,
  });
}

export function useKBEntry(id: string) {
  return useQuery({
    queryKey: aiManagementKeys.kbEntry(id),
    queryFn: () => kbApi.getEntry(id),
    staleTime: QUERY_STALE_TIME,
    enabled: !!id,
  });
}

// ============================================================================
// WRITE — Create, Update, Delete
// ============================================================================

export function useCreateKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKBEntryInput) => kbApi.create(input),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntries() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbStats() });
      toast.success(`"${entry.title}" created successfully`);
    },
    onError: () => {
      toast.error('Failed to create knowledge base entry');
    },
  });
}

export function useUpdateKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateKBEntryInput }) =>
      kbApi.update(id, input),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntries() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbStats() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntry(entry.id) });
      toast.success(`"${entry.title}" updated successfully`);
    },
    onError: () => {
      toast.error('Failed to update knowledge base entry');
    },
  });
}

export function useDeleteKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => kbApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntries() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbStats() });
      toast.success('Entry deleted');
    },
    onError: () => {
      toast.error('Failed to delete knowledge base entry');
    },
  });
}
