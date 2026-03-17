/**
 * Notes Module — Summarise Hook
 * Navigate Wealth Admin Dashboard
 *
 * §6 — Mutation hook for AI-powered note summarisation
 *
 * @module notes/hooks/useSummariseNote
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { noteKeys } from './queryKeys';
import { NotesAPI } from '../api';

/**
 * Summarise a note's content using AI.
 * Persists the summary to the note and invalidates relevant caches.
 */
export function useSummariseNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => NotesAPI.summariseNote(noteId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      toast.success('Note summarised', {
        description: 'AI summary has been generated and saved.',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to summarise note', { description: error.message });
    },
  });
}
