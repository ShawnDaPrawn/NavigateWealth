/**
 * Shared API Types
 * Single source of truth for request/response contracts (§9.3)
 *
 * These types enforce the API contract between frontend and backend.
 * Frontend API response types MUST mirror the server's actual response shape.
 * When the server adds fields, the frontend type must be updated in the
 * same logical change.
 */

// ============================================================================
// COMMON QUERY PARAMETERS
// ============================================================================

/**
 * Standard pagination parameters — used in list endpoint query strings.
 */
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

/**
 * Standard sort parameters.
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Standard search parameters.
 */
export interface SearchParams {
  search?: string;
}

/**
 * Combined list query parameters (pagination + search + sort).
 */
export type ListQueryParams = PaginationParams & SortParams & SearchParams;

// ============================================================================
// MUTATION RESULTS
// ============================================================================

/**
 * Standard create response — returns the ID of the new entity.
 */
export interface CreateResponse {
  success: true;
  id: string;
  message?: string;
}

/**
 * Standard update response.
 */
export interface UpdateResponse {
  success: true;
  message?: string;
}

/**
 * Standard delete response.
 */
export interface DeleteResponse {
  success: true;
  message?: string;
}

// ============================================================================
// DRY-RUN PATTERN (§14.1)
// ============================================================================

/**
 * Dry-run request parameters — all destructive/batch operations
 * MUST support a dryRun flag (default: true for safety).
 */
export interface DryRunParams {
  dryRun?: boolean;
}

/**
 * Dry-run result — returned by maintenance/batch endpoints.
 */
export interface DryRunResult {
  success: boolean;
  dryRun: boolean;
  durationMs: number;
  timestamp: string;
}

// ============================================================================
// HTTP METHODS (for proxy/generic patterns)
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
