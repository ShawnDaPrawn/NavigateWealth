/**
 * Requests Module - Utility Functions
 * Navigate Wealth Admin Dashboard
 * 
 * Reusable utility functions for:
 * - Request status and workflow helpers
 * - Template validation
 * - Priority and category helpers
 * - Filtering and sorting
 * - Formatting and display
 * - Validation
 * 
 * @module requests/utils
 */

import type {
  RequestStatus,
  RequestPriority,
  RequestCategory,
  TemplateStatus,
  ApprovalOutcome,
  ClientAssociationRule,
  Request,
  RequestTemplate,
  LifecycleStage,
} from './types';

// ============================================================================
// STATUS & WORKFLOW UTILITIES
// ============================================================================

/**
 * Get status color classes
 * 
 * @param status - Request status
 * @returns Tailwind color classes
 * 
 * @example
 * ```typescript
 * const className = getStatusColor('COMPLETED'); // 'bg-green-100 text-green-700'
 * ```
 */
export function getStatusColor(status: RequestStatus): string {
  const colors: Record<RequestStatus, string> = {
    [RequestStatus.NEW]: 'bg-blue-100 text-blue-700',
    [RequestStatus.IN_COMPLIANCE_REVIEW]: 'bg-purple-100 text-purple-700',
    [RequestStatus.IN_LIFECYCLE]: 'bg-indigo-100 text-indigo-700',
    [RequestStatus.IN_SIGN_OFF]: 'bg-orange-100 text-orange-700',
    [RequestStatus.COMPLETED]: 'bg-green-100 text-green-700',
    [RequestStatus.ON_HOLD]: 'bg-yellow-100 text-yellow-700',
    [RequestStatus.CANCELLED]: 'bg-gray-100 text-gray-700',
  };

  return colors[status] || 'bg-gray-100 text-gray-700';
}

/**
 * Get status label
 * 
 * @param status - Request status
 * @returns Human-readable label
 * 
 * @example
 * ```typescript
 * getStatusLabel('IN_LIFECYCLE'); // 'In Lifecycle'
 * ```
 */
export function getStatusLabel(status: RequestStatus): string {
  return status.replace(/_/g, ' ');
}

/**
 * Check if status transition is allowed
 * 
 * @param from - Current status
 * @param to - Target status
 * @returns True if transition is allowed
 * 
 * @example
 * ```typescript
 * canTransitionStatus('NEW', 'IN_COMPLIANCE_REVIEW'); // true
 * canTransitionStatus('COMPLETED', 'NEW'); // false
 * ```
 */
export function canTransitionStatus(from: RequestStatus, to: RequestStatus): boolean {
  const transitions: Record<RequestStatus, RequestStatus[]> = {
    [RequestStatus.NEW]: [
      RequestStatus.IN_COMPLIANCE_REVIEW,
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.IN_COMPLIANCE_REVIEW]: [
      RequestStatus.NEW,
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.ON_HOLD,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.IN_LIFECYCLE]: [
      RequestStatus.IN_SIGN_OFF,
      RequestStatus.ON_HOLD,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.IN_SIGN_OFF]: [
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.COMPLETED,
      RequestStatus.ON_HOLD,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.COMPLETED]: [],
    [RequestStatus.ON_HOLD]: [
      RequestStatus.IN_COMPLIANCE_REVIEW,
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.IN_SIGN_OFF,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.CANCELLED]: [],
  };

  return transitions[from]?.includes(to) ?? false;
}

/**
 * Get next allowed statuses
 * 
 * @param currentStatus - Current request status
 * @returns Array of allowed next statuses
 * 
 * @example
 * ```typescript
 * getNextAllowedStatuses('NEW'); // ['IN_COMPLIANCE_REVIEW', 'IN_LIFECYCLE', 'CANCELLED']
 * ```
 */
