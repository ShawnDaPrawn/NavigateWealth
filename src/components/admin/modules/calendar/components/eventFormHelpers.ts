/**
 * Event form helpers
 *
 * Pure date/time and recurrence logic for EventFormModal, kept out of the
 * component so it can be unit-tested without rendering.
 *
 * The form models "when" as date + start time + duration rather than two raw
 * datetime-local inputs: the adviser picks a day, a start slot and how long the
 * meeting runs, and the end time follows.
 */

import { addMinutes, differenceInMinutes, format, isValid, set, startOfDay } from 'date-fns';
import type { CalendarEvent, LocationType } from '../types';

// ============================================================================
// TIME SLOTS & DURATIONS
// ============================================================================

/** Minutes between selectable start times. */
export const TIME_STEP_MINUTES = 15;

/** Durations offered in the duration picker, in minutes. */
export const DURATION_OPTIONS: readonly number[] = [15, 30, 45, 60, 90, 120, 180, 240];

/** Business hours used for the "outside business hours" hint. */
export const BUSINESS_HOURS = { start: 8, end: 18 } as const;

/**
 * Every `HH:mm` slot of the day at TIME_STEP_MINUTES intervals. When `extra`
 * is a time that does not fall on a slot (an event created elsewhere at 09:20)
 * it is inserted in order so the select can still show the real value.
 */
export function buildTimeOptions(extra?: string): string[] {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += TIME_STEP_MINUTES) {
    slots.push(minutesToTime(m));
  }
  if (extra && /^\d{2}:\d{2}$/.test(extra) && !slots.includes(extra)) {
    slots.push(extra);
    slots.sort();
  }
  return slots;
}

/**
 * Duration options plus the current value when it is non-standard, so editing
 * a 70-minute event does not silently change it.
 */
export function buildDurationOptions(current?: number): number[] {
  const options = [...DURATION_OPTIONS];
  if (current && current > 0 && !options.includes(current)) {
    options.push(current);
    options.sort((a, b) => a - b);
  }
  return options;
}

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "45 min", "1 hr", "1 hr 30 min", "2 hrs". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  return rest === 0 ? hourLabel : `${hourLabel} ${rest} min`;
}

/** "18:30" → "6:30 PM" for display beside the 24-hour select value. */
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = set(new Date(2000, 0, 1), { hours: h, minutes: m, seconds: 0, milliseconds: 0 });
  return format(d, 'h:mm a');
}

// ============================================================================
// COMBINING & SPLITTING
// ============================================================================

/** Local date + `HH:mm` → Date. */
export function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return set(startOfDay(date), { hours: h || 0, minutes: m || 0, seconds: 0, milliseconds: 0 });
}

export function computeEndAt(start: Date, durationMinutes: number): Date {
  return addMinutes(start, durationMinutes);
}

export interface EventTimeParts {
  date: Date;
  time: string;
  durationMinutes: number;
}

/**
 * Split stored ISO timestamps back into the form's date / time / duration.
 * Falls back to a sensible default when the stored values are unreadable.
 */
export function splitEventTimes(startIso: string, endIso: string): EventTimeParts {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (!isValid(start) || !isValid(end)) {
    return { ...defaultStart(), durationMinutes: 60 };
  }
  const duration = Math.max(TIME_STEP_MINUTES, differenceInMinutes(end, start));
  return { date: startOfDay(start), time: format(start, 'HH:mm'), durationMinutes: duration };
}

/** The next quarter-hour from `now`, as the default for a new event. */
export function defaultStart(now: Date = new Date()): { date: Date; time: string } {
  const rounded = addMinutes(
    startOfDay(now),
    Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / TIME_STEP_MINUTES) * TIME_STEP_MINUTES,
  );
  return { date: startOfDay(rounded), time: format(rounded, 'HH:mm') };
}

// ============================================================================
// CHECKS
// ============================================================================

