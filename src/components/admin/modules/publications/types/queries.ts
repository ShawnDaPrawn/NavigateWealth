/**
 * Filters, search and news.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type ArticleStatus } from './articles';

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
