import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarEvents } from '../useCalendarEvents';
import type { CalendarEvent } from '../../types';

// ============================================================================
// Test helpers
// ============================================================================

function makeEvent(
  id: string,
  startAt: string,
  status: CalendarEvent['status'] = 'scheduled' as CalendarEvent['status'],
): CalendarEvent {
  return {
    id,
    title: `Event ${id}`,
    start_at: startAt,
    end_at: startAt,
    status,
    event_type: 'meeting',
    description: null,
    location: null,
    client_id: null,
    adviser_id: null,
    created_by: 'system',
    created_at: startAt,
    updated_at: startAt,
    metadata: null,
  } as unknown as CalendarEvent;
}

// ============================================================================
// eventsByDate
// ============================================================================

describe('useCalendarEvents — eventsByDate', () => {
  it('returns empty object for empty events array', () => {
    const { result } = renderHook(() => useCalendarEvents([]));

    expect(result.current.eventsByDate).toEqual({});
  });

  it('groups events by yyyy-MM-dd date key', () => {
    const events = [
      makeEvent('e-1', '2026-06-10T09:00:00Z'),
      makeEvent('e-2', '2026-06-10T14:00:00Z'),
      makeEvent('e-3', '2026-06-11T09:00:00Z'),
    ];

    const { result } = renderHook(() => useCalendarEvents(events));

    expect(Object.keys(result.current.eventsByDate)).toContain('2026-06-10');
    expect(Object.keys(result.current.eventsByDate)).toContain('2026-06-11');
    expect(result.current.eventsByDate['2026-06-10']).toHaveLength(2);
    expect(result.current.eventsByDate['2026-06-11']).toHaveLength(1);
  });

  it('excludes cancelled events', () => {
    const events = [
      makeEvent('e-1', '2026-06-10T09:00:00Z', 'scheduled' as CalendarEvent['status']),
      makeEvent('e-2', '2026-06-10T10:00:00Z', 'cancelled'),
    ];

    const { result } = renderHook(() => useCalendarEvents(events));

    const dateEvents = result.current.eventsByDate['2026-06-10'];
    expect(dateEvents).toHaveLength(1);
    expect(dateEvents[0].id).toBe('e-1');
  });

  it('sorts events within a date by start_at ascending', () => {
    const events = [
      makeEvent('e-late', '2026-06-10T14:00:00Z'),
      makeEvent('e-early', '2026-06-10T08:00:00Z'),
    ];

    const { result } = renderHook(() => useCalendarEvents(events));

    const dateEvents = result.current.eventsByDate['2026-06-10'];
    expect(dateEvents[0].id).toBe('e-early');
    expect(dateEvents[1].id).toBe('e-late');
  });

  it('handles single event correctly', () => {
    const events = [makeEvent('e-1', '2026-06-15T10:00:00Z')];

    const { result } = renderHook(() => useCalendarEvents(events));

    expect(result.current.eventsByDate['2026-06-15']).toHaveLength(1);
    expect(result.current.eventsByDate['2026-06-15'][0].id).toBe('e-1');
  });
});

// ============================================================================
// getEventsOnDate
// ============================================================================

describe('useCalendarEvents — getEventsOnDate', () => {
  it('returns events for the queried date', () => {
    const events = [
      makeEvent('e-1', '2026-06-10T09:00:00Z'),
      makeEvent('e-2', '2026-06-11T09:00:00Z'),
    ];

    const { result } = renderHook(() => useCalendarEvents(events));

    const onJune10 = result.current.getEventsOnDate(new Date('2026-06-10T00:00:00Z'));

    expect(onJune10).toHaveLength(1);
    expect(onJune10[0].id).toBe('e-1');
  });

  it('returns empty array when no events on that date', () => {
    const events = [makeEvent('e-1', '2026-06-10T09:00:00Z')];

    const { result } = renderHook(() => useCalendarEvents(events));

    const onJune20 = result.current.getEventsOnDate(new Date('2026-06-20T00:00:00Z'));

    expect(onJune20).toEqual([]);
  });

  it('returns all events on a date including multiple entries', () => {
    const events = [
      makeEvent('e-1', '2026-06-10T09:00:00Z'),
      makeEvent('e-2', '2026-06-10T14:00:00Z'),
      makeEvent('e-3', '2026-06-10T17:00:00Z'),
    ];

    const { result } = renderHook(() => useCalendarEvents(events));

    const onJune10 = result.current.getEventsOnDate(new Date('2026-06-10T00:00:00Z'));

    expect(onJune10).toHaveLength(3);
  });
});

// ============================================================================
// Memoization (referential stability)
// ============================================================================

describe('useCalendarEvents — memoization', () => {
  it('eventsByDate reference is stable across re-renders with same events', () => {
    const events = [makeEvent('e-1', '2026-06-10T09:00:00Z')];

    const { result, rerender } = renderHook(({ evts }) => useCalendarEvents(evts), {
      initialProps: { evts: events },
    });

    const first = result.current.eventsByDate;
    rerender({ evts: events });
    const second = result.current.eventsByDate;

    expect(first).toBe(second);
  });

  it('eventsByDate updates when events array reference changes', () => {
    const events1 = [makeEvent('e-1', '2026-06-10T09:00:00Z')];
    const events2 = [
      makeEvent('e-1', '2026-06-10T09:00:00Z'),
      makeEvent('e-2', '2026-06-11T09:00:00Z'),
    ];

    const { result, rerender } = renderHook(({ evts }) => useCalendarEvents(evts), {
      initialProps: { evts: events1 },
    });

    const first = result.current.eventsByDate;
    rerender({ evts: events2 });
    const second = result.current.eventsByDate;

    expect(first).not.toBe(second);
    expect(Object.keys(second)).toHaveLength(2);
  });
});
