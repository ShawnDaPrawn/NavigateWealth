/**
 * Calendar Events Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hooks for managing calendar events.
 * Uses the calendar API layer for all data operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { calendarApi } from '../api';
import type {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput,
  CalendarFilters,
} from '../types';
import { QUERY_STALE_TIME, QUERY_GC_TIME } from '../constants';

// ============================================================================
// QUERY KEYS
// ============================================================================

/**
 * Query key factory for events
 */
export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (filters: Partial<CalendarFilters>) => [...eventKeys.lists(), filters] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
};

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Fetch all events with optional filters
 * @param filters Optional filters to apply
 * @returns React Query result with events array
 */
export function useEvents(filters?: Partial<CalendarFilters>) {
  return useQuery({
    queryKey: eventKeys.list(filters || {}),
    queryFn: () => calendarApi.fetchEvents(filters),
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

/**
 * Fetch a single event by ID
 * @param id Event ID
 * @returns React Query result with single event
 */
export function useEvent(id: string | null) {
  return useQuery({
    queryKey: eventKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const events = await calendarApi.fetchEvents();
      return events.find(e => e.id === id) || null;
    },
    enabled: !!id,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new calendar event
 * Invalidates event queries on success
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<CalendarEvent> =>
      calendarApi.createEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('Event created successfully');
    },
    onError: (error) => {
      console.error('Failed to create event:', error);
      toast.error('Failed to create event');
    },
  });
}

/**
 * Update an existing calendar event
 * Invalidates event queries on success
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateEventInput): Promise<CalendarEvent> => {
      const { id, ...updates } = input;
      return calendarApi.updateEvent(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('Event updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update event:', error);
      toast.error('Failed to update event');
    },
  });
}

/**
 * Delete a calendar event
 * Invalidates event queries on success
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string): Promise<void> => {
      await calendarApi.deleteEvent(eventId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('Event deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
    },
  });
}
