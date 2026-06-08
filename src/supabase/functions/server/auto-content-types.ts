// ---------------------------------------------------------------------------
// Auto Content — Shared Types
// ---------------------------------------------------------------------------

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
  /** Default audience for generated articles */
  audience: 'advisors' | 'clients' | 'both';
  /** Default tone */
  tone: 'professional' | 'conversational' | 'authoritative' | 'friendly' | 'educational';
  /** Default article length */
  targetLength: 'short' | 'medium' | 'long';
  /** Category ID to assign to generated articles */
  categoryId?: string;
  /** Category name for AI context */
  categoryName?: string;
  /** Lead time in days for calendar events */
  leadTimeDays?: number;
  /** Custom RSS feed URLs (for news_commentary) */
  rssFeeds?: string[];
  /** Last successful run ISO timestamp */
  lastRunAt?: string;
  /** Total articles generated */
  totalGenerated: number;
  /** Hours between automatic scheduled runs (0 = manual only) */
  scheduleIntervalHours: number;
  /** When true, articles created by this pipeline are published immediately */
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
  /** Summary of what was produced */
  summary: string;
  /** Errors encountered (if any) */
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
  /** Month (1-12) and day (1-31) for annual recurrence */
  month: number;
  day: number;
  /** Whether this repeats yearly */
  recurring: boolean;
  /** Year for one-off events */
  year?: number;
  /** Lead time in days before the event to generate the article */
  leadTimeDays: number;
  /** Suggested article topic */
  articleTopic: string;
  /** Key points the article should cover */
  keyPoints: string[];
  /** Whether this event is active */
  isActive: boolean;
  /** Last year an article was generated for this event */
  lastGeneratedYear?: number;
}

export interface PipelineTriggerResult {
  pipelineId: PipelineId;
  status: 'success' | 'partial' | 'skipped' | 'error';
  articlesGenerated: number;
  articleIds: string[];
  summary: string;
  errors: string[];
  durationMs: number;
}

export interface ContentSource {
  id: string;
  /** Human-readable name */
  name: string;
  /** RSS feed URL */
  url: string;
  /** Source type — currently only RSS */
  type: 'rss';
  /** Which pipeline(s) this source feeds into */
  pipelines: PipelineId[];
  /** Whether this source is active */
  isActive: boolean;
  // ── Frequency Controls ──
  /** Minimum hours between checks (0 = no limit) */
  checkIntervalHours: number;
  /** Max articles to generate per single pipeline run from this source */
  maxArticlesPerRun: number;
  /** Max articles to generate per calendar day from this source (0 = no limit) */
  maxArticlesPerDay: number;
  /** Max articles to generate per calendar week from this source (0 = no limit) */
  maxArticlesPerWeek: number;
  // ── Filtering ──
  /** Optional keyword filter — items must match at least one keyword */
  filterKeywords?: string[];
  // ── Tracking ──
  /** ISO timestamp of last successful check */
  lastCheckedAt?: string;
  /** Articles generated today (auto-reset) */
  articlesGeneratedToday: number;
  /** Articles generated this week (auto-reset) */
  articlesGeneratedThisWeek: number;
  /** ISO date string for daily counter reset */
  dailyResetDate?: string;
  /** ISO date string (Monday) for weekly counter reset */
  weeklyResetDate?: string;
  /** Lifetime total */
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

export interface DiscoveredFeed {
  url: string;
  title: string;
  type: 'rss' | 'atom';
}
