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

export const CAMPAIGN_STATUS_CONFIG: Record<
  NewsletterCampaignStatus,
  { label: string; className: string }
> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  },
  queued: {
    label: 'Queued',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  sending: {
    label: 'Sending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  paused: {
    label: 'Paused',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  },
  finished: {
    label: 'Finished',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
};

export const DELIVERY_STATUS_CONFIG: Record<
  NewsletterDeliveryStatus,
  { label: string; className: string }
> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  sending: {
    label: 'Sending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  sent: {
    label: 'Delivered',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  failed_retryable: {
    label: 'Retrying',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  },
  failed_terminal: {
    label: 'Failed',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  },
};

/** Merge fields the composer offers; substituted server-side per recipient. */
export const MERGE_FIELDS = [
  { token: '{{firstName}}', description: "Recipient's first name" },
  { token: '{{name}}', description: "Recipient's full name" },
  { token: '{{email}}', description: "Recipient's email address" },
  { token: '{{unsubscribeUrl}}', description: 'Personal unsubscribe link' },
] as const;
