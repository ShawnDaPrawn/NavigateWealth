/**
 * email-senders-appointments.ts — appointment booking lifecycle emails.
 * ============================================================================
 *
 * One sender per queue email type, following the email-senders-esign shape:
 * getEmailTemplate → resolve {{ .Var }} placeholders → createEmailTemplate →
 * sendEmail. The details card and actions row differ between virtual meetings
 * (join link) and in-person meetings (location + directions), composed here so
 * each email type keeps a single KV-editable template.
 *
 * Testing: set APPOINTMENTS_TEST_RECIPIENT to redirect every appointment email
 * to that address with a "[TEST]" subject prefix (real templates, no client
 * spam).
 */
import { createModuleLogger } from './stderr-logger.ts';
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
  getEmailTemplate,
} from './email-core.ts';
import { buildAppointmentIcs, buildGoogleCalendarLink, icsToBase64 } from './appointments-ics.ts';

const log = createModuleLogger('email-senders-appointments');

const ORGANIZER_NAME = 'Navigate Wealth';
const ORGANIZER_EMAIL = 'info@navigatewealth.co';

export type AppointmentClientEmailType =
  | 'confirmation'
  | 'day_before'
  | 'morning_of'
  | 'starting_soon'
  | 'rescheduled'
  | 'cancelled';

const TEMPLATE_BY_TYPE: Record<AppointmentClientEmailType, string> = {
  confirmation: 'appointment_confirmation',
  day_before: 'appointment_reminder_day_before',
  morning_of: 'appointment_reminder_morning',
  starting_soon: 'appointment_starting_soon',
  rescheduled: 'appointment_rescheduled',
  cancelled: 'appointment_cancelled',
};

/** Types that carry an ICS attachment (calendar add / replace / remove). */
const ICS_TYPES: ReadonlySet<AppointmentClientEmailType> = new Set([
  'confirmation',
  'rescheduled',
  'cancelled',
]);

export interface AppointmentEmailPayload {
  to: string;
  clientName: string;
  advisorName: string;
  title: string;
  /** ISO datetimes (UTC) */
  startAt: string;
  endAt: string;
  meetingKind: 'virtual' | 'in_person' | 'phone';
  joinUrl?: string | null;
  location?: string | null;
  description?: string | null;
  /** Public manage page: https://<site>/appointment?token=... */
  manageUrl: string;
  /** ICS identity — required for confirmation/rescheduled/cancelled */
  icsUid: string;
  icsSequence: number;
}

// ── SAST formatting (South Africa is fixed UTC+2, no DST) ────────────────────

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatSastDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + SAST_OFFSET_MS);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatSastTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + SAST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// ── Test-mode redirect ───────────────────────────────────────────────────────

function applyTestOverride(to: string, subject: string): { to: string; subject: string } {
  const testRecipient = Deno.env.get('APPOINTMENTS_TEST_RECIPIENT') || '';
  if (!testRecipient) return { to, subject };
  return { to: testRecipient, subject: `[TEST → ${to}] ${subject}` };
}

// ── HTML block composition ───────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function googleMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

function buildDetailsBlock(payload: AppointmentEmailPayload): string {
  const rows: string[] = [
    `<p style="margin: 5px 0;"><strong>Date:</strong> ${formatSastDate(payload.startAt)}</p>`,
    `<p style="margin: 5px 0;"><strong>Time:</strong> ${formatSastTime(payload.startAt)} – ${formatSastTime(payload.endAt)} (SAST)</p>`,
  ];

  if (payload.meetingKind === 'virtual') {
    rows.push(
      payload.joinUrl
        ? `<p style="margin: 5px 0;"><strong>Where:</strong> Online — <a href="${payload.joinUrl}" style="color: #6d28d9;">join the meeting</a></p>`
        : '<p style="margin: 5px 0;"><strong>Where:</strong> Online — a meeting link will be shared before the appointment</p>',
    );
  } else if (payload.meetingKind === 'in_person') {
    const location = payload.location || 'Our offices';
    rows.push(
      `<p style="margin: 5px 0;"><strong>Where:</strong> ${escapeHtml(location)} (<a href="${googleMapsUrl(location)}" style="color: #6d28d9;">directions</a>)</p>`,
    );
  } else {
    rows.push(
      '<p style="margin: 5px 0;"><strong>Where:</strong> Phone call — we will call you at the scheduled time</p>',
    );
  }

  if (payload.description) {
    rows.push(`<p style="margin: 5px 0;">${escapeHtml(payload.description)}</p>`);
  }

  return (
    '<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">' +
    `<h3 style="margin-top: 0; color: #111827;">${escapeHtml(payload.title)}</h3>` +
    rows.join('') +
    '</div>'
  );
}

