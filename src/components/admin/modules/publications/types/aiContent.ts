/**
 * AI writing, content templates, article generation and the auto-content pipeline.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type Article } from './articles';

// AI WRITING TYPES (Phase 3)
// ============================================================================

/**
 * AI writing action types
 */
export type AIAction =
  | 'improve'
  | 'expand'
  | 'summarize'
  | 'continue'
  | 'tone'
  | 'headline'
  | 'excerpt'
  | 'compliance_check'
  | 'seo_optimize'
  | 'generate_callout'
  | 'fix_grammar'
  | 'custom';

/**
 * AI writing request payload
 */
export interface AIWritingRequest {
  action: AIAction;
  content: string;
  context?: string;
  tone?: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  prompt?: string;
  articleTitle?: string;
  articleExcerpt?: string;
  articleCategory?: string;
}

/**
 * AI writing response payload
 */
export interface AIWritingResponse {
  result: string;
  suggestions?: string[];
  warnings?: string[];
  action: AIAction;
  tokensUsed?: number;
}

// ============================================================================
// CONTENT TEMPLATE TYPES (Phase 4)
// ============================================================================

export interface ContentTemplate {
  id: string;
  name: string;
  description: string;
  body: string;
  category_id?: string;
  type_id?: string;
  icon?: string;
  tags: string[];
  is_system: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description: string;
  body: string;
  category_id?: string;
  type_id?: string;
  icon?: string;
  tags?: string[];
  is_system?: boolean;
  sort_order?: number;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  body?: string;
  category_id?: string;
  type_id?: string;
  icon?: string;
  tags?: string[];
  sort_order?: number;
  is_active?: boolean;
}

// ============================================================================
// AI ARTICLE GENERATION TYPES (Phase 5)
// ============================================================================

export interface GenerateArticleBrief {
  /** Topic or working title */
  topic: string;
  /** Target audience */
  audience: 'advisors' | 'clients' | 'both';
  /** Writing tone */
  tone: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Key points to cover (optional) */
  keyPoints?: string[];
  /** Target word count */
  targetLength: 'short' | 'medium' | 'long';
  /** Category name for context */
  categoryName?: string;
  /** Template body to use as structural guide (optional) */
  templateBody?: string;
  /** Additional instructions (optional) */
  additionalInstructions?: string;
  /** Available category names for auto-detection when no category is explicitly selected */
  availableCategories?: string[];
}

export interface GenerateArticleResult {
  title: string;
  excerpt: string;
  body: string;
  suggestedSlug: string;
  readingTimeMinutes: number;
  suggestedMetaDescription: string;
  tokensUsed: number;
  /** AI-suggested category name (returned when availableCategories was provided) */
  suggestedCategoryName?: string;
  /** Hero image URL sourced from Unsplash based on article topic */
  suggestedHeroImageUrl?: string;
  /** Thumbnail image URL sourced from Unsplash based on article topic */
  suggestedThumbnailUrl?: string;
  /** Unsplash photo ID for stale image tracking */
  unsplashPhotoId?: string;
}

// ============================================================================
// AUTO CONTENT PIPELINE TYPES (Phase 5 — Automation)
// ============================================================================

export type PipelineId =
  | 'market_commentary'
  | 'regulatory_monitor'
  | 'news_commentary'
  | 'calendar_content';

export interface PipelineConfig {
  id: PipelineId;
  name: string;
  description: string;
  enabled: boolean;
  audience: 'advisors' | 'clients' | 'both';
  tone: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  targetLength: 'short' | 'medium' | 'long';
  categoryId?: string;
  categoryName?: string;
  leadTimeDays?: number;
  rssFeeds?: string[];
  lastRunAt?: string;
  totalGenerated: number;
  /** Hours between automatic scheduled runs (0 = manual only) */
  scheduleIntervalHours: number;
  /** When true, articles created by this pipeline are published immediately instead of saved as drafts */
  autoPublish?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineRunLog {
  id: string;
  pipelineId: PipelineId;
  status: 'success' | 'partial' | 'error';
  articlesGenerated: number;
  articleIds: string[];
  summary: string;
  errors: string[];
  durationMs: number;
  tokensUsed: number;
  startedAt: string;
  completedAt: string;
}

export interface CalendarEvent {
  id: string;
  name: string;
  description: string;
  month: number;
  day: number;
  recurring: boolean;
  year?: number;
  leadTimeDays: number;
  articleTopic: string;
  keyPoints: string[];
  isActive: boolean;
  lastGeneratedYear?: number;
}

export interface PipelineTriggerResult {
  pipelineId: PipelineId;
  status: 'success' | 'skipped' | 'error';
  articlesGenerated: number;
  articleIds: string[];
  summary: string;
  errors: string[];
  durationMs: number;
}

export interface ContentSource {
  id: string;
  name: string;
  url: string;
  type: 'rss';
  pipelines: PipelineId[];
  isActive: boolean;
  checkIntervalHours: number;
  maxArticlesPerRun: number;
  maxArticlesPerDay: number;
  maxArticlesPerWeek: number;
  filterKeywords?: string[];
  lastCheckedAt?: string;
  articlesGeneratedToday: number;
  articlesGeneratedThisWeek: number;
  dailyResetDate?: string;
  weeklyResetDate?: string;
  totalGenerated: number;
  created_at: string;
  updated_at: string;
}

export type CreateContentSourceInput = Omit<
  ContentSource,
  | 'id'
  | 'lastCheckedAt'
  | 'articlesGeneratedToday'
  | 'articlesGeneratedThisWeek'
  | 'dailyResetDate'
  | 'weeklyResetDate'
  | 'totalGenerated'
  | 'created_at'
  | 'updated_at'
>;

/**
 * Feed discovered from a webpage URL via auto-discovery
 */
export interface DiscoveredFeed {
  /** Feed URL */
  url: string;
  /** Feed title as advertised by the site */
  title: string;
  /** Feed type */
  type: 'rss' | 'atom';
}

// ============================================================================
// VERSION HISTORY TYPES (Phase 4)
// ============================================================================

export interface ArticleVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  body: string;
  excerpt: string;
  edited_by: string;
  change_summary: string;
  snapshot: Record<string, unknown>;
  created_at: string;
  char_count: number;
  word_count: number;
}

