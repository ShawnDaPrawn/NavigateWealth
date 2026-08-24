/**
 * API response envelopes and validation.
 *
 * One slice of what used to be the single 1,291-line publications `types.ts`;
 * that file remains the barrel every consumer imports from.
 */

// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;

  /** Success flag */
  success: boolean;

  /** Optional error message */
  error?: string;

  /** Optional metadata */
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Data items */
  data: T[];

  /** Pagination metadata */
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean;

  /** Errors by field */
  errors: Record<string, string>;

  /** Warning messages */
  warnings?: string[];
}

// ============================================================================
// TYPE CONSTANTS
