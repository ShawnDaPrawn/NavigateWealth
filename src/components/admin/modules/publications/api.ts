/**
 * Publications Module - API Client
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized API client for the Publications module with:
 * - Articles CRUD operations
 * - Categories management
 * - Content types management
 * - Initialization and settings
 * - Error handling and type safety
 * 
 * @module publications/api
 */

import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { getModuleUrl } from '../../../../utils/api/config';
import { logger } from '../../../../utils/logger';
import { createClient } from '../../../../utils/supabase/client';
import type {
  Article,
  ArticleSummary,
  Category,
  ContentType,
  CreateArticleInput,
  UpdateArticleInput,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateContentTypeInput,
  UpdateContentTypeInput,
  ArticleFilters,
  PublicationStats,
  InitializationStatus,
  InitializePublicationsInput,
  ReorderUpdate,
  ApiResponse,
  NewsItem,
} from './types';
import type { AIWritingRequest, AIWritingResponse } from './types';
import type { ContentTemplate, CreateTemplateInput, UpdateTemplateInput, ArticleVersion } from './types';
import type { GenerateArticleBrief, GenerateArticleResult } from './types';
import type { PipelineId, PipelineConfig, PipelineRunLog, PipelineTriggerResult, CalendarEvent, ContentSource, CreateContentSourceInput, DiscoveredFeed } from './types';
import type {
  SubscriberListResponse,
  SubscriberMutationResponse,
  UpdateSubscriberInput,
  BulkUploadResponse,
  ArticlePublishResponse,
  ArticleReshareResponse,
  ArticleEmailEngagementSummary,
  ArticleEmailEngagementDetail,
  ArticleNotificationJob,
  ArticleNotificationCampaign,
  ArticleNotificationProcessorResult,
  ArticleNotificationProcessorState,
} from './types';

// ============================================================================
// BASE URL CONFIGURATION
// ============================================================================

const BASE_URL = getModuleUrl('publications');
const RSS_PROXY_URL = getModuleUrl('rss-proxy');
const AUTO_CONTENT_URL = getModuleUrl('auto-content');

const headers = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

const EMAIL_ENGAGEMENT_CHANGED_EVENT = 'publications:email-engagement-changed';

function notifyEmailEngagementChanged(
  articleId: string,
  reason: 'published' | 'retry_queued' | 'notification_job_updated' | 'notification_campaign_updated',
): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(EMAIL_ENGAGEMENT_CHANGED_EVENT, {
    detail: {
      articleId,
      reason,
    },
  }));
}

/**
 * Get auth headers with user session token for authenticated endpoints.
 * Falls back to anon key if no session is available (§5.1 — client-side auth is UX only).
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || publicAnonKey;
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return headers;
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * API Error class
 */
export class PublicationsAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'PublicationsAPIError';
  }
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new PublicationsAPIError(
      errorData.error || `API request failed with status ${response.status}`,
      response.status,
      errorData
    );
  }

  const data = await response.json();
  return data.data || data;
}

// ============================================================================
// ARTICLES API
// ============================================================================

/**
 * Articles API namespace
 * All operations related to article management
 */
