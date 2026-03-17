/**
 * Calendar Module Constants
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized constants for calendar module including labels, colors,
 * and configuration values.
 */

import type {
  EventType,
  LocationType,
  ReminderType,
  ReminderPriority,
} from './types';

// ============================================================================
// EVENT TYPE CONSTANTS
// ============================================================================

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: 'Meeting',
  review: 'Review',
  call: 'Call',
  webinar: 'Webinar',
  internal: 'Internal',
  consultation: 'Consultation',
  deadline: 'Deadline',
  birthday: 'Birthday',
  renewal: 'Policy Renewal',
  other: 'Other',
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  call: 'bg-green-100 text-green-700',
  webinar: 'bg-indigo-100 text-indigo-700',
  internal: 'bg-gray-100 text-gray-700',
  consultation: 'bg-teal-100 text-teal-700',
  deadline: 'bg-rose-100 text-rose-700',
  birthday: 'bg-pink-100 text-pink-700',
  renewal: 'bg-amber-100 text-amber-700',
  other: 'bg-slate-100 text-slate-700',
};

// ============================================================================
// LOCATION TYPE CONSTANTS
// ============================================================================

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  in_person: 'In Person',
  video: 'Video Call',
  phone: 'Phone Call',
  virtual: 'Virtual',
  other: 'Other',
};

// ============================================================================
// REMINDER TYPE CONSTANTS
// ============================================================================

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  client_review: 'Client Review',
  section_14: 'Section 14',
  birthday: 'Birthday',
  follow_up: 'Follow Up',
  compliance: 'Compliance',
  task: 'Task',
  deadline: 'Deadline',
  call: 'Call',
  email: 'Email',
  other: 'Other',
};

export const REMINDER_TYPE_COLORS: Record<ReminderType, string> = {
  client_review: 'bg-blue-100 text-blue-700 border-blue-200',
  section_14: 'bg-red-100 text-red-700 border-red-200',
  birthday: 'bg-pink-100 text-pink-700 border-pink-200',
  follow_up: 'bg-purple-100 text-purple-700 border-purple-200',
  compliance: 'bg-orange-100 text-orange-700 border-orange-200',
  task: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  deadline: 'bg-rose-100 text-rose-700 border-rose-200',
  call: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  email: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

// ============================================================================
// PRIORITY CONSTANTS
// ============================================================================

export const PRIORITY_COLORS: Record<ReminderPriority, string> = {
  low: 'text-gray-500',
  normal: 'text-blue-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_FILTERS = {
  search: '',
  dateRange: {
    start: null,
    end: null,
  },
  reminderTypes: [],
  eventTypes: [],
  reminderStatuses: [],
  eventStatuses: [],
  clientId: null,
} as const;

export const DEFAULT_EVENT_DURATION_MINUTES = 60;
export const DEFAULT_REMINDER_LEAD_TIME_MINUTES = 60;

// ============================================================================
// CONFIGURATION
// ============================================================================

export const EVENTS_PER_PAGE = 20;
export const QUERY_STALE_TIME = 30000;
export const QUERY_GC_TIME = 5 * 60 * 1000;
export const SEARCH_DEBOUNCE_MS = 300;
export const DISPLAY_DATE_FORMAT = 'MMM d, yyyy';
export const DISPLAY_TIME_FORMAT = 'h:mm a';
export const DISPLAY_DATETIME_FORMAT = 'MMM d, yyyy h:mm a';