/**
 * Task Management Module - Constants & Configuration
 * Navigate Wealth Admin Dashboard
 *
 * Centralised, typed constants for task UI display.
 * Guidelines SS5.3 — All non-trivial constants must be centralised and typed.
 *
 * @module tasks/constants
 */

import type { TaskPriority, TaskStatus, TaskCategory } from './types';

// ============================================================================
// PRIORITY MAPPINGS
// ============================================================================

/** Priority label mappings */
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/** Priority color mappings (Tailwind classes) */
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

/** Priority background colors (for badges) */
export const PRIORITY_BG_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-50',
  medium: 'bg-blue-50',
  high: 'bg-orange-50',
  critical: 'bg-red-50',
};

/** Priority icon colors */
export const PRIORITY_ICON_COLORS: Record<TaskPriority, string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

/** Priority numeric values (for sorting) */
export const PRIORITY_VALUES: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================================================
// STATUS MAPPINGS
// ============================================================================

/** Status label mappings */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

/** Status color mappings */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  archived: 'bg-gray-100 text-gray-700 border-gray-200',
};

/** Status icon colors */
export const STATUS_ICON_COLORS: Record<TaskStatus, string> = {
  new: 'text-blue-600',
  in_progress: 'text-amber-600',
  completed: 'text-green-600',
  archived: 'text-gray-600',
};

/** Status background colors (for columns) */
export const STATUS_COLUMN_COLORS: Record<TaskStatus, string> = {
  new: 'bg-blue-50/50 border-blue-100',
  in_progress: 'bg-amber-50/50 border-amber-100',
  completed: 'bg-green-50/50 border-green-100',
  archived: 'bg-gray-50/50 border-gray-100',
};

// ============================================================================
// CATEGORY MAPPINGS
// ============================================================================

/** Category label mappings */
export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  client: 'Client',
  compliance: 'Compliance',
  application: 'Application',
  internal: 'Internal',
};

/** Category color mappings */
export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  client: 'bg-purple-100 text-purple-700',
  compliance: 'bg-red-100 text-red-700',
  application: 'bg-blue-100 text-blue-700',
  internal: 'bg-gray-100 text-gray-700',
};

/** Category icon colors */
export const CATEGORY_ICON_COLORS: Record<TaskCategory, string> = {
  client: 'text-purple-600',
  compliance: 'text-red-600',
  application: 'text-blue-600',
  internal: 'text-gray-600',
};

// ============================================================================
// OPTION ARRAYS
// ============================================================================

/** Available category options */
export const CATEGORY_OPTIONS: TaskCategory[] = [
  'client',
  'compliance',
  'application',
  'internal',
];

/** Available priority options */
export const PRIORITY_OPTIONS: TaskPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
];

/** Available status options (for forms — excludes archived) */
export const STATUS_OPTIONS: TaskStatus[] = [
  'new',
  'in_progress',
  'completed',
];

/** Board columns (excludes archived) */
export const BOARD_COLUMNS: TaskStatus[] = [
  'new',
  'in_progress',
  'completed',
];

// ============================================================================
// API ENDPOINTS (module-local)
// ============================================================================

export const ENDPOINTS = {
  TASKS: '/tasks',
  ALL: '/tasks/all',
  STATS: '/tasks/stats',
  DUE_TODAY: '/tasks/due-today',
  BY_DATE: '/tasks/by-date',
  REORDER: '/tasks/reorder',
  TASK: (id: string) => `/tasks/${id}`,
  MOVE: (id: string) => `/tasks/${id}/move`,
  DUPLICATE: (id: string) => `/tasks/${id}/duplicate`,
  ARCHIVE: (id: string) => `/tasks/${id}/archive`,
  UNARCHIVE: (id: string) => `/tasks/${id}/unarchive`,
} as const;
