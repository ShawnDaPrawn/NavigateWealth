/**
 * useKeyboardShortcuts
 * ---------------------------------------------------------------------------
 * Registers the single global `keydown` listener for PrepareFormStudio.
 * Having all keyboard shortcuts in one place means they're easy to document
 * (the help dialog lists them all) and never clash with each other.
 *
 * Extracted from PrepareFormStudio.tsx (Phase 6b god-file split).
 */

import { useEffect } from 'react';
import type { EsignField, SignerFormData } from '../types';
import { isEditableTarget } from './prepareFormStudioUtils';

export function useKeyboardShortcuts(params: {
  selectedFieldIds: Set<string>;
  primarySelectedId: string | null | undefined;
  fields: EsignField[];
  visibleSignerIds: Set<string> | null | undefined;
  handleCopy: () => void;
  handlePaste: () => void;
  handleDuplicate: () => void;
  handleBulkDelete: () => void;
  persistFields: (opts?: { silent?: boolean }) => Promise<boolean | undefined>;
  eligibleSigners: SignerFormData[];
  clearSelection: () => void;
  selectMany: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedSignerId: React.Dispatch<React.SetStateAction<string | undefined>>;
}): void {
  const {
    selectedFieldIds,
    primarySelectedId,
    fields,
    visibleSignerIds,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleBulkDelete,
    persistFields,
    eligibleSigners,
    clearSelection,
    selectMany,
    undo,
    redo,
    setShowShortcuts,
    setSelectedSignerId,
  } = params;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;

      // Help — '?' (shift+/)
      if (e.key === '?' && !meta) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      // Escape — clear selection / close popovers handled by Radix
      if (e.key === 'Escape') {
        if (selectedFieldIds.size > 0 || primarySelectedId) {
          clearSelection();
        }
        return;
      }
      // Save — cmd/ctrl + S
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persistFields();
        return;
      }
      // Undo / Redo — handled by global meta+z / shift+meta+z
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Copy / Paste / Duplicate
      if (meta && e.key.toLowerCase() === 'c') {
        if (selectedFieldIds.size === 0) return;
        e.preventDefault();
        handleCopy();
        return;
      }
      if (meta && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        if (selectedFieldIds.size === 0) return;
        e.preventDefault();
        handleDuplicate();
        return;
      }
      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldIds.size > 0) {
        e.preventDefault();
        handleBulkDelete();
        return;
      }
      // Select-all — cmd/ctrl + a
      if (meta && e.key.toLowerCase() === 'a' && fields.length > 0) {
        e.preventDefault();
        const visibleIds = fields
          .filter((f) => !visibleSignerIds || (f.signer_id && visibleSignerIds.has(f.signer_id)))
          .map((f) => f.id);
        selectMany(visibleIds);
        return;
      }
      // P2.5 2.11 — number keys 1..9 jump to the Nth signer in the
      // "Placing fields for" picker. Cuts the round-trip through the
      // dropdown out of the field-placement loop entirely.
      if (!meta && /^[1-9]$/.test(e.key) && eligibleSigners.length > 0) {
        const idx = Number(e.key) - 1;
        const target = eligibleSigners[idx];
        if (target) {
          e.preventDefault();
          setSelectedSignerId(target.email);
        }
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedFieldIds,
    primarySelectedId,
    fields,
    visibleSignerIds,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleBulkDelete,
    persistFields,
    eligibleSigners,
    clearSelection,
    selectMany,
    undo,
    redo,
    setShowShortcuts,
    setSelectedSignerId,
  ]);
}
