/**
 * Publications utils — formatting, grouping, debounce, reading time, and
 * article-form validation. One slice of the former monolithic utils.tsx
 * (re-exported by ../utils.tsx).
 */
import type { Article, ArticleFormData, ArticleStatus } from '../types';

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
  wait: number,
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
  if (
    data.reading_time_minutes &&
    (data.reading_time_minutes < 1 || data.reading_time_minutes > 120)
  ) {
    errors.push('Reading time must be between 1 and 120 minutes');
  }

  return errors;
}