/** Weekend, or starts before 08:00, or ends after 18:00. */
export function isOutsideBusinessHours(start: Date, end: Date): boolean {
  const day = start.getDay();
  if (day === 0 || day === 6) return true;
  if (start.getHours() < BUSINESS_HOURS.start) return true;
  if (end.getHours() > BUSINESS_HOURS.end) return true;
  if (end.getHours() === BUSINESS_HOURS.end && end.getMinutes() > 0) return true;
  return false;
}

/**
 * First non-cancelled event that overlaps [start, end), ignoring `excludeId`
 * (the event being edited).
 */
export function findConflict(
  events: CalendarEvent[],
  start: Date,
  end: Date,
  excludeId?: string | null,
): CalendarEvent | null {
  const s = start.getTime();
  const e = end.getTime();
  return (
    events.find((ev) => {
      if (excludeId && ev.id === excludeId) return false;
      if (ev.status === 'cancelled') return false;
      const evStart = new Date(ev.start_at).getTime();
      const evEnd = new Date(ev.end_at).getTime();
      return s < evEnd && e > evStart;
    }) ?? null
  );
}

/** Accepts a meeting link only when it is an absolute http(s) URL. */
export function isValidMeetingLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// LOCATION
// ============================================================================

/** Location types the form offers. `virtual` (a legacy alias) maps to video. */
export type FormLocationType = Exclude<LocationType, 'virtual'>;

export function normaliseLocationType(type: LocationType | null | undefined): FormLocationType {
  if (type === 'virtual') return 'video';
  return type ?? 'in_person';
}

// ============================================================================
// RECURRENCE
// ============================================================================

export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceState {
  frequency: RecurrenceFrequency;
  interval: number;
  /** `yyyy-MM-dd` or empty. */
  endDate: string;
}

export const DEFAULT_RECURRENCE: RecurrenceState = { frequency: 'none', interval: 1, endDate: '' };

/** Longest a recurring series may run from its start date, in years. */
export const MAX_RECURRENCE_YEARS = 2;

/** Parse the JSON rule the backend stores. Unreadable rules become "none". */
export function parseRecurrenceRule(rule: string | null | undefined): RecurrenceState {
  if (!rule) return DEFAULT_RECURRENCE;
  try {
    const parsed = JSON.parse(rule) as Partial<{
      frequency: string;
      interval: number;
      endDate: string | null;
    }>;
    const frequency = parsed.frequency;
    if (
      frequency !== 'daily' &&
      frequency !== 'weekly' &&
      frequency !== 'monthly' &&
      frequency !== 'yearly'
    ) {
      return DEFAULT_RECURRENCE;
    }
    const interval = Number(parsed.interval);
    return {
      frequency,
      interval: Number.isFinite(interval) && interval >= 1 ? Math.floor(interval) : 1,
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
    };
  } catch {
    return DEFAULT_RECURRENCE;
  }
}

/** Serialise the form state to the backend's JSON rule, or null for "none". */
export function buildRecurrenceRule(state: RecurrenceState): string | null {
  if (state.frequency === 'none') return null;
  return JSON.stringify({
    frequency: state.frequency,
    interval: state.interval,
    endDate: state.endDate || null,
  });
}

/**
 * Validate the recurrence end date against the event start. Returns an error
 * message, or null when the state is acceptable.
 */
export function recurrenceError(state: RecurrenceState, start: Date): string | null {
  if (state.frequency === 'none' || !state.endDate) return null;
  const until = new Date(`${state.endDate}T23:59:59`);
  if (!isValid(until)) return 'Choose a valid end date for the repeat.';
  if (until <= start) return 'The repeat end date must be after the event start.';
  const limit = new Date(start);
  limit.setFullYear(limit.getFullYear() + MAX_RECURRENCE_YEARS);
  if (until > limit) return `Repeats cannot run more than ${MAX_RECURRENCE_YEARS} years.`;
  return null;
}

export const FREQUENCY_UNIT: Record<Exclude<RecurrenceFrequency, 'none'>, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};
