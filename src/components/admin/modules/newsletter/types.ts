/**
 * Newsletter — frontend types.
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

export type NewsletterCampaignSource = 'admin' | 'routine';

/** A campaign's live presence on the public website. */
export interface NewsletterWebsitePublication {
  slug: string;
  publishedAt: string;
  pdfUrl: string;
  publicPath: string;
  pdfFileName: string;
  pdfSizeBytes: number;
}

export interface NewsletterPdf {
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface NewsletterCampaign {
  id: string;
  title: string;
  description: string;
  fromName: string;
  listIds: string[];
  listNames: string[];
  pdf: NewsletterPdf | null;
  source: NewsletterCampaignSource;
  sourceRef: string | null;
  reviewNotifiedAt: string | null;
  /** 'YYYY-MM' — which issue this is, and where it files on the website. */
  issueMonth: string;
  /** Publish on the website when the send finishes. */
  publishToWebsite: boolean;
  /** Set once live on the website. */
  website: NewsletterWebsitePublication | null;
  status: NewsletterCampaignStatus;
  scheduledAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  processedCount: number;
  progressPercent: number;
  readCount: number;
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

export interface NewsletterCampaignStats {
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  readCount: number;
  readRate: number;
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

export interface NewsletterProcessorState {
  mode: 'manual' | 'cron';
  lastRunAt: string | null;
  /** Null when the pg_cron job has never checked in — see the delivery panel warning. */
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
    awaitingReview: number;
    scheduled: number;
    active: number;
    finished: number;
    cancelled: number;
  };
  delivery: { totalSent: number; totalFailed: number; totalRead: number };
  recentCampaigns: NewsletterCampaign[];
  processor: NewsletterProcessorState | null;
  listCount: number;
}

export type CampaignStatusCounts = Record<NewsletterCampaignStatus, number>;

export interface CampaignListResult {
  campaigns: NewsletterCampaign[];
  total: number;
  page: number;
  limit: number;
  /** Per-status counts over the whole search-filtered set (before the status filter). */
  statusCounts: CampaignStatusCounts;
}

export interface RecipientPageResult {
  recipients: NewsletterCampaignRecipient[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCampaignInput {
  title: string;
  description: string;
  /** May be empty: a newsletter can go to the website without being emailed. */
  listIds: string[];
  issueMonth?: string;
  publishToWebsite?: boolean;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

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
  intakeProcessed: number;
  sent: number;
  failed: number;
  finished: string[];
  errors: string[];
}

/** UX-only capability flags derived from the personnel permission set. */
export interface NewsletterCaps {
  create: boolean;
  send: boolean;
  delete: boolean;
}
