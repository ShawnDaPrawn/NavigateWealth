/**
 * POST /consultation/request — the public booking gate.
 * =====================================================
 *
 * Office hours moved from 08:00 to 08:30, and in-person at the Pretoria office
 * became a real meeting type. Both rules live only in this route: the schema
 * accepts the type, then `validateBookingDateTime` refuses weekends, anything
 * sooner than the second business day, and times outside 08:30–16:30. Nothing
 * else calls that function.
 *
 * A refusal has to happen before the consultation row, the submissions entry,
 * and the two emails. Accepting 08:00 again, or rejecting `in_person`, would
 * either book outside office hours or drop a lead the form now sends.
 *
 * The clock is Monday 19 October 2026, 10:00 SAST. The earliest bookable day
 * is Wednesday 21 October. Thursday, Friday, and Saturday are set per test
 * because each one skips a different weekend.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/consultation-booking.contract.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: () => 'test' },
  };
});

const sent = vi.hoisted(
  () => [] as Array<{ to?: string; subject?: string; html?: string; text?: string }>,
);
const submissionsCreate = vi.hoisted(() => vi.fn(async () => ({ id: 'sub_1' })));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../email-service.ts', () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(
    async (payload: { to?: string; subject?: string; html?: string; text?: string }) => {
      sent.push(payload);
      return true;
    },
  ),
  getFooterSettings: async () => ({}),
  createEmailTemplate: (body: string) => body,
  createPlainTextEmail: (body: string) => body,
}));

vi.mock('../submissions-service.ts', () => ({
  submissionsService: { create: submissionsCreate },
}));

vi.mock('../contact-pdf-generator.ts', () => ({
  generateContactPdf: () => 'cGRm',
}));

const app = (await import('../consultation.ts')).default;

/** Monday 19 Oct 2026 10:00 SAST. Earliest bookable day: Wednesday 21 Oct. */
const MONDAY_10H00_SAST = new Date('2026-10-19T08:00:00.000Z');
const EARLIEST_FROM_MONDAY = '2026-10-21';

function post(body: Record<string, unknown>) {
  return app.request('/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '0820000000',
    meetingType: 'in_person',
    preferredDate1: EARLIEST_FROM_MONDAY,
    preferredTime1: '08:30',
    ...overrides,
  };
}

function storedConsultations(): Array<Record<string, unknown>> {
  return [...kvStore.entries()]
    .filter(([key]) => key.startsWith('consultation:'))
    .map(([, value]) => value as Record<string, unknown>);
}

