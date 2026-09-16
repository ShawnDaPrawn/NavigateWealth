/**
 * Newsletter — endpoint constants and status display config.
 * §5.3 — each module defines its own ENDPOINTS in constants.ts.
 */
import type { NewsletterCampaignStatus, NewsletterDeliveryStatus } from './types';

export const ENDPOINTS = {
  DASHBOARD: 'newsletter-studio/dashboard',
  CAMPAIGNS: 'newsletter-studio/campaigns',
  CAMPAIGN: (id: string) => `newsletter-studio/campaigns/${id}`,
  CAMPAIGN_PDF: (id: string) => `newsletter-studio/campaigns/${id}/pdf`,
  CAMPAIGN_TEST: (id: string) => `newsletter-studio/campaigns/${id}/test`,
  CAMPAIGN_SCHEDULE: (id: string) => `newsletter-studio/campaigns/${id}/schedule`,
  CAMPAIGN_SEND_NOW: (id: string) => `newsletter-studio/campaigns/${id}/send-now`,
  CAMPAIGN_RESUME: (id: string) => `newsletter-studio/campaigns/${id}/resume`,
  CAMPAIGN_CANCEL: (id: string) => `newsletter-studio/campaigns/${id}/cancel`,
  CAMPAIGN_RECIPIENTS: (id: string) => `newsletter-studio/campaigns/${id}/recipients`,
  CAMPAIGN_STATS: (id: string) => `newsletter-studio/campaigns/${id}/stats`,
  LISTS: 'newsletter-studio/lists',
  PROCESS: 'newsletter-studio/process',
  TRACK_CLICK: 'newsletter-studio/track/click',
} as const;

/** The always-present subscriber audience (mirrors SUBSCRIBER_LIST_ID server-side). */
export const SUBSCRIBER_LIST_ID = 'sys_newsletter_contacts';

/** Upload cap — mirrors MAX_NEWSLETTER_PDF_BYTES server-side. */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_LABEL = '5 MB';

export const TITLE_MAX_LENGTH = 150;
export const DESCRIPTION_MAX_LENGTH = 1000;

/** Sender identity shown in the send dialog — mirrors newsletter-studio-render.ts. */
export const NEWSLETTER_FROM_EMAIL = 'newsletters@navigatewealth.co';
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
    description: 'Not sent yet.',
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
    label: 'Stopped',
    className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
    description:
      'Delivery stopped because the email provider rejected our sender. Fix the cause, then retry.',
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

/** Filter chips on the newsletter list; a chip may cover several statuses. */
export const CAMPAIGN_STATUS_FILTERS: {
  id: string;
  label: string;
  statuses: NewsletterCampaignStatus[] | null;
}[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'draft', label: 'Drafts', statuses: ['draft'] },
  { id: 'scheduled', label: 'Scheduled', statuses: ['scheduled'] },
  { id: 'sending', label: 'Sending', statuses: ['queued', 'sending', 'paused'] },
  { id: 'finished', label: 'Sent', statuses: ['finished'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];
