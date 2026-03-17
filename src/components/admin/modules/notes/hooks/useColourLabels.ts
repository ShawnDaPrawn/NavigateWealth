/**
 * useColourLabels — Manages custom colour descriptions
 *
 * §6 — Hook for local persistence of colour label mappings
 * §11.1 — Local UI state only (localStorage, no server state)
 *
 * Provides a personnel-scoped map of NoteColor → custom description.
 * Falls back to the default colour names from NOTE_COLOR_CONFIG.
 *
 * @module notes/hooks/useColourLabels
 */

import { useState, useCallback, useEffect } from 'react';
import type { NoteColor, CustomColourLabels } from '../types';
import { NOTE_COLOR_CONFIG, COLOUR_LABELS_STORAGE_KEY } from '../constants';

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function getStorageKey(personnelId: string): string {
  return `${COLOUR_LABELS_STORAGE_KEY}_${personnelId}`;
}

function loadLabels(personnelId: string): CustomColourLabels {
  try {
    const raw = localStorage.getItem(getStorageKey(personnelId));
    if (!raw) return {};
    return JSON.parse(raw) as CustomColourLabels;
  } catch {
    return {};
  }
}

function saveLabels(personnelId: string, labels: CustomColourLabels): void {
  try {
    localStorage.setItem(getStorageKey(personnelId), JSON.stringify(labels));
  } catch {
    // Fail silently
  }
}

// ============================================================================
// DISPLAY LABEL UTILITY (§7.1 — pure utility)
// ============================================================================

/**
 * Returns the display label for a colour.
 *
 * - If custom label exists: "Custom Label"
 * - Otherwise: default colour name (e.g. "Green")
 */
export function getColourDisplayLabel(
  color: NoteColor,
  customLabels: CustomColourLabels
): string {
  const custom = customLabels[color];
  if (custom && custom.trim()) return custom.trim();
  return NOTE_COLOR_CONFIG[color].label;
}

/**
 * Returns a tooltip-style label combining the colour name and custom description.
 *
 * - If custom label exists: "Green — New Business"
 * - Otherwise: "Green"
 */
export function getColourTooltipLabel(
  color: NoteColor,
  customLabels: CustomColourLabels
): string {
  const defaultLabel = NOTE_COLOR_CONFIG[color].label;
  const custom = customLabels[color];
  if (custom && custom.trim()) return `${defaultLabel} \u2014 ${custom.trim()}`;
  return defaultLabel;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseColourLabelsReturn {
  /** The raw custom labels map */
  customLabels: CustomColourLabels;
  /** Update a single colour's custom label (empty string to clear) */
  setLabel: (color: NoteColor, label: string) => void;
  /** Replace all labels at once (used by the dialog's save) */
  setAllLabels: (labels: CustomColourLabels) => void;
  /** Get display label for a colour (custom or default) */
  getLabel: (color: NoteColor) => string;
  /** Get tooltip label ("Green — New Business" or just "Green") */
  getTooltip: (color: NoteColor) => string;
}

export function useColourLabels(personnelId: string): UseColourLabelsReturn {
  const [customLabels, setCustomLabels] = useState<CustomColourLabels>({});

  // Load on mount / personnelId change
  useEffect(() => {
    setCustomLabels(loadLabels(personnelId));
  }, [personnelId]);

  const setLabel = useCallback((color: NoteColor, label: string) => {
    setCustomLabels((prev) => {
      const next = { ...prev };
      if (label.trim()) {
        next[color] = label.trim();
      } else {
        delete next[color];
      }
      saveLabels(personnelId, next);
      return next;
    });
  }, [personnelId]);

  const setAllLabels = useCallback((labels: CustomColourLabels) => {
    // Clean out empty entries
    const cleaned: CustomColourLabels = {};
    for (const [k, v] of Object.entries(labels)) {
      if (v && v.trim()) {
        cleaned[k as NoteColor] = v.trim();
      }
    }
    setCustomLabels(cleaned);
    saveLabels(personnelId, cleaned);
  }, [personnelId]);

  const getLabel = useCallback((color: NoteColor) => {
    return getColourDisplayLabel(color, customLabels);
  }, [customLabels]);

  const getTooltip = useCallback((color: NoteColor) => {
    return getColourTooltipLabel(color, customLabels);
  }, [customLabels]);

  return {
    customLabels,
    setLabel,
    setAllLabels,
    getLabel,
    getTooltip,
  };
}
