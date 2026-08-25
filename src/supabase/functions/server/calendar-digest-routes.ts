/**
 * ****************************************************************************
 * CALENDAR DAILY DIGEST ROUTES
 * ****************************************************************************
 *
 * VERSION: 1.0.0
 *
 * Sends a daily calendar digest email each weekday morning at 06:00 SAST.
 * Lists all calendar events for the current day.
 *
 * Endpoint:
 *   POST /calendar-digest/send-daily
 *
 * Auth: requireCronAuth from cron-auth.ts — the Vault-backed shared token
 *   scheduled jobs send, with the service-role/super-admin env comparison
 *   kept as a fallback for manual runs. The local copy of this guard was
 *   removed on 2026-08-25: it compared against SUPABASE_SERVICE_ROLE_KEY
 *   only, and had been answering 401 to its own cron job silently.
 *       via the Authorization Bearer header (cron / server-to-server only).
 *
 * ****************************************************************************
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { asyncHandler } from './error.middleware.ts';
import { requireCronAuth } from './cron-auth.ts';
import { getAllClients } from './communication-business-logic.ts';
import type { CommunicationClient, SupabaseAdminClient } from './communication-types.ts';
import { sendEmail, createEmailTemplate, getFooterSettings } from './email-service.tsx';

const app = new Hono();
const log = createModuleLogger('calendar-digest');

const ADMIN_EMAIL = 'info@navigatewealth.co';

// ---------------------------------------------------------------------------
// Supabase client — service role for reading across all users
// ---------------------------------------------------------------------------

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Johannesburg',
    });
  } catch {
    return isoStr;
  }
}

/** Map event_type to a human label. */
const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  review: 'Review',
  call: 'Call',
  webinar: 'Webinar',
  internal: 'Internal',
  consultation: 'Consultation',
  deadline: 'Deadline',
  other: 'Other',
};

/** Map event_type to badge colours for the email. */
const EVENT_TYPE_COLOURS: Record<string, { bg: string; text: string }> = {
  meeting: { bg: '#6d28d9', text: '#ffffff' },
  review: { bg: '#2563eb', text: '#ffffff' },
  call: { bg: '#059669', text: '#ffffff' },
  webinar: { bg: '#d97706', text: '#ffffff' },
  internal: { bg: '#6b7280', text: '#ffffff' },
  consultation: { bg: '#7c3aed', text: '#ffffff' },
  deadline: { bg: '#dc2626', text: '#ffffff' },
  other: { bg: '#9ca3af', text: '#ffffff' },
};

// ---------------------------------------------------------------------------
// POST /calendar-digest/send-daily
// ---------------------------------------------------------------------------

