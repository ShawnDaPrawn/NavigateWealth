import { useState, useCallback, useRef } from 'react';

// ============================================================================
// useUndoRedo — Generic undo/redo history hook
//
// Supports two modes of state updates:
//  1. `set(newState)` — Creates a new history entry (structural changes)
//  2. `setWithMerge(newState)` — Debounced: first call creates entry,
//     rapid subsequent calls merge into the same entry (property edits)
//
// Both `set` and `setWithMerge` accept either a direct value or an updater
// function `(prev: T) => T`, matching React's useState API.
//
// Max history defaults to 50 entries to bound memory usage.
// ============================================================================

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

/** Accepts a value or an updater function, same as React's setState */
type SetStateAction<T> = T | ((prev: T) => T);

function resolveAction<T>(action: SetStateAction<T>, prev: T): T {
  return typeof action === 'function' ? (action as (prev: T) => T)(prev) : action;
}

interface UseUndoRedoReturn<T> {
  /** Current state value */
  state: T;
  /** Set new state, always creating a history entry. Accepts value or updater fn */
  set: (action: SetStateAction<T>) => void;
  /** Set new state with merge window — rapid calls merge into one entry */
  setWithMerge: (action: SetStateAction<T>, mergeWindowMs?: number) => void;
  /** Undo to previous state */
  undo: () => void;
  /** Redo to next state */
  redo: () => void;
  /** Reset history entirely with a new initial state */
  reset: (newPresent: T) => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of undo steps available */
  historySize: number;
  /** Number of redo steps available */
  futureSize: number;
}

export function useUndoRedo<T>(
  initialState: T,
  maxHistory: number = 50
): UseUndoRedoReturn<T> {
  const [history, setHistory] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Merge window tracking for debounced property edits
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- set: always creates a new history entry --
  const set = useCallback(
    (action: SetStateAction<T>) => {
      // Clear any active merge window since this is a discrete action
      if (mergeTimerRef.current) {
        clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = null;
      }

      setHistory((prev) => {
        const newPresent = resolveAction(action, prev.present);
        return {
          past: [...prev.past, prev.present].slice(-maxHistory),
          present: newPresent,
          future: [], // New action clears redo stack
        };
      });
    },
    [maxHistory]
  );

  // -- setWithMerge: debounced updates for rapid edits (e.g. typing) --
  // First call opens a merge window and creates a history entry.
  // Subsequent calls within the window update present without new entries.
  // After the window expires, the next call creates a new entry.
  const setWithMerge = useCallback(
    (action: SetStateAction<T>, mergeWindowMs: number = 500) => {
      if (mergeTimerRef.current) {
        // Within active merge window — update present only, extend window
        clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = setTimeout(() => {
          mergeTimerRef.current = null;
        }, mergeWindowMs);

        setHistory((prev) => ({
          ...prev,
          present: resolveAction(action, prev.present),
        }));
      } else {
        // No active merge window — create new history entry, start window
        mergeTimerRef.current = setTimeout(() => {
          mergeTimerRef.current = null;
        }, mergeWindowMs);

        setHistory((prev) => {
          const newPresent = resolveAction(action, prev.present);
          return {
            past: [...prev.past, prev.present].slice(-maxHistory),
            present: newPresent,
            future: [], // New action clears redo stack
          };
        });
      }
    },
    [maxHistory]
  );

  // -- undo --
  const undo = useCallback(() => {
    // Clear merge window on undo
    if (mergeTimerRef.current) {
      clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
    }

    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop()!;
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  // -- redo --
  const redo = useCallback(() => {
    // Clear merge window on redo
    if (mergeTimerRef.current) {
      clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
    }

    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift()!;
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // -- reset: clear all history, start fresh --
  const reset = useCallback((newPresent: T) => {
    if (mergeTimerRef.current) {
      clearTimeout(mergeTimerRef.current);
      mergeTimerRef.current = null;
    }

    setHistory({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    set,
    setWithMerge,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historySize: history.past.length,
    futureSize: history.future.length,
  };
}
