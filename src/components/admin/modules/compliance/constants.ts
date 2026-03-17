/**
 * Compliance Module Constants
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized constants for Compliance module including status labels, colors,
 * regulatory frameworks, and configuration values.
 */

import type { 
  RAGStatus, 
  ComplianceStatus, 
  REStatus, 
  AMLCheckStatus,
  RiskLevel,
  ComplaintStatus,
  ComplaintCategory,
  SupervisionFrequency 
} from './types';

// ============================================================================
// STATUS LABELS & COLORS
// ============================================================================

/**
 * RAG (Red, Amber, Green) status labels
 */
export const RAG_STATUS_LABELS: Record<RAGStatus, string> = {
  red: 'Critical',
  amber: 'Warning',
  green: 'Good',
};

/**
 * RAG status colors (Tailwind CSS)
 */
export const RAG_STATUS_COLORS: Record<RAGStatus, string> = {
  red: 'bg-red-100 text-red-800 border-red-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  green: 'bg-green-100 text-green-800 border-green-200',
};

/**
 * Compliance status labels
 */
export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  current: 'Current',
  'due-soon': 'Due Soon',
  overdue: 'Overdue',
  pending: 'Pending',
  inactive: 'Inactive',
};

/**
 * Compliance status colors (Tailwind CSS)
 */
export const COMPLIANCE_STATUS_COLORS: Record<ComplianceStatus, string> = {
  current: 'bg-green-100 text-green-800 border-green-200',
  'due-soon': 'bg-amber-100 text-amber-800 border-amber-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
};

/**
 * RE (Representative) status labels
 */
export const RE_STATUS_LABELS: Record<REStatus, string> = {
  Active: 'Active',
  Lapsed: 'Lapsed',
  Suspended: 'Suspended',
  'Application Submitted': 'Application Submitted',
  Pending: 'Pending',
};

/**
 * RE status colors (Tailwind CSS)
 */
export const RE_STATUS_COLORS: Record<REStatus, string> = {
  Active: 'bg-green-100 text-green-800 border-green-200',
  Lapsed: 'bg-red-100 text-red-800 border-red-200',
  Suspended: 'bg-orange-100 text-orange-800 border-orange-200',
  'Application Submitted': 'bg-blue-100 text-blue-800 border-blue-200',
  Pending: 'bg-gray-100 text-gray-800 border-gray-200',
};

/**
 * AML check status labels
 */
export const AML_STATUS_LABELS: Record<AMLCheckStatus, string> = {
  clear: 'Clear',
  flagged: 'Flagged',
  pending: 'Pending',
  'review-required': 'Review Required',
};

/**
 * AML check status colors (Tailwind CSS)
 */
export const AML_STATUS_COLORS: Record<AMLCheckStatus, string> = {
  clear: 'bg-green-100 text-green-800 border-green-200',
  flagged: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-blue-100 text-blue-800 border-blue-200',
  'review-required': 'bg-amber-100 text-amber-800 border-amber-200',
};

/**
 * Risk level labels
 */
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/**
 * Risk level colors (Tailwind CSS)
 */
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

/**
 * Complaint status labels
 */
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  received: 'Received',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  resolved: 'Resolved',
  escalated: 'Escalated',
  closed: 'Closed',
};

/**
 * Complaint status colors (Tailwind CSS)
 */
export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  received: 'bg-blue-100 text-blue-800 border-blue-200',
  acknowledged: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  investigating: 'bg-amber-100 text-amber-800 border-amber-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  escalated: 'bg-orange-100 text-orange-800 border-orange-200',
  closed: 'bg-gray-100 text-gray-800 border-gray-200',
};

/**
 * Complaint category labels
 */
export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  service: 'Service Quality',
  product: 'Product Issue',
  advice: 'Advice Quality',
  billing: 'Billing & Fees',
  communication: 'Communication',
  other: 'Other',
};

/**
 * Supervision frequency labels
 */
export const SUPERVISION_FREQUENCY_LABELS: Record<SupervisionFrequency, string> = {
  Monthly: 'Monthly',
  Quarterly: 'Quarterly',
  'Bi-annual': 'Bi-annual',
  Annual: 'Annual',
};

// ============================================================================
// REGULATORY FRAMEWORKS
// ============================================================================

/**
 * South African regulatory authorities
 */
export const REGULATORY_AUTHORITIES = {
  FSCA: 'Financial Sector Conduct Authority',
  PA: 'Prudential Authority',
  SARS: 'South African Revenue Service',
  FIC: 'Financial Intelligence Centre',
  INFOREGULATOR: 'Information Regulator',
  CIPC: 'Companies and Intellectual Property Commission',
} as const;

