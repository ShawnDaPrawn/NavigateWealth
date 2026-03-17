/**
 * useAutoSave — Debounced auto-save for notes
 *
 * Tracks dirty state and debounces saves at a configurable interval.
 * Only fires for existing notes (not new ones).
 *
 * §6 — Hook layer; no business logic
 * §11.1 — Local UI state management
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { UpdateNoteInput } from '../types';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  /** The note ID (if editing an existing note) */
  noteId: string | undefined;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Callback to persist the note */
  onAutoSave: (input: UpdateNoteInput) => Promise<void>;
}

interface UseAutoSaveReturn {
  /** Current auto-save status */
  status: AutoSaveStatus;
  /** Mark the note as dirty (content changed) — triggers debounced save */
  markDirty: (input: Omit<UpdateNoteInput, 'id'>) => void;
  /** Flush any pending save immediately (e.g. before close) */
  flush: () => Promise<void>;
  /** Reset status back to idle */
  reset: () => void;
}

export function useAutoSave({
  noteId,
  isOpen,
  debounceMs = 1500,
  onAutoSave,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Omit<UpdateNoteInput, 'id'> | null>(null);
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;

  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;

  // Clear timer on unmount or close
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      setStatus('idle');
    }
  }, [isOpen]);

  // Perform the actual save
  const doSave = useCallback(async (data: Omit<UpdateNoteInput, 'id'>) => {
    const id = noteIdRef.current;
    if (!id) return;

    setStatus('saving');
    try {
      await onAutoSaveRef.current({ id, ...data });
      setStatus('saved');
      // Reset "saved" indicator after 3s
      setTimeout(() => {
        setStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 3000);
    } catch {
      setStatus('error');
    }
  }, []);

  // Mark as dirty — triggers debounced save
  const markDirty = useCallback(
    (data: Omit<UpdateNoteInput, 'id'>) => {
      if (!noteIdRef.current) return; // Skip for new notes

      pendingRef.current = data;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        const pending = pendingRef.current;
        if (pending) {
          pendingRef.current = null;
          doSave(pending);
        }
      }, debounceMs);
    },
    [debounceMs, doSave]
  );

  // Flush pending save immediately
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      await doSave(pending);
    }
  }, [doSave]);

  const reset = useCallback(() => {
    setStatus('idle');
  }, []);

  return { status, markDirty, flush, reset };
}
