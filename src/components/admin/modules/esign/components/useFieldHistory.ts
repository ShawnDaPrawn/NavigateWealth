import { useState, useCallback } from 'react';
import type { EsignField } from '../types';

export interface FieldHistory {
  /** Record a new field array as the latest undo step (also applies it + marks unsaved). */
  pushToHistory: (newFields: EsignField[]) => void;
  /** Record the live fields (after a drag, resize or edit) as one undo step. */
  checkpoint: () => void;
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
  /**
   * The live field array. Moves, resizes and property edits update fields
   * WITHOUT a history entry (one per mouse-move would be useless); pass the
   * live array so `checkpoint` can record the finished gesture and `undo`
   * can roll back an edit that was never checkpointed. Without it, undo
   * skipped straight past every move and resize.
   */
  currentFields?: EsignField[],
): FieldHistory {
  const [history, setHistory] = useState<EsignField[][]>([initialFields]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const hasUncommitted = currentFields !== undefined && currentFields !== history[historyIndex];

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

  /** Record the live fields as one undo step, if they changed since the last. */
  const checkpoint = useCallback(() => {
    if (currentFields === undefined || currentFields === history[historyIndex]) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentFields);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [currentFields, history, historyIndex]);

  const undo = useCallback(() => {
    if (hasUncommitted) {
      // Roll back the edit in progress; keep it as the redo step.
      setHistory([...history.slice(0, historyIndex + 1), currentFields!]);
      setFields(history[historyIndex]);
      setHasUnsavedChanges(true);
      return;
    }
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFields(history[historyIndex - 1]);
      setHasUnsavedChanges(true);
    }
  }, [hasUncommitted, currentFields, history, historyIndex, setFields, setHasUnsavedChanges]);

  const redo = useCallback(() => {
    if (hasUncommitted) return;
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFields(history[historyIndex + 1]);
      setHasUnsavedChanges(true);
    }
  }, [hasUncommitted, history, historyIndex, setFields, setHasUnsavedChanges]);

  return {
    pushToHistory,
    checkpoint,
    undo,
    redo,
    canUndo: historyIndex > 0 || hasUncommitted,
    canRedo: !hasUncommitted && historyIndex < history.length - 1,
  };
}
