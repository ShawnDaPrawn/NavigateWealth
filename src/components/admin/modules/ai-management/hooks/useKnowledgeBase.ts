/**
 * Knowledge Base — React Query Hooks (Phase 2)
 *
 * CRUD hooks for KB entries with optimistic cache invalidation.
 * Every write also invalidates the knowledge index status, because the server
 * syncs the entry into Vasco's index as part of the write.
 *
 * Guidelines: §6, §11.2
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiManagementKeys } from './queryKeys';
import { kbApi } from '../api';
import { QUERY_STALE_TIME } from '../constants';
import type { CreateKBEntryInput, KBSaveResult, UpdateKBEntryInput } from '../types';
import { toast } from 'sonner';

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

/**
 * Tell the admin what actually happened to Vasco, not just to the database.
 * A live entry that failed to index is a real problem (the entry exists but
 * Vasco cannot see it) and is reported as an error, with the entry kept.
 */
export function announceSave(result: KBSaveResult, verb: 'created' | 'updated'): void {
  const title = `"${result.entry.title}"`;
  const status = result.entry.status;

  if (status !== 'active') {
    const where = status === 'archived' ? 'archived' : 'saved as a draft';
    toast.success(`${title} ${where} — Vasco will not use it`);
    return;
  }

  if (result.index && !result.index.indexed) {
    toast.error(
      `${title} ${verb}, but could not be added to Vasco's knowledge${
        result.index.error ? `: ${result.index.error}` : ''
      }. Use "Rebuild index" on the Knowledge tab to retry.`,
    );
    return;
  }

  toast.success(`${title} is live — Vasco can use it now`);
}

export function useCreateKBEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKBEntryInput) => kbApi.create(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntries() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbStats() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.ragIndex() });
      announceSave(result, 'created');
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntries() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbStats() });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.kbEntry(result.entry.id) });
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.ragIndex() });
      announceSave(result, 'updated');
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
      queryClient.invalidateQueries({ queryKey: aiManagementKeys.ragIndex() });
      toast.success('Entry deleted');
    },
    onError: () => {
      toast.error('Failed to delete knowledge base entry');
    },
  });
}