beforeEach(() => {
  kvStore.clear();
  sent.length = 0;
  submissionsCreate.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(MONDAY_10H00_SAST);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('office hours', () => {
  it('refuses 08:00, which used to be inside the booking window, and stores nothing', async () => {
    const res = await post(booking({ preferredTime1: '08:00' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.join(' ')).toContain('between 08:30 and 16:30');
    expect(body.details.join(' ')).not.toContain('between 08:00');
    expect(storedConsultations()).toEqual([]);
    expect(submissionsCreate).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it.each(['08:29', '16:31', '17:00'])('refuses %s and does not keep the lead', async (time) => {
    const res = await post(booking({ preferredTime1: time }));

    expect(res.status).toBe(400);
    expect((await res.json()).details.join(' ')).toContain('between 08:30 and 16:30');
    expect(storedConsultations()).toEqual([]);
    expect(submissionsCreate).not.toHaveBeenCalled();
  });

  it.each(['8:30', '08:30:00'])('refuses a time that is not HH:MM (%s)', async (time) => {
    const res = await post(booking({ preferredTime1: time }));

    expect(res.status).toBe(400);
    expect((await res.json()).details.join(' ')).toContain('Invalid time format');
    expect(storedConsultations()).toEqual([]);
  });

  it('accepts the new opening time and the closing minute', async () => {
    const opening = await post(booking({ preferredTime1: '08:30' }));
    expect(opening.status).toBe(200);

    kvStore.clear();
    sent.length = 0;
    const closing = await post(booking({ preferredTime1: '16:30', meetingType: 'virtual' }));
    expect(closing.status).toBe(200);
    expect(storedConsultations()[0]).toMatchObject({
      meetingType: 'virtual',
      preferredTime1: '16:30',
    });
  });
});

describe('how soon a day can be booked', () => {
  it('refuses a weekend, the same day, and the next business day', async () => {
    const weekend = await post(booking({ preferredDate1: '2026-10-24', preferredTime1: '09:00' }));
    expect(weekend.status).toBe(400);
    expect((await weekend.json()).details.join(' ')).toContain('not available on weekends');

    const sameDay = await post(booking({ preferredDate1: '2026-10-19', preferredTime1: '09:00' }));
    expect(sameDay.status).toBe(400);
    expect((await sameDay.json()).details.join(' ')).toContain(EARLIEST_FROM_MONDAY);

    const nextBusinessDay = await post(
      booking({ preferredDate1: '2026-10-20', preferredTime1: '09:00' }),
    );
    expect(nextBusinessDay.status).toBe(400);
    expect((await nextBusinessDay.json()).details.join(' ')).toContain(
      `earliest available date is ${EARLIEST_FROM_MONDAY}`,
    );
    expect(storedConsultations()).toEqual([]);
  });

  it('from a Thursday the earliest day is the following Monday', async () => {
    vi.setSystemTime(new Date('2026-10-15T08:00:00.000Z'));

    const friday = await post(booking({ preferredDate1: '2026-10-16', preferredTime1: '09:00' }));
    expect(friday.status).toBe(400);
    expect((await friday.json()).details.join(' ')).toContain('2026-10-19');

    const monday = await post(booking({ preferredDate1: '2026-10-19', preferredTime1: '09:00' }));
    expect(monday.status).toBe(200);
    expect(storedConsultations()[0]).toMatchObject({ preferredDate1: '2026-10-19' });
  });

  it('from a Friday the earliest day is the following Tuesday', async () => {
    vi.setSystemTime(new Date('2026-10-16T08:00:00.000Z'));

    const monday = await post(booking({ preferredDate1: '2026-10-19', preferredTime1: '09:00' }));
    expect(monday.status).toBe(400);
    expect((await monday.json()).details.join(' ')).toContain('2026-10-20');

    const tuesday = await post(booking({ preferredDate1: '2026-10-20', preferredTime1: '09:00' }));
    expect(tuesday.status).toBe(200);
  });

  it('from a Saturday the earliest day is the following Tuesday', async () => {
    vi.setSystemTime(new Date('2026-10-17T08:00:00.000Z'));

    const monday = await post(booking({ preferredDate1: '2026-10-19', preferredTime1: '09:00' }));
    expect(monday.status).toBe(400);
    expect((await monday.json()).details.join(' ')).toContain('2026-10-20');
    expect(storedConsultations()).toEqual([]);
  });

  it('refuses the whole request when a later slot is outside the rules', async () => {
    const res = await post(
      booking({
        preferredDate2: '2026-10-21',
        preferredTime2: '09:00',
        preferredDate3: '2026-10-24',
        preferredTime3: '09:00',
      }),
    );

    expect(res.status).toBe(400);
    const details = (await res.json()).details.join(' ');
    expect(details).toContain('Preferred slot 3');
    expect(details).toContain('not available on weekends');
    expect(storedConsultations()).toEqual([]);
    expect(submissionsCreate).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});

describe('in-person meetings', () => {
  it('stores an in-person booking at 08:30 and tells the client where to come', async () => {
    const res = await post(
      booking({
        name: 'Jane <script>alert(1)</script>',
        additionalNotes: '<img src=x onerror=alert(1)>',
      }),
    );

    expect(res.status).toBe(200);
    expect(storedConsultations()).toHaveLength(1);
    expect(storedConsultations()[0]).toMatchObject({
      meetingType: 'in_person',
      preferredTime1: '08:30',
      email: 'jane@example.com',
    });
    expect(submissionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'consultation',
        payload: expect.objectContaining({ meetingType: 'in_person', preferredTime: '08:30' }),
      }),
    );

    const client = sent.find((message) => message.to === 'jane@example.com');
    const staff = sent.find((message) => message.to === 'info@navigatewealth.co');
    expect(client?.html).toContain('In-Person Meeting (Pretoria office)');
    expect(client?.html).toContain('directions to our office at Route 21 Business Park, Pretoria');
    expect(client?.html).not.toContain('phone consultation');
    expect(client?.html).not.toContain('<script>');
    expect(client?.html).not.toContain('<img');
    expect(client?.html).toContain('&lt;script&gt;');
    expect(client?.html).toContain('&lt;img');
    expect(staff?.html).toContain('In-Person Meeting (Pretoria office)');
    expect(staff?.html).not.toContain('<script>');
    expect(staff?.subject).toContain('Jane <script>alert(1)</script>');
  });

  it('tells a phone booking it is a phone consultation', async () => {
    const res = await post(booking({ meetingType: 'telephonic' }));

    expect(res.status).toBe(200);
    const client = sent.find((message) => message.to === 'jane@example.com');
    expect(client?.html).toContain('Telephonic Meeting (Phone Call)');
    expect(client?.html).toContain('phone consultation');
    expect(client?.html).not.toContain('Route 21 Business Park');
  });

  it('refuses a meeting type outside virtual, telephonic, and in_person', async () => {
    const res = await post(booking({ meetingType: 'office' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors.meetingType.join(' ')).toContain('in_person');
    expect(storedConsultations()).toEqual([]);
    expect(submissionsCreate).not.toHaveBeenCalled();
  });

  it('answers success to a honeypot fill and keeps nothing', async () => {
    const res = await post(booking({ website: 'http://spam.example', preferredTime1: '08:00' }));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(storedConsultations()).toEqual([]);
    expect(submissionsCreate).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });
});
