/**
 * Publications utils — slug, status, filtering, and sorting helpers for
 * articles. One slice of the former monolithic utils.tsx; the barrel
 * ../utils.tsx re-exports everything, so consumer imports are unchanged.
 */
import type { Article, ArticleStatus } from '../types';

// ============================================================================
// SLUG UTILITIES
// ============================================================================

/**
 * Generate URL-friendly slug from title
 *
 * @param title - Title to slugify
 * @returns URL-friendly slug
 *
 * @example
 * ```typescript
 * generateSlug('My Article Title!'); // 'my-article-title'
 * generateSlug('Financial Planning 101'); // 'financial-planning-101'
 * ```
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Check if slug is available
 *
 * @param slug - Slug to check
 * @param articles - Existing articles
 * @param excludeId - Article ID to exclude (for updates)
 * @returns True if available
 *
 * @example
 * ```typescript
 * if (isSlugAvailable('my-article', articles)) {
 *   // Slug is available
 * }
 * ```
 */
export function isSlugAvailable(slug: string, articles: Article[], excludeId?: string): boolean {
  return !articles.some((article) => article.slug === slug && article.id !== excludeId);
}

/**
 * Generate unique slug
 * Adds numeric suffix if slug exists
 *
 * @param baseSlug - Base slug
 * @param articles - Existing articles
 * @param excludeId - Article ID to exclude
 * @returns Unique slug
 *
 * @example
 * ```typescript
 * const slug = generateUniqueSlug('my-article', articles);
 * // If 'my-article' exists, returns 'my-article-2'
 * ```
 */
export function generateUniqueSlug(
  baseSlug: string,
  articles: Article[],
  excludeId?: string,
): string {
  let slug = baseSlug;
  let counter = 2;

  while (!isSlugAvailable(slug, articles, excludeId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

// ============================================================================
// STATUS UTILITIES
// ============================================================================

/**
 * Check if status transition is allowed
 *
 * @param from - Current status
 * @param to - Target status
 * @returns True if transition is allowed
 *
 * @example
 * ```typescript
 * canTransitionStatus('draft', 'published'); // true
 * canTransitionStatus('archived', 'published'); // false
 * ```
 */
export function canTransitionStatus(from: ArticleStatus, to: ArticleStatus): boolean {
  // Define allowed transitions
  const transitions: Record<ArticleStatus, ArticleStatus[]> = {
    draft: ['in_review', 'scheduled', 'published', 'archived'],
    in_review: ['draft', 'scheduled', 'published', 'archived'],
    scheduled: ['draft', 'published', 'archived'],
    published: ['archived'],
    archived: ['draft'],
  };

  return transitions[from]?.includes(to) ?? false;
}

/**
 * Get status color class
 *
 * @param status - Article status
 * @returns Tailwind color classes
 *
 * @example
 * ```typescript
 * const className = getStatusColor('published'); // 'bg-green-100 text-green-700'
 * ```
 */
export function getStatusColor(status: ArticleStatus): string {
  const colors: Record<ArticleStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-blue-100 text-blue-700',
    published: 'bg-green-100 text-green-700',
    archived: 'bg-red-100 text-red-700',
  };

  return colors[status] || 'bg-gray-100 text-gray-700';
}

/**
 * Get status label
 *
 * @param status - Article status
 * @returns Human-readable label
 *
 * @example
 * ```typescript
 * getStatusLabel('in_review'); // 'In Review'
 * ```
 */
export function getStatusLabel(status: ArticleStatus): string {
  const labels: Record<ArticleStatus, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    scheduled: 'Scheduled',
    published: 'Published',
    archived: 'Archived',
  };

  return labels[status] || status;
}

/**
 * Check if article is published
 *
 * @param article - Article to check
 * @returns True if published
 *
 * @example
 * ```typescript
 * if (isPublished(article)) {
 *   // Article is live
 * }
 * ```
 */
export function isPublished(article: Article): boolean {
  return article.status === 'published' && !!article.published_at;
}

/**
 * Check if article is scheduled for future
 *
 * @param article - Article to check
 * @returns True if scheduled
 *
 * @example
 * ```typescript
 * if (isScheduledForFuture(article)) {
 *   // Will publish later
 * }
 * ```
 */
export function isScheduledForFuture(article: Article): boolean {
  if (article.status !== 'scheduled' || !article.scheduled_for) {
    return false;
  }

  const scheduledDate = new Date(article.scheduled_for);
  const now = new Date();

  return scheduledDate > now;
}

/**
 * Check if article should auto-publish
 *
 * @param article - Article to check
 * @returns True if should auto-publish now
 *
 * @example
 * ```typescript
 * if (shouldAutoPublish(article)) {
 *   await ArticlesAPI.publishArticle(article.id);
 * }
 * ```
 */
export function shouldAutoPublish(article: Article): boolean {
  if (article.status !== 'scheduled' || !article.scheduled_for) {
    return false;
  }

  const scheduledDate = new Date(article.scheduled_for);
  const now = new Date();

  return scheduledDate <= now;
}

export function getArticleImageUrl(
  article:
    | (Partial<Article> & {
        feature_image_url?: string | null;
        featured_image_url?: string | null;
      })
    | null
    | undefined,
): string | null {
  if (!article) return null;

  return (
    article.hero_image_url ||
    article.feature_image_url ||
    article.featured_image_url ||
    article.featured_image ||
    article.thumbnail_image_url ||
    null
  );
}

// ============================================================================
// FILTERING UTILITIES
// ============================================================================

/**
 * Filter articles by status
 *
 * @param articles - Articles to filter
 * @param status - Status filter ('all' or specific status)
 * @returns Filtered articles
 *
 * @example
 * ```typescript
 * const published = filterByStatus(articles, 'published');
 * ```
 */
export function filterByStatus(articles: Article[], status: ArticleStatus | 'all'): Article[] {
  if (status === 'all') return articles;
  return articles.filter((article) => article.status === status);
}

/**
 * Filter articles by category
 *
 * @param articles - Articles to filter
 * @param categoryId - Category ID ('all' or specific)
 * @returns Filtered articles
 *
 * @example
 * ```typescript
 * const filtered = filterByCategory(articles, 'cat-123');
 * ```
 */
export function filterByCategory(articles: Article[], categoryId: string | 'all'): Article[] {
  if (categoryId === 'all') return articles;
  return articles.filter((article) => article.category_id === categoryId);
}

/**
 * Filter articles by content type
 *
 * @param articles - Articles to filter
 * @param typeId - Type ID ('all' or specific)
 * @returns Filtered articles
 *
 * @example
 * ```typescript
 * const filtered = filterByType(articles, 'type-456');
 * ```
 */
export function filterByType(articles: Article[], typeId: string | 'all'): Article[] {
  if (typeId === 'all') return articles;
  return articles.filter((article) => article.type_id === typeId);
}

/**
 * Search articles by query
 * Searches title, excerpt, and content
 *
 * @param articles - Articles to search
 * @param query - Search query
 * @returns Matching articles
 *
 * @example
 * ```typescript
 * const results = searchArticles(articles, 'financial planning');
 * ```
 */
export function searchArticles(articles: Article[], query: string): Article[] {
  if (!query) return articles;

  const queryLower = query.toLowerCase();

  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(queryLower) ||
      article.excerpt.toLowerCase().includes(queryLower) ||
      article.content?.toLowerCase().includes(queryLower) ||
      article.subtitle?.toLowerCase().includes(queryLower),
  );
}

