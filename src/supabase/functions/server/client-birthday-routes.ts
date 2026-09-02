/**
 * ****************************************************************************
 * CLIENT BIRTHDAY GREETINGS
 * ****************************************************************************
 *
 * Sends a birthday greeting TO THE CLIENT. This is the counterpart to
 * `calendar-digest/send-birthdays`, which sends a summary to the advisor and
 * mails no client at all.
 *
 * Endpoint:
 *   POST /client-birthdays/send-greetings
 *
 * Auth: requireCronAuth — the Vault-backed shared token scheduled jobs send.
 *
 * CONSENT IS A HARD GATE. Unlike the advisor digest, which merely *reports*
 * marketing consent, nothing is sent here without
 * `_applicationMeta.communicationConsent === true`. A client who has not
 * consented is skipped and counted, never mailed.
 *
 * A second gate: anyone who has unsubscribed through the newsletter page is
 * skipped too, matched on email. That is the same list the newsletter audience
 * builder honours (`newsletter-studio-service.ts`), so the Unsubscribe link in
 * the footer genuinely switches these off rather than being decorative.
 *
 * TWO DIVERGENCES FROM THE ADVISOR DIGEST, both deliberate:
 *   1. Runs every day, not weekdays only. The digest is a work-planning tool,
 *      so weekends are noise; a birthday on a Saturday is still a birthday.
 *   2. 29 February birthdays are greeted on 28 February in non-leap years.
 *      The digest documents that gap and leaves it, because rounding a date of
 *      birth in an advisor-facing report would misstate an age. Here the date
 *      is not shown to anyone, so silence every fourth year is the worse
 *      outcome.
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
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
  getEmailTemplate,
  createPlainTextEmail,
} from './email-service.tsx';
import { listSubscribers } from './newsletter-service.ts';

const app = new Hono();
const log = createModuleLogger('client-birthdays');

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Date of birth, read from every shape it is stored in.
 *
 * `getAllClients` maps `personalInformation.dateOfBirth` to `client.dateOfBirth`
 * and drops the other two, so the profile fallbacks below are not redundant —
 * they are the only way to see a date carried at the profile root.
 */
export function resolveDateOfBirth(client: CommunicationClient): string | undefined {
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
 * that to `true` for every client, so gating on it would mail everybody.
 */
export function hasMarketingConsent(client: CommunicationClient): boolean {
  const profile = (client.profile || {}) as Record<string, unknown>;
  const meta = (profile._applicationMeta || {}) as Record<string, unknown>;
  return meta.communicationConsent === true;
}

/**
 * Does this date of birth fall on the given SAST day?
 *
 * Returns false for anything unparseable rather than throwing, so one bad
 * profile cannot stop the whole run.
 */
export function isBirthdayOn(
  rawDob: string | undefined,
  month: number,
  day: number,
  year: number,
): boolean {
  if (!rawDob) return false;
  const dob = new Date(rawDob);
  if (Number.isNaN(dob.getTime())) return false;

  const dobMonth = dob.getUTCMonth() + 1;
  const dobDay = dob.getUTCDate();

  if (dobMonth === month && dobDay === day) return true;

  // 29 February in a non-leap year — greet on the 28th.
  if (dobMonth === 2 && dobDay === 29 && month === 2 && day === 28) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return !isLeapYear;
  }

  return false;
}

