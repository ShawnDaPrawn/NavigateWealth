/**
 * Calendar API Layer
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized API calls for calendar events and reminders.
 * All Supabase interactions should go through this layer.
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
  CalendarFilters,
  Reminder,
  CreateReminderInput,
  UpdateReminderInput,
} from './types';

// ============================================================================
// EVENT API
// ============================================================================

/**
 * Fetch all events with optional filters
 * @param filters Optional filters to apply to the query
 * @returns Promise resolving to array of calendar events
 */
export async function fetchEvents(
  filters?: Partial<CalendarFilters>
): Promise<CalendarEvent[]> {
  logger.debug('[API] Fetching events...', { filters });

  const queryParams = new URLSearchParams();

  if (filters?.search) {
    queryParams.append('search', filters.search);
  }

  if (filters?.dateRange?.start) {
    queryParams.append('start', filters.dateRange.start);
  }

  if (filters?.dateRange?.end) {
    queryParams.append('end', filters.dateRange.end);
  }

  if (filters?.eventTypes && filters.eventTypes.length > 0) {
    queryParams.append('eventTypes', filters.eventTypes.join(','));
  }

  if (filters?.eventStatuses && filters.eventStatuses.length > 0) {
    queryParams.append('eventStatuses', filters.eventStatuses.join(','));
  }

  if (filters?.clientId) {
    queryParams.append('clientId', filters.clientId);
  }

  try {
    const data = await api.get<CalendarEvent[]>(`/calendar/events?${queryParams.toString()}`);
    logger.debug(`[API] Fetched ${data?.length || 0} events`);
    return data;
  } catch (error) {
    logger.error('[API] Error fetching events', error);
    throw error;
  }
}

/**
 * Create a new calendar event
 * @param input Event data to create
 * @returns Promise resolving to the created event
 */
export async function createEvent(
  input: CreateEventInput
): Promise<CalendarEvent> {
  logger.debug('[API] Creating event', { title: input.title });

  try {
    const data = await api.post<CalendarEvent>('/calendar/events', input);
    logger.debug('[API] Event created', { id: data.id });
    return data;
  } catch (error) {
    logger.error('[API] Error creating event', error);
    throw error;
  }
}

/**
 * Update an existing calendar event
 * @param id Event ID to update
 * @param updates Partial event data to update
 * @returns Promise resolving to the updated event
 */
export async function updateEvent(
  id: string,
  updates: Partial<Omit<UpdateEventInput, 'id'>>
): Promise<CalendarEvent> {
  logger.debug('[API] Updating event', { id });

  try {
    const data = await api.put<CalendarEvent>(`/calendar/events/${id}`, updates);
    logger.debug('[API] Event updated', { id: data.id });
    return data;
  } catch (error) {
    logger.error('[API] Error updating event', error);
    throw error;
  }
}

/**
 * Delete a calendar event
 * @param id Event ID to delete
 * @returns Promise resolving when deletion is complete
 */
export async function deleteEvent(id: string): Promise<void> {
  logger.debug('[API] Deleting event', { id });

  try {
    await api.delete(`/calendar/events/${id}`);
    logger.debug('[API] Event deleted', { id });
  } catch (error) {
    logger.error('[API] Error deleting event', error);
    throw error;
  }
}

// ============================================================================
// REMINDER API (Future Implementation)
// ============================================================================

/**
 * Fetch all reminders with optional filters
 * @param filters Optional filters to apply to the query
 * @returns Promise resolving to array of reminders
 */
export async function fetchReminders(
  filters?: Partial<CalendarFilters>
): Promise<Reminder[]> {
  logger.debug('[API] Fetching reminders...', { filters });
  
  const queryParams = new URLSearchParams();
  if (filters?.reminderStatuses && filters.reminderStatuses.length > 0) {
    // For now backend only supports single status or no status filter in basic implementation
    // We'll just take the first one if multiple provided, or expand backend later
    queryParams.append('status', filters.reminderStatuses[0]);
  }

  try {
    const data = await api.get<Reminder[]>(`/calendar/reminders?${queryParams.toString()}`);
    return data;
  } catch (error) {
    logger.error('[API] Error fetching reminders', error);
    throw error;
  }
}

/**
 * Create a new reminder
 * @param input Reminder data to create
 * @returns Promise resolving to the created reminder
 */
export async function createReminder(
  input: CreateReminderInput
): Promise<Reminder> {
  logger.debug('[API] Creating reminder', { title: input.title });
  
  try {
    const data = await api.post<Reminder>('/calendar/reminders', input);
    return data;
  } catch (error) {
    logger.error('[API] Error creating reminder', error);
    throw error;
  }
}

/**
 * Update an existing reminder
 * @param id Reminder ID to update
 * @param updates Partial reminder data to update
 * @returns Promise resolving to the updated reminder
 */
export async function updateReminder(
  id: string,
  updates: Partial<Omit<UpdateReminderInput, 'id'>>
): Promise<Reminder> {
  logger.debug('[API] Updating reminder', { id });
  
  try {
    const data = await api.put<Reminder>(`/calendar/reminders/${id}`, updates);
    return data;
  } catch (error) {
    logger.error('[API] Error updating reminder', error);
    throw error;
  }
}

/**
 * Delete a reminder
 * @param id Reminder ID to delete
 * @returns Promise resolving when deletion is complete
 */
export async function deleteReminder(id: string): Promise<void> {
  logger.debug('[API] Deleting reminder', { id });
  
  try {
    await api.delete(`/calendar/reminders/${id}`);
  } catch (error) {
    logger.error('[API] Error deleting reminder', error);
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Calendar API object for organized imports
 */
export const calendarApi = {
  // Events
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  
  // Reminders
  fetchReminders,
  createReminder,
  updateReminder,
  deleteReminder,
};
