/**
 * Categories and content types.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */

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