function buildActionsBlock(payload: AppointmentEmailPayload): string {
  const googleLink = buildGoogleCalendarLink({
    title: payload.title,
    start: new Date(payload.startAt),
    end: new Date(payload.endAt),
    details: payload.joinUrl
      ? `Join: ${payload.joinUrl}\nManage: ${payload.manageUrl}`
      : `Manage: ${payload.manageUrl}`,
    location: payload.meetingKind === 'virtual' ? payload.joinUrl : payload.location,
  });

  const linkStyle = 'color: #6d28d9; text-decoration: underline;';
  return (
    '<p style="margin: 16px 0; text-align: center; font-size: 14px;">' +
    `<a href="${googleLink}" style="${linkStyle}">Add to Google Calendar</a>` +
    ' &nbsp;·&nbsp; ' +
    `<a href="${payload.manageUrl}" style="${linkStyle}">Reschedule</a>` +
    ' &nbsp;·&nbsp; ' +
    `<a href="${payload.manageUrl}&action=cancel" style="${linkStyle}">Cancel</a>` +
    '</p>'
  );
}

/** Hero button varies by meeting kind and email type. */
function buildPrimaryAction(payload: AppointmentEmailPayload): { label: string; url: string } {
  if (payload.meetingKind === 'virtual' && payload.joinUrl) {
    return { label: 'Join meeting', url: payload.joinUrl };
  }
  if (payload.meetingKind === 'in_person' && payload.location) {
    return { label: 'Get directions', url: googleMapsUrl(payload.location) };
  }
  return { label: 'Manage appointment', url: payload.manageUrl };
}

// ── Senders ──────────────────────────────────────────────────────────────────

/**
 * Send one of the client-facing lifecycle emails. Returns true on success or
 * when the template is disabled (a deliberate skip is not a failure).
 */
export async function sendAppointmentClientEmail(
  emailType: AppointmentClientEmailType,
  payload: AppointmentEmailPayload,
): Promise<boolean> {
  const template = await getEmailTemplate(TEMPLATE_BY_TYPE[emailType]);
  if (!template.enabled) {
    log.info('Appointment email disabled, skipping send', { emailType, to: payload.to });
    return true;
  }

  const footerSettings = await getFooterSettings();
  const detailsBlock = emailType === 'cancelled' ? '' : buildDetailsBlock(payload);
  const actionsBlock = emailType === 'cancelled' ? '' : buildActionsBlock(payload);
  const primary = buildPrimaryAction(payload);
  const eventDate = formatSastDate(payload.startAt);
  const eventTime = formatSastTime(payload.startAt);

  const resolve = (text: string) =>
    text
      .replace(/\{\{ \.ClientName \}\}/g, escapeHtml(payload.clientName))
      .replace(/\{\{ \.AdvisorName \}\}/g, escapeHtml(payload.advisorName))
      .replace(/\{\{ \.EventTitle \}\}/g, escapeHtml(payload.title))
      .replace(/\{\{ \.EventDate \}\}/g, eventDate)
      .replace(/\{\{ \.EventTime \}\}/g, eventTime)
      .replace(/\{\{ \.DetailsBlock \}\}/g, detailsBlock)
      .replace(/\{\{ \.ActionsBlock \}\}/g, actionsBlock)
      .replace(/\{\{ \.PrimaryLabel \}\}/g, primary.label)
      .replace(/\{\{ \.PrimaryUrl \}\}/g, primary.url);

  const buttonLabel = resolve(template.buttonLabel);
  const buttonUrl = resolve(template.buttonUrl);

  const html = createEmailTemplate(resolve(template.bodyHtml), {
    title: resolve(template.title),
    subtitle: resolve(template.subtitle),
    greeting: resolve(template.greeting),
    // Cancelled email has no button (template fields are empty strings)
    buttonUrl: buttonUrl || undefined,
    buttonLabel: buttonLabel || undefined,
    footerNote: resolve(template.footerNote),
    footerSettings,
  });

  const whereLine =
    payload.meetingKind === 'virtual'
      ? `Join: ${payload.joinUrl || 'link to follow'}`
      : payload.meetingKind === 'in_person'
        ? `Location: ${payload.location || 'Our offices'}`
        : 'Phone call — we will call you at the scheduled time';

  const text = `
${resolve(template.greeting)}

${payload.title}
Date: ${eventDate}
Time: ${eventTime} (SAST)
${whereLine}

Manage (reschedule or cancel): ${payload.manageUrl}
  `.trim();

  const attachments = ICS_TYPES.has(emailType)
    ? [
        {
          content: icsToBase64(
            buildAppointmentIcs({
              uid: payload.icsUid,
              sequence: payload.icsSequence,
              method: emailType === 'cancelled' ? 'CANCEL' : 'REQUEST',
              start: new Date(payload.startAt),
              end: new Date(payload.endAt),
              summary: payload.title,
              description: [
                payload.description,
                payload.joinUrl ? `Join: ${payload.joinUrl}` : null,
                `Manage: ${payload.manageUrl}`,
              ]
                .filter(Boolean)
                .join('\n'),
              location: payload.meetingKind === 'virtual' ? payload.joinUrl : payload.location,
              url: payload.joinUrl,
              organizerName: ORGANIZER_NAME,
              organizerEmail: ORGANIZER_EMAIL,
              attendeeName: payload.clientName,
              attendeeEmail: payload.to,
            }),
          ),
          filename: 'appointment.ics',
          type: `text/calendar; method=${emailType === 'cancelled' ? 'CANCEL' : 'REQUEST'}`,
          disposition: 'attachment',
        },
      ]
    : undefined;

  const { to, subject } = applyTestOverride(payload.to, resolve(template.subject));
  return await sendEmail({ to, subject, html, text, attachments });
}

