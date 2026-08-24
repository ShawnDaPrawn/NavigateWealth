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
export * from './utils/articles';
export * from './utils/validation';
export * from './utils/presentation';
export * from './utils/subscribers';

import {
  generateSlug,
  isSlugAvailable,
  generateUniqueSlug,
  canTransitionStatus,
  getStatusColor,
  getStatusLabel,
  isPublished,
  isScheduledForFuture,
  shouldAutoPublish,
  filterByStatus,
  filterByCategory,
  filterByType,
  searchArticles,
  getFeaturedArticles,
  sortByDate,
  sortByTitle,
  sortByFeatured,
} from './utils/articles';
import { validateArticle, validateCategory, validateContentType } from './utils/validation';
import {
  formatPublishDate,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getRelativeTime,
  truncateText,
  groupByStatus,
  groupByCategory,
  debounce,
  calculateReadingTime,
  validateArticleForm,
} from './utils/presentation';

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
