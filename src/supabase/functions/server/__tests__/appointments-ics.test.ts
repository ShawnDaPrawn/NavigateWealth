/**
 * Appointment ICS generation tests
 * =================================
 *
 * Pure-function coverage for the RFC 5545 builder: text escaping, 75-octet
 * line folding, REQUEST/CANCEL structure, SEQUENCE propagation, and the
 * Google Calendar render link.
 *
 * Run:
 *   npx vitest run src/supabase/functions/server/__tests__/appointments-ics.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  buildAppointmentIcs,
  buildGoogleCalendarLink,
  escapeIcsText,
  foldIcsLine,
  formatIcsUtc,
  icsToBase64,
} from '../appointments-ics.ts';

const baseInput = {
  uid: 'abc-123@navigatewealth.co',
  sequence: 0,
  method: 'REQUEST' as const,
  start: new Date('2026-07-14T08:00:00.000Z'), // 10:00 SAST
  end: new Date('2026-07-14T09:00:00.000Z'),
  summary: 'Consultation — Jane Doe',
  description: 'Agenda: annual review',
  location: null,
  url: 'https://teams.microsoft.com/l/meetup-join/xyz',
  organizerName: 'Navigate Wealth',
  organizerEmail: 'info@navigatewealth.co',
  attendeeName: 'Jane Doe',
  attendeeEmail: 'jane@example.com',
};

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });
});

describe('formatIcsUtc', () => {
  it('formats in UTC basic form', () => {
    expect(formatIcsUtc(new Date('2026-07-14T08:05:09.000Z'))).toBe('20260714T080509Z');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:Short')).toBe('SUMMARY:Short');
  });

  it('folds long lines at 75 octets with a leading space on continuations', () => {
    const line = 'DESCRIPTION:' + 'x'.repeat(200);
    const folded = foldIcsLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].length).toBe(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true);
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    // Reassembling (strip continuation spaces) restores the original line
    expect(
      parts[0] +
        parts
          .slice(1)
          .map((p) => p.slice(1))
          .join(''),
    ).toBe(line);
  });

  it('folds on octet count so multi-byte characters never straddle the limit', () => {
    const line = 'DESCRIPTION:' + 'é'.repeat(100); // 2 octets each
    const folded = foldIcsLine(line);
    for (const part of folded.split('\r\n')) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
  });
});

/** Reverse RFC 5545 folding so assertions can match full logical lines. */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '');
}

describe('buildAppointmentIcs', () => {
  it('builds a REQUEST invite with UID, SEQUENCE, organizer and attendee', () => {
    const raw = buildAppointmentIcs(baseInput);
    const ics = unfold(raw);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('UID:abc-123@navigatewealth.co');
    expect(ics).toContain('SEQUENCE:0');
    expect(ics).toContain('DTSTART:20260714T080000Z');
    expect(ics).toContain('DTEND:20260714T090000Z');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('ORGANIZER;CN=Navigate Wealth:mailto:info@navigatewealth.co');
    expect(ics).toContain('mailto:jane@example.com');
    expect(ics).toContain('END:VCALENDAR');
    // Escaped em-dash summary text survives; comma-free here but semicolons escaped
    expect(ics).toContain('SUMMARY:Consultation — Jane Doe');
    // No physical line exceeds 75 octets in the raw (folded) output
    for (const line of raw.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    // CRLF line endings throughout
    expect(ics.includes('\n')).toBe(true);
    expect(ics.split('\n').every((l, i, arr) => i === arr.length - 1 || l.endsWith('\r'))).toBe(
      true,
    );
  });

  it('builds a CANCEL with CANCELLED status and bumped sequence', () => {
    const ics = buildAppointmentIcs({ ...baseInput, method: 'CANCEL', sequence: 2 });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SEQUENCE:2');
  });

  it('escapes commas and semicolons in text fields', () => {
    const ics = buildAppointmentIcs({
      ...baseInput,
      summary: 'Review; budget, estate',
      location: '25 Sovereign Dr, Irene',
      url: null,
    });
    expect(ics).toContain('SUMMARY:Review\\; budget\\, estate');
    expect(ics).toContain('LOCATION:25 Sovereign Dr\\, Irene');
  });
});

describe('buildGoogleCalendarLink', () => {
  it('produces a render TEMPLATE link with UTC date range', () => {
    const link = buildGoogleCalendarLink({
      title: 'Consultation',
      start: baseInput.start,
      end: baseInput.end,
      details: 'Join: https://example.com',
      location: 'Irene',
    });
    const url = new URL(link);
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Consultation');
    expect(url.searchParams.get('dates')).toBe('20260714T080000Z/20260714T090000Z');
    expect(url.searchParams.get('location')).toBe('Irene');
  });
});

describe('icsToBase64', () => {
  it('round-trips UTF-8 content', () => {
    const ics = 'SUMMARY:Café meeting é';
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(icsToBase64(ics)), (c) => c.charCodeAt(0)),
    );
    expect(decoded).toBe(ics);
  });
});
