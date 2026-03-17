/**
 * Requests Module - Types
 * 
 * Type definitions for the Requests management system:
 * - Request templates and configurations
 * - Request instances and workflows
 * - Compliance and lifecycle management
 * - Audit logging
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

export enum RequestType {
  ADMINISTRATIVE = 'Administrative Request',
  QUOTE = 'Quote Request',
}

export enum ClientAssociationRule {
  REQUIRED = 'Required',
  OPTIONAL = 'Optional',
  NOT_ALLOWED = 'Not Allowed',
}

export enum TemplateStatus {
  DRAFT = 'Draft',
  ACTIVE = 'Active',
  ARCHIVED = 'Archived',
}

export enum RequestStatus {
  NEW = 'New',
  IN_COMPLIANCE_REVIEW = 'In Compliance Review',
  IN_LIFECYCLE = 'In Lifecycle',
  IN_SIGN_OFF = 'In Sign-Off',
  COMPLETED = 'Completed',
  ON_HOLD = 'On Hold',
  CANCELLED = 'Cancelled',
}

export enum RequestPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DROPDOWN = 'dropdown',
  MULTI_SELECT = 'multi-select',
  BOOLEAN = 'boolean',
  FILE_REFERENCE = 'file',
}

export enum FieldVisibility {
  ADMIN_ONLY = 'Admin-only',
  CLIENT_VISIBLE = 'Client-visible',
  EXTERNAL_VISIBLE = 'External-visible',
}

export enum AssignmentRule {
  AUTO_ASSIGN_OWNER = 'Auto-assign to template owner',
  AUTO_ASSIGN_ROUND_ROBIN = 'Auto-assign to round-robin queue',
  MANUAL_REQUIRED = 'Manual assignment required',
}

export enum ApprovalOutcome {
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  DEFICIENT = 'Deficient',
  PENDING = 'Pending',
}

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

export interface RequestField {
  id: string;
  label: string;
  key: string;
  type: FieldType;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    allowedValues?: string[];
  };
  visibility: FieldVisibility;
  prefillSource?: string;
  pdfMappingToken?: string;
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  order: number;
}

export interface RequestFieldSection {
  id: string;
  name: string;
  description?: string;
  fields: RequestField[];
  order: number;
}

export interface AssigneeRole {
  role: 'Admin' | 'Adviser' | 'Compliance Officer' | 'External';
  required: boolean;
  defaultUserId?: string;
}

export interface ReminderConfig {
  enabled: boolean;
  intervalHours: number;
  sendToInternal: boolean;
  sendToExternal: boolean;
}

export interface AssigneeConfiguration {
  defaultRoles: AssigneeRole[];
  assignmentRule: AssignmentRule;
  allowExternalAssignees: boolean;
  reminderConfig: ReminderConfig;
}

export interface ComplianceChecklistItem {
  id: string;
  description: string;
  requiresEvidence: boolean;
  completionRole: 'Admin' | 'Adviser' | 'Compliance Officer';
  order: number;
}

export interface ComplianceApprovalConfig {
  enabled: boolean;
  checklistItems: ComplianceChecklistItem[];
}

export interface LifecycleStageRequirement {
  type: 'document' | 'field' | 'approval';
  description: string;
  reference?: string;
}

export interface LifecycleTransition {
  targetStageId: string;
  label: string;
}

export interface SLAConfig {
  durationHours: number;
  escalationEnabled: boolean;
  escalationTarget?: string;
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

export interface FinalisationConfig {
  completionStateLabel: string;
  lockAfterCompletion: boolean;
  requiredFinalDocuments: string[];
  sendCompletionEmail: boolean;
  completionEmailTemplate?: string;
}

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

export interface RequestTemplate {
  id: string;
  version: number;
  name: string;
  category: RequestCategory;
  requestType: RequestType;
  clientAssociationRule: ClientAssociationRule;
  defaultPriority: RequestPriority;
  defaultQueue: 'New Requests' | string;
  providerLane?: string;
  status: TemplateStatus;
  requestDetailsSchema: RequestFieldSection[];
  assigneeConfiguration: AssigneeConfiguration;
  complianceApprovalConfig: ComplianceApprovalConfig;
  lifecycleConfiguration: LifecycleConfiguration;
  complianceSignOffConfig: ComplianceSignOffConfig;
  finalisationConfig: FinalisationConfig;
  communicationTriggers: CommunicationTrigger[];
  pdfOutputConfig: PDFOutputConfig;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  owner: string;
  previousVersionId?: string;
}

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
  id: string;
  templateId: string;
  templateVersion: number;
  status: RequestStatus;
  priority: RequestPriority;
  clientId?: string;
  clientName?: string;
  requestDetails: Record<string, unknown>;
  assignees: RequestAssignee[];
  complianceApproval: {
    required: boolean;
    checklistStatus: ComplianceChecklistItemStatus[];
    approvedBy?: string;
    approvedAt?: string;
  };
  lifecycle: {
    currentStageId?: string;
    stageHistory: LifecycleStageStatus[];
    startedAt?: string;
  };
  complianceSignOff: {
    required: boolean;
    outcome?: ApprovalOutcome;
    approvedBy?: string;
    approvedAt?: string;
    deficiencies: Deficiency[];
  };
  finalised: boolean;
  finalisedAt?: string;
  finalisedBy?: string;
  documentIds: string[];
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

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