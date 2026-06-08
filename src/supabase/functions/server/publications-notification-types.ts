import type {
  ArticleEmailTrackingSource,
  ArticleEmailTrackingRecord,
} from './publications-email-engagement-service.ts';

export type { ArticleEmailTrackingSource, ArticleEmailTrackingRecord };

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

export interface PublishedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
}

export interface ArticleNotificationRecipient {
  email: string;
  firstName: string;
  name: string;
}

export interface ArticleNotificationRunResult {
  dryRun: boolean;
  recipientCount: number;
  sent: number;
  failed: number;
  recipients: ArticleNotificationRecipient[];
  errors: string[];
}

export type ArticleNotificationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'completed_with_failures';

export type ArticleNotificationCampaignStatus =
  | ArticleNotificationJobStatus
  | 'no_recipients'
  | 'queue_failed';

export type ArticleNotificationJobKind = 'publish' | 'retry_undelivered';
export type ArticleNotificationJobPhase = 'preparing' | 'sending' | 'completed';

export interface ArticleNotificationJobItem {
  email: string;
  firstName: string;
  name: string;
  trackingToken: string | null;
}

export interface ArticleNotificationJob {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  articleExcerpt: string;
  source: ArticleEmailTrackingSource;
  kind: ArticleNotificationJobKind;
  status: ArticleNotificationJobStatus;
  recipientCount: number;
  currentIndex: number;
  prepareCursor: number;
  items: ArticleNotificationJobItem[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastProgressAt: string | null;
  lastPreparedAt: string | null;
  lastDeliveredAt: string | null;
  lastError: string | null;
  lockId: string | null;
  lockExpiresAt: string | null;
}

export interface ArticleNotificationJobSnapshot extends ArticleNotificationJob {
  phase: ArticleNotificationJobPhase;
  preparedCount: number;
  unpreparedCount: number;
  sentCount: number;
  failedCount: number;
  failedRetryableCount: number;
  failedTerminalCount: number;
  pendingCount: number;
  sendingCount: number;
  processedCount: number;
  progressPercent: number;
  stuck: boolean;
}

export interface ArticleNotificationCampaign {
  id: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  articleExcerpt: string;
  source: ArticleEmailTrackingSource;
  status: ArticleNotificationCampaignStatus;
  phase: ArticleNotificationJobPhase;
  intendedRecipientCount: number;
  preparedCount: number;
  unpreparedCount: number;
  pendingCount: number;
  sendingCount: number;
  sentCount: number;
  failedRetryableCount: number;
  failedTerminalCount: number;
  processedCount: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  lastError: string | null;
  jobId: string | null;
  stuck: boolean;
}

export interface ArticleNotificationProcessorResult {
  processedJobs: number;
  advancedJobs: number;
  completedJobs: number;
  jobs: ArticleNotificationJobSnapshot[];
}

export interface ArticleNotificationProcessorState {
  mode: 'manual' | 'cron' | 'scheduler';
  lastHeartbeatAt: string;
  lastRunAt: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  maxJobs: number;
  maxBatchesPerJob: number;
  processedJobs: number;
  advancedJobs: number;
  completedJobs: number;
  activeJobCount: number;
  queuedJobCount: number;
  processingJobCount: number;
  stuckJobCount: number;
  staleJobThresholdMs: number;
  stuckJobs: ArticleNotificationProcessorStuckJob[];
}

export interface ArticleNotificationProcessorStuckJob {
  id: string;
  articleId: string;
  articleTitle: string;
  kind: ArticleNotificationJobKind;
  source: ArticleEmailTrackingSource;
  status: ArticleNotificationJobStatus;
  phase: ArticleNotificationJobPhase;
  pendingCountEstimate: number;
  prepareCursor: number;
  recipientCount: number;
  lastProgressAt: string | null;
  updatedAt: string;
  minutesSinceProgress: number | null;
}

// ---------------------------------------------------------------------------
// Internal Types (used within notification sub-modules)
// ---------------------------------------------------------------------------

export interface QueueArticleNotificationOptions {
  kind: ArticleNotificationJobKind;
  source?: ArticleEmailTrackingSource;
}

export interface NewsletterSubscription {
  email: string;
  name?: string;
  confirmed: boolean;
  active?: boolean;
}

export interface ExternalContact {
  email: string;
  name?: string;
  source: string;
  subscribedAt: string;
}

export interface NewsletterGroup {
  clientIds: string[];
  externalContacts?: ExternalContact[];
}

export interface LegacySubscriptionPageOptions {
  startAfter?: string;
  limit?: number;
}

export interface ArticleNotificationProcessorOptions {
  jobId?: string;
  maxJobs?: number;
  maxBatchesPerJob?: number;
  mode?: 'manual' | 'cron' | 'scheduler';
}

export type DeliveryFailureDisposition = 'retryable' | 'terminal';

export interface DeliveryFailureClassification {
  message: string;
  disposition: DeliveryFailureDisposition;
}

export interface PreparePublishJobTrackingBatchResult {
  job: ArticleNotificationJob;
  preparedCount: number;
}
