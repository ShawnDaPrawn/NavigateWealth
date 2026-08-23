/**
 * Type constants and guards.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type Article, type ArticleStatus } from './articles';
import { type Category, type ContentType } from './taxonomy';

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
