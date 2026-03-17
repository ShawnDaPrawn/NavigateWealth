/**
 * Requests Module - Components Index
 * Navigate Wealth Admin Dashboard
 * 
 * UI components for request and template management
 * 
 * @module requests/components
 */

// ============================================================================
// REQUEST COMPONENTS
// ============================================================================

/**
 * Kanban board view for requests
 * Displays requests in three lanes: New, Pending, Completed
 * 
 * @component
 */
export { RequestBoardView } from './requests/RequestBoardView';

/**
 * Individual request card component
 * Displays request details with lane-specific information
 * 
 * @component
 */
export { RequestCard } from './requests/RequestCard';

// ============================================================================
// TEMPLATE COMPONENTS
// ============================================================================

/**
 * Template list and management view
 * Displays all request templates with filtering
 * 
 * @component
 */
export { TemplateListView } from './templates/TemplateListView';

// ============================================================================
// WIZARD COMPONENTS
// ============================================================================

/**
 * New request creation wizard (5-step flow)
 * Guides users through template-driven request creation
 * 
 * @component
 */
export { NewRequestWizard } from './wizard/NewRequestWizard';

/**
 * Template creation and editing wizard
 * Multi-step template configuration interface
 * 
 * @component
 */
export { TemplateWizard } from './wizard/TemplateWizard';

// ============================================================================
// WIZARD STEPS (New Request)
// ============================================================================

/**
 * Step 1: Template selection
 * Choose the blueprint for the request
 * 
 * @component
 */
export { StepSelectTemplate } from './wizard/new-request-steps/StepSelectTemplate';

/**
 * Step 2: Client association
 * Associate client based on template rules (required/optional/not-allowed)
 * 
 * @component
 */
export { StepAssociateClient } from './wizard/new-request-steps/StepAssociateClient';

/**
 * Step 3: Request details
 * Capture template-driven form fields
 * 
 * @component
 */
export { StepRequestDetails } from './wizard/new-request-steps/StepRequestDetails';

/**
 * Step 4: Assignees
 * Assign team members to the request
 * 
 * @component
 */
export { StepAssignees } from './wizard/new-request-steps/StepAssignees';

/**
 * Step 5: Review and create
 * Final confirmation before request creation
 * 
 * @component
 */
export { StepReview } from './wizard/new-request-steps/StepReview';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

/**
 * Category badge component
 * Displays color-coded category badges
 * 
 * @component
 */
export { CategoryBadge } from './shared/CategoryBadge';

/**
 * Status badge component
 * Displays color-coded status badges
 * 
 * @component
 */
export { StatusBadge } from './shared/StatusBadge';
