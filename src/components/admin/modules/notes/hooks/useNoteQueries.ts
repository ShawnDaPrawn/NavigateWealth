/**
 * Notes Module — Query Hooks
 * Navigate Wealth Admin Dashboard
 *
 * §6 — Hooks are the only consumers of APIs
 * §11.2 — React Query for all server state
 *
 * @module notes/hooks/useNoteQueries
 */

import { useQuery } from '@tanstack/react-query';
import { noteKeys } from './queryKeys';
import { NotesAPI } from '../api';
import { NOTES_STALE_TIME } from '../constants';

/**
 * Fetch all notes for a personnel member
 */
export function useNotes(personnelId: string | undefined) {
  return useQuery({
    queryKey: noteKeys.list(personnelId || ''),
    queryFn: () => NotesAPI.getNotes(personnelId!),
    enabled: !!personnelId,
    staleTime: NOTES_STALE_TIME,
  });
}

/**
 * Fetch notes linked to a specific client
 */
export function useClientNotes(clientId: string | undefined) {
  return useQuery({
    queryKey: noteKeys.clientNotes(clientId || ''),
    queryFn: () => NotesAPI.getClientNotes(clientId!),
    enabled: !!clientId,
    staleTime: NOTES_STALE_TIME,
  });
}

/**
 * Fetch a single note by ID
 */
export function useNote(noteId: string | undefined) {
  return useQuery({
    queryKey: noteKeys.detail(noteId || ''),
    queryFn: () => NotesAPI.getNote(noteId!),
    enabled: !!noteId,
    staleTime: NOTES_STALE_TIME,
  });
}
