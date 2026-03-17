/**
 * Calendar Module - Type Definitions
 * Backend
 * 
 * Uses shared types for entities and DTOs.
 */

export * from './shared-calendar-types.ts';
import { EventType, EventStatus, ReminderStatus } from './shared-calendar-types.ts';

export interface EventFilters {
  start?: Date;
  end?: Date;
  search?: string;
  eventTypes?: EventType[];
  eventStatuses?: EventStatus[];
  clientId?: string;
}

export interface ReminderFilters {
  start?: Date;
  end?: Date;
  status?: ReminderStatus;
  clientId?: string;
}

export interface EventCreate extends Omit<import('./shared-calendar-types.ts').CreateEventInput, 'start_at' | 'end_at'> {
  start_at: string;
  end_at: string;
}

export interface EventUpdate extends import('./shared-calendar-types.ts').UpdateEventInput {}
export interface ReminderCreate extends import('./shared-calendar-types.ts').CreateReminderInput {}
export interface ReminderUpdate extends import('./shared-calendar-types.ts').UpdateReminderInput {}

