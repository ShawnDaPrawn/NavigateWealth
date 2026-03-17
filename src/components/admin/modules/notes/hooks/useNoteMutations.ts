/**
 * Notes Module — Mutation Hooks
 * Navigate Wealth Admin Dashboard
 *
 * §6 — Mutations invalidate relevant queries and provide user feedback
 *
 * @module notes/hooks/useNoteMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { noteKeys } from './queryKeys';
import { tasksKeys } from '../../../../../utils/queryKeys';
import { NotesAPI } from '../api';
import type { CreateNoteInput, UpdateNoteInput } from '../types';

/**
 * Create a new note
 */
export function useCreateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateNoteInput) => NotesAPI.createNote(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: noteKeys.list(variables.personnelId) });
      if (variables.clientId) {
        qc.invalidateQueries({ queryKey: noteKeys.clientNotes(variables.clientId) });
      }
      toast.success('Note created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create note', { description: error.message });
    },
  });
}

/**
 * Update a note
 */
export function useUpdateNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateNoteInput) => NotesAPI.updateNote(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: noteKeys.list(data.personnelId) });
      qc.invalidateQueries({ queryKey: noteKeys.detail(data.id) });
      // Invalidate both old and new client caches
      if (data.clientId) {
        qc.invalidateQueries({ queryKey: noteKeys.clientNotes(data.clientId) });
      }
      // Broad invalidation for client notes that may have been unlinked
      qc.invalidateQueries({ queryKey: noteKeys.all });
    },
    onError: (error: Error) => {
      toast.error('Failed to update note', { description: error.message });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => NotesAPI.deleteNote(noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      toast.success('Note deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete note', { description: error.message });
    },
  });
}

/**
 * Convert a note to a to-do task
 */
export function useConvertNoteToTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => NotesAPI.convertToTask(noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: noteKeys.all });
      qc.invalidateQueries({ queryKey: tasksKeys.all });
      toast.success('Note converted to task', {
        description: 'You can find it in your To-Do board.',
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to convert note', { description: error.message });
    },
  });
}
