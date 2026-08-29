/**
 * Newsletter Studio — campaign rendering.
 *
 * Pure-ish helpers that turn an authored campaign body into the exact
 * per-recipient email: merge fields, click-through link rewriting,
 * preheader injection, branded wrapper, plain-text alternative, and the
 * deliverability envelope (List-Unsubscribe et al.).
 *
 * Click-through tracking follows the platform's engagement doctrine
 * (no tracking pixel — see ArticleEmailEngagementPanel): destinations are
 * stored server-side at queue time and clicks are recorded when the
 * recipient actually follows a link, which also counts as the "open".
 */

import { SITE_ORIGIN, SITE_ORIGIN_APEX } from '../../../utils/siteOrigin.ts';
import { createEmailTemplate, createPlainTextEmail, getFooterSettings } from './email-service.ts';
import type {
  NewsletterAudienceItem,
  NewsletterCampaign,
  NewsletterCampaignLink,
} from './newsletter-studio-types.ts';

/** Sender identity for campaign mail — matches the double-opt-in flow's address. */
export const NEWSLETTER_FROM_EMAIL = 'newsletters@navigatewealth.co';
export const NEWSLETTER_DEFAULT_FROM_NAME = 'Navigate Wealth';
export const NEWSLETTER_REPLY_TO = {
  email: 'info@navigatewealth.co',
  name: 'Navigate Wealth Support',
};

/**
 * SPA page that records the click and forwards to the stored destination.
 * Apex origin on purpose: links in emails must open in the browser, not get
 * captured into the installed portal PWA (see SITE_ORIGIN_APEX docs).
 */
export const CLICK_THROUGH_PATH = '/newsletter/click';

const HREF_RE = /href\s*=\s*(["'])(https?:\/\/[^"']+)\1/gi;

/**
 * Extract the unique http(s) destinations from a campaign body, in first-seen
 * order, and assign short stable link ids. Mailto/tel/anchor hrefs are left
 * alone. Unsubscribe links are excluded — rewriting those through a tracker
 * would break one-click unsubscribe.
 */
export function extractCampaignLinks(bodyHtml: string): NewsletterCampaignLink[] {
  const seen = new Map<string, NewsletterCampaignLink>();
  for (const match of bodyHtml.matchAll(HREF_RE)) {
    const url = match[2];
    if (seen.has(url)) continue;
    if (isUnsubscribeUrl(url)) continue;
    seen.set(url, { id: `l${seen.size + 1}`, url });
  }
  return [...seen.values()];
}

function isUnsubscribeUrl(url: string): boolean {
  return url.includes('/newsletter/unsubscribe');
}

export function buildUnsubscribeUrl(email: string): string {
  return `${SITE_ORIGIN}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function buildClickThroughUrl(campaignId: string, token: string, linkId: string): string {
  const params = new URLSearchParams({ c: campaignId, t: token, l: linkId });
  return `${SITE_ORIGIN_APEX}${CLICK_THROUGH_PATH}?${params.toString()}`;
}

/**
 * Rewrite tracked hrefs to the click-through URL for one recipient.
 * Only URLs captured in `links` are rewritten, so the redirect endpoint can
 * only ever forward to a destination the author actually wrote.
 */
export function rewriteLinksForRecipient(
  bodyHtml: string,
  links: NewsletterCampaignLink[],
  campaignId: string,
  token: string,
): string {
  if (links.length === 0) return bodyHtml;
  const byUrl = new Map(links.map((link) => [link.url, link]));
  return bodyHtml.replace(HREF_RE, (full, quote: string, url: string) => {
    const link = byUrl.get(url);
    if (!link) return full;
    return `href=${quote}${buildClickThroughUrl(campaignId, token, link.id)}${quote}`;
  });
}

/** Escape a string for literal use inside a RegExp — none needed here, kept for merge fields. */
const MERGE_FIELD_RE = /\{\{\s*(firstName|name|email|unsubscribeUrl)\s*\}\}/g;

export interface MergeContext {
  firstName: string;
  name: string;
  email: string;
  unsubscribeUrl: string;
}

/** HTML-escape a merge value — recipient names are data, never markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Substitute `{{firstName}}`, `{{name}}`, `{{email}}` and `{{unsubscribeUrl}}`
 * placeholders. Values are HTML-escaped except the unsubscribe URL, which is
 * server-built and URL-encoded already.
 */
export function applyMergeFields(bodyHtml: string, ctx: MergeContext): string {
  return bodyHtml.replace(MERGE_FIELD_RE, (_full, field: keyof MergeContext) => {
    if (field === 'unsubscribeUrl') return ctx.unsubscribeUrl;
    return escapeHtml(ctx[field] ?? '');
  });
}

/** Inbox-preview text: visually hidden, read by mail clients as the snippet. */
function preheaderHtml(preheader: string): string {
  return (
    `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">` +
    `${escapeHtml(preheader)}</div>`
  );
}

export interface RenderedCampaignEmail {
  html: string;
  text: string;
}

export interface RenderCampaignEmailInput {
  campaign: Pick<
    NewsletterCampaign,
    'id' | 'subject' | 'preheader' | 'bodyHtml' | 'links' | 'trackClicks'
  >;
  recipient: Pick<NewsletterAudienceItem, 'email' | 'name' | 'firstName' | 'token'>;
  /** Disable link rewriting (test sends keep original destinations). */
  disableClickTracking?: boolean;
}

/**
 * Produce the final personalized email for one recipient: merge fields →
 * link rewriting → preheader → branded wrapper → plain-text alternative.
 */
export async function renderCampaignEmail(
  input: RenderCampaignEmailInput,
): Promise<RenderedCampaignEmail> {
  const { campaign, recipient } = input;
  const unsubscribeUrl = buildUnsubscribeUrl(recipient.email);

  let content = applyMergeFields(campaign.bodyHtml, {
    firstName: recipient.firstName,
    name: recipient.name,
    email: recipient.email,
    unsubscribeUrl,
  });

  // The plain-text alternative comes from the personalized content but keeps
  // original destinations — text-mode readers get real URLs, not tracker ones.
  const textSource = content;

  if (campaign.trackClicks && !input.disableClickTracking) {
    content = rewriteLinksForRecipient(content, campaign.links, campaign.id, recipient.token);
  }

  if (campaign.preheader) {
    content = preheaderHtml(campaign.preheader) + content;
  }

  const footerSettings = await getFooterSettings();
  const html = createEmailTemplate(content, {
    greeting: '',
    unsubscribeLink: unsubscribeUrl,
    footerSettings,
  });

  const text = createPlainTextEmail(
    textSource
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim(),
    unsubscribeUrl,
  );

  return { html, text };
}

/**
 * Deliverability headers for one campaign send — the same envelope the
 * double-opt-in welcome email established (List-Unsubscribe + one-click).
 */
export function buildCampaignEmailHeaders(
  campaignId: string,
  token: string,
  unsubscribeUrl: string,
): Record<string, string> {
  return {
    'Message-ID': `<${crypto.randomUUID()}@navigatewealth.co>`,
    'List-Unsubscribe': `<mailto:unsubscribe@navigatewealth.co?subject=unsubscribe>, <${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'List-Id': 'Navigate Wealth Newsletter <newsletter.navigatewealth.co>',
    'X-Entity-Ref-ID': `nlstudio-${campaignId}-${token}`,
  };
}