app.post(
  '/send-daily',
  requireCronAuth,
  asyncHandler(async (c) => {
    log.info('=== Daily Calendar Digest: Starting ===');

    // 1. Determine today's boundaries in SAST (UTC+2)
    const now = new Date();
    const sastOffset = 2 * 60 * 60 * 1000;
    const sastNow = new Date(now.getTime() + sastOffset);
    const todayStart = new Date(
      Date.UTC(sastNow.getUTCFullYear(), sastNow.getUTCMonth(), sastNow.getUTCDate(), 0, 0, 0, 0),
    );
    // Convert back to UTC for the DB query
    const dayStartUtc = new Date(todayStart.getTime() - sastOffset);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    log.info(`Querying events between ${dayStartUtc.toISOString()} and ${dayEndUtc.toISOString()}`);

    // 2. Query all events for today across all users
    const { data: events, error } = await getSupabase()
      .from('events')
      .select('*, client:clients(id, full_name, email)')
      .gte('start_at', dayStartUtc.toISOString())
      .lt('start_at', dayEndUtc.toISOString())
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true });

    if (error) {
      log.error('Failed to query calendar events', error);
      return c.json({ success: false, error: `DB query failed: ${error.message}` }, 500);
    }

    const todayFormatted = new Date().toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Johannesburg',
    });

    if (!events || events.length === 0) {
      log.info("No calendar events for today — sending 'clear day' email");

      const footerSettings = await getFooterSettings();
      const html = createEmailTemplate(
        `<p>You have <strong>no events</strong> scheduled for today.</p>
         <p style="font-size: 13px; color: #6b7280; margin-top: 12px;">
           Enjoy the free time — or use it to catch up on pending tasks.
         </p>`,
        {
          title: 'Daily Calendar',
          subtitle: todayFormatted,
          greeting: 'Good morning,',
          buttonUrl: 'https://www.navigatewealth.co/admin/calendar',
          buttonLabel: 'Open Calendar',
          footerNote: 'This is an automated daily digest from Navigate Wealth.',
          footerSettings,
        },
      );

      const sent = await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Daily Calendar — ${todayFormatted} (No events)`,
        html,
        text: `Daily Calendar — ${todayFormatted}\n\nNo events scheduled for today.\n\nOpen calendar: https://www.navigatewealth.co/admin/calendar`,
      });

      return c.json({ success: true, sent, event_count: 0 });
    }

    log.info(`Found ${events.length} event(s) for today — building digest`);

    // 3. Build event table rows
    const eventRows = events
      .map((evt: Record<string, unknown>) => {
        const eventType = (evt.event_type as string) || 'other';
        const typeLabel = EVENT_TYPE_LABELS[eventType] || 'Other';
        const typeColour = EVENT_TYPE_COLOURS[eventType] || EVENT_TYPE_COLOURS.other;
        const timeStr = `${formatTime(evt.start_at as string)} – ${formatTime(evt.end_at as string)}`;
        const clientName = (evt.client as Record<string, unknown>)?.full_name || '—';
        const location = (evt.location as string) || (evt.video_link as string) || '—';

        return `
          <tr>
            <td style="padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 3px;">
                ${evt.title}
              </div>
              ${evt.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${(evt.description as string).substring(0, 80)}${(evt.description as string).length > 80 ? '…' : ''}</div>` : ''}
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top;">
              <span style="
                display: inline-block;
                padding: 2px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                background-color: ${typeColour.bg};
                color: ${typeColour.text};
              ">${typeLabel}</span>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top; white-space: nowrap;">
              <div style="font-size: 13px; color: #374151; font-weight: 600;">${timeStr}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-size: 13px; color: #374151;">${clientName}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-size: 12px; color: #6b7280;">${location}</div>
            </td>
          </tr>`;
      })
      .join('');

    // 4. Summary by event type
    const typeCounts: Record<string, number> = {};
    for (const evt of events) {
      const t = (evt.event_type as string) || 'other';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    const summaryBadges = Object.entries(typeCounts)
      .map(([type, count]) => {
        const colour = EVENT_TYPE_COLOURS[type] || EVENT_TYPE_COLOURS.other;
        const label = EVENT_TYPE_LABELS[type] || 'Other';
        return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:${colour.bg}20;color:${colour.bg};margin-right:6px;margin-bottom:4px;">${label}: ${count}</span>`;
      })
      .join('');

    // 5. Compose body HTML
    const bodyHtml = `
      <p style="margin-bottom: 16px;">
        You have <strong style="color: #6d28d9;">${events.length}</strong> event${events.length !== 1 ? 's' : ''} scheduled for today.
      </p>

      <!-- Type Summary -->
      <div style="margin-bottom: 20px;">
        ${summaryBadges}
      </div>

      <!-- Events Table -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        border-collapse: separate;
        overflow: hidden;
        margin-bottom: 20px;
      ">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Event
            </th>
            <th style="padding: 10px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Type
            </th>
            <th style="padding: 10px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Time
            </th>
            <th style="padding: 10px 10px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Client
            </th>
            <th style="padding: 10px 10px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Location
            </th>
          </tr>
        </thead>
        <tbody>
          ${eventRows}
        </tbody>
      </table>

      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">
        Have a productive day!
      </p>
    `;

    // 6. Build full email
    const footerSettings = await getFooterSettings();

    const html = createEmailTemplate(bodyHtml, {
      title: 'Daily Calendar',
      subtitle: todayFormatted,
      greeting: 'Good morning,',
      buttonUrl: 'https://www.navigatewealth.co/admin/calendar',
      buttonLabel: 'Open Calendar',
      footerNote: 'This is an automated daily digest from Navigate Wealth.',
      footerSettings,
    });

    // 7. Plain-text fallback
    const eventLines = events
      .map((evt: Record<string, unknown>, i: number) => {
        const timeStr = `${formatTime(evt.start_at as string)} – ${formatTime(evt.end_at as string)}`;
        const typeLabel = EVENT_TYPE_LABELS[(evt.event_type as string) || 'other'] || 'Other';
        return `  ${i + 1}. [${typeLabel}] ${evt.title} — ${timeStr}`;
      })
      .join('\n');

    const text = `
Daily Calendar — ${todayFormatted}

Good morning,

You have ${events.length} event(s) scheduled for today:

${eventLines}

Open calendar: https://www.navigatewealth.co/admin/calendar

—
This is an automated daily digest from Navigate Wealth.
    `.trim();

    // 8. Send
    const sent = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Daily Calendar (${events.length}) — ${todayFormatted}`,
      html,
      text,
    });

    log.info(`Calendar digest email ${sent ? 'sent' : 'FAILED'} to ${ADMIN_EMAIL}`);

    return c.json({
      success: true,
      sent,
      event_count: events.length,
      by_type: typeCounts,
    });
  }),
);

/**
 * Birth date, from either profile shape.
 *
 * There are two, and reading only one silently loses whole cohorts:
 *   - Admin-entered profiles nest under `personalInformation`, which is what
 *     `getAllClients` maps to `client.dateOfBirth`.
 *   - Profiles built by `buildClientProfileFromApplication` (every self-service
 *     client approved through the application flow) are FLAT — `dateOfBirth`
 *     sits at the profile root and there is no `personalInformation` object at
 *     all, so `client.dateOfBirth` is undefined for all of them.
 *
 * `advice-engine-service.ts` already reads `profile.dateOfBirth || profile.date_of_birth`
 * for the same reason. Caught in review of #232; the first version of this route
 * read only the nested value and would have reported a quiet day for an entire
 * client population.
 */
function resolveDateOfBirth(client: CommunicationClient): string | undefined {
  if (client.dateOfBirth) return client.dateOfBirth;

  const profile = (client.profile || {}) as Record<string, unknown>;
  const root = (profile.dateOfBirth ?? profile.date_of_birth) as unknown;
  if (typeof root === 'string' && root) return root;

  const nested = (profile.personalInformation as Record<string, unknown> | undefined)
    ?.dateOfBirth as unknown;
  return typeof nested === 'string' && nested ? nested : undefined;
}

/**
 * Marketing consent, read from where it is actually stored.
 *
 * Deliberately does NOT use `client.hasEmailOptIn`: `getAllClients` hard-codes
 * that field to `true` for every client, and nothing else in the codebase reads
 * it. Reporting treats `_applicationMeta.communicationConsent === true` as the
 * marketing-consent flag (reporting-service-audits.ts, reporting-service-clients.ts),
 * so this matches that.
 *
 * This mattered: the first version of this route rendered the hard-coded flag,
 * so every row read "Email OK" — telling the advisor they could mail clients who
 * had declined consent.
 */
function resolveMarketingConsent(client: CommunicationClient): boolean {
  const profile = (client.profile || {}) as Record<string, unknown>;
  const meta = (profile._applicationMeta || {}) as Record<string, unknown>;
  return meta.communicationConsent === true;
}

// ---------------------------------------------------------------------------
// POST /calendar-digest/send-birthdays
// ---------------------------------------------------------------------------

/**
 * Client birthday digest — a summary TO THE ADVISOR, not a greeting to clients.
 *
 * Scheduled by `client-birthday-digest` (weekdays 05:00 UTC). That job had been
 * answering 404 since it was created: this route did not exist. Nothing
 * reported it, because pg_cron marks net.http_post succeeded as soon as the
 * request is enqueued (docs/runbooks/scheduled-jobs.md).
 *
 * WHERE THE DATA COMES FROM, AND WHY NOT THE OBVIOUS PLACES:
 *   - `public.clients` has a `date_of_birth` column and is EMPTY (0 rows on
 *     2026-08-25). Client records live in KV.
 *   - `birthday` is not a member of the `event_type` enum, so despite the
 *     frontend type offering it, no birthday has ever been storable as a
 *     calendar event.
 *   So this derives from `dateOfBirth` on the KV client profile, read through
 *   `getAllClients` — which already excludes soft-deleted and suspended clients,
 *   so a closed account can never surface in the digest.
 *
 * TWO DELIBERATE DIVERGENCES FROM `send-daily`:
 *   1. On a day with no birthdays this sends NOTHING and returns
 *      `{ sent: false, reason: 'no_birthdays' }`. `send-daily` emails a "clear
 *      day" note, which is reasonable for a calendar you check every morning;
 *      a daily "no birthdays today" mail is just noise.
 *   2. It reports each client's MARKETING CONSENT rather than filtering on it.
 *      The recipient is the advisor, so opt-in does not gate delivery — but the
 *      advisor needs to know whether they may actually mail that client back.
 *
 * KNOWN GAP: 29 February birthdays do not match in non-leap years. Left as an
 * explicit gap rather than silently rounding to the 28th or the 1st, which is a
 * product decision, not a technical one.
 */
app.post(
  '/send-birthdays',
  requireCronAuth,
  asyncHandler(async (c) => {
    log.info('=== Client Birthday Digest: Starting ===');

    // Today in SAST (UTC+2), matching send-daily's handling.
    const sastNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const todayMonth = sastNow.getUTCMonth() + 1;
    const todayDay = sastNow.getUTCDate();
    const todayYear = sastNow.getUTCFullYear();

    const todayFormatted = new Date().toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Johannesburg',
    });

    let clients: CommunicationClient[];
    try {
      clients = await getAllClients(getSupabase() as unknown as SupabaseAdminClient);
    } catch (error) {
      log.error('Failed to load clients for the birthday digest', error);
      return c.json({ success: false, error: 'Could not load clients' }, 500);
    }

    const birthdays = clients
      .filter((client) => {
        const raw = resolveDateOfBirth(client);
        if (!raw) return false;
        const dob = new Date(raw);
        if (Number.isNaN(dob.getTime())) return false;
        return dob.getUTCMonth() + 1 === todayMonth && dob.getUTCDate() === todayDay;
      })
      .map((client) => {
        const dob = new Date(resolveDateOfBirth(client) as string);
        const name = [client.firstName, client.lastName].filter(Boolean).join(' ') || client.email;
        return {
          name,
          email: client.email,
          turning: todayYear - dob.getUTCFullYear(),
          marketingConsent: resolveMarketingConsent(client),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (birthdays.length === 0) {
      log.info('No client birthdays today — sending nothing');
      return c.json({ success: true, sent: false, reason: 'no_birthdays', birthday_count: 0 });
    }

    log.info(`Found ${birthdays.length} client birthday(s) today — building digest`);

    const rows = birthdays
      .map(
        (b) => `
          <tr>
            <td style="padding: 12px 14px; border-bottom: 1px solid #f3f4f6;">
              <div style="font-weight: 600; color: #111827; font-size: 14px;">${b.name}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${b.email}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; white-space: nowrap;">
              <div style="font-size: 13px; color: #374151; font-weight: 600;">Turning ${b.turning}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center;">
              <span style="
                display: inline-block;
                padding: 2px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                background-color: ${b.marketingConsent ? '#059669' : '#9ca3af'};
                color: #ffffff;
              ">${b.marketingConsent ? 'Marketing consent' : 'No marketing consent'}</span>
            </td>
          </tr>`,
      )
      .join('');

    const footerSettings = await getFooterSettings();
    const html = createEmailTemplate(
      `<p><strong>${birthdays.length}</strong> client${birthdays.length === 1 ? '' : 's'} celebrating a birthday today.</p>
       <table style="width: 100%; border-collapse: collapse; margin-top: 14px;">
         <thead>
           <tr>
             <th style="padding: 8px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Client</th>
             <th style="padding: 8px 10px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Age</th>
             <th style="padding: 8px 10px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Consent</th>
           </tr>
         </thead>
         <tbody>${rows}</tbody>
       </table>
       <p style="font-size: 13px; color: #6b7280; margin-top: 14px;">
         Clients marked <em>No marketing consent</em> have not consented to
         marketing email — reach them by phone instead.
       </p>`,
      {
        title: 'Client Birthdays',
        subtitle: todayFormatted,
        greeting: 'Good morning,',
        buttonUrl: 'https://www.navigatewealth.co/admin/clients',
        buttonLabel: 'Open Clients',
        footerNote: 'This is an automated birthday digest from Navigate Wealth.',
        footerSettings,
      },
    );

    const plain = birthdays
      .map(
        (b) =>
          `- ${b.name} (turning ${b.turning}) — ${b.email}${b.marketingConsent ? '' : ' [no marketing consent]'}`,
      )
      .join('\n');

    const sent = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Client Birthdays — ${todayFormatted} (${birthdays.length})`,
      html,
      text: `Client Birthdays — ${todayFormatted}\n\n${plain}\n\nOpen clients: https://www.navigatewealth.co/admin/clients`,
    });

    log.info(`Birthday digest sent=${sent} for ${birthdays.length} client(s)`);
    return c.json({ success: true, sent, birthday_count: birthdays.length });
  }),
);

export default app;
