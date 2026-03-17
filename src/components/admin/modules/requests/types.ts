// ============================================================================
// REQUEST MODULE TYPES
// Navigate Wealth Admin Dashboard
//
// Type definitions for the Requests module, including:
// - Request templates (blueprints for requests)
// - Requests (runtime instances)
// - Workflow configurations
// - Lifecycle stages
// - Compliance approvals
// - Audit logging
//
// @module requests/types
// ============================================================================

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

/**
 * Default priority for new requests
 */
export const DEFAULT_REQUEST_PRIORITY = 'Medium';

/**
 * Default SLA duration in hours
 */
export const DEFAULT_SLA_HOURS = 72;

/**
 * Default reminder interval in hours
 */
export const DEFAULT_REMINDER_INTERVAL = 24;

/**
 * Maximum lifecycle stages allowed per template
 */
export const MAX_LIFECYCLE_STAGES = 20;

// ----------------------------------------------------------------------------
// ENUMS & CONSTANTS
// ----------------------------------------------------------------------------

/**
 * Request categories for classification
 * 
 * @enum {string}
 */
export enum RequestCategory {
  RISK = 'Risk',
  RETIREMENT = 'Retirement',
  MEDICAL_AID = 'Medical Aid',
  INVESTMENT_PLANNING = 'Investment Planning',
  ESTATE_PLANNING = 'Estate Planning',
  TAX_PLANNING = 'Tax Planning',
  GENERAL = 'General',
  LEGAL_COMPLIANCE = 'Legal / Compliance',
}

/**
 * Request types (administrative or quote)
 * 
 * @enum {string}
 */
export enum RequestType {
  ADMINISTRATIVE = 'Administrative Request',
  QUOTE = 'Quote Request',
}

/**
 * Client association rules for templates
 * Determines if a client is required, optional, or not allowed
 * 
 * @enum {string}
 */
export enum ClientAssociationRule {
  REQUIRED = 'Required',
  OPTIONAL = 'Optional',
  NOT_ALLOWED = 'Not Allowed',
}

/**
 * Template statuses (lifecycle state)
 * 
 * @enum {string}
 */
export enum TemplateStatus {
  DRAFT = 'Draft',
  ACTIVE = 'Active',
  ARCHIVED = 'Archived',
}

/**
 * Request statuses (workflow state)
 * Represents the current position in the request lifecycle
 * 
 * @enum {string}
 */
export enum RequestStatus {
  NEW = 'New',
  IN_COMPLIANCE_REVIEW = 'In Compliance Review',
  IN_LIFECYCLE = 'In Lifecycle',
  IN_SIGN_OFF = 'In Sign-Off',
  COMPLETED = 'Completed',
  ON_HOLD = 'On Hold',
  CANCELLED = 'Cancelled',
}

/**
 * Request priority levels
 * Determines urgency and SLA requirements
 * 
 * @enum {string}
 */
export enum RequestPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

/**
 * Field types for template request details schema
 * 
 * @enum {string}
 */
export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DROPDOWN = 'dropdown',
  MULTI_SELECT = 'multi-select',
  BOOLEAN = 'boolean',
  FILE_REFERENCE = 'file',
}

/**
 * Field visibility levels
 * Controls who can view the field
 * 
 * @enum {string}
 */
export enum FieldVisibility {
  ADMIN_ONLY = 'Admin-only',
  CLIENT_VISIBLE = 'Client-visible',
  EXTERNAL_VISIBLE = 'External-visible',
}

/**
 * Assignment rules for request assignees
 * 
 * @enum {string}
 */
export enum AssignmentRule {
  AUTO_ASSIGN_OWNER = 'Auto-assign to template owner',
  AUTO_ASSIGN_ROUND_ROBIN = 'Auto-assign to round-robin queue',
  MANUAL_REQUIRED = 'Manual assignment required',
}

/**
 * Compliance approval outcomes
 * 
 * @enum {string}
 */
export enum ApprovalOutcome {
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  DEFICIENT = 'Deficient',
  PENDING = 'Pending',
}

/**
 * Audit log action types
 * Tracks all changes to requests
 * 
 * @enum {string}
 */
export enum AuditAction {
  CREATED = 'Created',
  UPDATED = 'Updated',
  DELETED = 'Deleted',
  STAGE_MOVED_FORWARD = 'Stage Moved Forward',
  STAGE_MOVED_BACKWARD = 'Stage Moved Backward',
  COMPLIANCE_APPROVED = 'Compliance Approved',
  COMPLIANCE_REJECTED = 'Compliance Rejected',
  ASSIGNED = 'Assigned',
  UNASSIGNED = 'Unassigned',
  DOCUMENT_UPLOADED = 'Document Uploaded',
  DOCUMENT_DELETED = 'Document Deleted',
  STATUS_CHANGED = 'Status Changed',
  FINALISED = 'Finalised',
  REMINDER_SENT = 'Reminder Sent',
  COMMENT_ADDED = 'Comment Added',
}

