/**
 * useEntityCrud — Generic CRUD hook for profile list entities.
 *
 * Eliminates ~600 lines of nearly-identical boilerplate in useProfileManager
 * by providing a single, config-driven hook for add / update / save / edit /
 * cancelEdit / confirmDelete / remove operations on array-type fields of
 * ProfileData (bankAccounts, familyMembers, assets, liabilities, etc.).
 *
 * Design decisions:
 *  - Uses a ref for `items` so callbacks remain stable across renders.
 *  - Validation is checked *before* exiting edit mode (fixes a pre-existing
 *    bug where validation toasts fired but the item still left edit mode).
 *  - `onCleanup` is an optional callback for side-effects on remove / save /
 *    cancelEdit (e.g. clearing currency display-value state for assets).
 *
 * Guidelines: §4.1 (module structure), §6 (hooks layer), §9.1 (strict types).
 */

import { useState, useCallback, useRef } from 'react';
import type { ProfileData } from '../types';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// Configuration
// ============================================================================

export interface EntityCrudConfig<T extends { id: string }> {
  /**
   * The key in ProfileData whose value is T[].
   * Used to read/write from the parent state.
   */
  arrayKey: keyof ProfileData & string;

  /** Factory function to create a new, blank entity. */
  createItem: () => T;

  /**
   * Inline validation run on save.
   * Return an error message string to block save (shown as toast.error),
   * or null if validation passes.
   */
  validateItem?: (item: T) => string | null;

  /**
   * Predicate: is the item "blank" / never filled in?
   * Used by cancelEdit to auto-remove items the user added then abandoned.
   */
  isItemEmpty?: (item: T) => boolean;

  /**
   * Optional cleanup callback fired on remove, save, and cancelEdit.
   * Useful for clearing external display-value state tied to the item id.
   */
  onCleanup?: (id: string) => void;
}

// ============================================================================
// Return type
// ============================================================================

export interface EntityCrudHandlers<T extends { id: string }> {
  /** Set of item ids currently in edit mode. */
  inEditMode: Set<string>;
  /** Item id pending delete confirmation, or null. */
  itemToDelete: string | null;
  /** Setter for delete confirmation state (needed by AlertDialog open binding). */
  setItemToDelete: React.Dispatch<React.SetStateAction<string | null>>;

  // Standard CRUD
  add: () => void;
  update: (id: string, updates: Partial<T>) => void;
  save: (id: string) => void;
  edit: (id: string) => void;
  cancelEdit: (id: string) => void;
  confirmDelete: (id: string) => void;
  remove: (id: string) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useEntityCrud<T extends { id: string }>(
  /** The current items array — read-only reference for validation / isEmpty checks. */
  items: T[],
  /** Parent state setter for ProfileData. */
  setProfileData: React.Dispatch<React.SetStateAction<ProfileData>>,
  /** Entity-specific configuration. */
  config: EntityCrudConfig<T>,
): EntityCrudHandlers<T> {
  const [inEditMode, setInEditMode] = useState<Set<string>>(new Set());
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Ref keeps callbacks stable while always reading latest items for validation.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const configRef = useRef(config);
  configRef.current = config;

  // ── Helpers ──────────────────────────────────────────────────────

  const removeFromEditMode = useCallback((id: string) => {
    setInEditMode(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const addToEditMode = useCallback((id: string) => {
    setInEditMode(prev => new Set([...prev, id]));
  }, []);

  // ── CRUD handlers ───────────────────────────────────────────────

  const add = useCallback(() => {
    const newItem = configRef.current.createItem();
    setProfileData(prev => ({
      ...prev,
      [configRef.current.arrayKey]: [...(prev[configRef.current.arrayKey] as T[]), newItem],
    }));
    addToEditMode(newItem.id);
  }, [setProfileData, addToEditMode]);

  const update = useCallback((id: string, updates: Partial<T>) => {
    setProfileData(prev => ({
      ...prev,
      [configRef.current.arrayKey]: (prev[configRef.current.arrayKey] as T[]).map(
        item => (item.id === id ? { ...item, ...updates } : item),
      ),
    }));
  }, [setProfileData]);

  const save = useCallback((id: string) => {
    // Validate before exiting edit mode (fixes pre-existing bug where
    // validation error toasts fired but the item still left edit mode).
    if (configRef.current.validateItem) {
      const item = itemsRef.current.find(x => x.id === id);
      if (item) {
        const error = configRef.current.validateItem(item);
        if (error) {
          toast.error(error);
          return; // Stay in edit mode
        }
      }
    }
    removeFromEditMode(id);
    configRef.current.onCleanup?.(id);
  }, [removeFromEditMode]);

  const edit = useCallback((id: string) => {
    addToEditMode(id);
  }, [addToEditMode]);

  const cancelEdit = useCallback((id: string) => {
    // Auto-remove blank items the user never filled in
    if (configRef.current.isItemEmpty) {
      const item = itemsRef.current.find(x => x.id === id);
      if (item && configRef.current.isItemEmpty(item)) {
        setProfileData(prev => ({
          ...prev,
          [configRef.current.arrayKey]: (prev[configRef.current.arrayKey] as T[]).filter(
            x => x.id !== id,
          ),
        }));
      }
    }
    removeFromEditMode(id);
    configRef.current.onCleanup?.(id);
  }, [setProfileData, removeFromEditMode]);

  const confirmDelete = useCallback((id: string) => {
    setItemToDelete(id);
  }, []);

  const remove = useCallback((id: string) => {
    setProfileData(prev => ({
      ...prev,
      [configRef.current.arrayKey]: (prev[configRef.current.arrayKey] as T[]).filter(
        x => x.id !== id,
      ),
    }));
    removeFromEditMode(id);
    setItemToDelete(null);
    configRef.current.onCleanup?.(id);
  }, [setProfileData, removeFromEditMode]);

  return {
    inEditMode,
    itemToDelete,
    setItemToDelete,
    add,
    update,
    save,
    edit,
    cancelEdit,
    confirmDelete,
    remove,
  };
}
