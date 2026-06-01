import { useState, useCallback } from 'react';

export interface FieldSelection {
  /** Currently-selected field ids. */
  selectedFieldIds: Set<string>;
  /** The "primary" selection — the field the Properties panel edits. It is
   *  whichever id was touched LAST, even by a deselecting toggle. */
  primarySelectedId: string | undefined;
  /** Signer-filter: when non-null, only these signers' fields are shown.
   *  null means "show everyone". */
  visibleSignerIds: Set<string> | null;

  /** Replace the selection with a single field (it becomes primary). */
  selectOnly: (id: string) => void;
  /** Add or remove a field from the selection; it always becomes primary
   *  (even when the toggle removes it). */
  toggleInSelection: (id: string) => void;
  /** Remove a field from the selection; clears primary iff it was that field. */
  removeFromSelection: (id: string) => void;
  /** Select many fields. `additive` unions with the current selection,
   *  otherwise replaces it; the last id becomes primary. */
  selectMany: (ids: string[], opts?: { additive?: boolean }) => void;
  /** Clear the entire field selection. */
  clearSelection: () => void;

  /** Cycle the signer-filter for one signer: off → only-this → drop-this →
   *  (none → off). Mirrors the legend-swatch click. */
  toggleSignerFilter: (email: string) => void;
  /** Drop the signer-filter entirely (show all signers' fields). */
  clearSignerFilter: () => void;
}

/**
 * Multi-selection state machine for the PrepareFormStudio field editor. Owns
 * `selectedFieldIds` + `primarySelectedId` (the field-overlay selection) and
 * the `visibleSignerIds` legend filter, exposing the discrete operations the
 * click / marquee / keyboard / bulk-action handlers drive. Every operation
 * uses functional setState so the returned callbacks are stable — handlers can
 * depend on them without re-subscribing.
 *
 * Behaviour is lifted verbatim from the component's former inline setState
 * calls, including the quirk that `toggleInSelection` sets primary to the
 * toggled id even when the toggle DESELECTS it.
 */
export function useFieldSelection(): FieldSelection {
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [primarySelectedId, setPrimarySelectedId] = useState<string | undefined>(undefined);
  const [visibleSignerIds, setVisibleSignerIds] = useState<Set<string> | null>(null);

  const selectOnly = useCallback((id: string) => {
    setSelectedFieldIds(new Set([id]));
    setPrimarySelectedId(id);
  }, []);

  const toggleInSelection = useCallback((id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPrimarySelectedId(id);
  }, []);

  const removeFromSelection = useCallback((id: string) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPrimarySelectedId((prev) => (prev === id ? undefined : prev));
  }, []);

  const selectMany = useCallback((ids: string[], opts?: { additive?: boolean }) => {
    setSelectedFieldIds((prev) => (opts?.additive ? new Set([...prev, ...ids]) : new Set(ids)));
    setPrimarySelectedId(ids[ids.length - 1]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFieldIds(new Set());
    setPrimarySelectedId(undefined);
  }, []);

  const toggleSignerFilter = useCallback((email: string) => {
    setVisibleSignerIds((prev) => {
      if (!prev) return new Set([email]);
      if (prev.has(email) && prev.size === 1) return null;
      if (prev.has(email)) {
        const next = new Set(prev);
        next.delete(email);
        return next.size === 0 ? null : next;
      }
      const next = new Set(prev);
      next.add(email);
      return next;
    });
  }, []);

  const clearSignerFilter = useCallback(() => {
    setVisibleSignerIds(null);
  }, []);

  return {
    selectedFieldIds,
    primarySelectedId,
    visibleSignerIds,
    selectOnly,
    toggleInSelection,
    removeFromSelection,
    selectMany,
    clearSelection,
    toggleSignerFilter,
    clearSignerFilter,
  };
}