// ----------------------------------------------------------------------------
// REQUEST DETAILS SCHEMA (Step 2 of Wizard)
// ----------------------------------------------------------------------------

export interface RequestField {
  id: string;
  label: string;
  key: string; // Machine-readable key for storage and PDF mapping
  type: FieldType;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    allowedValues?: string[];
  };
  visibility: FieldVisibility;
  prefillSource?: string; // e.g., "client.idNumber", "adviser.name"
  pdfMappingToken?: string; // e.g., "{{client.idNumber}}"
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  helpText?: string;
  options?: string[]; // For dropdown/multi-select
  order: number;
}

export interface RequestFieldSection {
  id: string;
  name: string;
  description?: string;
  fields: RequestField[];
  order: number;
}

// ----------------------------------------------------------------------------
// ASSIGNEES & RESPONSIBILITY (Step 3 of Wizard)
// ----------------------------------------------------------------------------

export interface AssigneeRole {
  role: 'Admin' | 'Adviser' | 'Compliance Officer' | 'External';
  required: boolean;
  defaultUserId?: string;
}

export interface ReminderConfig {
  enabled: boolean;
  intervalHours: number; // Default reminder interval
  sendToInternal: boolean;
  sendToExternal: boolean;
}

export interface AssigneeConfiguration {
  defaultRoles: AssigneeRole[];
  assignmentRule: AssignmentRule;
  allowExternalAssignees: boolean;
  reminderConfig: ReminderConfig;
}

// ----------------------------------------------------------------------------
// COMPLIANCE APPROVAL (Step 4 of Wizard)
// ----------------------------------------------------------------------------

export interface ComplianceChecklistItem {
  id: string;
  description: string;
  requiresEvidence: boolean; // Must upload document
  completionRole: 'Admin' | 'Adviser' | 'Compliance Officer';
  order: number;
}

export interface ComplianceApprovalConfig {
  enabled: boolean;
  checklistItems: ComplianceChecklistItem[];
}

// ----------------------------------------------------------------------------
// LIFECYCLE (Step 5 of Wizard)
// ----------------------------------------------------------------------------

export interface LifecycleStageRequirement {
  type: 'document' | 'field' | 'approval';
  description: string;
  reference?: string; // Field key or document type
}

export interface LifecycleTransition {
  targetStageId: string;
  label: string; // e.g., "Next", "Back", "On Hold"
}

export interface SLAConfig {
  durationHours: number;
  escalationEnabled: boolean;
  escalationTarget?: string; // User ID or role
}

export interface StageReminderSchedule {
  enabled: boolean;
  intervalHours: number;
  sendToInternal: boolean;
  sendToExternal: boolean;
}

export interface LifecycleStage {
  id: string;
  name: string;
  description: string;
  order: number;
  requirements: LifecycleStageRequirement[];
  allowedTransitions: LifecycleTransition[];
  sla?: SLAConfig;
  reminderSchedule: StageReminderSchedule;
}

export interface LifecycleConfiguration {
  stages: LifecycleStage[];
}

// ----------------------------------------------------------------------------
// COMPLIANCE SIGN-OFF (Step 6 of Wizard)
// ----------------------------------------------------------------------------

export interface DeficiencyWorkflow {
  allowDeficiencies: boolean;
  requireRemedialDocuments: boolean;
  requireRemedialComments: boolean;
}

export interface ComplianceSignOffConfig {
  enabled: boolean;
  approverRole: 'Super Admin' | 'Compliance Officer' | 'Named User';
  approverUserId?: string;
  deficiencyWorkflow: DeficiencyWorkflow;
}

// ----------------------------------------------------------------------------
// FINALISATION (Step 7 of Wizard)
// ----------------------------------------------------------------------------

export interface FinalisationConfig {
  completionStateLabel: string; // "Completed" or "Archived"
  lockAfterCompletion: boolean;
  requiredFinalDocuments: string[];
  sendCompletionEmail: boolean;
  completionEmailTemplate?: string;
}

// ----------------------------------------------------------------------------
// COMMUNICATIONS & PDF
// ----------------------------------------------------------------------------

export interface CommunicationTrigger {
  event: 'request_created' | 'missing_docs' | 'lifecycle_moved' | 'sla_overdue' | 'quote_ready' | 'finalised';
  enabled: boolean;
  emailTemplate?: string;
  notificationMessage?: string;
}

export interface PDFOutputConfig {
  templateVersion: string;
  includeSections: string[];
  includeAuditLog: boolean;
}

// ----------------------------------------------------------------------------
// TEMPLATE (Complete)
// ----------------------------------------------------------------------------

export interface RequestTemplate {
  id: string;
  version: number;
  
  // Step 1: Basics
  name: string;
  category: RequestCategory;
  requestType: RequestType;
  clientAssociationRule: ClientAssociationRule;
  defaultPriority: RequestPriority;
  defaultQueue: 'New Requests' | string; // Can add provider lanes later
  providerLane?: string;
  status: TemplateStatus;
  
