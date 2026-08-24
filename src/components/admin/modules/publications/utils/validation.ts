/**
 * Publications utils — article/category/content-type validation. One slice
 * of the former monolithic utils.tsx (re-exported by ../utils.tsx).
 */
import type {
  CreateArticleInput,
  CreateCategoryInput,
  CreateContentTypeInput,
  ValidationResult,
} from '../types';

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
