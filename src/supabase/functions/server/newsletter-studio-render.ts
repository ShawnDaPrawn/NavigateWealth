/**
 * Newsletter Studio — email rendering.
 *
 * The email around a PDF newsletter is short and fixed: greeting, title,
 * description, a "Read the newsletter" button, a note that the PDF is also
 * attached, and the unsubscribe footer. There are no merge fields and no
 * authored HTML — the title and description are data and are escaped.
 *
 * The button is the only tracked link. It goes through the click-through
 * page (SPA, apex origin) which asks the server for a short-lived signed URL
 * to the campaign's own PDF and records the read — no tracking pixel.
 */

import { SITE_ORIGIN, SITE_ORIGIN_APEX } from '../../../utils/siteOrigin.ts';
import { createEmailTemplate, createPlainTextEmail } from './email-service.ts';
import type { EmailFooterSettings } from './email-core.ts';
import { PDF_LINK_ID } from './newsletter-studio-types.ts';
import type { NewsletterAudienceItem, NewsletterCampaign } from './newsletter-studio-types.ts';

/** Sender identity for campaign mail — matches the double-opt-in flow's address. */
export const NEWSLETTER_FROM_EMAIL = 'newsletters@navigatewealth.co';
export const NEWSLETTER_DEFAULT_FROM_NAME = 'Navigate Wealth';
export const NEWSLETTER_REPLY_TO = {
  email: 'info@navigatewealth.co',
  name: 'Navigate Wealth Support',
};

/**
 * SPA page that records the click and forwards to the signed PDF URL.
 * Apex origin on purpose: links in emails must open in the browser, not get
 * captured into the installed portal PWA (see SITE_ORIGIN_APEX docs).
 */
export const CLICK_THROUGH_PATH = '/newsletter/click';

export function buildUnsubscribeUrl(email: string): string {
  return `${SITE_ORIGIN}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function buildClickThroughUrl(campaignId: string, token: string, linkId: string): string {
  const params = new URLSearchParams({ c: campaignId, t: token, l: linkId });
  return `${SITE_ORIGIN_APEX}${CLICK_THROUGH_PATH}?${params.toString()}`;
}

/** The tracked read link for one recipient. */
export function buildReadUrl(campaignId: string, token: string): string {
  return buildClickThroughUrl(campaignId, token, PDF_LINK_ID);
}

/** HTML-escape a value — titles, descriptions and names are data, never markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Description paragraphs: blank-line separated, single newlines become <br>. */
function descriptionHtml(description: string): string {
  return description
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p style="margin:0 0 16px 0;">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export interface RenderedNewsletterEmail {
  html: string;
  text: string;
}

export interface RenderNewsletterEmailInput {
  campaign: Pick<NewsletterCampaign, 'title' | 'description'>;
  recipient: Pick<NewsletterAudienceItem, 'email' | 'firstName'>;
  /** Where the "Read the newsletter" button goes (tracked for real sends, signed for tests). */
  readUrl: string;
  /** Loaded once per campaign per tick by the caller — not per recipient. */
  footerSettings: EmailFooterSettings;
}

/** Produce the final email for one recipient. */
export function renderNewsletterEmail(input: RenderNewsletterEmailInput): RenderedNewsletterEmail {
  const { campaign, recipient, readUrl, footerSettings } = input;
  const unsubscribeUrl = buildUnsubscribeUrl(recipient.email);
  const greeting = recipient.firstName ? `Hi ${escapeHtml(recipient.firstName)},` : 'Hello,';

  const content =
    `<h1 style="font-size:22px;line-height:1.3;margin:0 0 16px 0;">${escapeHtml(campaign.title)}</h1>` +
    descriptionHtml(campaign.description) +
    `<p style="margin:24px 0 8px 0;font-size:13px;color:#6b7280;">The newsletter is also attached to this email as a PDF.</p>`;

  const html = createEmailTemplate(content, {
    title: escapeHtml(campaign.title),
    greeting,
    buttonUrl: readUrl,
    buttonLabel: 'Read the newsletter',
    unsubscribeLink: unsubscribeUrl,
    footerSettings,
  });

  const text = createPlainTextEmail(
    [
      recipient.firstName ? `Hi ${recipient.firstName},` : 'Hello,',
      '',
      campaign.title,
      '',
      campaign.description.trim(),
      '',
      `Read the newsletter: ${readUrl}`,
      '',
      'The newsletter is also attached to this email as a PDF.',
    ].join('\n'),
    unsubscribeUrl,
  );

  return { html, text };
}

/** Edge Function origin fallback when SUPABASE_URL is not in the environment. */
const EDGE_ORIGIN_FALLBACK = 'https://vpjmdsltwrnpefzcgdmz.supabase.co';

/**
 * RFC 8058 one-click unsubscribe target. Mailbox providers POST here (with a
 * form-encoded body, no JS, no session), so it must be the server route that
 * actually flips the consent record — never the SPA page, which only works
 * when a human's browser runs it (review finding). The footer link humans
 * click stays on the SPA unsubscribe page.
 */
export function buildOneClickUnsubscribeUrl(campaignId: string, token: string): string {
  const origin =
    (typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') : undefined) ||
    EDGE_ORIGIN_FALLBACK;
  const params = new URLSearchParams({ c: campaignId, t: token });
  return `${origin}/functions/v1/make-server-91ed8379/newsletter-studio/unsubscribe-oneclick?${params.toString()}`;
}

/**
 * Deliverability headers for one campaign send — the same envelope the
 * double-opt-in welcome email established, with the https entry pointing at
 * the real one-click POST endpoint.
 */
export function buildCampaignEmailHeaders(
  campaignId: string,
  token: string,
): Record<string, string> {
  const oneClickUrl = buildOneClickUnsubscribeUrl(campaignId, token);
  return {
    'Message-ID': `<${crypto.randomUUID()}@navigatewealth.co>`,
    'List-Unsubscribe': `<mailto:unsubscribe@navigatewealth.co?subject=unsubscribe>, <${oneClickUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': 'Navigate Wealth Newsletter <newsletter.navigatewealth.co>',
    'X-Entity-Ref-ID': `nlstudio-${campaignId}-${token}`,
  };
}