export function getNextAllowedStatuses(currentStatus: RequestStatus): RequestStatus[] {
  const transitions: Record<RequestStatus, RequestStatus[]> = {
    [RequestStatus.NEW]: [
      RequestStatus.IN_COMPLIANCE_REVIEW,
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.IN_COMPLIANCE_REVIEW]: [
      RequestStatus.NEW,
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.ON_HOLD,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.IN_LIFECYCLE]: [
      RequestStatus.IN_SIGN_OFF,
      RequestStatus.ON_HOLD,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.IN_SIGN_OFF]: [
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.COMPLETED,
      RequestStatus.ON_HOLD,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.COMPLETED]: [],
    [RequestStatus.ON_HOLD]: [
      RequestStatus.IN_COMPLIANCE_REVIEW,
      RequestStatus.IN_LIFECYCLE,
      RequestStatus.IN_SIGN_OFF,
      RequestStatus.CANCELLED,
    ],
    [RequestStatus.CANCELLED]: [],
  };

  return transitions[currentStatus] || [];
}

/**
 * Check if request is in active workflow
 * 
 * @param status - Request status
 * @returns True if request is active
 * 
 * @example
 * ```typescript
 * isActiveStatus('IN_LIFECYCLE'); // true
 * isActiveStatus('COMPLETED'); // false
 * ```
 */
export function isActiveStatus(status: RequestStatus): boolean {
  return [
    RequestStatus.NEW,
    RequestStatus.IN_COMPLIANCE_REVIEW,
    RequestStatus.IN_LIFECYCLE,
    RequestStatus.IN_SIGN_OFF,
  ].includes(status);
}

/**
 * Check if request is completed
 * 
 * @param status - Request status
 * @returns True if completed
 * 
 * @example
 * ```typescript
 * isCompletedStatus('COMPLETED'); // true
 * ```
 */
export function isCompletedStatus(status: RequestStatus): boolean {
  return status === RequestStatus.COMPLETED;
}

/**
 * Check if request is on hold
 * 
 * @param status - Request status
 * @returns True if on hold
 * 
 * @example
 * ```typescript
 * isOnHoldStatus('ON_HOLD'); // true
 * ```
 */
export function isOnHoldStatus(status: RequestStatus): boolean {
  return status === RequestStatus.ON_HOLD;
}

/**
 * Check if request is cancelled
 * 
 * @param status - Request status
 * @returns True if cancelled
 * 
 * @example
 * ```typescript
 * isCancelledStatus('CANCELLED'); // true
 * ```
 */
export function isCancelledStatus(status: RequestStatus): boolean {
  return status === RequestStatus.CANCELLED;
}

// ============================================================================
// PRIORITY UTILITIES
// ============================================================================

/**
 * Get priority color classes
 * 
 * @param priority - Request priority
 * @returns Tailwind color classes
 * 
 * @example
 * ```typescript
 * getPriorityColor('URGENT'); // 'bg-red-100 text-red-700'
 * ```
 */
export function getPriorityColor(priority: RequestPriority): string {
  const colors: Record<RequestPriority, string> = {
    [RequestPriority.LOW]: 'bg-gray-100 text-gray-700',
    [RequestPriority.MEDIUM]: 'bg-blue-100 text-blue-700',
    [RequestPriority.HIGH]: 'bg-orange-100 text-orange-700',
    [RequestPriority.URGENT]: 'bg-red-100 text-red-700',
  };

  return colors[priority] || 'bg-gray-100 text-gray-700';
}

/**
 * Get priority icon
 * 
 * @param priority - Request priority
 * @returns Icon indicator
 * 
 * @example
 * ```typescript
 * getPriorityIcon('URGENT'); // '🔥'
 * ```
 */
export function getPriorityIcon(priority: RequestPriority): string {
  const icons: Record<RequestPriority, string> = {
    [RequestPriority.LOW]: '⚪',
    [RequestPriority.MEDIUM]: '🔵',
    [RequestPriority.HIGH]: '🟠',
    [RequestPriority.URGENT]: '🔥',
  };

  return icons[priority] || '';
}

/**
 * Get priority sort order
 * 
 * @param priority - Request priority
 * @returns Numeric sort order
 * 
 * @example
 * ```typescript
 * getPrioritySortOrder('URGENT'); // 0 (highest)
 * ```
 */
export function getPrioritySortOrder(priority: RequestPriority): number {
  const order: Record<RequestPriority, number> = {
    [RequestPriority.URGENT]: 0,
    [RequestPriority.HIGH]: 1,
    [RequestPriority.MEDIUM]: 2,
    [RequestPriority.LOW]: 3,
  };

  return order[priority] ?? 99;
}

// ============================================================================
// CATEGORY UTILITIES
// ============================================================================