export const ArticlesAPI = {
  /**
   * Get all articles
   * 
   * @param filters - Optional filters
   * @returns Array of articles
   * 
   * @example
   * ```typescript
   * const articles = await ArticlesAPI.getArticles();
   * const published = await ArticlesAPI.getArticles({ status: 'published' });
   * ```
   */
  async getArticles(filters?: ArticleFilters): Promise<Article[]> {
    const params = new URLSearchParams();
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.category_id && filters.category_id !== 'all') params.append('category_id', filters.category_id);
    if (filters?.type_id && filters.type_id !== 'all') params.append('type_id', filters.type_id);
    if (filters?.is_featured !== undefined) params.append('is_featured', String(filters.is_featured));
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const url = `${BASE_URL}/articles${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, { headers });
    return handleResponse<Article[]>(response);
  },

  /**
   * Get single article by ID
   * 
   * @param id - Article ID
   * @returns Article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.getArticle('abc-123');
   * ```
   */
  async getArticle(id: string): Promise<Article> {
    const response = await fetch(`${BASE_URL}/articles/${id}`, { headers });
    return handleResponse<Article>(response);
  },

  /**
   * Get article by slug
   * 
   * @param slug - Article slug
   * @returns Article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.getArticleBySlug('my-article');
   * ```
   */
  async getArticleBySlug(slug: string): Promise<Article> {
    const response = await fetch(`${BASE_URL}/articles/slug/${slug}`, { headers });
    return handleResponse<Article>(response);
  },

  /**
   * Create new article
   * 
   * @param input - Article data
   * @returns Created article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.createArticle({
   *   title: 'My Article',
   *   excerpt: 'Article excerpt',
   *   category_id: 'cat-123',
   *   type_id: 'type-456',
   * });
   * ```
   */
  async createArticle(input: CreateArticleInput): Promise<Article> {
    const response = await fetch(`${BASE_URL}/articles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<Article>(response);
  },

  /**
   * Update existing article
   * 
   * @param input - Update data with article ID
   * @returns Updated article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.updateArticle({
   *   id: 'abc-123',
   *   title: 'Updated Title',
   * });
   * ```
   */
  async updateArticle(input: UpdateArticleInput): Promise<Article> {
    const { id, ...updates } = input;
    const response = await fetch(`${BASE_URL}/articles/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleResponse<Article>(response);
  },

  /**
   * Delete article
   * 
   * @param id - Article ID
   * 
   * @example
   * ```typescript
   * await ArticlesAPI.deleteArticle('abc-123');
   * ```
   */
  async deleteArticle(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/articles/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<void>(response);
    notifyEmailEngagementChanged(id, 'notification_campaign_updated');
  },

  /**
   * Publish article
   * Sets status to 'published' and published_at to now
   * 
   * @param id - Article ID
   * @param options - Optional publish options
   * @returns Published article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.publishArticle('abc-123');
   * const articleWithNotification = await ArticlesAPI.publishArticle('abc-123', { notify_subscribers: true });
   * ```
   */
  async publishArticle(id: string, options?: { notify_subscribers?: boolean }): Promise<ArticlePublishResponse> {
    const response = await fetch(`${BASE_URL}/articles/${id}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notify_subscribers: options?.notify_subscribers ?? true }),
    });
    const result = await handleResponse<ArticlePublishResponse>(response);
    notifyEmailEngagementChanged(result.article.id, 'published');
    return result;
  },

  /**
   * Archive article
   * Sets status to 'archived'
   * 
   * @param id - Article ID
   * @returns Archived article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.archiveArticle('abc-123');
   * ```
   */
  async archiveArticle(id: string): Promise<Article> {
    const response = await fetch(`${BASE_URL}/articles/${id}/archive`, {
      method: 'POST',
      headers,
    });
    return handleResponse<Article>(response);
  },

  /**
   * Unarchive article
   * Sets status to 'draft'
   * 
   * @param id - Article ID
   * @returns Unarchived article
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.unarchiveArticle('abc-123');
   * ```
   */
  async unarchiveArticle(id: string): Promise<Article> {
    const response = await fetch(`${BASE_URL}/articles/${id}/unarchive`, {
      method: 'POST',
      headers,
    });
    return handleResponse<Article>(response);
  },

  /**
   * Unpublish article
   * Sets status to 'draft'
   * 
   * @param id - Article ID
   * @returns Unpublished article (now draft)
   * 
   * @example
   * ```typescript
   * const article = await ArticlesAPI.unpublishArticle('abc-123');
   * ```
   */
  async unpublishArticle(id: string): Promise<Article> {
    const response = await fetch(`${BASE_URL}/articles/${id}/unpublish`, {
      method: 'POST',
      headers,
    });
    return handleResponse<Article>(response);
  },

  /**
   * Process scheduled articles
   * Publishes any articles whose scheduled_for date has passed.
   * Idempotent — safe to call repeatedly.
   *
   * @returns Count of articles processed
   */
  async processScheduled(): Promise<{ processed: number }> {
    const response = await fetch(`${BASE_URL}/process-scheduled`, {
      method: 'POST',
      headers,
    });
    const result = await response.json();
    return { processed: result?.data?.processed || 0 };
  },

  /**
   * Search articles
   * 
   * Uses the main /articles endpoint with search query parameter.
   * Note: There is no dedicated /articles/search route — that path would
   * incorrectly match the /articles/:id param route.
   * 
   * @param query - Search query
   * @returns Matching articles
   * 
   * @example
   * ```typescript
   * const results = await ArticlesAPI.searchArticles('financial planning');
   * ```
   */
  async searchArticles(query: string): Promise<Article[]> {
    const response = await fetch(`${BASE_URL}/articles?search=${encodeURIComponent(query)}`, {
      headers,
    });
    return handleResponse<Article[]>(response);
  },

  /**
   * Get featured articles
   * 
   * Uses the main /articles endpoint with is_featured filter.
   * Note: There is no dedicated /articles/featured route — that path would
   * incorrectly match the /articles/:id param route.
   * 
   * @param limit - Maximum number of articles
   * @returns Featured articles
   * 
   * @example
   * ```typescript
   * const featured = await ArticlesAPI.getFeaturedArticles(5);
   * ```
   */
  async getFeaturedArticles(limit: number = 10): Promise<Article[]> {
    const response = await fetch(`${BASE_URL}/articles?is_featured=true&limit=${limit}`, {
      headers,
    });
    return handleResponse<Article[]>(response);
  },

  async reshareArticle(
    id: string,
    input: {
      dryRun?: boolean;
      targetMode?: 'all' | 'selected';
      recipientEmails?: string[];
    },
  ): Promise<ArticleReshareResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/articles/${id}/reshare`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        dryRun: input.dryRun ?? true,
        targetMode: input.targetMode ?? 'all',
        recipientEmails: input.recipientEmails ?? [],
      }),
    });
    return handleResponse<ArticleReshareResponse>(response);
  },

  async getEmailEngagementSummary(options?: { includeDeleted?: boolean }): Promise<ArticleEmailEngagementSummary[]> {
    const authHeaders = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options?.includeDeleted) {
      params.set('include_deleted', 'true');
    }
    const response = await fetch(`${BASE_URL}/email-engagement/summary${params.toString() ? `?${params.toString()}` : ''}`, {
      headers: authHeaders,
    });
    return handleResponse<ArticleEmailEngagementSummary[]>(response);
  },

  async getArticleEmailEngagement(id: string): Promise<ArticleEmailEngagementDetail> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/articles/${id}/email-engagement`, {
      headers: authHeaders,
    });
    return handleResponse<ArticleEmailEngagementDetail>(response);
  },

  async retryUndeliveredArticleNotifications(
    id: string,
    input?: {
      source?: 'publish' | 'reshare';
    },
  ): Promise<ArticleNotificationJob> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/articles/${id}/retry-undelivered`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        source: input?.source ?? 'publish',
      }),
    });
    const result = await handleResponse<ArticleNotificationJob>(response);
    notifyEmailEngagementChanged(result.articleId, 'retry_queued');
    return result;
  },

  async getNotificationJob(jobId: string): Promise<ArticleNotificationJob> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/notification-jobs/${jobId}`, {
      headers: authHeaders,
    });
    const result = await handleResponse<ArticleNotificationJob>(response);
    notifyEmailEngagementChanged(result.articleId, 'notification_job_updated');
    return result;
  },

  async getNotificationCampaign(campaignId: string): Promise<ArticleNotificationCampaign> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/notification-campaigns/${campaignId}`, {
      headers: authHeaders,
    });
    const result = await handleResponse<ArticleNotificationCampaign>(response);
    notifyEmailEngagementChanged(result.articleId, 'notification_campaign_updated');
    return result;
  },

  async processNotificationJobs(input?: {
    jobId?: string;
    maxJobs?: number;
    maxBatchesPerJob?: number;
  }): Promise<ArticleNotificationProcessorResult> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/notification-jobs/process`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jobId: input?.jobId,
        maxJobs: input?.maxJobs,
        maxBatchesPerJob: input?.maxBatchesPerJob,
      }),
    });
    return handleResponse<ArticleNotificationProcessorResult>(response);
  },

  async getNotificationProcessorStatus(): Promise<ArticleNotificationProcessorState | null> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/notification-jobs/processor-status`, {
      headers: authHeaders,
    });
    return handleResponse<ArticleNotificationProcessorState | null>(response);
  },
};

// ============================================================================
// CATEGORIES API
// ============================================================================

/**
 * Categories API namespace
 * All operations related to category management
 */
export const CategoriesAPI = {
  /**
   * Get all categories
   * 
   * @returns Array of categories
   * 
   * @example
   * ```typescript
   * const categories = await CategoriesAPI.getCategories();
   * ```
   */
  async getCategories(): Promise<Category[]> {
    const response = await fetch(`${BASE_URL}/categories`, { headers });
    return handleResponse<Category[]>(response);
  },

  /**
   * Get single category by ID
   * 
   * @param id - Category ID
   * @returns Category
   * 
   * @example
   * ```typescript
   * const category = await CategoriesAPI.getCategory('cat-123');
   * ```
   */
  async getCategory(id: string): Promise<Category> {
    const response = await fetch(`${BASE_URL}/categories/${id}`, { headers });
    return handleResponse<Category>(response);
  },

  /**
   * Create new category
   * 
   * @param input - Category data
   * @returns Created category
   * 
   * @example
   * ```typescript
   * const category = await CategoriesAPI.createCategory({
   *   name: 'Financial Planning',
   *   icon: '📊',
   * });
   * ```
   */
  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const response = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<Category>(response);
  },

  /**
   * Update existing category
   * 
   * @param input - Update data with category ID
   * @returns Updated category
   * 
   * @example
   * ```typescript
   * const category = await CategoriesAPI.updateCategory({
   *   id: 'cat-123',
   *   name: 'Updated Name',
   * });
   * ```
   */
  async updateCategory(input: UpdateCategoryInput): Promise<Category> {
    const { id, ...updates } = input;
    const response = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleResponse<Category>(response);
  },

  /**
   * Delete category
   * 
   * @param id - Category ID
   * 
   * @example
   * ```typescript
   * await CategoriesAPI.deleteCategory('cat-123');
   * ```
   */
  async deleteCategory(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<void>(response);
  },

  /**
   * Reorder categories
   * Updates sort_order for multiple categories
   * 
   * @param updates - Array of {id, sort_order}
   * 
   * @example
   * ```typescript
   * await CategoriesAPI.reorderCategories([
   *   { id: 'cat-1', sort_order: 0 },
   *   { id: 'cat-2', sort_order: 1 },
   * ]);
   * ```
   */
  async reorderCategories(updates: ReorderUpdate[]): Promise<void> {
    const response = await fetch(`${BASE_URL}/categories/reorder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ updates }),
    });
    await handleResponse<void>(response);
  },
};

