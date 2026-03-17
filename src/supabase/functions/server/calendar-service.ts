/**
 * Calendar Module - Service Layer
 * 
 * Uses SHARED domain logic for validation and filtering.
 * Responsible only for Data Access (KV) and Logging.
 */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createModuleLogger } from './stderr-logger.ts';
import { ValidationError, NotFoundError } from './error.middleware.ts';
import type {
  CalendarEvent,
  Reminder,
  EventCreate,
  EventUpdate,
  ReminderCreate,
  ReminderUpdate,
  EventFilters,
  ReminderFilters,
} from './calendar-types.ts';

// Shared Logic Imports
import { 
  CreateEventSchema, 
  UpdateEventSchema, 
  CreateReminderSchema, 
  UpdateReminderSchema 
} from './shared-calendar-validation.ts';

const log = createModuleLogger('calendar-service');

/**
 * Create Supabase client with Service Role Key for backend operations
 * This bypasses RLS, so we must manually enforce user ownership where applicable
 * OR better: use the user's JWT if available, but here we are in service layer.
 * 
 * Ideally, we should receive the Supabase client (scoped to user) from the controller,
 * but for now let's use the Service Role and filter by user_id manually.
 */
function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export class CalendarService {
  
  private supabase = createServiceClient();

  // ========================================================================
  // EVENTS
  // ========================================================================
  
  /**
   * Get all events for user
   */
  async getEvents(userId: string, filters?: Partial<EventFilters>): Promise<CalendarEvent[]> {
    log.info('Getting events', { userId, filters });
    
    let query = this.supabase
      .from('events')
      .select('*, client:clients(*)')
      .eq('created_by', userId); // Enforce ownership

    // Apply filters
    if (filters?.start) {
      query = query.gte('start_at', filters.start.toISOString());
    }
    
    if (filters?.end) {
      query = query.lte('start_at', filters.end.toISOString());
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters?.eventTypes && filters.eventTypes.length > 0) {
      query = query.in('event_type', filters.eventTypes);
    }

    if (filters?.eventStatuses && filters.eventStatuses.length > 0) {
      query = query.in('status', filters.eventStatuses);
    }

    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      log.error('Error fetching events', error);
      throw error;
    }
    
    return data || [];
  }
  
  /**
   * Get event by ID
   */
  async getEventById(userId: string, eventId: string): Promise<CalendarEvent> {
    const { data, error } = await this.supabase
      .from('events')
      .select('*, client:clients(*)')
      .eq('id', eventId)
      .eq('created_by', userId)
      .single();
      
    if (error || !data) {
      throw new NotFoundError('Event not found');
    }
    
    return data;
  }
  
  /**
   * Create a new event
   */
  async createEvent(userId: string, data: EventCreate): Promise<CalendarEvent> {
    log.info('Creating event', { userId });
    
    // Use Shared Validation
    const validation = CreateEventSchema.safeParse(data);
    if (!validation.success) {
      throw new ValidationError(validation.error.message);
    }
    
    // Validated data with defaults applied
    const validData = validation.data;
    
    const { data: event, error } = await this.supabase
      .from('events')
      .insert({
        title: validData.title,
        description: validData.description,
        event_type: validData.event_type,
        start_at: validData.start_at,
        end_at: validData.end_at,
        location_type: validData.location_type,
        location: validData.location,
        video_link: validData.video_link,
        client_id: validData.client_id,
        attendees: validData.attendees || {},
        attendee_count: validData.attendees ? Object.keys(validData.attendees).length : 0,
        status: 'scheduled',
        created_by: userId,
        recurrence_rule: validData.recurrence_rule,
      })
      .select('*, client:clients(*)')
      .single();

    if (error) {
      log.error('Error creating event', error);
      throw error;
    }
    
    log.success('Event created', { userId, eventId: event.id });
    return event;
  }
  
  /**
   * Update an event
   */
  async updateEvent(userId: string, eventId: string, updates: EventUpdate): Promise<CalendarEvent> {
    // Verify existence and ownership
    await this.getEventById(userId, eventId);
    
    // Use Shared Validation
    const validation = UpdateEventSchema.safeParse(updates);
    if (!validation.success) {
      throw new ValidationError(validation.error.message);
    }
    
    const validUpdates = validation.data;
    const updatePayload: Record<string, unknown> = { ...validUpdates };
    
    // Recalculate attendee count if needed
    if (validUpdates.attendees) {
      updatePayload.attendee_count = Object.keys(validUpdates.attendees).length;
    }
    
    const { data: event, error } = await this.supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .eq('created_by', userId)
      .select('*, client:clients(*)')
      .single();
      
    if (error) {
      log.error('Error updating event', error);
      throw error;
    }
    
    log.success('Event updated', { userId, eventId });
    return event;
  }
  
  /**
   * Delete an event
   */
  async deleteEvent(userId: string, eventId: string): Promise<void> {
    await this.getEventById(userId, eventId); // Verify exists and ownership
    
    const { error } = await this.supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('created_by', userId);
      
    if (error) {
      log.error('Error deleting event', error);
      throw error;
    }
    
    log.success('Event deleted', { userId, eventId });
  }

  // ========================================================================
  // REMINDERS
  // ========================================================================
  
  /**
   * Get all reminders for user
   */
  async getReminders(userId: string, filters?: Partial<ReminderFilters>): Promise<Reminder[]> {
    log.info('Getting reminders', { userId });

    let query = this.supabase
      .from('reminders')
      .select('*, client:clients(*)')
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`);

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    // Add date range filters for reminders if needed
    
    const { data, error } = await query;
    
    if (error) {
      // Handle missing table gracefully
      if (error.code === '42P01') {
         log.warn('Reminders table does not exist');
         return [];
      }
      log.error('Error fetching reminders', error);
      throw error;
    }
    
    return data || [];
  }
  
  /**
   * Get reminder by ID
   */
  async getReminderById(userId: string, reminderId: string): Promise<Reminder> {
    const { data, error } = await this.supabase
      .from('reminders')
      .select('*, client:clients(*)')
      .eq('id', reminderId)
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
      .single();

    if (error || !data) {
      throw new NotFoundError('Reminder not found');
    }

    return data;
  }

  /**
   * Create a new reminder
   */
  async createReminder(userId: string, data: ReminderCreate): Promise<Reminder> {
    log.info('Creating reminder', { userId });

    const validation = CreateReminderSchema.safeParse(data);
    if (!validation.success) {
      throw new ValidationError(validation.error.message);
    }

    const validData = validation.data;

    const { data: reminder, error } = await this.supabase
      .from('reminders')
      .insert({
        title: validData.title,
        description: validData.description,
        type: validData.type,
        due_at: validData.due_at,
        priority: validData.priority || 'normal',
        client_id: validData.client_id,
        tags: validData.tags || [],
        recurrence_rule: validData.recurrence_rule,
        status: 'pending',
        created_by: userId,
        assignee_id: userId, // Default to self-assigned for now
      })
      .select('*, client:clients(*)')
      .single();

    if (error) {
      log.error('Error creating reminder', error);
      throw error;
    }

    log.success('Reminder created', { userId, reminderId: reminder.id });
    return reminder;
  }

  /**
   * Update a reminder
   */
  async updateReminder(userId: string, reminderId: string, updates: ReminderUpdate): Promise<Reminder> {
    await this.getReminderById(userId, reminderId);

    const validation = UpdateReminderSchema.safeParse(updates);
    if (!validation.success) {
      throw new ValidationError(validation.error.message);
    }

    const validUpdates = validation.data;

    const { data: reminder, error } = await this.supabase
      .from('reminders')
      .update(validUpdates)
      .eq('id', reminderId)
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
      .select('*, client:clients(*)')
      .single();

    if (error) {
      log.error('Error updating reminder', error);
      throw error;
    }

    log.success('Reminder updated', { userId, reminderId });
    return reminder;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(userId: string, reminderId: string): Promise<void> {
    await this.getReminderById(userId, reminderId);

    const { error } = await this.supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId)
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`);

    if (error) {
      log.error('Error deleting reminder', error);
      throw error;
    }

    log.success('Reminder deleted', { userId, reminderId });
  }
}