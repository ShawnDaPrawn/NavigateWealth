/**
 * Notes Module — Type Definitions
 * Navigate Wealth Admin Dashboard
 *
 * §5.2 — Single source of truth for module types
 * §9.1 — Strict typing, no `any`
 *
 * @module notes/types
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/** Available note colour themes */
export type NoteColor =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'orange';

/** View modes for the notes grid */
export type NoteViewMode = 'grid' | 'list';

/** Sort options */
export type NoteSortBy = 'updatedAt' | 'createdAt' | 'title';

/** Sort direction */
export type NoteSortDirection = 'asc' | 'desc';

/** Filter options for archive state */
export type NoteArchiveFilter = 'active' | 'archived' | 'all';

// ============================================================================
// MAIN INTERFACES
// ============================================================================

/** A single note entity */
export interface Note {
  /** Unique identifier (UUID) */
  id: string;

  /** Note title */
  title: string;

  /** Note content (plain text / markdown) */
  content: string;

  /** AI-generated summary of the note content */
  summary?: string | null;

  /** Personnel ID who owns this note */
  personnelId: string;

  /** Personnel display name */
  personnelName: string;

  /** Optional linked client ID */
  clientId?: string | null;

  /** Optional linked client display name */
  clientName?: string | null;

  /** Tags for categorisation */
  tags: string[];

  /** Colour theme */
  color: NoteColor;

  /** Whether note is pinned to top */
  isPinned: boolean;

  /** Whether note is archived */
  isArchived: boolean;

  /** If converted to a task, the task ID */
  convertedToTaskId?: string | null;

  /** Creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/** Input for creating a new note */
export interface CreateNoteInput {
  title: string;
  content?: string;
  personnelId: string;
  personnelName: string;
  clientId?: string | null;
  clientName?: string | null;
  tags?: string[];
  color?: NoteColor;
}

/** Input for updating a note (partial) */
export interface UpdateNoteInput {
  id: string;
  title?: string;
  content?: string;
  summary?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  tags?: string[];
  color?: NoteColor;
  isPinned?: boolean;
  isArchived?: boolean;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

/** Filters for the notes list */
export interface NoteFilters {
  search?: string;
  color?: NoteColor | 'all';
  archiveFilter?: NoteArchiveFilter;
  clientId?: string | null;
  tags?: string[];
}

// ============================================================================
// SAVED FILTER PRESETS
// ============================================================================

/** A saved filter preset that persists across sessions */
export interface SavedFilterPreset {
  /** Unique identifier (UUID) */
  id: string;
  /** User-defined label */
  name: string;
  /** Filter state snapshot */
  filters: {
    search: string;
    archiveFilter: NoteArchiveFilter;
    colorFilter: NoteColor | 'all';
    sortBy: NoteSortBy;
    selectedTags: string[];
    clientFilter: string;
  };
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}

// ============================================================================
// BULK ACTIONS
// ============================================================================

/** Available bulk action types */
export type BulkActionType = 'archive' | 'unarchive' | 'delete' | 'addTag' | 'removeTag' | 'setColor';

// ============================================================================
// COLOUR LABELS
// ============================================================================

/** Custom colour descriptions set by the user (e.g. green → "New Business") */
export type CustomColourLabels = Partial<Record<NoteColor, string>>;