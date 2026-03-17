/**
 * useTranscribe — React Query mutation for audio transcription
 *
 * §6 — Hooks are the only consumers of APIs
 * §11.2 — Server state via React Query
 *
 * Converts an audio Blob to base64, sends to the transcription server route,
 * and returns the transcribed text.
 *
 * @module notes/hooks/useTranscribe
 */

import { useMutation } from '@tanstack/react-query';
import { NotesAPI } from '../api';

// ============================================================================
// TYPES
// ============================================================================

export interface TranscribeInput {
  /** Audio blob from MediaRecorder */
  audioBlob: Blob;
  /** Audio format identifier (e.g. 'webm', 'ogg') */
  format: string;
  /** Optional BCP-47 language hint */
  language?: string;
}

export interface TranscribeResult {
  /** Transcribed text */
  text: string;
  /** Audio duration in seconds (from Whisper) */
  duration?: number;
  /** Warning message (e.g. no speech detected) */
  warning?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a Blob to a base64 string (without the data URI prefix).
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Strip the "data:audio/webm;base64," prefix
        const base64 = reader.result.split(',')[1] || '';
        resolve(base64);
      } else {
        reject(new Error('Failed to read audio data'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read audio file'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// HOOK
// ============================================================================

export function useTranscribe() {
  const mutation = useMutation<TranscribeResult, Error, TranscribeInput>({
    mutationFn: async ({ audioBlob, format, language }: TranscribeInput) => {
      const base64Audio = await blobToBase64(audioBlob);

      if (!base64Audio) {
        throw new Error('Audio recording is empty. Please try recording again.');
      }

      return NotesAPI.transcribe(base64Audio, format, language);
    },
  });

  return {
    transcribe: mutation.mutate,
    transcribeAsync: mutation.mutateAsync,
    isTranscribing: mutation.isPending,
    transcriptionResult: mutation.data ?? null,
    transcriptionError: mutation.error,
    resetTranscription: mutation.reset,
  };
}
