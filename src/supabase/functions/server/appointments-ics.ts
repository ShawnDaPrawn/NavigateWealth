/**
 * Appointment Booking — ICS (iCalendar) generation
 *
 * Dependency-free RFC 5545 builder for the appointment lifecycle emails:
 *   • METHOD:REQUEST on confirmation / reschedule (SEQUENCE bumped so calendar
 *     clients replace the existing entry instead of duplicating it)
 *   • METHOD:CANCEL on cancellation
 *
 * Times are emitted in UTC "Z" form rather than with a VTIMEZONE block —
 * South Africa has no DST, so there are no local rules worth preserving, and
 * UTC renders correctly in Gmail, Outlook and Apple Calendar.
 */

export interface IcsAppointmentInput {
  /** Stable per-appointment UID, e.g. `<appointment_id>@navigatewealth.co` */
  uid: string;
  /** Increments on every reschedule */
  sequence: number;
  method: 'REQUEST' | 'CANCEL';
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Join link — also emitted as the VEVENT URL property */
  url?: string | null;
  organizerName: string;
  organizerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
}

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** UTC basic format: YYYYMMDDTHHMMSSZ */
export function formatIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

const encoder = new TextEncoder();

/**
 * RFC 5545 §3.1 line folding: content lines must not exceed 75 octets;
 * continuations begin with a single space. Folds on octet count (not char
 * count) so multi-byte UTF-8 never straddles the limit.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let currentOctets = 0;
  // First line gets 75 octets, continuations get 74 (leading space costs one).
  let limit = 75;

  for (const char of line) {
    const charOctets = encoder.encode(char).length;
    if (currentOctets + charOctets > limit) {
      out.push(current);
      current = '';
      currentOctets = 0;
      limit = 74;
    }
    current += char;
    currentOctets += charOctets;
  }
  if (current) out.push(current);

  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join('\r\n');
}

export function buildAppointmentIcs(input: IcsAppointmentInput): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Navigate Wealth//Appointments//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${input.method}`,
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(input.start)}`,
    `DTEND:${formatIcsUtc(input.end)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
  ];

  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  if (input.url) {
    lines.push(`URL:${input.url}`);
  }

  lines.push(
    `STATUS:${input.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    `ORGANIZER;CN=${escapeIcsText(input.organizerName)}:mailto:${input.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsText(input.attendeeName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  );

  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export interface GoogleCalendarLinkInput {
  title: string;
  start: Date;
  end: Date;
  details?: string | null;
  location?: string | null;
}

/** "Add to Google Calendar" render link (Calendly-style secondary action). */
export function buildGoogleCalendarLink(input: GoogleCalendarLinkInput): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${formatIcsUtc(input.start)}/${formatIcsUtc(input.end)}`,
  });
  if (input.details) params.set('details', input.details);
  if (input.location) params.set('location', input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Base64 for SendGrid attachment content (UTF-8 safe, Deno + Node). */
export function icsToBase64(ics: string): string {
  const bytes = encoder.encode(ics);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
