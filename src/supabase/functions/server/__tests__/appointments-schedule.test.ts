/**
 * Appointment email schedule computation tests
 * =============================================
 *
 * Covers the pure scheduling rules in appointments-service.ts:
 *   • standard booking → confirmation + day_before + morning_of + starting_soon
 *   • late bookings skip past-due reminders
 *   • morning_of drops when it collides with day_before
 *   • SAST (UTC+2) morning-of computation → 05:00 UTC
 *   • manage-token generation (length/charset/uniqueness)
 *
 * Run:
 *   npx vitest run src/supabase/functions/server/__tests__/appointments-schedule.test.ts
 */

import { describe, it, expect, vi } from 'vitest';

// The service module transitively imports the Supabase client and KV store —
// mock them so importing the pure helpers has no side effects.
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: vi.fn(() => ({})),
}));
vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async () => null),
  set: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
  getByPrefix: vi.fn(async () => []),
}));

import {
  computeEmailSchedule,
  morningOfUtcMs,
  generateManageToken,
} from '../appointments-service.ts';

describe('morningOfUtcMs', () => {
  it('returns 05:00 UTC (07:00 SAST) on the SAST date of the start time', () => {
    // 2026-07-14 10:00 SAST == 08:00 UTC
    const startMs = Date.parse('2026-07-14T08:00:00.000Z');
    expect(new Date(morningOfUtcMs(startMs)).toISOString()).toBe('2026-07-14T05:00:00.000Z');
  });

  it('uses the SAST calendar date when the UTC date differs', () => {
    // 2026-07-15 00:30 SAST == 2026-07-14 22:30 UTC → morning-of is the 15th SAST
    const startMs = Date.parse('2026-07-14T22:30:00.000Z');
    expect(new Date(morningOfUtcMs(startMs)).toISOString()).toBe('2026-07-15T05:00:00.000Z');
  });
});

describe('computeEmailSchedule', () => {
  it('queues all four emails for a booking made well in advance', () => {
    const nowMs = Date.parse('2026-07-10T08:00:00.000Z');
    const startAt = '2026-07-14T08:00:00.000Z'; // 10:00 SAST, 4 days out
    const plans = computeEmailSchedule(startAt, nowMs);

    expect(plans.map((p) => p.email_type)).toEqual([
      'confirmation',
      'day_before',
      'morning_of',
      'starting_soon',
    ]);
    expect(plans[0].scheduled_at).toBe(new Date(nowMs).toISOString());
    expect(plans[1].scheduled_at).toBe('2026-07-13T08:00:00.000Z');
    expect(plans[2].scheduled_at).toBe('2026-07-14T05:00:00.000Z');
    expect(plans[3].scheduled_at).toBe('2026-07-14T07:55:00.000Z');
  });

  it('uses the rescheduled email as the immediate send on reschedule', () => {
    const nowMs = Date.parse('2026-07-10T08:00:00.000Z');
    const plans = computeEmailSchedule('2026-07-14T08:00:00.000Z', nowMs, 'rescheduled');
    expect(plans[0].email_type).toBe('rescheduled');
  });

  it('skips day_before for a same-day booking but keeps a still-useful morning_of', () => {
    // Booked 06:50 SAST for 09:00 SAST the same day: day_before is in the
    // past (dropped); morning_of at 07:00 SAST is 2h before start, still useful.
    const nowMs = Date.parse('2026-07-14T04:50:00.000Z');
    const plans = computeEmailSchedule('2026-07-14T07:00:00.000Z', nowMs);
    expect(plans.map((p) => p.email_type)).toEqual(['confirmation', 'morning_of', 'starting_soon']);
  });

  it('skips every reminder that would land in the past or within 60s', () => {
    // Booked 8 minutes before the meeting
    const startMs = Date.parse('2026-07-14T08:00:00.000Z');
    const nowMs = startMs - 8 * 60 * 1000;
    const plans = computeEmailSchedule('2026-07-14T08:00:00.000Z', nowMs);
    expect(plans.map((p) => p.email_type)).toEqual(['confirmation', 'starting_soon']);
  });

  it('drops starting_soon when booked less than 6 minutes ahead', () => {
    const startMs = Date.parse('2026-07-14T08:00:00.000Z');
    const nowMs = startMs - 5 * 60 * 1000; // exactly 5 min before
    const plans = computeEmailSchedule('2026-07-14T08:00:00.000Z', nowMs);
    expect(plans.map((p) => p.email_type)).toEqual(['confirmation']);
  });

  it('drops morning_of for early-morning meetings where it would land on top of starting_soon', () => {
    // Meeting at 07:20 SAST → morning_of (07:00 SAST) would be 20 min before
    // start, arriving alongside starting_soon (07:15 SAST). Dropped.
    const nowMs = Date.parse('2026-07-13T00:00:00.000Z');
    const plans = computeEmailSchedule('2026-07-15T05:20:00.000Z', nowMs);
    expect(plans.map((p) => p.email_type)).toEqual(['confirmation', 'day_before', 'starting_soon']);
  });

  it('never schedules a reminder after the appointment starts', () => {
    const nowMs = Date.parse('2026-07-10T08:00:00.000Z');
    const startAt = '2026-07-14T03:00:00.000Z'; // 05:00 SAST — before 07:00 SAST
    const plans = computeEmailSchedule(startAt, nowMs);
    // morning_of (05:00 UTC = 07:00 SAST) would be AFTER the 03:00 UTC start → dropped
    expect(plans.map((p) => p.email_type)).not.toContain('morning_of');
    const startMs = Date.parse(startAt);
    for (const plan of plans.filter((p) => p.email_type !== 'confirmation')) {
      expect(new Date(plan.scheduled_at).getTime()).toBeLessThan(startMs);
    }
  });
});

describe('generateManageToken', () => {
  it('produces long, URL-safe, unique tokens', () => {
    const a = generateManageToken();
    const b = generateManageToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40); // 32 bytes base64url ≈ 43 chars
    expect(/^[A-Za-z0-9_-]+$/.test(a)).toBe(true);
  });
});
