/**
 * Calendar Events Utility Hook
 * Navigate Wealth Admin Dashboard
 * 
 * Provides utility functions for working with calendar events,
 * including grouping by date and filtering.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '../types';

/**
 * Hook for organizing and accessing calendar events
 * @param events Array of calendar events
 * @returns Object with eventsByDate map and helper functions
 */
export function useCalendarEvents(events: CalendarEvent[]) {
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    
    // Sort all active events by start time
    const sortedEvents = [...events]
      .filter(e => e.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    // Group by 'yyyy-MM-dd'
    sortedEvents.forEach(event => {
      const dateKey = format(new Date(event.start_at), 'yyyy-MM-dd');
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(event);
    });

    return map;
  }, [events]);

  /**
   * Get all events for a specific date
   * @param date Date to get events for
   * @returns Array of events on that date
   */
  const getEventsOnDate = (date: Date) => {
    return eventsByDate[format(date, 'yyyy-MM-dd')] || [];
  };

  return {
    eventsByDate,
    getEventsOnDate,
  };
}
