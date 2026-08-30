/**
 * Newsletter Studio — frontend types.
 *
 * Mirrors src/supabase/functions/server/newsletter-studio-types.ts view
 * shapes 1:1. Shared over HTTP, never imported across the SPA/edge boundary.
 */

export type NewsletterCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'paused'
  | 'finished'
  | 'cancelled';

export interface NewsletterCampaignLink {
  id: string;
  url: string;
}

export interface NewsletterCampaign {
  id: string;
  name: string;
  subject: string;
  preheader?: string;
  fromName: string;
  listIds: string[];
  listNames: string[];
  bodyHtml: string;
  templateId?: string | null;
  trackClicks: boolean;
  status: NewsletterCampaignStatus;
  scheduledAt: string | null;
  links: NewsletterCampaignLink[];
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  processedCount: number;
  progressPercent: number;
  openCount: number;
  clickCount: number;
  statsRefreshedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastProgressAt: string | null;
  lastError: string | null;
  pendingCount: number;
  stuck: boolean;
}

export type NewsletterDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed_retryable'
  | 'failed_terminal';

export interface NewsletterCampaignRecipient {
  campaignId: string;
  token: string;
  email: string;
  name: string;
  firstName: string;
  deliveryStatus: NewsletterDeliveryStatus;
  deliveryError: string | null;
  attemptCount: number;
  lastAttemptedAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clicks: { linkId: string; at: string }[];
}

export interface NewsletterCampaignLinkStats extends NewsletterCampaignLink {
  clickCount: number;
}

export interface NewsletterCampaignStats {
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  openCount: number;
  clickCount: number;
  clickedRecipientCount: number;
  openRate: number;
  clickRate: number;
  links: NewsletterCampaignLinkStats[];
}

export interface NewsletterListView {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'custom';
  memberCount: number;
  externalContactCount: number;
  clientCount: number;
}

export interface NewsletterStudioTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterProcessorState {
  mode: 'manual' | 'cron';
  lastRunAt: string | null;
  /** Null when the pg_cron job has never checked in — see the dashboard warning. */
  lastCronRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastHeartbeatAt: string | null;
  activeCampaignCount: number;
  processedInLastRun: number;
  sentInLastRun: number;
  failedInLastRun: number;
}

export interface NewsletterDashboardSummary {
  subscribers: { total: number; active: number; pending: number; unsubscribed: number };
  campaigns: {
    total: number;
    draft: number;
    scheduled: number;
    active: number;
    finished: number;
    cancelled: number;
  };
  delivery: { totalSent: number; totalFailed: number; totalOpens: number; totalClicks: number };
  recentCampaigns: NewsletterCampaign[];
  processor: NewsletterProcessorState | null;
  listCount: number;
  templateCount: number;
}

export interface CampaignListResult {
  campaigns: NewsletterCampaign[];
  total: number;
  page: number;
  limit: number;
}

export interface RecipientPageResult {
  recipients: NewsletterCampaignRecipient[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  preheader?: string;
  fromName?: string;
  listIds: string[];
  bodyHtml: string;
  templateId?: string | null;
  trackClicks?: boolean;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

export interface TemplateInput {
  name: string;
  description?: string;
  subject?: string;
  bodyHtml: string;
}

export interface TestSendResult {
  email: string;
  ok: boolean;
  error?: string;
}

export interface ProcessResult {
  mode: 'manual' | 'cron';
  campaignsExamined: number;
  campaignsProcessed: number;
  promotedScheduled: number;
  sent: number;
  failed: number;
  finished: string[];
  errors: string[];
}
