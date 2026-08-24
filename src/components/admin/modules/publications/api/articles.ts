/**
 * The article CRUD, publishing and email-engagement calls.
 *
 * Split out of `api.ts` (1,441 lines); `api.ts` still re-exports every group,
 * because consumers import the aggregate from there.
 */
import type { Article, CreateArticleInput, UpdateArticleInput, ArticleFilters } from '../types';
import type {
  ArticlePublishResponse,
  ArticleReshareResponse,
  ArticleEmailEngagementSummary,
  ArticleEmailEngagementDetail,
  ArticleNotificationJob,
  ArticleNotificationCampaign,
  ArticleNotificationProcessorResult,
  ArticleNotificationProcessorState,
} from '../types';
import {
  BASE_URL,
  getAuthHeaders,
  getMultipartAuthHeaders,
  handleResponse,
  headers,
  notifyEmailEngagementChanged,
} from './shared';

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
    if (filters?.category_id && filters.category_id !== 'all')
      params.append('category_id', filters.category_id);
    if (filters?.type_id && filters.type_id !== 'all') params.append('type_id', filters.type_id);
    if (filters?.is_featured !== undefined)
      params.append('is_featured', String(filters.is_featured));
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
  async publishArticle(
    id: string,
    options?: { notify_subscribers?: boolean },
  ): Promise<ArticlePublishResponse> {
    const response = await fetch(`${BASE_URL}/articles/${id}/publish`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ notify_subscribers: options?.notify_subscribers ?? true }),
    });
    const result = await handleResponse<ArticlePublishResponse>(response);
    notifyEmailEngagementChanged(result.article.id, 'published');
    return result;
  },

  async uploadImage(file: File): Promise<{ url: string; path: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${BASE_URL}/upload-image`, {
      method: 'POST',
      headers: await getMultipartAuthHeaders(),
      body: formData,
    });

    return handleResponse<{ url: string; path: string }>(response);
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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

  async getEmailEngagementSummary(options?: {
    includeDeleted?: boolean;
  }): Promise<ArticleEmailEngagementSummary[]> {
    const authHeaders = await getAuthHeaders();
    const params = new URLSearchParams();
    if (options?.includeDeleted) {
      params.set('include_deleted', 'true');
    }
    const response = await fetch(
      `${BASE_URL}/email-engagement/summary${params.toString() ? `?${params.toString()}` : ''}`,
      {
        headers: authHeaders,
      },
    );
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
      /** Re-send to the full newsletter list (publish only), then queue failures for retry. */
      blastAll?: boolean;
    },
  ): Promise<
    ArticleNotificationJob & {
      blastRecipientCount?: number;
      mode?: 'blast_all' | 'resume_undelivered';
    }
  > {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}/articles/${id}/retry-undelivered`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        source: input?.source ?? 'publish',
        blastAll: input?.blastAll ?? false,
      }),
    });
    const result = await handleResponse<
      ArticleNotificationJob & {
        blastRecipientCount?: number;
        mode?: 'blast_all' | 'resume_undelivered';
      }
    >(response);
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
