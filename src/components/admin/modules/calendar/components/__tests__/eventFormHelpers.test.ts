import { describe, it, expect } from 'vitest';

import {
  buildTimeOptions,
  buildDurationOptions,
  formatDuration,
  formatTimeLabel,
  combineDateAndTime,
  computeEndAt,
  splitEventTimes,
  defaultStart,
  isOutsideBusinessHours,
  findConflict,
  isValidMeetingLink,
  normaliseLocationType,
  parseRecurrenceRule,
  buildRecurrenceRule,
  recurrenceError,
} from '../eventFormHelpers';
import type { CalendarEvent } from '../../types';

describe('time slots and durations', () => {
  it('offers 96 quarter-hour slots from 00:00 to 23:45', () => {
    const slots = buildTimeOptions();
    expect(slots).toHaveLength(96);
    expect(slots[0]).toBe('00:00');
    expect(slots[slots.length - 1]).toBe('23:45');
    expect(slots).toContain('18:30');
  });

  it('inserts a non-slot time in order so an existing event keeps its value', () => {
    const slots = buildTimeOptions('09:20');
    expect(slots).toHaveLength(97);
    expect(slots.indexOf('09:20')).toBe(slots.indexOf('09:15') + 1);
    expect(buildTimeOptions('09:15')).toHaveLength(96);
    expect(buildTimeOptions('nope')).toHaveLength(96);
  });

  it('keeps a non-standard duration available when editing', () => {
    expect(buildDurationOptions(70)).toContain(70);
    expect(buildDurationOptions(60)).toEqual(buildDurationOptions());
    expect(buildDurationOptions(0)).toEqual(buildDurationOptions());
  });

  it('formats durations for humans', () => {
    expect(formatDuration(15)).toBe('15 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(formatDuration(120)).toBe('2 hrs');
  });

  it('shows 12-hour labels next to 24-hour values', () => {
    expect(formatTimeLabel('18:30')).toBe('6:30 PM');
    expect(formatTimeLabel('00:00')).toBe('12:00 AM');
  });
});

describe('combining and splitting', () => {
  it('combines a date and a time in local time', () => {
    const d = combineDateAndTime(new Date(2026, 8, 7, 13, 45), '18:30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(0);
  });

  it('computes the end from the duration', () => {
    const start = combineDateAndTime(new Date(2026, 8, 7), '18:30');
    expect(computeEndAt(start, 60).getHours()).toBe(19);
    expect(computeEndAt(start, 45).getMinutes()).toBe(15);
  });

  it('splits stored timestamps back into date, time and duration', () => {
    const start = new Date(2026, 8, 7, 9, 20);
    const end = new Date(2026, 8, 7, 10, 30);
    const parts = splitEventTimes(start.toISOString(), end.toISOString());
    expect(parts.time).toBe('09:20');
    expect(parts.durationMinutes).toBe(70);
    expect(parts.date.getDate()).toBe(7);
    expect(parts.date.getHours()).toBe(0);
  });

  it('falls back to a default when the stored values are unreadable', () => {
    const parts = splitEventTimes('garbage', 'also garbage');
    expect(parts.durationMinutes).toBe(60);
    expect(parts.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('defaults a new event to the next quarter hour', () => {
    expect(defaultStart(new Date(2026, 8, 7, 14, 3)).time).toBe('14:15');
    expect(defaultStart(new Date(2026, 8, 7, 14, 15)).time).toBe('14:30');
    const late = defaultStart(new Date(2026, 8, 7, 23, 50));
    expect(late.time).toBe('00:00');
    expect(late.date.getDate()).toBe(8);
  });
});

describe('checks', () => {
  const monday = (h: number, m = 0) => new Date(2026, 8, 7, h, m); // 7 Sep 2026 is a Monday
  const saturday = (h: number) => new Date(2026, 8, 5, h);

  it('flags weekends and times outside 08:00-18:00', () => {
    expect(isOutsideBusinessHours(saturday(10), saturday(11))).toBe(true);
    expect(isOutsideBusinessHours(monday(7), monday(8))).toBe(true);
    expect(isOutsideBusinessHours(monday(17, 30), monday(18, 30))).toBe(true);
    expect(isOutsideBusinessHours(monday(17), monday(18))).toBe(false);
    expect(isOutsideBusinessHours(monday(9), monday(10))).toBe(false);
  });

  const events = [
    {
      id: 'a',
      title: 'Existing',
      status: 'scheduled',
      start_at: monday(10).toISOString(),
      end_at: monday(11).toISOString(),
    },
    {
      id: 'b',
      title: 'Cancelled',
      status: 'cancelled',
      start_at: monday(14).toISOString(),
      end_at: monday(15).toISOString(),
    },
  ] as CalendarEvent[];

  it('finds overlapping events but ignores cancelled ones and the event itself', () => {
    expect(findConflict(events, monday(10, 30), monday(11, 30))?.id).toBe('a');
    expect(findConflict(events, monday(11), monday(12))).toBeNull();
    expect(findConflict(events, monday(14), monday(15))).toBeNull();
    expect(findConflict(events, monday(10), monday(11), 'a')).toBeNull();
  });

  it('accepts only absolute http(s) meeting links', () => {
    expect(isValidMeetingLink('https://meet.example.com/abc')).toBe(true);
    expect(isValidMeetingLink('meet.example.com/abc')).toBe(false);
    expect(isValidMeetingLink('ftp://x')).toBe(false);
  });

  it('maps the legacy virtual location type to video', () => {
    expect(normaliseLocationType('virtual')).toBe('video');
    expect(normaliseLocationType('phone')).toBe('phone');
    expect(normaliseLocationType(undefined)).toBe('in_person');
  });
});

describe('recurrence', () => {
  it('round-trips the stored JSON rule', () => {
    const rule = buildRecurrenceRule({ frequency: 'weekly', interval: 2, endDate: '2026-12-01' });
    expect(parseRecurrenceRule(rule)).toEqual({
      frequency: 'weekly',
      interval: 2,
      endDate: '2026-12-01',
    });
  });

  it('serialises "none" as null and tolerates bad input', () => {
    expect(buildRecurrenceRule({ frequency: 'none', interval: 1, endDate: '' })).toBeNull();
    expect(parseRecurrenceRule(null).frequency).toBe('none');
    expect(parseRecurrenceRule('not json').frequency).toBe('none');
    expect(parseRecurrenceRule('{"frequency":"hourly"}').frequency).toBe('none');
    expect(parseRecurrenceRule('{"frequency":"daily","interval":"x"}').interval).toBe(1);
  });

  it('validates the repeat end date', () => {
    const start = new Date(2026, 8, 7, 9);
    expect(recurrenceError({ frequency: 'none', interval: 1, endDate: '' }, start)).toBeNull();
    expect(recurrenceError({ frequency: 'weekly', interval: 1, endDate: '' }, start)).toBeNull();
    expect(
      recurrenceError({ frequency: 'weekly', interval: 1, endDate: '2026-09-01' }, start),
    ).toMatch(/after/);
    expect(
      recurrenceError({ frequency: 'weekly', interval: 1, endDate: '2030-01-01' }, start),
    ).toMatch(/2 years/);
    expect(
      recurrenceError({ frequency: 'weekly', interval: 1, endDate: '2026-12-01' }, start),
    ).toBeNull();
  });
});
