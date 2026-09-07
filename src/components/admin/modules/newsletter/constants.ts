/**
 * Newsletter Studio — endpoint constants and status display config.
 * §5.3 — each module defines its own ENDPOINTS in constants.ts.
 */
import type { NewsletterCampaignStatus, NewsletterDeliveryStatus } from './types';

export const ENDPOINTS = {
  DASHBOARD: 'newsletter-studio/dashboard',
  CAMPAIGNS: 'newsletter-studio/campaigns',
  CAMPAIGN: (id: string) => `newsletter-studio/campaigns/${id}`,
  CAMPAIGN_DUPLICATE: (id: string) => `newsletter-studio/campaigns/${id}/duplicate`,
  CAMPAIGN_TEST: (id: string) => `newsletter-studio/campaigns/${id}/test`,
  CAMPAIGN_SCHEDULE: (id: string) => `newsletter-studio/campaigns/${id}/schedule`,
  CAMPAIGN_SEND_NOW: (id: string) => `newsletter-studio/campaigns/${id}/send-now`,
  CAMPAIGN_PAUSE: (id: string) => `newsletter-studio/campaigns/${id}/pause`,
  CAMPAIGN_RESUME: (id: string) => `newsletter-studio/campaigns/${id}/resume`,
  CAMPAIGN_CANCEL: (id: string) => `newsletter-studio/campaigns/${id}/cancel`,
  CAMPAIGN_RECIPIENTS: (id: string) => `newsletter-studio/campaigns/${id}/recipients`,
  CAMPAIGN_STATS: (id: string) => `newsletter-studio/campaigns/${id}/stats`,
  LISTS: 'newsletter-studio/lists',
  TEMPLATES: 'newsletter-studio/templates',
  TEMPLATE: (id: string) => `newsletter-studio/templates/${id}`,
  PROCESS: 'newsletter-studio/process',
  TRACK_CLICK: 'newsletter-studio/track/click',
} as const;

/** The always-present subscriber audience (mirrors SUBSCRIBER_LIST_ID server-side). */
export const SUBSCRIBER_LIST_ID = 'sys_newsletter_contacts';

/** Sender identity shown in previews — mirrors newsletter-studio-render.ts. */
export const NEWSLETTER_FROM_EMAIL = 'newsletters@navigatewealth.co';
export const NEWSLETTER_REPLY_TO_EMAIL = 'info@navigatewealth.co';
export const DEFAULT_FROM_NAME = 'Navigate Wealth';

export interface StatusDisplay {
  label: string;
  /** Badge colours. */
  className: string;
  /** Status dot colour for badges and timelines. */
  dot: string;
  /** One-line explanation used in tooltips and banners. */
  description: string;
}

export const CAMPAIGN_STATUS_CONFIG: Record<NewsletterCampaignStatus, StatusDisplay> = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    dot: 'bg-slate-400',
    description: 'Being written — nothing has been sent.',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    dot: 'bg-blue-500',
    description: 'Will start delivering automatically at the scheduled time.',
  },
  queued: {
    label: 'Queued',
    className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
    dot: 'bg-violet-500 animate-pulse',
    description: 'Audience frozen — waiting for the next delivery pass.',
  },
  sending: {
    label: 'Sending',
    className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
    dot: 'bg-violet-500 animate-pulse',
    description: 'Delivery is in progress.',
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
    description: 'Delivery is on hold. Resume to continue where it left off.',
  },
  finished: {
    label: 'Sent',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Delivery complete.',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    dot: 'bg-rose-500',
    description: 'Stopped before every recipient was reached.',
  },
};