/**
 * Get category color
 * 
 * @param category - Request category
 * @returns Tailwind color classes
 * 
 * @example
 * ```typescript
 * getCategoryColor('RISK'); // 'bg-red-50 text-red-700'
 * ```
 */
export function getCategoryColor(category: RequestCategory): string {
  const colors: Record<RequestCategory, string> = {
    [RequestCategory.RISK]: 'bg-red-50 text-red-700',
    [RequestCategory.RETIREMENT]: 'bg-blue-50 text-blue-700',
    [RequestCategory.MEDICAL_AID]: 'bg-green-50 text-green-700',
    [RequestCategory.INVESTMENT_PLANNING]: 'bg-purple-50 text-purple-700',
    [RequestCategory.ESTATE_PLANNING]: 'bg-indigo-50 text-indigo-700',
    [RequestCategory.TAX_PLANNING]: 'bg-yellow-50 text-yellow-700',
    [RequestCategory.GENERAL]: 'bg-gray-50 text-gray-700',
    [RequestCategory.LEGAL_COMPLIANCE]: 'bg-orange-50 text-orange-700',
  };

  return colors[category] || 'bg-gray-50 text-gray-700';
}

/**
 * Get category icon
 * 
 * @param category - Request category
 * @returns Icon emoji
 * 
 * @example
 * ```typescript
 * getCategoryIcon('RISK'); // '🛡️'
 * ```
 */
export function getCategoryIcon(category: RequestCategory): string {
  const icons: Record<RequestCategory, string> = {
    [RequestCategory.RISK]: '🛡️',
    [RequestCategory.RETIREMENT]: '🏖️',
    [RequestCategory.MEDICAL_AID]: '⚕️',
    [RequestCategory.INVESTMENT_PLANNING]: '📈',
    [RequestCategory.ESTATE_PLANNING]: '🏛️',
    [RequestCategory.TAX_PLANNING]: '💰',
    [RequestCategory.GENERAL]: '📋',
    [RequestCategory.LEGAL_COMPLIANCE]: '⚖️',
  };

  return icons[category] || '📋';
}

// ============================================================================
// TEMPLATE STATUS UTILITIES
// ============================================================================

/**
 * Get template status color
 * 
 * @param status - Template status
 * @returns Tailwind color classes
 * 
 * @example
 * ```typescript
 * getTemplateStatusColor('ACTIVE'); // 'bg-green-100 text-green-700'
 * ```
 */
export function getTemplateStatusColor(status: TemplateStatus): string {
  const colors: Record<TemplateStatus, string> = {
    [TemplateStatus.DRAFT]: 'bg-gray-100 text-gray-700',
    [TemplateStatus.ACTIVE]: 'bg-green-100 text-green-700',
    [TemplateStatus.ARCHIVED]: 'bg-red-100 text-red-700',
  };

  return colors[status] || 'bg-gray-100 text-gray-700';
}

/**
 * Check if template is active
 * 
 * @param template - Request template
 * @returns True if active
 * 
 * @example
 * ```typescript
 * isTemplateActive(template); // true
 * ```
 */
export function isTemplateActive(template: RequestTemplate): boolean {
  return template.status === TemplateStatus.ACTIVE;
}

// ============================================================================
// APPROVAL UTILITIES
// ============================================================================

/**
 * Get approval outcome color
 * 
 * @param outcome - Approval outcome
 * @returns Tailwind color classes
 * 
 * @example
 * ```typescript
 * getApprovalOutcomeColor('APPROVED'); // 'bg-green-100 text-green-700'
 * ```
 */
export function getApprovalOutcomeColor(outcome: ApprovalOutcome): string {
  const colors: Record<ApprovalOutcome, string> = {
    [ApprovalOutcome.APPROVED]: 'bg-green-100 text-green-700',
    [ApprovalOutcome.REJECTED]: 'bg-red-100 text-red-700',
    [ApprovalOutcome.DEFICIENT]: 'bg-yellow-100 text-yellow-700',
    [ApprovalOutcome.PENDING]: 'bg-blue-100 text-blue-700',
  };

  return colors[outcome] || 'bg-gray-100 text-gray-700';
}

// ============================================================================
// CLIENT ASSOCIATION UTILITIES
// ============================================================================

