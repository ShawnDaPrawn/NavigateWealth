import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import { toast } from 'sonner';
import type { EsignField } from '../types';

export interface AutoSave {
  /** True while a non-silent save is in flight (drives the Save button spinner). */
  autoSaving: boolean;
  /** Timestamp of the last successful persist (drives the "Saved HH:MM" label). */
  lastSavedAt: Date | null;
  /**
   * Persist the *current* fields snapshot. Reads from the ref (not a closure)
   * so auto-save and unmount-flush always see the freshest edits. Returns true
   * on a successful save, false if there was no handler, nothing changed since
   * the last save, or the save failed.
   */
  persistFields: (opts?: { silent?: boolean }) => Promise<boolean>;
  /** Always holds the freshest fields — read by send/back paths that race edits. */
  fieldsRef: MutableRefObject<EsignField[]>;
}

/**
 * Debounced auto-save for the PrepareFormStudio field editor — the single most
 * important defence against the "I clicked Save and lost my work" class of bugs.
 * Owns `autoSaving` / `lastSavedAt` and the canonical `lastSavedFieldsRef` (the
 * last-persisted snapshot, used to short-circuit redundant saves and detect
 * drift), and wires up three effects: the 1.5s debounce, the beforeunload
 * warning, and the unmount-flush. Lifted verbatim from the component so its
 * ref/effect machinery lives in one testable place.
 */
export function useAutoSave(params: {
  fields: EsignField[];
  initialFields: EsignField[];
  onSaveFields?: (fields: EsignField[]) => Promise<void>;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  saving: boolean;
  sending: boolean;
}): AutoSave {
  const {
    fields,
    initialFields,
    onSaveFields,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    saving,
    sending,
  } = params;

  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // `lastSavedFieldsRef` is the canonical record of the most recently persisted
  // state so we can short-circuit redundant saves and detect drift on
  // unmount/back navigation.
  const lastSavedFieldsRef = useRef<string>(JSON.stringify(initialFields));
  const fieldsRef = useRef<EsignField[]>(initialFields);
  fieldsRef.current = fields;
  const onSaveFieldsRef = useRef(onSaveFields);
  onSaveFieldsRef.current = onSaveFields;

  const persistFields = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      const handler = onSaveFieldsRef.current;
      if (!handler) return false;
      const snapshot = fieldsRef.current;
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSavedFieldsRef.current) return false;
      try {
        if (!opts?.silent) setAutoSaving(true);
        await handler(snapshot);
        lastSavedFieldsRef.current = serialized;
        setLastSavedAt(new Date());
        setHasUnsavedChanges(false);
        return true;
      } catch (err) {
        if (!opts?.silent) {
          toast.error('Auto-save failed — please click Save to retry.');
        }
        return false;
      } finally {
        if (!opts?.silent) setAutoSaving(false);
      }
    },
    [setHasUnsavedChanges],
  );

  // Debounced auto-save (1.5s after the last change). A user who places fields
  // and walks away for two seconds is already safely persisted.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (saving || sending || autoSaving) return;
    const timer = setTimeout(() => {
      persistFields({ silent: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [fields, hasUnsavedChanges, saving, sending, autoSaving, persistFields]);

  // beforeunload: warn the user if they try to close the tab / navigate away
  // with unsaved changes still in memory. We can't make `await persistFields`
  // run reliably here (browsers cancel async work in unload), so we surface a
  // confirmation prompt instead.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore the message and show their own copy, but the
        // returnValue assignment is still required to trigger the prompt.
        e.returnValue = 'You have unsaved field changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Unmount-flush: when the view is torn down (top-nav click, route change,
  // parent state transition), make a best-effort silent save so nothing is
  // lost. The empty-deps array intentionally captures persistFields via ref.
  const persistFieldsRef = useRef(persistFields);
  persistFieldsRef.current = persistFields;
  useEffect(() => {
    return () => {
      const serialized = JSON.stringify(fieldsRef.current);
      if (serialized !== lastSavedFieldsRef.current) {
        // fire-and-forget — the parent React Query cache will refresh on
        // next dashboard visit.
        void persistFieldsRef.current({ silent: true });
      }
    };
  }, []);

  return { autoSaving, lastSavedAt, persistFields, fieldsRef };
}
