/**
 * Articles: the record, statuses, and create/update inputs.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type Category, type ContentType } from './taxonomy';

// ============================================================================
// ARTICLE TYPES
// ============================================================================

/**
 * Article status enum
 * Represents the publication workflow stages
 */
export type ArticleStatus =
  | 'draft' // Initial draft state
  | 'in_review' // Submitted for review
  | 'scheduled' // Scheduled for future publication
  | 'published' // Currently published
  | 'archived'; // Archived/unpublished

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
  press_category?:
    | 'company_news'
    | 'product_launch'
    | 'awards'
    | 'team_news'
    | 'industry_insights'
    | null;

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
  /** Optional press-page category */
  press_category?:
    | 'company_news'
    | 'product_launch'
    | 'awards'
    | 'team_news'
    | 'industry_insights'
    | null;

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
  press_category?:
    | 'company_news'
    | 'product_launch'
    | 'awards'
    | 'team_news'
    | 'industry_insights'
    | null;
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