/**
 * Check if client is required for template
 * 
 * @param rule - Client association rule
 * @returns True if client is required
 * 
 * @example
 * ```typescript
 * isClientRequired('Required'); // true
 * ```
 */
export function isClientRequired(rule: ClientAssociationRule): boolean {
  return rule === ClientAssociationRule.REQUIRED;
}

/**
 * Check if client is optional for template
 * 
 * @param rule - Client association rule
 * @returns True if client is optional
 * 
 * @example
 * ```typescript
 * isClientOptional('Optional'); // true
 * ```
 */
export function isClientOptional(rule: ClientAssociationRule): boolean {
  return rule === ClientAssociationRule.OPTIONAL;
}

/**
 * Check if client is not allowed for template
 * 
 * @param rule - Client association rule
 * @returns True if client is not allowed
 * 
 * @example
 * ```typescript
 * isClientNotAllowed('Not Allowed'); // true
 * ```
 */
export function isClientNotAllowed(rule: ClientAssociationRule): boolean {
  return rule === ClientAssociationRule.NOT_ALLOWED;
}

// ============================================================================
// FILTERING UTILITIES
// ============================================================================

/**
 * Filter requests by status
 * 
 * @param requests - Requests to filter
 * @param status - Status filter
 * @returns Filtered requests
 * 
 * @example
 * ```typescript
 * const active = filterByStatus(requests, 'IN_LIFECYCLE');
 * ```
 */
export function filterByStatus(
  requests: Request[],
  status: RequestStatus | 'all'
): Request[] {
  if (status === 'all') return requests;
  return requests.filter((request) => request.status === status);
}

/**
 * Filter requests by priority
 * 
 * @param requests - Requests to filter
 * @param priority - Priority filter
 * @returns Filtered requests
 * 
 * @example
 * ```typescript
 * const urgent = filterByPriority(requests, 'URGENT');
 * ```
 */
export function filterByPriority(
  requests: Request[],
  priority: RequestPriority | 'all'
): Request[] {
  if (priority === 'all') return requests;
  return requests.filter((request) => request.priority === priority);
}

/**
 * Filter requests by category
 * 
 * @param requests - Requests to filter
 * @param category - Category filter
 * @returns Filtered requests
 * 
 * @example
 * ```typescript
 * const risk = filterByCategory(requests, 'RISK');
 * ```
 */
export function filterByCategory(
  requests: Request[],
  category: RequestCategory | 'all'
): Request[] {
  if (category === 'all') return requests;
  return requests.filter((request) => request.template?.category === category);
}

/**
 * Filter templates by status
 * 
 * @param templates - Templates to filter
 * @param status - Status filter
 * @returns Filtered templates
 * 
 * @example
 * ```typescript
 * const active = filterTemplatesByStatus(templates, 'ACTIVE');
 * ```
 */
export function filterTemplatesByStatus(
  templates: RequestTemplate[],
  status: TemplateStatus | 'all'
): RequestTemplate[] {
  if (status === 'all') return templates;
  return templates.filter((template) => template.status === status);
}

/**
 * Search requests by query
 * Searches ID, client name, subject
 * 
 * @param requests - Requests to search
 * @param query - Search query
 * @returns Matching requests
 * 
 * @example
 * ```typescript
 * const results = searchRequests(requests, 'john');
 * ```
 */
export function searchRequests(requests: Request[], query: string): Request[] {
  if (!query) return requests;

  const queryLower = query.toLowerCase();

  return requests.filter(
    (request) =>
      request.id.toLowerCase().includes(queryLower) ||
      request.client?.full_name?.toLowerCase().includes(queryLower) ||
      request.subject?.toLowerCase().includes(queryLower) ||
      request.template?.name?.toLowerCase().includes(queryLower)
  );
}

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Sort requests by priority
 * 
 * @param requests - Requests to sort
 * @returns Sorted requests (urgent first)
 * 
 * @example
 * ```typescript
 * const sorted = sortByPriority(requests);
 * ```
 */
export function sortByPriority(requests: Request[]): Request[] {
  return [...requests].sort((a, b) => {
    const priorityA = getPrioritySortOrder(a.priority);
    const priorityB = getPrioritySortOrder(b.priority);
    return priorityA - priorityB;
  });
}

/**
 * Sort requests by date
 * 
 * @param requests - Requests to sort
 * @param order - Sort order
 * @returns Sorted requests
 * 
 * @example
 * ```typescript
 * const sorted = sortByDate(requests, 'desc');
 * ```
 */
