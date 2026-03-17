/**
 * Requests Module - Hooks Index
 * Navigate Wealth Admin Dashboard
 * 
 * Custom React hooks for request and template management
 * 
 * @module requests/hooks
 */

// Query key registry
export { requestKeys } from './queryKeys';

// ============================================================================
// REQUEST HOOKS
// ============================================================================

/**
 * Request data management hook
 * 
 * @example
 * ```typescript
 * const { requests, loading, error, fetchRequests, createRequest } = useRequests({
 *   status: ['IN_LIFECYCLE'],
 *   priority: ['URGENT'],
 *   autoFetch: true
 * });
 * ```
 */
export { useRequests } from './useRequests';

// ============================================================================
// TEMPLATE HOOKS
// ============================================================================

/**
 * Template data management hook
 * 
 * @example
 * ```typescript
 * const { templates, loading, error, fetchTemplates, createTemplate } = useTemplates({
 *   status: [TemplateStatus.ACTIVE],
 *   autoFetch: true
 * });
 * ```
 */
export { useTemplates } from './useTemplates';