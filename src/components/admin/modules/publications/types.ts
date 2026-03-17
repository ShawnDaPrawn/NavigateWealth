/**
 * Publications Module - Type Definitions
 * Navigate Wealth Admin Dashboard
 * 
 * Comprehensive type system for the Publications module including:
 * - Article types and statuses
 * - Category management types
 * - Content type definitions
 * - Input/Update types for CRUD operations
 * - Filter and search types
 * - Settings and configuration types
 * 
 * @module publications/types
 */

// ============================================================================
// ARTICLE TYPES
// ============================================================================

/**
 * Article status enum
 * Represents the publication workflow stages
 */
export type ArticleStatus = 
  | 'draft'        // Initial draft state
  | 'in_review'    // Submitted for review
  | 'scheduled'    // Scheduled for future publication
  | 'published'    // Currently published
  | 'archived';    // Archived/unpublished

/**
 * Complete article entity
 * Represents a published or draft article
 */
export interface Article {
  /** Unique identifier */
  id: string;
  
  /** Article title */
  title: string;
  
  /** Optional subtitle */
  subtitle?: string | null;
  
  /** URL-friendly slug */
  slug: string;
  
  /** Short excerpt/summary */
  excerpt: string;
  
  /** Full article content (HTML) — server field name */
  body?: string | null;
  
  /** Full article content (legacy alias) */
  content?: string | null;
  
  /** Foreign key to category */
  category_id: string;
  
  /** Foreign key to content type */
  type_id: string;
  
  /** Current publication status */
  status: ArticleStatus;
  
  /** Whether article is featured */
  is_featured: boolean;
  
  /** Publication timestamp (if published) */
  published_at?: string | null;
  
  /** Scheduled publication timestamp */
  scheduled_for?: string | null;
  
  /** Creation timestamp */
  created_at: string;
  
  /** Last update timestamp */
  updated_at: string;
  
  /** Optional: Populated category relation */
  category?: Category;
  
  /** Optional: Populated content type relation */
  type?: ContentType;
  
  /** Optional: Author information */
  author_id?: string;
  author_name?: string;
  
  /** Optional: SEO metadata */
  seo_title?: string | null;
  seo_description?: string | null;
  seo_canonical_url?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[] | null;
  
  /** Optional: Hero/featured image */
  hero_image_url?: string | null;
  featured_image?: string | null;
  
  /** Optional: Thumbnail image */
  thumbnail_image_url?: string | null;
  
  /** Reading time in minutes */
  reading_time_minutes?: number;
  
  /** Optional: View count */
  view_count?: number;
  
  /** Last editor */
  last_edited_by?: string;
  
  /** Whether to send email notifications when this article is published (used for scheduled articles) */
  notify_on_publish?: boolean;

  /** Optional press category for Press page display */
  press_category?: 'company_news' | 'product_launch' | 'awards' | 'team_news' | 'industry_insights' | null;

  /** Enriched fields from server (joins) */
  category_name?: string;
  category_slug?: string;
  type_name?: string;
  type_slug?: string;
}

/**
 * Input type for creating new articles
 */
export interface CreateArticleInput {
  /** Article title */
  title: string;
  
  /** Optional subtitle */
  subtitle?: string;
  
  /** URL slug (auto-generated from title if not provided) */
  slug?: string;
  
  /** Short excerpt */
  excerpt: string;
  
  /** Full article body (rich text) */
  body?: string;
  
  /** Full content (legacy alias) */
  content?: string;
  
  /** Category ID */
  category_id: string;
  
  /** Content type ID */
  type_id: string;
  
  /** Initial status (defaults to 'draft') */
  status?: ArticleStatus;
  
  /** Featured flag */
  is_featured?: boolean;
  
  /** Schedule for future publication */
  scheduled_for?: string;
  
  /** SEO metadata */
  meta_description?: string;
  meta_keywords?: string[];
  seo_title?: string;
  seo_description?: string;
  
  /** Featured image URL */
  featured_image?: string;
  
  /** Hero image URL (displayed at article top) */
  hero_image_url?: string;
  
  /** Thumbnail image URL (used in lists/cards) */
  thumbnail_image_url?: string;
  
  /** Author display name */
  author_name?: string;
  
  /** Estimated reading time in minutes */
  reading_time_minutes?: number;

  /** Whether to send email notifications when this article is published (used for scheduled articles) */
  notify_on_publish?: boolean;
}

/**
 * Input type for updating existing articles
 */