// ============================================================================
// CONTENT TYPES API
// ============================================================================

/**
 * Content Types API namespace
 * All operations related to content type management
 */
export const ContentTypesAPI = {
  /**
   * Get all content types
   * 
   * @returns Array of content types
   * 
   * @example
   * ```typescript
   * const types = await ContentTypesAPI.getTypes();
   * ```
   */
  async getTypes(): Promise<ContentType[]> {
    const response = await fetch(`${BASE_URL}/types`, { headers });
    return handleResponse<ContentType[]>(response);
  },

  /**
   * Get single content type by ID
   * 
   * @param id - Content type ID
   * @returns Content type
   * 
   * @example
   * ```typescript
   * const type = await ContentTypesAPI.getType('type-123');
   * ```
   */
  async getType(id: string): Promise<ContentType> {
    const response = await fetch(`${BASE_URL}/types/${id}`, { headers });
    return handleResponse<ContentType>(response);
  },

  /**
   * Create new content type
   * 
   * @param input - Content type data
   * @returns Created content type
   * 
   * @example
   * ```typescript
   * const type = await ContentTypesAPI.createType({
   *   name: 'Blog Post',
   *   icon: '📝',
   * });
   * ```
   */
  async createType(input: CreateContentTypeInput): Promise<ContentType> {
    const response = await fetch(`${BASE_URL}/types`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<ContentType>(response);
  },

  /**
   * Update existing content type
   * 
   * @param input - Update data with type ID
   * @returns Updated content type
   * 
   * @example
   * ```typescript
   * const type = await ContentTypesAPI.updateType({
   *   id: 'type-123',
   *   name: 'Updated Name',
   * });
   * ```
   */
  async updateType(input: UpdateContentTypeInput): Promise<ContentType> {
    const { id, ...updates } = input;
    const response = await fetch(`${BASE_URL}/types/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleResponse<ContentType>(response);
  },

  /**
   * Delete content type
   * 
   * @param id - Content type ID
   * 
   * @example
   * ```typescript
   * await ContentTypesAPI.deleteType('type-123');
   * ```
   */
  async deleteType(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/types/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<void>(response);
  },

  /**
   * Reorder content types
   * Updates sort_order for multiple types
   * 
   * @param updates - Array of {id, sort_order}
   * 
   * @example
   * ```typescript
   * await ContentTypesAPI.reorderTypes([
   *   { id: 'type-1', sort_order: 0 },
   *   { id: 'type-2', sort_order: 1 },
   * ]);
   * ```
   */
  async reorderTypes(updates: ReorderUpdate[]): Promise<void> {
    const response = await fetch(`${BASE_URL}/types/reorder`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ updates }),
    });
    await handleResponse<void>(response);
  },
};

// ============================================================================
// STATISTICS API
// ============================================================================

/**
 * Statistics API namespace
 * Analytics and statistics for publications
 */
export const StatsAPI = {
  /**
   * Get publication statistics
   * 
   * @returns Publication stats
   * 
   * @example
   * ```typescript
   * const stats = await StatsAPI.getStats();
   * console.log(`Total articles: ${stats.total}`);
   * ```
   */
  async getStats(): Promise<PublicationStats> {
    const response = await fetch(`${BASE_URL}/stats`, { headers });
    return handleResponse<PublicationStats>(response);
  },
};

// ============================================================================
// INITIALIZATION API
// ============================================================================

/**
 * Initialization API namespace
 * Check and initialize the publications system
 */
export const InitializationAPI = {
  /**
   * Check if publications is initialized
   * 
   * @returns Initialization status
   * 
   * @example
   * ```typescript
   * const status = await InitializationAPI.checkStatus();
   * if (!status.is_initialized) {
   *   await InitializationAPI.initialize();
   * }
   * ```
   */
  async checkStatus(): Promise<InitializationStatus> {
    try {
      const categoriesResponse = await fetch(`${BASE_URL}/categories`, { headers });
      const categories = await handleResponse<Category[]>(categoriesResponse);
      
      const typesResponse = await fetch(`${BASE_URL}/types`, { headers });
      const types = await handleResponse<ContentType[]>(typesResponse);

      return {
        is_initialized: categories.length > 0 && types.length > 0,
        has_categories: categories.length > 0,
        has_types: types.length > 0,
      };
    } catch (error) {
      return {
        is_initialized: false,
        has_categories: false,
        has_types: false,
      };
    }
  },

  /**
   * Initialize publications with default data
   * 
   * @param input - Initialization options
   * @returns Success response
   * 
   * @example
   * ```typescript
   * await InitializationAPI.initialize({
   *   create_default_categories: true,
   *   create_default_types: true,
   * });
   * ```
   */
  async initialize(input: InitializePublicationsInput = {}): Promise<{ success: boolean }> {
    const response = await fetch(`${BASE_URL}/initialize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<{ success: boolean }>(response);
  },
};

// ============================================================================
// SETTINGS API
// ============================================================================

/**
 * Settings API namespace
 * Configuration and maintenance operations
 */
export const SettingsAPI = {
  /**
   * Export all data
   */
  async exportData(): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/export`, { headers });
    return handleResponse(response);
  },

  /**
   * Import data
   */
  async importData(data: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return handleResponse(response);
  },

  /**
   * Clear all drafts
   */
  async clearDrafts(): Promise<{ message: string }> {
    const response = await fetch(`${BASE_URL}/maintenance/clear-drafts`, {
      method: 'DELETE',
      headers
    });
    return handleResponse(response);
  }
};

// ============================================================================
// AI WRITING API
// ============================================================================

const AI_BASE_URL = getModuleUrl('publications-ai');

/**
 * AI Writing API namespace
 * AI-powered content generation and transformation (Phase 3)
 */
export const AIWritingAPI = {
  /**
   * Generate or transform content using AI
   */
  async generate(request: AIWritingRequest): Promise<AIWritingResponse> {
    const response = await fetch(`${AI_BASE_URL}/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    return handleResponse<AIWritingResponse>(response);
  },

  /**
   * Generate a complete article from a structured brief (Phase 5)
   */
  async generateArticle(brief: GenerateArticleBrief): Promise<GenerateArticleResult> {
    const response = await fetch(`${AI_BASE_URL}/generate-article`, {
      method: 'POST',
      headers,
      body: JSON.stringify(brief),
    });
    return handleResponse<GenerateArticleResult>(response);
  },
};

// ============================================================================
// CONTENT TEMPLATES API (Phase 4)
// ============================================================================

export const TemplatesAPI = {
  async getTemplates(): Promise<ContentTemplate[]> {
    const response = await fetch(`${BASE_URL}/templates`, { headers });
    return handleResponse<ContentTemplate[]>(response);
  },

  async getTemplate(id: string): Promise<ContentTemplate> {
    const response = await fetch(`${BASE_URL}/templates/${id}`, { headers });
    return handleResponse<ContentTemplate>(response);
  },

  async createTemplate(input: CreateTemplateInput): Promise<ContentTemplate> {
    const response = await fetch(`${BASE_URL}/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<ContentTemplate>(response);
  },

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<ContentTemplate> {
    const response = await fetch(`${BASE_URL}/templates/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<ContentTemplate>(response);
  },

  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/templates/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<void>(response);
  },

  async seedDefaults(): Promise<ContentTemplate[]> {
    const response = await fetch(`${BASE_URL}/templates/seed`, {
      method: 'POST',
      headers,
    });
    return handleResponse<ContentTemplate[]>(response);
  },
};

// ============================================================================
// VERSION HISTORY API (Phase 4)
// ============================================================================

export const VersionsAPI = {
  async getVersions(articleId: string): Promise<ArticleVersion[]> {
    const response = await fetch(`${BASE_URL}/versions/${articleId}`, { headers });
    return handleResponse<ArticleVersion[]>(response);
  },

  async createVersion(articleId: string, editedBy?: string): Promise<ArticleVersion> {
    const response = await fetch(`${BASE_URL}/versions/${articleId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ edited_by: editedBy || 'system' }),
    });
    return handleResponse<ArticleVersion>(response);
  },

  async restoreVersion(articleId: string, versionId: string): Promise<unknown> {
    const response = await fetch(`${BASE_URL}/versions/${articleId}/${versionId}/restore`, {
      method: 'POST',
      headers,
    });
    return handleResponse(response);
  },
};

// ============================================================================
// AUTO CONTENT API (Phase 5)
// ============================================================================

export const AutoContentAPI = {
  async getConfigs(): Promise<PipelineConfig[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/configs`, { headers });
    return handleResponse<PipelineConfig[]>(response);
  },

  async getConfig(id: PipelineId): Promise<PipelineConfig> {
    const response = await fetch(`${AUTO_CONTENT_URL}/configs/${id}`, { headers });
    return handleResponse<PipelineConfig>(response);
  },

  async updateConfig(id: PipelineId, updates: Partial<PipelineConfig>): Promise<PipelineConfig> {
    const response = await fetch(`${AUTO_CONTENT_URL}/configs/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleResponse<PipelineConfig>(response);
  },

  async triggerPipeline(id: PipelineId): Promise<PipelineTriggerResult> {
    const response = await fetch(`${AUTO_CONTENT_URL}/trigger/${id}`, {
      method: 'POST',
      headers,
    });
    return handleResponse<PipelineTriggerResult>(response);
  },

  async triggerAll(): Promise<PipelineTriggerResult[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/trigger-all`, {
      method: 'POST',
      headers,
    });
    return handleResponse<PipelineTriggerResult[]>(response);
  },

  /**
   * Process pipelines that are due based on their scheduleIntervalHours.
   * Called by the client-side auto-content poller. Idempotent — safe to call repeatedly.
   */
  async processDue(): Promise<{
    processed: PipelineTriggerResult[];
    skippedCount: number;
    totalArticlesGenerated: number;
  }> {
    const response = await fetch(`${AUTO_CONTENT_URL}/process-due`, {
      method: 'POST',
      headers,
    });
    return handleResponse<{
      processed: PipelineTriggerResult[];
      skippedCount: number;
      totalArticlesGenerated: number;
    }>(response);
  },

  async triggerSource(sourceId: string): Promise<{ results: PipelineTriggerResult[]; totalGenerated: number; sourceName: string }> {
    const response = await fetch(`${AUTO_CONTENT_URL}/trigger-source/${sourceId}`, {
      method: 'POST',
      headers,
    });
    return handleResponse<{ results: PipelineTriggerResult[]; totalGenerated: number; sourceName: string }>(response);
  },

  async getRunHistory(id: PipelineId, limit?: number): Promise<PipelineRunLog[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await fetch(`${AUTO_CONTENT_URL}/history/${id}${params}`, { headers });
    return handleResponse<PipelineRunLog[]>(response);
  },

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events`, { headers });
    return handleResponse<CalendarEvent[]>(response);
  },

  async addCalendarEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });
    return handleResponse<CalendarEvent>(response);
  },

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleResponse<CalendarEvent>(response);
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    const response = await fetch(`${AUTO_CONTENT_URL}/calendar-events/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<void>(response);
  },

  // ── Content Sources ─────────────────────────────────────────────

  async getContentSources(): Promise<ContentSource[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources`, { headers });
    return handleResponse<ContentSource[]>(response);
  },

  async addContentSource(input: CreateContentSourceInput): Promise<ContentSource> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    return handleResponse<ContentSource>(response);
  },

  async updateContentSource(id: string, updates: Partial<ContentSource>): Promise<ContentSource> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    return handleResponse<ContentSource>(response);
  },

  async deleteContentSource(id: string): Promise<void> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<void>(response);
  },

  // ── Feed Discovery ───────────────────────────────────────────────

  /**
   * Discover RSS/Atom feeds from a webpage URL.
   * If the URL is already an RSS feed, returns it directly.
   * Otherwise parses the HTML for <link rel="alternate"> feed tags
   * and probes common feed paths as a fallback.
   */
  async discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
    const response = await fetch(`${AUTO_CONTENT_URL}/sources/discover-feeds`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    return handleResponse<DiscoveredFeed[]>(response);
  },
};

// ============================================================================
// AGGREGATED API EXPORT
// ============================================================================

/**
 * Complete Publications API
 * Aggregated namespace for all API operations
 */
export const PublicationsAPI = {
  Articles: ArticlesAPI,
  Categories: CategoriesAPI,
  Types: ContentTypesAPI,
  Stats: StatsAPI,
  Init: InitializationAPI,
  Settings: SettingsAPI,
  AI: AIWritingAPI,
  Templates: TemplatesAPI,
  Versions: VersionsAPI,
  AutoContent: AutoContentAPI,
};

/**
 * Parse RSS Feed via Proxy
 * Used by Market News feature
 */
export async function fetchRSSFeed(url: string): Promise<NewsItem[]> {
  try {
    const proxyUrl = `${RSS_PROXY_URL}?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, { 
      signal: AbortSignal.timeout(20000),
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`
      }
    });
    
    if (!response.ok) {
      logger.warn(`RSS fetch failed for ${url}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (data.status === 'ok' && data.items) {
      return data.items.map((item: Record<string, unknown>) => ({
        title: typeof item.title === 'string' ? item.title : 'Untitled',
        pubDate: typeof item.pubDate === 'string' ? item.pubDate : new Date().toISOString(),
        author: typeof item.author === 'string' ? item.author : (data.feed?.title || 'Investing.com'),
        link: typeof item.link === 'string' ? item.link : '#',
        image: getRSSImage(item),
        description: typeof item.description === 'string' ? item.description : '',
        source: data.feed?.title || 'News'
      }));
    }
    
    return [];
  } catch (error) {
    logger.error(`RSS feed fetch failed for ${url}`, error);
    return [];
  }
}

function getRSSImage(item: Record<string, unknown>): string {
  if (typeof item.enclosure === 'object' && item.enclosure && 'link' in item.enclosure && typeof item.enclosure.link === 'string') {
    return item.enclosure.link;
  }
  if (typeof item.thumbnail === 'string') {
    return item.thumbnail;
  }
  return 'https://i-invdn-com.investing.com/news/news_headline_open_108x81.jpg';
}

// ============================================================================
// NEWSLETTER SUBSCRIBERS API (§5.1 — data boundary)
// ============================================================================

const NEWSLETTER_URL = getModuleUrl('newsletter');

/**
 * Newsletter Subscribers API namespace.
 * Uses dynamic auth headers because newsletter admin routes require authentication (§5.1).
 */
export const NewsletterAPI = {
  /** GET /newsletter/admin/subscribers */
  async getSubscribers(): Promise<SubscriberListResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/subscribers`, { headers: authHeaders });
    return handleResponse<SubscriberListResponse>(response);
  },

  /** POST /newsletter/admin/add */
  async addSubscriber(input: {
    email: string;
    firstName: string;
    surname: string;
  }): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/add`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(input),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },

  /** POST /newsletter/admin/bulk */
  async bulkAdd(subscribers: {
    email: string;
    firstName?: string;
    surname?: string;
  }[]): Promise<BulkUploadResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/bulk`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ subscribers }),
    });
    return handleResponse<BulkUploadResponse>(response);
  },

  /** POST /newsletter/admin/remove */
  async removeSubscriber(email: string): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/remove`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email }),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },

  /** POST /newsletter/admin/resubscribe */
  async resubscribe(email: string): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/resubscribe`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email }),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },

  /** POST /newsletter/admin/update */
  async updateSubscriber(input: UpdateSubscriberInput): Promise<SubscriberMutationResponse> {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${NEWSLETTER_URL}/admin/update`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(input),
    });
    return handleResponse<SubscriberMutationResponse>(response);
  },
};

export default PublicationsAPI;
