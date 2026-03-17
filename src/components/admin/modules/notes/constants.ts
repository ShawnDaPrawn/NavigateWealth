/**
 * Notes Module — Constants & Configuration
 * Navigate Wealth Admin Dashboard
 *
 * §5.3 — All non-trivial constants centralised and typed
 *
 * @module notes/constants
 */

import type { NoteColor, NoteSortBy } from './types';

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const ENDPOINTS = {
  NOTES: '/notes',
  NOTE: (id: string) => `/notes/${id}`,
  CLIENT_NOTES: (clientId: string) => `/notes/client/${clientId}`,
  CONVERT_TO_TASK: (id: string) => `/notes/${id}/convert-to-task`,
  SUMMARISE: (id: string) => `/notes/${id}/summarise`,
  TRANSCRIBE: '/transcription/transcribe',
} as const;

// ============================================================================
// COLOUR MAPPINGS
// ============================================================================

export interface NoteColorConfig {
  label: string;
  /** Card background */
  bg: string;
  /** Card border */
  border: string;
  /** Sidebar accent bar */
  accent: string;
  /** Header area bg */
  headerBg: string;
  /** Dot indicator class */
  dot: string;
}

export const NOTE_COLOR_CONFIG: Record<NoteColor, NoteColorConfig> = {
  default: {
    label: 'White',
    bg: 'bg-white',
    border: 'border-gray-200',
    accent: 'bg-gray-300',
    headerBg: 'bg-gray-50',
    dot: 'bg-gray-400',
  },
  yellow: {
    label: 'Yellow',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    accent: 'bg-amber-400',
    headerBg: 'bg-amber-100/60',
    dot: 'bg-amber-400',
  },
  green: {
    label: 'Green',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    accent: 'bg-emerald-400',
    headerBg: 'bg-emerald-100/60',
    dot: 'bg-emerald-400',
  },
  blue: {
    label: 'Blue',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    accent: 'bg-blue-400',
    headerBg: 'bg-blue-100/60',
    dot: 'bg-blue-400',
  },
  purple: {
    label: 'Purple',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    accent: 'bg-purple-400',
    headerBg: 'bg-purple-100/60',
    dot: 'bg-purple-400',
  },
  pink: {
    label: 'Pink',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    accent: 'bg-pink-400',
    headerBg: 'bg-pink-100/60',
    dot: 'bg-pink-400',
  },
  orange: {
    label: 'Orange',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    accent: 'bg-orange-400',
    headerBg: 'bg-orange-100/60',
    dot: 'bg-orange-400',
  },
} as const;

export const NOTE_COLORS: NoteColor[] = [
  'default',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'orange',
];

// ============================================================================
// SORT OPTIONS
// ============================================================================

export const NOTE_SORT_OPTIONS: { value: NoteSortBy; label: string }[] = [
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'title', label: 'Title (A\u2013Z)' },
];

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

/** Key for saved filter presets (personnel-scoped via suffix) */
export const FILTER_PRESETS_STORAGE_KEY = 'nw_notes_filter_presets';

/** Key for custom pinned note order (personnel-scoped via suffix) */
export const PIN_ORDER_STORAGE_KEY = 'nw_notes_pin_order';

/** Key for custom colour labels (personnel-scoped via suffix) */
export const COLOUR_LABELS_STORAGE_KEY = 'nw_notes_colour_labels';

// ============================================================================
// QUERY BEHAVIOUR
// ============================================================================

export const NOTES_STALE_TIME = 2 * 60 * 1000; // 2 minutes
export const NOTES_DEBOUNCE_MS = 300;

// ============================================================================
// VOICE RECORDING
// ============================================================================

/** Maximum recording duration in milliseconds (5 minutes) */
export const MAX_RECORDING_DURATION_MS = 5 * 60 * 1000;

/** Recording tick interval for elapsed time display */
export const RECORDING_TICK_MS = 1000;