/**
 * Notify the advisor that a client requested a reschedule (or cancelled) from
 * the public manage page.
 */
export async function sendRescheduleRequestedAdvisorEmail(params: {
  to: string;
  clientName: string;
  title: string;
  startAt: string;
  proposedTimes: Array<{ start_at: string; end_at: string }>;
  note?: string | null;
}): Promise<boolean> {
  const template = await getEmailTemplate('appointment_reschedule_requested');
  if (!template.enabled) {
    log.info('Advisor reschedule-request email disabled, skipping send', { to: params.to });
    return true;
  }

  const footerSettings = await getFooterSettings();
  const eventDate = formatSastDate(params.startAt);
  const eventTime = formatSastTime(params.startAt);

  const proposedRows = params.proposedTimes
    .map(
      (t) =>
        `<p style="margin: 5px 0;">• ${formatSastDate(t.start_at)}, ${formatSastTime(t.start_at)} – ${formatSastTime(t.end_at)} (SAST)</p>`,
    )
    .join('');
  const detailsBlock =
    '<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">' +
    '<h3 style="margin-top: 0; color: #111827;">Proposed times</h3>' +
    (proposedRows || '<p style="margin: 5px 0;">No specific times proposed.</p>') +
    (params.note
      ? `<p style="margin: 12px 0 0 0;"><strong>Note from client:</strong> ${escapeHtml(params.note)}</p>`
      : '') +
    '</div>';

  const resolve = (text: string) =>
    text
      .replace(/\{\{ \.ClientName \}\}/g, escapeHtml(params.clientName))
      .replace(/\{\{ \.EventTitle \}\}/g, escapeHtml(params.title))
      .replace(/\{\{ \.EventDate \}\}/g, eventDate)
      .replace(/\{\{ \.EventTime \}\}/g, eventTime)
      .replace(/\{\{ \.DetailsBlock \}\}/g, detailsBlock);

  const html = createEmailTemplate(resolve(template.bodyHtml), {
    title: resolve(template.title),
    subtitle: resolve(template.subtitle),
    greeting: resolve(template.greeting),
    buttonUrl: resolve(template.buttonUrl),
    buttonLabel: resolve(template.buttonLabel),
    footerNote: resolve(template.footerNote),
    footerSettings,
  });

  const text = `
${params.clientName} has requested to reschedule "${params.title}" (currently ${eventDate} at ${eventTime}).

Proposed times:
${params.proposedTimes.map((t) => `- ${formatSastDate(t.start_at)}, ${formatSastTime(t.start_at)} – ${formatSastTime(t.end_at)} (SAST)`).join('\n') || '- none given'}
${params.note ? `\nNote from client: ${params.note}` : ''}

Open the calendar to rebook — the client will automatically receive a new confirmation.
  `.trim();

  const { to, subject } = applyTestOverride(params.to, resolve(template.subject));
  return await sendEmail({ to, subject, html, text });
}

/**
 * Notify the advisor that a client cancelled from the public manage page.
 * Direct-composed (no KV template) like sendEsignReminder — it's an internal
 * operational notice, not client-facing communication.
 */
export async function sendAppointmentCancelledAdvisorEmail(params: {
  to: string;
  clientName: string;
  title: string;
  startAt: string;
  reason?: string | null;
}): Promise<boolean> {
  const footerSettings = await getFooterSettings();
  const eventDate = formatSastDate(params.startAt);
  const eventTime = formatSastTime(params.startAt);

  const html = createEmailTemplate(
    `
      <p><strong>${escapeHtml(params.clientName)}</strong> has cancelled the appointment <strong>${escapeHtml(params.title)}</strong> scheduled for ${eventDate} at ${eventTime} (SAST).</p>
      ${params.reason ? `<p><strong>Reason given:</strong> ${escapeHtml(params.reason)}</p>` : ''}
      <p>All pending reminder emails for this appointment have been stopped.</p>
    `,
    {
      title: 'Appointment Cancelled by Client',
      buttonUrl: 'https://www.navigatewealth.co/admin',
      buttonLabel: 'Open Calendar',
      footerSettings,
    },
  );

  const text = `
${params.clientName} has cancelled the appointment "${params.title}" scheduled for ${eventDate} at ${eventTime} (SAST).
${params.reason ? `\nReason given: ${params.reason}` : ''}

All pending reminder emails for this appointment have been stopped.
  `.trim();

  const { to, subject } = applyTestOverride(
    params.to,
    `Cancelled by client: ${params.title} — ${params.clientName}`,
  );
  return await sendEmail({ to, subject, html, text });
}
