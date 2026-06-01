import { useState, useCallback } from 'react';
import type { EsignField } from '../types';

export interface FieldHistory {
  /** Record a new field array as the latest undo step (also applies it + marks unsaved). */
  pushToHistory: (newFields: EsignField[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo stack for the PrepareFormStudio field editor. Owns the history array
 * + cursor and drives `setFields` / `setHasUnsavedChanges`. Lifted verbatim from
 * the component so its 10+ field-mutating callbacks can depend on a single
 * stable-per-history `pushToHistory` instead of the raw history state.
 *
 * Behaviour is identical to the inline version: pushToHistory / undo / redo are
 * recreated only when the history (stack or cursor) changes — the same cadence as
 * the original callbacks that listed `[history, historyIndex]` in their deps.
 */
export function useFieldHistory(
  initialFields: EsignField[],
  setFields: (fields: EsignField[]) => void,
  setHasUnsavedChanges: (value: boolean) => void,
): FieldHistory {
  const [history, setHistory] = useState<EsignField[][]>([initialFields]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushToHistory = useCallback(
    (newFields: EsignField[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newFields);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setFields(newFields);
      setHasUnsavedChanges(true);
    },
    [history, historyIndex, setFields, setHasUnsavedChanges],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFields(history[historyIndex - 1]);
      setHasUnsavedChanges(true);
    }
  }, [history, historyIndex, setFields, setHasUnsavedChanges]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFields(history[historyIndex + 1]);
      setHasUnsavedChanges(true);
    }
  }, [history, historyIndex, setFields, setHasUnsavedChanges]);

  return {
    pushToHistory,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}
