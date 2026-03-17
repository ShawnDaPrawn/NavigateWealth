/**
 * Publications Module - Utility Functions
 * Navigate Wealth Admin Dashboard
 * 
 * Reusable utility functions for:
 * - Slug generation and validation
 * - Status transitions and helpers
 * - Filtering and sorting
 * - Validation
 * - Formatting
 * - Performance
 * 
 * @module publications/utils
 */

import type {
  Article,
  ArticleFormData,
  ArticleStatus,
  Category,
  ContentType,
  CreateArticleInput,
  CreateCategoryInput,
  CreateContentTypeInput,
  ValidationResult,
} from './types';
import type { Subscriber, SubscriberStatus, UnsubTimeRange } from './types';
import { UNSUB_TIME_RANGE_DAYS } from './constants';

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
export function isSlugAvailable(
  slug: string,
  articles: Article[],
  excludeId?: string
): boolean {
  return !articles.some(
    (article) => article.slug === slug && article.id !== excludeId
  );
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
  excludeId?: string
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
export function filterByStatus(
  articles: Article[],
  status: ArticleStatus | 'all'
): Article[] {
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
export function filterByCategory(
  articles: Article[],
  categoryId: string | 'all'
): Article[] {
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
export function filterByType(
  articles: Article[],
  typeId: string | 'all'
): Article[] {
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
      article.subtitle?.toLowerCase().includes(queryLower)
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
  order: 'asc' | 'desc' = 'desc'
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
export function sortByTitle(
  articles: Article[],
  order: 'asc' | 'desc' = 'asc'
): Article[] {
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

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate article input
 * 
 * @param input - Article data to validate
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const result = validateArticle(input);
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateArticle(input: CreateArticleInput): ValidationResult {
  const errors: Record<string, string> = {};

  // Title validation
  if (!input.title || input.title.trim().length === 0) {
    errors.title = 'Title is required';
  } else if (input.title.length > 200) {
    errors.title = 'Title must be less than 200 characters';
  }

  // Excerpt validation
  if (!input.excerpt || input.excerpt.trim().length === 0) {
    errors.excerpt = 'Excerpt is required';
  } else if (input.excerpt.length > 500) {
    errors.excerpt = 'Excerpt must be less than 500 characters';
  }

  // Category validation
  if (!input.category_id) {
    errors.category_id = 'Category is required';
  }

  // Type validation
  if (!input.type_id) {
    errors.type_id = 'Content type is required';
  }

  // Scheduled date validation
  if (input.status === 'scheduled' && !input.scheduled_for) {
    errors.scheduled_for = 'Scheduled date is required for scheduled articles';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate category input
 * 
 * @param input - Category data to validate
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const result = validateCategory(input);
 * ```
 */
export function validateCategory(input: CreateCategoryInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Category name is required';
  } else if (input.name.length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  if (input.description && input.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate content type input
 * 
 * @param input - Content type data to validate
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const result = validateContentType(input);
 * ```
 */
export function validateContentType(input: CreateContentTypeInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.name || input.name.trim().length === 0) {
    errors.name = 'Type name is required';
  } else if (input.name.length > 100) {
    errors.name = 'Name must be less than 100 characters';
  }

  if (input.description && input.description.length > 500) {
    errors.description = 'Description must be less than 500 characters';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format published date
 * 
 * @param date - Date string
 * @returns Formatted date
 * 
 * @example
 * ```typescript
 * formatPublishDate('2026-01-05'); // 'Jan 5, 2026'
 * ```
 */
export function formatPublishDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date (alias for formatPublishDate for backward compatibility)
 * 
 * @param date - Date string or Date object
 * @returns Formatted date
 * 
 * @example
 * ```typescript
 * formatDate('2026-01-05'); // 'Jan 5, 2026'
 * formatDate(new Date()); // 'Jan 5, 2026'
 * ```
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time
 * 
 * @param date - Date string or Date object
 * @returns Formatted date and time
 * 
 * @example
 * ```typescript
 * formatDateTime('2026-01-05T14:30:00'); // 'Jan 5, 2026 at 2:30 PM'
 * ```
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format relative time
 * 
 * @param date - Date string
 * @returns Relative time string
 * 
 * @example
 * ```typescript
 * formatRelativeTime(yesterday); // '1 day ago'
 * ```
 */
export function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return formatPublishDate(date);
}

/**
 * Get relative time (alias for formatRelativeTime for backward compatibility)
 * 
 * @param date - Date string or Date object
 * @returns Relative time string
 * 
 * @example
 * ```typescript
 * getRelativeTime(yesterday); // '1 day ago'
 * ```
 */
export function getRelativeTime(date: string | Date): string {
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  return formatRelativeTime(dateStr);
}

/**
 * Truncate text
 * 
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 * 
 * @example
 * ```typescript
 * truncateText('Long text...', 50); // 'Long text...'
 * ```
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// GROUPING UTILITIES
// ============================================================================

/**
 * Group articles by status
 * 
 * @param articles - Articles to group
 * @returns Articles grouped by status
 * 
 * @example
 * ```typescript
 * const grouped = groupByStatus(articles);
 * // { draft: [...], published: [...], ... }
 * ```
 */
export function groupByStatus(articles: Article[]): Record<ArticleStatus, Article[]> {
  const grouped: Record<ArticleStatus, Article[]> = {
    draft: [],
    in_review: [],
    scheduled: [],
    published: [],
    archived: [],
  };

  articles.forEach((article) => {
    if (grouped[article.status]) {
      grouped[article.status].push(article);
    }
  });

  return grouped;
}

/**
 * Group articles by category
 * 
 * @param articles - Articles to group
 * @returns Articles grouped by category ID
 * 
 * @example
 * ```typescript
 * const grouped = groupByCategory(articles);
 * // { 'cat-1': [...], 'cat-2': [...] }
 * ```
 */
export function groupByCategory(articles: Article[]): Record<string, Article[]> {
  const grouped: Record<string, Article[]> = {};

  articles.forEach((article) => {
    if (!grouped[article.category_id]) {
      grouped[article.category_id] = [];
    }
    grouped[article.category_id].push(article);
  });

  return grouped;
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

/**
 * Debounce function to limit how often a function is called
 * 
 * @param func - Function to debounce
 * @param wait - Milliseconds to wait
 * @returns Debounced function
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   searchArticles(query);
 * }, 300);
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// ============================================================================
// READING TIME & FORM VALIDATION
// ============================================================================

/**
 * Calculate reading time based on word count
 * 
 * @param text - Text content to calculate reading time for
 * @returns Estimated reading time in minutes (minimum 1)
 */
export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return Math.max(1, minutes);
}

/**
 * Validate article form data
 * 
 * @param data - Partial article form data to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateArticleForm(data: Partial<ArticleFormData>): string[] {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters');
  }
  if (data.title && data.title.length > 200) {
    errors.push('Title must not exceed 200 characters');
  }
  if (!data.slug || data.slug.trim().length < 3) {
    errors.push('Slug must be at least 3 characters');
  }
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
  }
  if (!data.excerpt || data.excerpt.trim().length < 10) {
    errors.push('Excerpt must be at least 10 characters');
  }
  if (data.excerpt && data.excerpt.length > 500) {
    errors.push('Excerpt must not exceed 500 characters');
  }
  if (!data.body || data.body.trim().length < 50) {
    errors.push('Article body must be at least 50 characters');
  }
  if (!data.category_id) {
    errors.push('Please select a category');
  }
  if (!data.type_id) {
    errors.push('Please select a type');
  }
  if (data.reading_time_minutes && (data.reading_time_minutes < 1 || data.reading_time_minutes > 120)) {
    errors.push('Reading time must be between 1 and 120 minutes');
  }

  return errors;
}

// ============================================================================
// AGGREGATED UTILS OBJECT
// ============================================================================

export const publicationsUtils = {
  // Slugs
  generateSlug,
  isSlugAvailable,
  generateUniqueSlug,
  
  // Status
  canTransitionStatus,
  getStatusColor,
  getStatusLabel,
  isPublished,
  isScheduledForFuture,
  shouldAutoPublish,
  
  // Filtering
  filterByStatus,
  filterByCategory,
  filterByType,
  searchArticles,
  getFeaturedArticles,
  
  // Sorting
  sortByDate,
  sortByTitle,
  sortByFeatured,
  
  // Validation
  validateArticle,
  validateCategory,
  validateContentType,
  
  // Formatting
  formatPublishDate,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getRelativeTime,
  truncateText,
  
  // Grouping
  groupByStatus,
  groupByCategory,
  
  // Performance
  debounce,

  // Reading time & form validation
  calculateReadingTime,
  validateArticleForm,
};

export default publicationsUtils;

// ============================================================================
// NEWSLETTER SUBSCRIBER UTILITIES (§7.1 — pure derivation functions)
// ============================================================================

/**
 * Derive subscriber status from confirmed + active flags.
 * §7.1 — pure utility, never inline in JSX.
 */
export function deriveSubscriberStatus(sub: Subscriber): SubscriberStatus {
  if (!sub.confirmed) return 'pending';
  if (!sub.active) return 'unsubscribed';
  return 'active';
}

/**
 * Derive a human-readable unsubscribe reason.
 */
export function deriveUnsubscribeReason(sub: Subscriber): string {
  if (sub.removedBy === 'admin') return 'Removed by Admin';
  if (sub.unsubscribedAt && !sub.removedBy) return 'Self-Unsubscribed';
  return 'Unsubscribed';
}

/**
 * Format a date string using en-ZA locale (§8.3 — dd MMM yyyy).
 * Returns '—' for null/undefined/invalid inputs.
 */
export function formatDateZA(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Filter subscribers by time range (unsubscribed view).
 */
export function filterByTimeRange(
  subscribers: Subscriber[],
  range: UnsubTimeRange,
): Subscriber[] {
  if (range === 'all') return subscribers;
  const days = UNSUB_TIME_RANGE_DAYS[range];
  if (!days) return subscribers;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return subscribers.filter(
    (s) => s.unsubscribedAt && new Date(s.unsubscribedAt) >= cutoff,
  );
}

/**
 * Export unsubscribed subscribers to an Excel file.
 * Extracted from inline JSX onClick (§7 — no business logic in UI).
 */
export function exportUnsubscribedToExcel(
  subscribers: Subscriber[],
  timeRange: UnsubTimeRange,
): void {
  // Dynamic import — xlsx is only needed at export time
  import('xlsx').then((XLSX) => {
    const exportData = subscribers.map((s) => ({
      Email: s.email,
      'First Name': s.firstName || '',
      Surname: s.surname || '',
      Source: s.source || '',
      Reason: s.removedBy === 'admin' ? 'Admin Removed' : 'Self-Unsubscribed',
      'Subscribed Date': s.subscribedAt
        ? new Date(s.subscribedAt).toLocaleDateString('en-ZA')
        : '',
      'Unsubscribed Date': s.unsubscribedAt
        ? new Date(s.unsubscribedAt).toLocaleDateString('en-ZA')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 32 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Unsubscribed');
    const rangeLabel = timeRange === 'all' ? 'all-time' : timeRange;
    XLSX.writeFile(
      wb,
      `unsubscribed-subscribers-${rangeLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  });
}

/**
 * Generate and download the subscriber Excel template.
 */
export function downloadSubscriberExcelTemplate(): void {
  import('xlsx').then((XLSX) => {
    const templateData = [
      { Email: 'john.smith@example.com', 'First Name/s': 'John', Surname: 'Smith' },
      { Email: 'jane.doe@example.com', 'First Name/s': 'Jane', Surname: 'Doe' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData, {
      header: ['Email', 'First Name/s', 'Surname'],
    });
    ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subscribers');
    XLSX.writeFile(wb, 'navigate-wealth-newsletter-subscribers-template.xlsx');
  });
}

/**
 * Parse a subscriber spreadsheet file (.xlsx, .xls, .csv).
 * Returns parsed rows via callback.
 */
export function parseSubscriberFile(
  file: File,
  onParsed: (rows: { email: string; firstName: string; surname: string }[]) => void,
): void {
  const reader = new FileReader();

  reader.onload = (ev) => {
    try {
      import('xlsx').then((XLSX) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
          onParsed([]);
          return;
        }

        const normalise = (key: string) => key.trim().toLowerCase().replace(/[^a-z]/g, '');

        const results: { email: string; firstName: string; surname: string }[] = [];

        for (const row of rows) {
          const mapped: Record<string, string> = {};
          for (const [key, val] of Object.entries(row)) {
            mapped[normalise(key)] = String(val).trim();
          }

          const email = mapped['email'] || mapped['emailaddress'] || '';
          const firstName = mapped['firstnames'] || mapped['firstname'] || mapped['name'] || '';
          const surname = mapped['surname'] || mapped['lastname'] || '';

          if (email && email.includes('@')) {
            results.push({ email: email.toLowerCase(), firstName, surname });
          }
        }

        onParsed(results);
      });
    } catch {
      onParsed([]);
    }
  };

  reader.readAsArrayBuffer(file);
}