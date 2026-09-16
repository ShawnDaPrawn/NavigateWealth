/**
 * Newsletter intake — the "a draft is waiting for your review" admin email.
 *
 * Sent once per routine-created draft. Everything the routine supplied
 * (title, description, file name, who submitted it) is HTML-escaped: the
 * routine is trusted to hand over a newsletter, not to author markup in the
 * admin's inbox (SECURITY-AUDIT S10).
 */

import { ADMIN_EMAIL } from './constants.ts';
import { createEmailTemplate, getFooterSettings, sendEmail } from './email-service.ts';
import { escapeHtml } from './newsletter-studio-render.ts';
import { NEWSLETTER_REVIEW_TO_ENV } from './newsletter-intake-types.ts';
import { SITE_ORIGIN } from '../../../utils/siteOrigin.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('newsletter-intake-notify');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `NW_NEWSLETTER_REVIEW_TO` as a de-duplicated list, falling back to the admin inbox. */
export function parseReviewRecipients(raw: string | undefined): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => EMAIL_RE.test(entry));
  return list.length > 0 ? [...new Set(list)] : [ADMIN_EMAIL];
}

/** Deep link into the admin module with the draft open. */
export function buildReviewUrl(campaignId: string): string {
  const params = new URLSearchParams({ module: 'newsletter', campaign: campaignId });
  return `${SITE_ORIGIN}/admin?${params.toString()}`;
}

export interface DraftReviewNotification {
  campaignId: string;
  title: string;
  description: string;
  fileName: string;
  sizeBytes: number;
  listNames: string[];
  submittedBy: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Returns true when the email was accepted by the provider; never throws. */
export async function sendNewsletterDraftReviewNotification(
  input: DraftReviewNotification,
): Promise<boolean> {
  const recipients = parseReviewRecipients(Deno.env.get(NEWSLETTER_REVIEW_TO_ENV));
  const reviewUrl = buildReviewUrl(input.campaignId);
  const submitted = new Date().toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td>` +
    `<td style="padding:6px 0;">${value}</td></tr>`;

  const content =
    `<p style="margin:0 0 16px 0;">A newsletter draft has been handed over and is waiting for you to check it and send it. Nothing goes out until you approve it in the admin.</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px 0;">` +
    row('Title', `<strong>${escapeHtml(input.title)}</strong>`) +
    row('Description', escapeHtml(input.description).replace(/\n/g, '<br>')) +
    row('PDF', `${escapeHtml(input.fileName)} (${formatSize(input.sizeBytes)})`) +
    row('Audience', escapeHtml(input.listNames.join(', ') || 'Newsletter Contacts')) +
    row('Submitted by', escapeHtml(input.submittedBy)) +
    row('Submitted', escapeHtml(submitted)) +
    `</table>` +
    `<p style="margin:0;font-size:13px;color:#6b7280;">Open the draft to preview the PDF, adjust the title, description or audience, send yourself a test, then send it now or schedule it.</p>`;

  const html = createEmailTemplate(content, {
    title: 'Newsletter draft ready for review',
    greeting: 'Hi,',
    buttonUrl: reviewUrl,
    buttonLabel: 'Review the draft',
    footerSettings: await getFooterSettings(),
  });

  const text = [
    'A newsletter draft has been handed over and is waiting for your review.',
    '',
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    `PDF: ${input.fileName} (${formatSize(input.sizeBytes)})`,
    `Audience: ${input.listNames.join(', ') || 'Newsletter Contacts'}`,
    `Submitted by: ${input.submittedBy}`,
    `Submitted: ${submitted}`,
    '',
    `Review the draft: ${reviewUrl}`,
  ].join('\n');

  try {
    const [to, ...cc] = recipients;
    const ok = await sendEmail({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: `Newsletter draft ready for review: ${input.title}`,
      html,
      text,
      customArgs: { type: 'newsletter_draft_review', campaign_id: input.campaignId },
    });
    if (!ok)
      log.warn('Draft review email not accepted by provider', { campaignId: input.campaignId });
    return ok;
  } catch (error) {
    log.error('Draft review email failed', {
      campaignId: input.campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