/**
 * Flatten the template's body HTML into readable plain text.
 *
 * The plain-text part is derived rather than written twice: the copy is
 * editable in the admin template UI, and a hand-maintained second copy would
 * silently drift from whatever the advisor actually saved.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// POST /client-birthdays/send-greetings
// ---------------------------------------------------------------------------

app.post(
  '/send-greetings',
  requireCronAuth,
  asyncHandler(async (c) => {
    log.info('=== Client Birthday Greetings: Starting ===');

    // Today in SAST (UTC+2), matching the calendar digests.
    const sastNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const todayMonth = sastNow.getUTCMonth() + 1;
    const todayDay = sastNow.getUTCDate();
    const todayYear = sastNow.getUTCFullYear();

    let clients: CommunicationClient[];
    try {
      clients = await getAllClients(getSupabase() as unknown as SupabaseAdminClient);
    } catch (error) {
      log.error('Failed to load clients for birthday greetings', error);
      return c.json({ success: false, error: 'Could not load clients' }, 500);
    }

    const birthdayClients = clients.filter((client) =>
      isBirthdayOn(resolveDateOfBirth(client), todayMonth, todayDay, todayYear),
    );

    if (birthdayClients.length === 0) {
      log.info('No client birthdays today — nothing to send');
      return c.json({ success: true, sent: 0, reason: 'no_birthdays' });
    }

    // Unsubscribes, so the footer link is not decorative.
    let unsubscribed: Set<string>;
    try {
      unsubscribed = new Set(
        (await listSubscribers())
          .filter((s) => s.active === false)
          .map((s) => s.email.toLowerCase()),
      );
    } catch (error) {
      // DO NOT continue with an empty set. An unreadable unsubscribe list
      // would mean mailing everyone who ever opted out.
      log.error('Could not read the unsubscribe list — sending nothing', error);
      return c.json({ success: false, error: 'Could not read unsubscribe list' }, 500);
    }

    const template = await getEmailTemplate('client_birthday');
    if (template.enabled === false) {
      log.info('client_birthday template is disabled — sending nothing');
      return c.json({ success: true, sent: 0, reason: 'template_disabled' });
    }

    const footerSettings = await getFooterSettings();

    let sent = 0;
    let skippedNoConsent = 0;
    let skippedUnsubscribed = 0;
    let skippedNoEmail = 0;
    let failed = 0;

    for (const client of birthdayClients) {
      const email = (client.email || '').trim();
      if (!email) {
        skippedNoEmail++;
        continue;
      }
      if (!hasMarketingConsent(client)) {
        skippedNoConsent++;
        continue;
      }
      if (unsubscribed.has(email.toLowerCase())) {
        skippedUnsubscribed++;
        continue;
      }

      const firstName = (client.firstName || '').trim() || 'there';
      const fill = (text: string) => text.replace(/\{\{\s*\.FirstName\s*\}\}/g, firstName);

      const unsubscribeLink = `https://www.navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

      const html = createEmailTemplate(fill(template.bodyHtml), {
        title: fill(template.title),
        subtitle: fill(template.subtitle),
        greeting: fill(template.greeting),
        buttonUrl: template.buttonUrl ? fill(template.buttonUrl) : undefined,
        buttonLabel: template.buttonLabel ? fill(template.buttonLabel) : undefined,
        footerNote: fill(template.footerNote),
        unsubscribeLink,
        footerSettings,
      });

      // Derived from the same template body, never hand-written alongside it:
      // an admin editing the copy in the UI must not leave the plain-text part
      // saying something different from the HTML.
      const text = createPlainTextEmail(
        `${fill(template.greeting)}\n\n${htmlToPlainText(fill(template.bodyHtml))}`,
        unsubscribeLink,
      );

      try {
        const ok = await sendEmail({
          to: email,
          subject: fill(template.subject),
          html,
          text,
        });
        if (ok) {
          sent++;
        } else {
          failed++;
          log.error(`Birthday greeting failed for client ${client.id}`);
        }
      } catch (error) {
        failed++;
        log.error(`Birthday greeting threw for client ${client.id}`, error);
      }
    }

    log.info(
      `Birthday greetings: sent=${sent} failed=${failed} ` +
        `skipped(no_consent=${skippedNoConsent} unsubscribed=${skippedUnsubscribed} no_email=${skippedNoEmail}) ` +
        `of ${birthdayClients.length} birthday(s)`,
    );

    return c.json({
      success: true,
      birthday_count: birthdayClients.length,
      sent,
      failed,
      skipped_no_consent: skippedNoConsent,
      skipped_unsubscribed: skippedUnsubscribed,
      skipped_no_email: skippedNoEmail,
    });
  }),
);

export default app;