  // Step 2: Request Details Schema
  requestDetailsSchema: RequestFieldSection[];
  
  // Step 3: Assignees
  assigneeConfiguration: AssigneeConfiguration;
  
  // Step 4: Compliance Approval
  complianceApprovalConfig: ComplianceApprovalConfig;
  
  // Step 5: Lifecycle
  lifecycleConfiguration: LifecycleConfiguration;
  
  // Step 6: Compliance Sign-Off
  complianceSignOffConfig: ComplianceSignOffConfig;
  
  // Step 7: Finalisation
  finalisationConfig: FinalisationConfig;
  
  // Communications & PDF
  communicationTriggers: CommunicationTrigger[];
  pdfOutputConfig: PDFOutputConfig;
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  owner: string;
  previousVersionId?: string; // For version history
}

// ----------------------------------------------------------------------------
// REQUEST (Runtime Instance)
// ----------------------------------------------------------------------------

export interface RequestAssignee {
  userId: string;
  userName: string;
  role: 'Admin' | 'Adviser' | 'Compliance Officer' | 'External';
  assignedAt: string;
  assignedBy: string;
}

export interface ComplianceChecklistItemStatus {
  itemId: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  evidenceDocumentIds: string[];
  notes?: string;
}

export interface LifecycleStageStatus {
  stageId: string;
  enteredAt: string;
  exitedAt?: string;
  completedRequirements: string[];
  notes?: string;
}

export interface Deficiency {
  id: string;
  description: string;
  requiresDocument: boolean;
  requiresComment: boolean;
  createdBy: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  remedialDocumentIds: string[];
  remedialComment?: string;
}

export interface Request {
  id: string; // Unique request ID
  templateId: string;
  templateVersion: number;
  
  // Basic Info
  status: RequestStatus;
  priority: RequestPriority;
  
  // Client Association
  clientId?: string;
  clientName?: string;
  
  // Request Data (populated from template schema)
  requestDetails: Record<string, unknown>;
  
  // Assignees
  assignees: RequestAssignee[];
  
  // Compliance Approval Status
  complianceApproval: {
    required: boolean;
    checklistStatus: ComplianceChecklistItemStatus[];
    approvedBy?: string;
    approvedAt?: string;
  };
  
  // Lifecycle Status
  lifecycle: {
    currentStageId?: string;
    stageHistory: LifecycleStageStatus[];
    startedAt?: string;
  };
  
  // Compliance Sign-Off
  complianceSignOff: {
    required: boolean;
    outcome?: ApprovalOutcome;
    approvedBy?: string;
    approvedAt?: string;
    deficiencies: Deficiency[];
  };
  
  // Finalisation
  finalised: boolean;
  finalisedAt?: string;
  finalisedBy?: string;
  
  // Documents
  documentIds: string[];
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// AUDIT LOG
// ----------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  requestId: string;
  action: AuditAction;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  details: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
}

// ----------------------------------------------------------------------------
// API REQUEST/RESPONSE TYPES
// ----------------------------------------------------------------------------

export interface CreateTemplateRequest {
  name: string;
  category: RequestCategory;
  requestType: RequestType;
  clientAssociationRule: ClientAssociationRule;
  defaultPriority: RequestPriority;
  status: TemplateStatus;
  providerLane?: string;
  // All other fields will be added in wizard steps
}

export interface UpdateTemplateRequest {
  template: RequestTemplate;
  createNewVersion: boolean; // If true and template is active, creates new version
}

export interface CreateRequestRequest {
  templateId: string;
  clientId?: string;
  requestDetails: Record<string, unknown>;
  assignees?: string[]; // User IDs
  priority?: RequestPriority;
}

export interface MoveLifecycleStageRequest {
  targetStageId: string;
  notes?: string;
}

export interface ComplianceApprovalRequest {
  outcome: ApprovalOutcome;
  deficiencies?: Array<{
    description: string;
    requiresDocument: boolean;
    requiresComment: boolean;
  }>;
  notes?: string;
}

export interface ListRequestsFilters {
  status?: RequestStatus[];
  category?: RequestCategory[];
  templateId?: string;
  assigneeId?: string;
  clientId?: string;
  priority?: RequestPriority[];
  dateFrom?: string;
  dateTo?: string;
  search?: string; // Search by request ID or client name
}

// ----------------------------------------------------------------------------
// UI HELPER TYPES
// ----------------------------------------------------------------------------

export interface TemplateListItem {
  id: string;
  name: string;
  category: RequestCategory;
  requestType: RequestType;
  clientAssociation: ClientAssociationRule;
  lifecycleStageCount: number;
  complianceEnabled: boolean;
  signOffRequired: boolean;
  status: TemplateStatus;
  updatedAt: string;
  owner: string;
}

export interface RequestListItem {
  id: string;
  templateName: string;
  category: RequestCategory;
  clientName?: string;
  status: RequestStatus;
  currentStageName?: string;
  priority: RequestPriority;
  assigneeNames: string[];
  slaWarning: boolean;
  updatedAt: string;
}