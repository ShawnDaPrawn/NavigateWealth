import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// useAutosave — Debounced autosave with dirty-state tracking
//
// Compares current state to the last-saved snapshot. When a change is detected,
// a debounce timer starts. After the debounce period elapses with no further
// changes, the save function is invoked.
//
// Features:
//  - Serialised snapshot comparison (deep equality via JSON)
//  - Configurable debounce interval (default 3 seconds)
//  - Status tracking: 'saved' | 'saving' | 'unsaved' | 'error'
//  - `lastSavedAt` timestamp
//  - `beforeunload` warning when dirty
//  - Manual save that resets the debounce timer
//  - Retry on transient save failures (single retry after 5s)
// ============================================================================

export type AutosaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface UseAutosaveOptions<T> {
  /** Current state to track */
  data: T;
  /** Async save function — should throw on failure */
  onSave: (data: T) => Promise<void>;
  /** Debounce interval in ms (default: 3000) */
  debounceMs?: number;
  /** Whether autosave is enabled (default: true) */
  enabled?: boolean;
  /** Whether the form is a new (unsaved) resource — skips autosave until first manual save */
  isNew?: boolean;
}

interface UseAutosaveReturn {
  /** Current save status */
  status: AutosaveStatus;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  /** Trigger an immediate manual save */
  saveNow: () => Promise<void>;
  /** Mark the current state as the saved baseline (e.g. after initial load) */
  markSaved: () => void;
}

export function useAutosave<T>({
  data,
  onSave,
  debounceMs = 3000,
  enabled = true,
  isNew = false,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs to avoid stale closures
  const savedSnapshotRef = useRef<string>(serialize(data));
  const currentDataRef = useRef<T>(data);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  const isNewRef = useRef(isNew);

  // Keep refs in sync
  onSaveRef.current = onSave;
  enabledRef.current = enabled;
  isNewRef.current = isNew;
  currentDataRef.current = data;

  // -- Serialise for comparison --
  const currentSnapshot = serialize(data);
  const isDirty = currentSnapshot !== savedSnapshotRef.current;

  // -- Core save logic --
  const performSave = useCallback(async () => {
    if (isSavingRef.current) return;

    const dataToSave = currentDataRef.current;
    const snapshotToSave = serialize(dataToSave);

    // Bail if nothing changed
    if (snapshotToSave === savedSnapshotRef.current) {
      setStatus('saved');
      return;
    }

    isSavingRef.current = true;
    setStatus('saving');

    try {
      await onSaveRef.current(dataToSave);

      // Only update snapshot if data hasn't changed during save
      const postSaveSnapshot = serialize(currentDataRef.current);
      if (postSaveSnapshot === snapshotToSave) {
        // No changes during save — mark as saved
        savedSnapshotRef.current = snapshotToSave;
        setStatus('saved');
      } else {
        // Data changed during save — still dirty, re-queue
        savedSnapshotRef.current = snapshotToSave;
        setStatus('unsaved');
      }
      setLastSavedAt(new Date());
    } catch (error) {
      console.error('[useAutosave] Save failed:', error);
      setStatus('error');

      // Single retry after 5 seconds
      setTimeout(() => {
        if (enabledRef.current && !isNewRef.current) {
          performSave();
        }
      }, 5000);
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // -- Debounced autosave on data change --
  useEffect(() => {
    if (!enabled || isNew) return;

    if (isDirty) {
      setStatus('unsaved');

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Start new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        performSave();
      }, debounceMs);
    } else {
      setStatus((prev) => (prev === 'saving' ? prev : 'saved'));
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentSnapshot, enabled, isNew, isDirty, debounceMs, performSave]);

  // -- Manual save (cancels debounce, saves immediately) --
  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await performSave();
  }, [performSave]);

  // -- Mark current state as saved baseline --
  const markSaved = useCallback(() => {
    savedSnapshotRef.current = serialize(currentDataRef.current);
    setStatus('saved');
    setLastSavedAt(new Date());
  }, []);

  // -- Beforeunload warning --
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a prompt
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // -- Cleanup on unmount --
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    status,
    isDirty,
    lastSavedAt,
    saveNow,
    markSaved,
  };
}

// ============================================================================
// Utility — stable JSON serialisation for snapshot comparison
// ============================================================================
function serialize<T>(data: T): string {
  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}
