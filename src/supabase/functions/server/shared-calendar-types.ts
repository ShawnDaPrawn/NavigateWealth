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
  attendees?: Record<string, unknown>; // JSONB or string[]
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