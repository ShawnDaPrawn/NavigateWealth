/**
 * Notes Module — API Layer
 * Navigate Wealth Admin Dashboard
 *
 * §5.1 — Data boundary; only layer that touches the server
 * §3.2 — Three-tier: Frontend → Server → KV
 *
 * @module notes/api
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import type { Note, CreateNoteInput, UpdateNoteInput } from './types';
import { ENDPOINTS } from './constants';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class NotesApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'NotesApiError';
  }
}

function handleError(error: unknown, context: string): never {
  logger.error(`Error in ${context}`, error);
  if (error instanceof NotesApiError) throw error;
  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  throw new NotesApiError(message, undefined, error);
}

// ============================================================================
// NOTES API
// ============================================================================

export const NotesAPI = {
  /** Fetch all notes for a personnel member */
  async getNotes(personnelId: string): Promise<Note[]> {
    logger.debug('[NotesAPI] Fetching notes for personnel', { personnelId });
    try {
      const data = await api.get<{ notes: Note[] }>(
        `${ENDPOINTS.NOTES}?personnelId=${encodeURIComponent(personnelId)}`
      );
      return data?.notes || [];
    } catch (error) {
      handleError(error, 'getNotes');
    }
  },

  /** Fetch notes linked to a specific client */
  async getClientNotes(clientId: string): Promise<Note[]> {
    logger.debug('[NotesAPI] Fetching notes for client', { clientId });
    try {
      const data = await api.get<{ notes: Note[] }>(ENDPOINTS.CLIENT_NOTES(clientId));
      return data?.notes || [];
    } catch (error) {
      handleError(error, `getClientNotes(${clientId})`);
    }
  },

  /** Get a single note by ID */
  async getNote(id: string): Promise<Note> {
    logger.debug(`[NotesAPI] Fetching note ${id}`);
    try {
      const data = await api.get<{ note: Note }>(ENDPOINTS.NOTE(id));
      if (!data?.note) throw new NotesApiError(`Note ${id} not found`, 'NOT_FOUND');
      return data.note;
    } catch (error) {
      handleError(error, `getNote(${id})`);
    }
  },

  /** Create a new note */
  async createNote(input: CreateNoteInput): Promise<Note> {
    logger.debug('[NotesAPI] Creating note', { title: input.title });
    try {
      const data = await api.post<{ note: Note }>(ENDPOINTS.NOTES, input);
      return data.note;
    } catch (error) {
      handleError(error, 'createNote');
    }
  },

  /** Update an existing note */
  async updateNote(input: UpdateNoteInput): Promise<Note> {
    logger.debug(`[NotesAPI] Updating note ${input.id}`);
    try {
      const { id, ...updates } = input;
      const data = await api.put<{ note: Note }>(ENDPOINTS.NOTE(id), updates);
      return data.note;
    } catch (error) {
      handleError(error, `updateNote(${input.id})`);
    }
  },

  /** Delete a note permanently */
  async deleteNote(id: string): Promise<void> {
    logger.debug(`[NotesAPI] Deleting note ${id}`);
    try {
      await api.delete(ENDPOINTS.NOTE(id));
    } catch (error) {
      handleError(error, `deleteNote(${id})`);
    }
  },

  /** Convert a note into a to-do task */
  async convertToTask(id: string): Promise<{ taskId: string; note: Note }> {
    logger.debug(`[NotesAPI] Converting note ${id} to task`);
    try {
      const data = await api.post<{ taskId: string; note: Note }>(
        ENDPOINTS.CONVERT_TO_TASK(id),
        {}
      );
      return data;
    } catch (error) {
      handleError(error, `convertToTask(${id})`);
    }
  },

  /** Transcribe audio to text via OpenAI Whisper */
  async transcribe(audio: string, format: string, language?: string): Promise<{ text: string; duration?: number; warning?: string }> {
    logger.debug('[NotesAPI] Sending audio for transcription', { format, audioLength: audio.length });
    try {
      const data = await api.post<{ success: boolean; text: string; duration?: number; warning?: string; error?: string }>(
        ENDPOINTS.TRANSCRIBE,
        { audio, format, language }
      );
      if (!data.success) {
        throw new NotesApiError(data.error || 'Transcription failed', 'TRANSCRIPTION_ERROR');
      }
      return { text: data.text, duration: data.duration, warning: data.warning };
    } catch (error) {
      handleError(error, 'transcribe');
    }
  },

  /** Summarise and organise a note's content via AI */
  async summariseNote(id: string): Promise<{ summary: string; note: Note }> {
    logger.debug(`[NotesAPI] Summarising note ${id}`);
    try {
      const data = await api.post<{ success: boolean; summary: string; note: Note; error?: string }>(
        ENDPOINTS.SUMMARISE(id),
        {}
      );
      if (!data.success) {
        throw new NotesApiError(data.error || 'Summarisation failed', 'SUMMARISE_ERROR');
      }
      return { summary: data.summary, note: data.note };
    } catch (error) {
      handleError(error, `summariseNote(${id})`);
    }
  },
};