export interface UpdateArticleInput extends Partial<CreateArticleInput> {
  /** Article ID (required) */
  id: string;
  
  /** Publication timestamp (set when publishing) */
  published_at?: string;
}

/**
 * Article form data type
 * Used for form state management in article editor
 */
export interface ArticleFormData {
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  body?: string;
  category_id: string;
  type_id: string;
  feature_image_url?: string;
  thumbnail_image_url?: string;
  author_name?: string;
  reading_time_minutes?: number;
  tags?: string[];
  status: ArticleStatus;
  is_featured: boolean;
  scheduled_publish_at?: string;
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  press_category?: 'company_news' | 'product_launch' | 'awards' | 'team_news' | 'industry_insights' | null;
}

/**
 * Partial article for list views
 */
export interface ArticleSummary {
  id: string;
  title: string;
  excerpt: string;
  status: ArticleStatus;
  is_featured: boolean;
  published_at?: string | null;
  created_at: string;
  category?: Pick<Category, 'id' | 'name' | 'icon'>;
  type?: Pick<ContentType, 'id' | 'name' | 'icon'>;
}

// ============================================================================
// CATEGORY TYPES
// ============================================================================

/**
 * Article category
 * Used for organizing articles into logical groups
 */
export interface Category {
  /** Unique identifier */
  id: string;
  
  /** Category name */
  name: string;
  
  /** URL-friendly slug */
  slug: string;
  
  /** Optional description */
  description?: string | null;
  
  /** Optional icon (emoji or icon name) */
  icon?: string | null;
  
  /** Display order */
  sort_order: number;
  
  /** Active/inactive flag */
  is_active: boolean;
  
  /** Creation timestamp */
  created_at: string;
  
  /** Last update timestamp */
  updated_at: string;
  
  /** Optional: Article count */
  article_count?: number;
}

/**
 * Input type for creating categories
 */
export interface CreateCategoryInput {
  /** Category name */
  name: string;
  
  /** URL slug (auto-generated if not provided) */
  slug?: string;
  
  /** Description */
  description?: string;
  
  /** Icon */
  icon?: string;
  
  /** Sort order */
  sort_order?: number;
  
  /** Active flag */
  is_active?: boolean;
}

/**
 * Input type for updating categories
 */
export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  /** Category ID (required) */
  id: string;
}

// ============================================================================
// CONTENT TYPE TYPES
// ============================================================================

/**
 * Content type (article format/type)
 * Examples: Blog Post, Guide, Tutorial, Case Study, etc.
 */
export interface ContentType {
  /** Unique identifier */
  id: string;
  
  /** Type name */
  name: string;
  
  /** URL-friendly slug */
  slug: string;
  
  /** Optional description */
  description?: string | null;
  
  /** Optional icon (emoji or icon name) */
  icon?: string | null;
  
  /** Display order */
  sort_order: number;
  
  /** Active/inactive flag */
  is_active: boolean;
  
  /** Creation timestamp */
  created_at: string;
  
  /** Last update timestamp */
  updated_at: string;
  
  /** Optional: Article count */
  article_count?: number;
}

/**
 * Input type for creating content types
 */
export interface CreateContentTypeInput {
  /** Type name */
  name: string;
  
  /** URL slug (auto-generated if not provided) */
  slug?: string;
  
  /** Description */
  description?: string;
  
  /** Icon */
  icon?: string;
  
  /** Sort order */
  sort_order?: number;
  
  /** Active flag */
  is_active?: boolean;
}

/**
 * Input type for updating content types
 */
export interface UpdateContentTypeInput extends Partial<CreateContentTypeInput> {
  /** Type ID (required) */
  id: string;
}

// ============================================================================
// FILTER & SEARCH TYPES
// ============================================================================

/**
 * Article filters
 * Used for filtering articles in list views
 */
export interface ArticleFilters {
  /** Search query */
  search?: string;
  
  /** Filter by status */
  status?: ArticleStatus | 'all';
  
  /** Filter by category */
  category_id?: string | 'all';
  
  /** Filter by content type */
  type_id?: string | 'all';
  
  /** Filter by featured */
  is_featured?: boolean;
  
  /** Filter by date range */
  date_from?: string;
  date_to?: string;
}

/**
 * Sort options for articles
 */
export type ArticleSortField = 
  | 'created_at'
  | 'updated_at'
  | 'published_at'
  | 'title'
  | 'view_count';

export type ArticleSortOrder = 'asc' | 'desc';

export interface ArticleSortOptions {
  field: ArticleSortField;
  order: ArticleSortOrder;
}

