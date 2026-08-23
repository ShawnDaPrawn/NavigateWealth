/**
 * Statistics, settings, initialization and reorder.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */
import { type ArticleStatus } from './articles';

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
