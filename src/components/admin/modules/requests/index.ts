/**
 * Requests Module - Main Index
 * Navigate Wealth Admin Dashboard
 * 
 * Public API for the Requests module
 * 
 * @module requests
 */

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================

export { RequestsModule } from './RequestsModule';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export * from './types';

// ============================================================================
// API EXPORTS
// ============================================================================

export * from './api';

// ============================================================================
// HOOKS EXPORTS
// ============================================================================

export * from './hooks/useTemplates';
export * from './hooks/useRequests';

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export {
  // Status utilities
  getStatusColor,
  getStatusLabel,
  canTransitionStatus,
  getNextAllowedStatuses,
  isActiveStatus,
  isCompletedStatus,
  isOnHoldStatus,
  isCancelledStatus,
  
  // Priority utilities
  getPriorityColor,
  getPriorityIcon,
  getPrioritySortOrder,
  
  // Category utilities
  getCategoryColor,
  getCategoryIcon,
  
  // Template utilities
  getTemplateStatusColor,
  isTemplateActive,
  
  // Approval utilities
  getApprovalOutcomeColor,
  
  // Client association utilities
  isClientRequired,
  isClientOptional,
  isClientNotAllowed,
  
  // Filtering utilities
  filterByStatus,
  filterByPriority,
  filterByCategory,
  filterTemplatesByStatus,
  searchRequests,
  
  // Sorting utilities
  sortByPriority,
  sortByDate,
  
  // Formatting utilities
  formatDate,
  formatDateTime,
  getRelativeTime,
  
  // Grouping utilities
  groupByStatus,
  groupByPriority,
  
  // Validation utilities
  validateRequestInput,
  
  // Aggregated utils object
  requestsUtils,
} from './utils';

// Default utils export
export { default as utils } from './utils';
