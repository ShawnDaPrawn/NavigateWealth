/**
 * Shared Calendar Types
 * Single source of truth for Frontend and Backend
 */

// ============================================================================
// ENUMS & UNIONS
// ============================================================================

export type EventType = 
  | 'meeting' 
  | 'review' 
  | 'call' 
  | 'webinar' 
  | 'internal' 
  | 'consultation' 
  | 'deadline' 
  | 'other';

export type EventStatus = 
  | 'scheduled' 
  | 'completed' 
  | 'cancelled' 
  | 'rescheduled';

export type LocationType = 
  | 'in_person' 
  | 'video' 
  | 'phone' 
  | 'virtual' // Alias for video/other
  | 'other';

export type ReminderType = 
  | 'client_review' 
  | 'section_14' 
  | 'birthday' 
  | 'follow_up' 
  | 'compliance' 
  | 'task' 
  | 'deadline' 
  | 'call' 
  | 'email' 
  | 'other';

export type ReminderStatus = 
  | 'pending' 
  | 'completed' 
  | 'overdue' 
  | 'dismissed';

export type ReminderPriority = 
  | 'low' 
  | 'normal' // Alias for medium
  | 'medium' 
  | 'high' 
  | 'urgent';

export type CalendarView = 
  | 'agenda' 
  | 'day' 
  | 'week' 
  | 'month';

// ============================================================================
// ENTITIES
// ============================================================================

export interface CalendarEvent {
  id: string;
  user_id: string; // Backend uses user_id, Frontend might map this from context
  title: string;
  description: string | null;
  event_type: EventType;
  start_at: string;
  end_at: string;
  location_type: LocationType;
  location: string | null;
  video_link: string | null; // Alias: meeting_link
  meeting_link?: string | null; // For backend compatibility
  status: EventStatus;
  client_id: string | null;
  attendee_count?: number;
  attendees?: Record<string, unknown>; // JSONB — keyed by attendee identifier
  created_by: string;
  created_at: string;
  updated_at: string;
  recurrence_rule: string | null;
  completed_at?: string;
  cancelled_at?: string;
  
  // Relations
  client?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: ReminderType; // Backend: reminder_type
  reminder_type?: ReminderType; // For backend compatibility
  status: ReminderStatus;
  due_at: string;
  priority: ReminderPriority;
  client_id: string | null;
  assignee_id?: string;
  created_by: string;
  completed_at: string | null;
  dismissed_at?: string | null;
  recurrence_rule: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  
  // Relations
  client?: {
    id: string;
    full_name: string;
    email: string;
  };
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface CreateEventInput {
  title: string;
  description?: string | null;
  event_type: EventType;
  start_at: string;
  end_at: string;
  location_type: LocationType;
  location?: string | null;
  video_link?: string | null;
  client_id?: string | null;
  attendees?: Record<string, unknown>;
  create_reminder?: boolean;
  recurrence_rule?: string | null;
  notes?: string;
}

export interface UpdateEventInput {
  id?: string;
  title?: string;
  description?: string | null;
  event_type?: EventType;
  start_at?: string;
  end_at?: string;
  location_type?: LocationType;
  location?: string | null;
  video_link?: string | null;
  status?: EventStatus;
  client_id?: string | null;
  attendees?: Record<string, unknown>;
  recurrence_rule?: string | null;
  notes?: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string | null;
  type: ReminderType;
  due_at: string;
  priority?: ReminderPriority;
  client_id?: string | null;
  tags?: string[];
  create_event?: boolean;
  recurrence_rule?: string | null;
}

export interface UpdateReminderInput {
  id?: string;
  title?: string;
  description?: string | null;
  type?: ReminderType;
  due_at?: string;
  priority?: ReminderPriority;
  client_id?: string | null;
  status?: ReminderStatus;
  completed_at?: string | null;
  tags?: string[];
  recurrence_rule?: string | null;
}

export interface CalendarFilters {
  search: string;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  reminderTypes: ReminderType[];
  eventTypes: EventType[];
  reminderStatuses: ReminderStatus[];
  eventStatuses: EventStatus[];
  clientId: string | null;
}

// ============================================================================
// CALENDAR CLIENT (used by useClients hook for calendar context)
// ============================================================================

export interface Client {
  id: string;
  full_name: string;
  preferred_name: string | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DISPLAY CONSTANTS
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
  task: 'bg-teal-100 text-teal-700 border-teal-200',
  deadline: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  call: 'bg-green-100 text-green-700 border-green-200',
  email: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: 'Meeting',
  review: 'Review',
  call: 'Call',
  webinar: 'Webinar',
  internal: 'Internal',
  consultation: 'Consultation',
  deadline: 'Deadline',
  other: 'Other',
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: 'bg-blue-100 text-blue-700',
  review: 'bg-purple-100 text-purple-700',
  call: 'bg-green-100 text-green-700',
  webinar: 'bg-indigo-100 text-indigo-700',
  internal: 'bg-gray-100 text-gray-700',
  consultation: 'bg-teal-100 text-teal-700',
  deadline: 'bg-yellow-100 text-yellow-700',
  other: 'bg-slate-100 text-slate-700',
};

export const PRIORITY_COLORS: Record<ReminderPriority, string> = {
  low: 'text-gray-500',
  normal: 'text-blue-500',
  medium: 'text-blue-500',
  high: 'text-red-500',
  urgent: 'text-red-700',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  in_person: 'In Person',
  video: 'Video Call',
  phone: 'Phone Call',
  virtual: 'Virtual',
  other: 'Other',
};