/**
 * Filter featured articles
 *
 * @param articles - Articles to filter
 * @returns Featured articles only
 *
 * @example
 * ```typescript
 * const featured = getFeaturedArticles(articles);
 * ```
 */
export function getFeaturedArticles(articles: Article[]): Article[] {
  return articles.filter((article) => article.is_featured);
}

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Sort articles by date
 *
 * @param articles - Articles to sort
 * @param field - Date field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted articles
 *
 * @example
 * ```typescript
 * const sorted = sortByDate(articles, 'published_at', 'desc');
 * ```
 */
export function sortByDate(
  articles: Article[],
  field: 'created_at' | 'updated_at' | 'published_at',
  order: 'asc' | 'desc' = 'desc',
): Article[] {
  return [...articles].sort((a, b) => {
    const dateA = a[field] ? new Date(a[field]!).getTime() : 0;
    const dateB = b[field] ? new Date(b[field]!).getTime() : 0;

    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Sort articles by title (alphabetically)
 *
 * @param articles - Articles to sort
 * @param order - Sort order
 * @returns Sorted articles
 *
 * @example
 * ```typescript
 * const sorted = sortByTitle(articles, 'asc');
 * ```
 */
export function sortByTitle(articles: Article[], order: 'asc' | 'desc' = 'asc'): Article[] {
  return [...articles].sort((a, b) => {
    const comparison = a.title.localeCompare(b.title);
    return order === 'desc' ? -comparison : comparison;
  });
}

/**
 * Sort with featured articles first
 *
 * @param articles - Articles to sort
 * @returns Sorted articles (featured first)
 *
 * @example
 * ```typescript
 * const sorted = sortByFeatured(articles);
 * ```
 */
export function sortByFeatured(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return 0;
  });
}
