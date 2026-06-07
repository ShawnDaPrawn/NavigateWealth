import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  LOCATION_TYPE_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_TYPE_COLORS,
  PRIORITY_COLORS,
  DEFAULT_FILTERS,
  DEFAULT_EVENT_DURATION_MINUTES,
  DEFAULT_REMINDER_LEAD_TIME_MINUTES,
  EVENTS_PER_PAGE,
  DISPLAY_DATE_FORMAT,
  DISPLAY_TIME_FORMAT,
} from '../constants';

describe('calendar event type constants', () => {
  it('EVENT_TYPE_LABELS is a non-empty record of strings', () => {
    expect(Object.keys(EVENT_TYPE_LABELS).length).toBeGreaterThan(0);
    Object.values(EVENT_TYPE_LABELS).forEach((v) => expect(typeof v).toBe('string'));
  });

  it('EVENT_TYPE_COLORS is a non-empty record of strings', () => {
    expect(Object.keys(EVENT_TYPE_COLORS).length).toBeGreaterThan(0);
    Object.values(EVENT_TYPE_COLORS).forEach((v) => expect(typeof v).toBe('string'));
  });
});

describe('calendar location and reminder constants', () => {
  it('LOCATION_TYPE_LABELS is a non-empty record', () => {
    expect(Object.keys(LOCATION_TYPE_LABELS).length).toBeGreaterThan(0);
  });

  it('REMINDER_TYPE_LABELS and REMINDER_TYPE_COLORS are non-empty', () => {
    expect(Object.keys(REMINDER_TYPE_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(REMINDER_TYPE_COLORS).length).toBeGreaterThan(0);
  });

  it('PRIORITY_COLORS is a non-empty record', () => {
    expect(Object.keys(PRIORITY_COLORS).length).toBeGreaterThan(0);
  });
});

describe('calendar default configuration', () => {
  it('DEFAULT_EVENT_DURATION_MINUTES is a positive number', () => {
    expect(DEFAULT_EVENT_DURATION_MINUTES).toBeGreaterThan(0);
  });

  it('DEFAULT_REMINDER_LEAD_TIME_MINUTES is a positive number', () => {
    expect(DEFAULT_REMINDER_LEAD_TIME_MINUTES).toBeGreaterThan(0);
  });

  it('EVENTS_PER_PAGE is a positive integer', () => {
    expect(EVENTS_PER_PAGE).toBeGreaterThan(0);
    expect(Number.isInteger(EVENTS_PER_PAGE)).toBe(true);
  });

  it('DEFAULT_FILTERS is an object', () => {
    expect(typeof DEFAULT_FILTERS).toBe('object');
  });
});

describe('calendar display format constants', () => {
  it('DISPLAY_DATE_FORMAT and DISPLAY_TIME_FORMAT are non-empty strings', () => {
    expect(DISPLAY_DATE_FORMAT.length).toBeGreaterThan(0);
    expect(DISPLAY_TIME_FORMAT.length).toBeGreaterThan(0);
  });
});