// ============================================================================
// NEWS TYPES
// ============================================================================

export interface NewsItem {
  title: string;
  pubDate: string;
  author: string;
  link: string;
  image: string;
  description?: string;
  source?: string;
}

export type NewsCategory = 'economicNews' | 'forexNews' | 'stockMarket' | 'investingIdeas';

export type NewsData = Record<NewsCategory, NewsItem[]>;

// ============================================================================
// STATISTICS & ANALYTICS TYPES
// ============================================================================

/**
 * Publication statistics
 */
export interface PublicationStats {
  /** Total articles */
  total: number;
  
  /** By status */
  by_status: {
    draft: number;
    in_review: number;
    scheduled: number;
    published: number;
    archived: number;
  };
  
  /** Featured articles */
  featured: number;
  
  /** Articles by category */
  by_category: Record<string, number>;
  
  /** Articles by type */
  by_type: Record<string, number>;
  
  /** Recent activity */
  recent_published: number;
  recent_updated: number;
}

// ============================================================================
// SETTINGS & CONFIGURATION TYPES
// ============================================================================

/**
 * Publications module settings
 */
export interface PublicationsSettings {
  /** Default article status */
  default_status: ArticleStatus;
  
  /** Auto-generate slugs */
  auto_generate_slug: boolean;
  
  /** Require approval before publishing */
  require_approval: boolean;
  
  /** Enable scheduling */
  enable_scheduling: boolean;
  
  /** Default category */
  default_category_id?: string;
  
  /** Default content type */
  default_type_id?: string;
  
  /** SEO settings */
  seo_enabled: boolean;
  default_meta_keywords?: string[];
}

// ============================================================================
// INITIALIZATION TYPES
// ============================================================================

/**
 * Initialization status
 */
export interface InitializationStatus {
  /** Whether publications is initialized */
  is_initialized: boolean;
  
  /** Has categories */
  has_categories: boolean;
  
  /** Has content types */
  has_types: boolean;
  
  /** Optional: Default data created */
  defaults_created?: boolean;
}

/**
 * Initialization input
 */
export interface InitializePublicationsInput {
  /** Create default categories */
  create_default_categories?: boolean;
  
  /** Create default content types */
  create_default_types?: boolean;
  
  /** Sample articles */
  create_sample_articles?: boolean;
}

// ============================================================================
// REORDER TYPES
// ============================================================================

/**
 * Reorder update for categories/types
 */
export interface ReorderUpdate {
  /** Entity ID */
  id: string;
  
  /** New sort order */
  sort_order: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;
  
  /** Success flag */
  success: boolean;
  
  /** Optional error message */
  error?: string;
  
  /** Optional metadata */
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Data items */
  data: T[];
  
  /** Pagination metadata */
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean;
  
  /** Errors by field */
  errors: Record<string, string>;
  
  /** Warning messages */
  warnings?: string[];
}

// ============================================================================
// TYPE CONSTANTS
// ============================================================================

/**
 * Article status labels
 */
export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

/**
 * Article status colors
 */
export const ARTICLE_STATUS_COLORS: Record<ArticleStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
};

/**
 * Available article statuses
 */
export const ARTICLE_STATUSES: ArticleStatus[] = [
  'draft',
  'in_review',
  'scheduled',
  'published',
  'archived',
];

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for ArticleStatus
 */
export function isArticleStatus(value: unknown): value is ArticleStatus {
  return typeof value === 'string' && ARTICLE_STATUSES.includes(value as ArticleStatus);
}

/**
 * Type guard for Article
 */
export function isArticle(value: unknown): value is Article {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'status' in value &&
    isArticleStatus((value as Article).status)
  );
}

/**
 * Type guard for Category
 */
export function isCategory(value: unknown): value is Category {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'slug' in value
  );
}

/**
 * Type guard for ContentType
 */
export function isContentType(value: unknown): value is ContentType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'slug' in value
  );
}

// ============================================================================
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

export type PipelineId = 'market_commentary' | 'regulatory_monitor' | 'news_commentary' | 'calendar_content';

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

export type CreateContentSourceInput = Omit<ContentSource, 'id' | 'lastCheckedAt' | 'articlesGeneratedToday' | 'articlesGeneratedThisWeek' | 'dailyResetDate' | 'weeklyResetDate' | 'totalGenerated' | 'created_at' | 'updated_at'>;

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

export interface BulkUploadResponse {
  success: boolean;
  message: string;
  added: number;
  skipped: number;
  errors: string[];
}