// ============================================================================
// NEWSLETTER SUBSCRIBER TYPES
// ============================================================================

/**
 * Subscriber status derived from confirmed + active flags.
 * See §7.1 — derived via pure utility, never inline in JSX.
 */
export type SubscriberStatus = 'active' | 'pending' | 'unsubscribed';

/**
 * Newsletter subscriber entity as returned by GET /newsletter/admin/subscribers
 */
export interface Subscriber {
  email: string;
  firstName: string;
  surname: string;
  /** Composed full name (backward compat / display fallback) */
  name: string;
  source: string;
  confirmed: boolean;
  active: boolean;
  subscribedAt: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  /** 'admin' if removed by admin, null if self-unsubscribed */
  removedBy: string | null;
}

/** Time-range filter options for the unsubscribed view */
export type UnsubTimeRange = 'all' | '7d' | '30d' | '90d';

/** Status filter options for subscriber list */
export type SubscriberStatusFilter = 'all' | SubscriberStatus;

// ── API Response Types (§9.3) ──────────────────────────────────────────

export interface SubscriberListResponse {
  success: boolean;
  subscribers: Subscriber[];
  total: number;
}

export interface SubscriberMutationResponse {
  success: boolean;
  message: string;
  alreadySubscribed?: boolean;
  alreadyActive?: boolean;
}

export interface UpdateSubscriberInput {
  currentEmail: string;
  email: string;
  firstName: string;
  surname: string;
}

export interface BulkUploadResponse {
  success: boolean;
  message: string;
  added: number;
  skipped: number;
  errors: string[];
}

export interface ArticleReshareRecipient {
  email: string;
  firstName: string;
  name: string;
}

export interface ArticleReshareResponse {
  success: boolean;
  dryRun: boolean;
  message: string;
  recipientCount: number;
  sent: number;
  failed: number;
  recipients: ArticleReshareRecipient[];
  errors?: string[];
}

export type ArticleEmailDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'failed_retryable'
  | 'failed_terminal';
export type ArticleEmailTrackingSource = 'publish' | 'reshare';
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
  /** Present on retry-undelivered API when re-blasting to all subscribers. */
  blastRecipientCount?: number;
  mode?: 'blast_all' | 'resume_undelivered';
}

export interface ArticleNotificationProcessorResult {
  processedJobs: number;
  advancedJobs: number;
  completedJobs: number;
  jobs: ArticleNotificationJob[];
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

export interface ArticlePublishResponse {
  article: Article;
  notificationJob: ArticleNotificationJob | null;
  notificationCampaign?: ArticleNotificationCampaign | null;
  notificationError?: string | null;
}

export interface ArticleEmailEngagementSummary {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  publishedAt: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  campaignId?: string | null;
  campaignStatus?: ArticleNotificationCampaignStatus | null;
  intendedRecipientCount?: number;
  sendingCount?: number;
  failedRetryableCount?: number;
  failedTerminalCount?: number;
  lastActivityAt?: string | null;
  lastError?: string | null;
  pending: number;
  sent: number;
  failed: number;
  undelivered: number;
  publishPending: number;
  publishFailed: number;
  publishUndelivered: number;
  resharePending: number;
  reshareFailed: number;
  reshareUndelivered: number;
  opened: number;
  read: number;
  openRate: number;
  readRate: number;
  latestSentAt: string | null;
  latestOpenedAt: string | null;
  latestReadAt: string | null;
}

export interface ArticleEmailEngagementRecipient {
  token: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  recipientEmail: string;
  recipientName: string;
  recipientFirstName: string;
  source: ArticleEmailTrackingSource;
  createdAt: string;
  sentAt: string | null;
  openedAt: string | null;
  readAt: string | null;
  lastOpenedAt: string | null;
  lastReadAt: string | null;
  openCount: number;
  readCount: number;
  deliveryStatus: ArticleEmailDeliveryStatus;
  deliveryError: string | null;
  attemptCount?: number;
  lastAttemptedAt?: string | null;
  providerMessageId?: string | null;
}

export interface ArticleEmailEngagementDetail {
  summary: ArticleEmailEngagementSummary;
  campaign?: ArticleNotificationCampaign | null;
  recipients: ArticleEmailEngagementRecipient[];
}