export function sortByDate(
  requests: Request[],
  order: 'asc' | 'desc' = 'desc'
): Request[] {
  return [...requests].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format date
 * 
 * @param date - Date string or Date object
 * @returns Formatted date
 * 
 * @example
 * ```typescript
 * formatDate('2026-01-05'); // 'Jan 5, 2026'
 * ```
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time
 * 
 * @param date - Date string or Date object
 * @returns Formatted date and time
 * 
 * @example
 * ```typescript
 * formatDateTime('2026-01-05T14:30:00'); // 'Jan 5, 2026 at 2:30 PM'
 * ```
 */
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get relative time
 * 
 * @param date - Date string or Date object
 * @returns Relative time string
 * 
 * @example
 * ```typescript
 * getRelativeTime(yesterday); // '1 day ago'
 * ```
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  
  return formatDate(dateObj);
}

// ============================================================================
// GROUPING UTILITIES
// ============================================================================

/**
 * Group requests by status
 * 
 * @param requests - Requests to group
 * @returns Requests grouped by status
 * 
 * @example
 * ```typescript
 * const grouped = groupByStatus(requests);
 * // { NEW: [...], IN_LIFECYCLE: [...], ... }
 * ```
 */
export function groupByStatus(requests: Request[]): Record<string, Request[]> {
  const grouped: Record<string, Request[]> = {};

  requests.forEach((request) => {
    const status = request.status;
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(request);
  });

  return grouped;
}

/**
 * Group requests by priority
 * 
 * @param requests - Requests to group
 * @returns Requests grouped by priority
 * 
 * @example
 * ```typescript
 * const grouped = groupByPriority(requests);
 * // { URGENT: [...], HIGH: [...], ... }
 * ```
 */
export function groupByPriority(requests: Request[]): Record<string, Request[]> {
  const grouped: Record<string, Request[]> = {};

  requests.forEach((request) => {
    const priority = request.priority;
    if (!grouped[priority]) {
      grouped[priority] = [];
    }
    grouped[priority].push(request);
  });

  return grouped;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

interface ValidateRequestInputData {
  templateId?: string;
  priority?: string;
  clientAssociationRule?: ClientAssociationRule;
  clientId?: string;
  subject?: string;
}

export function validateRequestInput(input: ValidateRequestInputData): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!input.templateId) {
    errors.templateId = 'Template is required';
  }

  if (!input.priority) {
    errors.priority = 'Priority is required';
  }

  // Client validation based on association rule
  if (input.clientAssociationRule === ClientAssociationRule.REQUIRED && !input.clientId) {
    errors.clientId = 'Client is required for this template';
  }

  if (input.clientAssociationRule === ClientAssociationRule.NOT_ALLOWED && input.clientId) {
    errors.clientId = 'Client is not allowed for this template';
  }

  // Subject validation
  if (!input.clientId && !input.subject) {
    errors.subject = 'Subject is required when no client is specified';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ============================================================================
// UTILITY OBJECT EXPORT
// ============================================================================

/**
 * Aggregated requests utilities
 * Use individual exports for better tree-shaking
 */
export const requestsUtils = {
  // Status
  getStatusColor,
  getStatusLabel,
  canTransitionStatus,
  getNextAllowedStatuses,
  isActiveStatus,
  isCompletedStatus,
  isOnHoldStatus,
  isCancelledStatus,
  
  // Priority
  getPriorityColor,
  getPriorityIcon,
  getPrioritySortOrder,
  
  // Category
  getCategoryColor,
  getCategoryIcon,
  
  // Template
  getTemplateStatusColor,
  isTemplateActive,
  
  // Approval
  getApprovalOutcomeColor,
  
  // Client Association
  isClientRequired,
  isClientOptional,
  isClientNotAllowed,
  
  // Filtering
  filterByStatus,
  filterByPriority,
  filterByCategory,
  filterTemplatesByStatus,
  searchRequests,
  
  // Sorting
  sortByPriority,
  sortByDate,
  
  // Formatting
  formatDate,
  formatDateTime,
  getRelativeTime,
  
  // Grouping
  groupByStatus,
  groupByPriority,
  
  // Validation
  validateRequestInput,
};

export default requestsUtils;