/**
 * FAIS Class of Business categories
 */
export const COB_CATEGORIES = [
  'I - Short-term Insurance',
  'II - Long-term Insurance',
  'IIA - Long-term Insurance Category A',
  'III - Participatory Interests in Collective Investment Schemes',
  'IV - Pension Funds Benefits',
] as const;

/**
 * Product Supplier Type (PST) categories
 */
export const PST_CATEGORIES = [
  'Short-term Insurance',
  'Long-term Insurance',
  'Life Insurance',
  'Investment Business',
  'Pension Funds',
  'Collective Investment Schemes',
  'Health Services',
] as const;

/**
 * TCF (Treating Customers Fairly) outcomes
 */
export const TCF_OUTCOMES = {
  1: 'Consumers are confident that they are dealing with firms where the fair treatment of customers is central to the corporate culture',
  2: 'Products and services marketed and sold are designed to meet the needs of identified consumer groups',
  3: 'Consumers are provided with clear information and are kept appropriately informed',
  4: 'Where advice is given, the advice is suitable and takes account of consumer circumstances',
  5: 'Products perform as firms have led consumers to expect, and service is of an acceptable standard',
  6: 'Consumers do not face unreasonable post-sale barriers',
} as const;

// ============================================================================
// COMPLIANCE THRESHOLDS
// ============================================================================

/**
 * CPD (Continuing Professional Development) requirements
 */
export const CPD_REQUIREMENTS = {
  KEY_INDIVIDUAL: 30,      // Hours per year
  REPRESENTATIVE_L1: 30,   // Level 1 Representative
  REPRESENTATIVE_L2: 30,   // Level 2 Representative
  REPRESENTATIVE_L3: 15,   // Level 3 Representative
} as const;

/**
 * Deadline warning thresholds (in days)
 */
export const DEADLINE_THRESHOLDS = {
  CRITICAL: 7,   // Red warning
  WARNING: 30,   // Amber warning
  INFO: 90,      // Blue info
} as const;

/**
 * Complaint resolution targets (in days)
 */
export const COMPLAINT_RESOLUTION_TARGETS = {
  ACKNOWLEDGEMENT: 2,  // Days to acknowledge
  STANDARD: 15,        // Standard resolution time
  COMPLEX: 30,         // Complex case resolution
  MAXIMUM: 90,         // Maximum allowed time
} as const;

/**
 * Record retention periods (in years)
 */
export const RETENTION_PERIODS = {
  CLIENT_FILES: 5,
  ADVICE_RECORDS: 5,
  TRANSACTION_RECORDS: 5,
  FINANCIAL_RECORDS: 7,
  TAX_RECORDS: 5,
  COMPLAINTS: 5,
  MARKETING_MATERIALS: 3,
  GENERAL_CORRESPONDENCE: 3,
} as const;

/**
 * AML risk score thresholds
 */
export const AML_RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
  // Above 80 = Critical
} as const;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default CPD hours requirement
 */
export const DEFAULT_CPD_HOURS = 30;

/**
 * Default supervision frequency
 */
export const DEFAULT_SUPERVISION_FREQUENCY: SupervisionFrequency = 'Annual';

/**
 * Default retention period (years)
 */
export const DEFAULT_RETENTION_PERIOD = 5;

/**
 * Default page size for tables
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Default date format
 */
export const DATE_FORMAT = 'dd MMM yyyy';

/**
 * Default datetime format
 */
export const DATETIME_FORMAT = 'dd MMM yyyy HH:mm';

// ============================================================================
// QUERY CONFIGURATION
// ============================================================================

/**
 * Stale time for React Query cache (1 minute)
 */
export const QUERY_STALE_TIME = 60000;

/**
 * Garbage collection time for React Query cache (5 minutes)
 */
export const QUERY_GC_TIME = 5 * 60 * 1000;

/**
 * Debounce time for search input (milliseconds)
 */