export const DELIVERY_STATUS_CONFIG: Record<NewsletterDeliveryStatus, StatusDisplay> = {
  pending: {
    label: 'Pending',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    dot: 'bg-slate-400',
    description: 'Not attempted yet.',
  },
  sending: {
    label: 'Sending',
    className: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200',
    dot: 'bg-violet-500 animate-pulse',
    description: 'Handing off to the email provider.',
  },
  sent: {
    label: 'Delivered',
    className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Accepted by the email provider.',
  },
  failed_retryable: {
    label: 'Retrying',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
    description: 'A temporary failure — will be retried automatically.',
  },
  failed_terminal: {
    label: 'Failed',
    className: 'bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    dot: 'bg-rose-500',
    description: 'Permanently failed (bounce, opt-out or retry budget exhausted).',
  },
};

/** Filter chips on the campaigns list; a chip may cover several statuses. */
export const CAMPAIGN_STATUS_FILTERS: {
  id: string;
  label: string;
  statuses: NewsletterCampaignStatus[] | null;
}[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'draft', label: 'Drafts', statuses: ['draft'] },
  { id: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
  { id: 'sending', label: 'Sending', statuses: ['queued', 'sending'] },
  { id: 'paused', label: 'Paused', statuses: ['paused'] },
  { id: 'finished', label: 'Sent', statuses: ['finished'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

/** Merge fields the composer offers; substituted server-side per recipient. */
export const MERGE_FIELDS = [
  { token: '{{firstName}}', description: "Recipient's first name", sample: 'Thandi' },
  { token: '{{name}}', description: "Recipient's full name", sample: 'Thandi Nkosi' },
  { token: '{{email}}', description: "Recipient's email address", sample: 'thandi@example.com' },
  { token: '{{unsubscribeUrl}}', description: 'Personal unsubscribe link', sample: '#' },
] as const;

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
}

/**
 * Built-in starting points shown when the studio has no saved templates yet.
 * Plain semantic HTML — the branded wrapper, footer and unsubscribe link are
 * added at send time.
 */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'starter-monthly-update',
    name: 'Monthly update',
    description: 'A short intro, three headlines and a closing call to action.',
    subject: 'Your {{firstName}}-sized market update',
    bodyHtml: [
      '<h2>Hi {{firstName}},</h2>',
      '<p>Here is what mattered this month and what it means for your plan.</p>',
      '<h3>1. Headline one</h3>',
      '<p>A sentence or two on why it matters.</p>',
      '<h3>2. Headline two</h3>',
      '<p>A sentence or two on why it matters.</p>',
      '<h3>3. Headline three</h3>',
      '<p>A sentence or two on why it matters.</p>',
      '<p><a href="https://navigatewealth.co/insights">Read the full insights</a></p>',
      '<p>Warm regards,<br/>The Navigate Wealth team</p>',
    ].join('\n'),
  },
  {
    id: 'starter-announcement',
    name: 'Announcement',
    description: 'One clear message with a single action.',
    subject: 'A quick note from Navigate Wealth',
    bodyHtml: [
      '<h2>Hi {{firstName}},</h2>',
      '<p>We have some news we wanted you to hear from us first.</p>',
      '<p><strong>What is changing:</strong> describe the change in one or two sentences.</p>',
      '<p><strong>What it means for you:</strong> spell out the practical effect.</p>',
      '<p><a href="https://navigatewealth.co">Find out more</a></p>',
      '<p>Questions? Just reply to this email — a real person reads every reply.</p>',
    ].join('\n'),
  },
  {
    id: 'starter-event-invite',
    name: 'Event invitation',
    description: 'Date, time, what to expect and an RSVP link.',
    subject: "You're invited: {{firstName}}, join us on [date]",
    bodyHtml: [
      '<h2>You are invited, {{firstName}}</h2>',
      '<p>Join us for <strong>[event name]</strong> — a practical session on [topic].</p>',
      '<p><strong>When:</strong> [day, date, time]<br/><strong>Where:</strong> [venue or online link]</p>',
      '<p>What you will take away:</p>',
      '<ul><li>Point one</li><li>Point two</li><li>Point three</li></ul>',
      '<p><a href="https://navigatewealth.co/contact">Reserve your seat</a></p>',
    ].join('\n'),
  },
];