export const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// UI MESSAGES
// ============================================================================

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  RECORD_CREATED: 'Compliance record created successfully',
  RECORD_UPDATED: 'Compliance record updated successfully',
  RECORD_DELETED: 'Compliance record deleted successfully',
  DOCUMENT_UPLOADED: 'Document uploaded successfully',
  EXPORT_COMPLETED: 'Export completed successfully',
  CHECK_COMPLETED: 'Compliance check completed successfully',
  CONSENT_RECORDED: 'Consent recorded successfully',
  COMPLAINT_SUBMITTED: 'Complaint submitted successfully',
  COMPLAINT_RESOLVED: 'Complaint resolved successfully',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to load compliance records',
  CREATE_FAILED: 'Failed to create compliance record',
  UPDATE_FAILED: 'Failed to update compliance record',
  DELETE_FAILED: 'Failed to delete compliance record',
  UPLOAD_FAILED: 'Failed to upload document',
  EXPORT_FAILED: 'Failed to export data',
  INVALID_DATA: 'Invalid data provided',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_FOUND: 'Compliance record not found',
  CHECK_FAILED: 'Compliance check failed',
  CONSENT_FAILED: 'Failed to record consent',
  COMPLAINT_FAILED: 'Failed to submit complaint',
} as const;

/**
 * Info messages
 */
export const INFO_MESSAGES = {
  EMPTY_STATE: 'No compliance records found',
  LOADING: 'Loading compliance data...',
  PROCESSING: 'Processing...',
  SELECT_MODULE: 'Select a compliance module to view records',
  NO_OVERDUE: 'No overdue items',
  NO_DEADLINES: 'No upcoming deadlines',
  NO_ISSUES: 'No compliance issues detected',
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * RE Number validation regex (South African format)
 */
export const RE_NUMBER_REGEX = /^RE\s?\d{5,}$/i;

/**
 * FSP Number validation regex (South African format)
 */
export const FSP_NUMBER_REGEX = /^FSP\s?\d{5,}$/i;

/**
 * South African ID Number validation regex
 */
export const SA_ID_NUMBER_REGEX = /^\d{13}$/;

/**
 * Minimum notes length
 */
export const MIN_NOTES_LENGTH = 10;

/**
 * Maximum notes length
 */
export const MAX_NOTES_LENGTH = 5000;

/**
 * Maximum title length
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * Maximum description length
 */
export const MAX_DESCRIPTION_LENGTH = 1000;

// ============================================================================
// TABLE CONFIGURATION
// ============================================================================

/**
 * Default visible columns for compliance tables
 */
export const DEFAULT_VISIBLE_COLUMNS = [
  'title',
  'status',
  'ragStatus',
  'owner',
  'due',
  'lastReview',
] as const;

/**
 * Sortable columns
 */
export const SORTABLE_COLUMNS = [
  'title',
  'status',
  'ragStatus',
  'owner',
  'due',
  'created',
  'lastReview',
] as const;

/**
 * Export formats
 */
export const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
] as const;

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

/**
 * Email notification triggers
 */
export const EMAIL_NOTIFICATIONS = {
  DEADLINE_APPROACHING: true,
  DEADLINE_OVERDUE: true,
  HIGH_RISK_DETECTED: true,
  COMPLAINT_RECEIVED: true,
  COMPLIANCE_ISSUE: true,
  WEEKLY_SUMMARY: true,
} as const;

/**
 * Notification lead times (days before deadline)
 */
export const NOTIFICATION_LEAD_TIMES = {
  FIRST_WARNING: 30,
  SECOND_WARNING: 14,
  FINAL_WARNING: 7,
  OVERDUE_REMINDER: 1,  // Days after overdue
} as const;

// ============================================================================
// MODULE TABS
// ============================================================================

/**
 * Compliance module tab configuration
 */
export const COMPLIANCE_TABS = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'fais', label: 'FAIS', icon: 'UserCheck' },
  { id: 'aml-fica', label: 'AML/FICA', icon: 'Shield' },
  { id: 'popi-paia', label: 'POPI/PAIA', icon: 'Lock' },
  { id: 'statutory', label: 'Statutory Returns', icon: 'FileText' },
  { id: 'tcf', label: 'TCF', icon: 'Heart' },
  { id: 'record-keeping', label: 'Record Keeping', icon: 'Archive' },
  { id: 'debarment', label: 'Debarment', icon: 'Ban' },
  { id: 'conflicts', label: 'Conflicts & Marketing', icon: 'AlertTriangle' },
  { id: 'documents', label: 'Documents & Insurance', icon: 'FileCheck' },
  { id: 'new-business', label: 'New Business', icon: 'Briefcase' },
  { id: 'complaints', label: 'Complaints', icon: 'MessageSquare' },
] as const;

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Compliance module permissions
 */
export const COMPLIANCE_PERMISSIONS = {
  VIEW_ALL: 'compliance:view:all',
  VIEW_OWN: 'compliance:view:own',
  CREATE: 'compliance:create',
  UPDATE: 'compliance:update',
  DELETE: 'compliance:delete',
  EXPORT: 'compliance:export',
  MANAGE_SETTINGS: 'compliance:settings',
} as const;
