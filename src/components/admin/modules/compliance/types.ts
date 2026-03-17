/**
 * Compliance Module Type Definitions
 * Navigate Wealth Admin Dashboard
 * 
 * All TypeScript type definitions for the Compliance module covering:
 * - FAIS (Financial Advisory and Intermediary Services)
 * - AML/FICA (Anti-Money Laundering / Financial Intelligence Centre Act)
 * - POPI/PAIA (Protection of Personal Information / Promotion of Access to Information)
 * - Statutory Returns
 * - TCF (Treating Customers Fairly)
 * - Record Keeping
 * - Debarment & Supervision
 * - Conflicts & Marketing
 * - Documents & Insurance
 * - New Business Register
 * - Complaints
 */

// ============================================================================
// ENUMS & UNIONS
// ============================================================================

/**
 * RAG (Red, Amber, Green) status for compliance items
 */
export type RAGStatus = 'red' | 'amber' | 'green';

/**
 * General compliance status
 */
export type ComplianceStatus = 
  | 'current'      // All requirements met
  | 'due-soon'     // Deadline approaching (within 30 days)
  | 'overdue'      // Past deadline
  | 'pending'      // Awaiting approval/review
  | 'inactive';    // Not currently active

/**
 * FAIS Representative status
 */
export type REStatus = 
  | 'Active' 
  | 'Lapsed' 
  | 'Suspended' 
  | 'Application Submitted' 
  | 'Pending';

/**
 * AML/FICA check types
 */
export type AMLCheckType = 
  | 'kyc'          // Know Your Customer
  | 'screening'    // Sanctions screening
  | 'verification' // Identity verification
  | 'peps'         // Politically Exposed Persons
  | 'adverse-media'; // Adverse media checks

/**
 * AML/FICA check status
 */
export type AMLCheckStatus = 
  | 'clear' 
  | 'flagged' 
  | 'pending' 
  | 'review-required';

/**
 * Risk levels for compliance checks
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * POPIA consent types
 */
export type ConsentType = 
  | 'general'       // General data processing
  | 'marketing'     // Marketing communications
  | 'profiling'     // Profiling and automated decisions
  | 'data_sharing'  // Sharing data with third parties
  | 'special';      // Special personal information

/**
 * Document types for compliance
 */
export type ComplianceDocumentType = 
  | 'license'
  | 'certificate'
  | 'policy'
  | 'procedure'
  | 'form'
  | 'report'
  | 'proof'
  | 'other';

/**
 * Supervision plan frequency
 */
export type SupervisionFrequency = 
  | 'Monthly' 
  | 'Quarterly' 
  | 'Bi-annual' 
  | 'Annual';

/**
 * Complaint status
 */
export type ComplaintStatus = 
  | 'received'
  | 'acknowledged'
  | 'investigating'
  | 'resolved'
  | 'escalated'
  | 'closed';

/**
 * Complaint category
 */
export type ComplaintCategory = 
  | 'service'
  | 'product'
  | 'advice'
  | 'billing'
  | 'communication'
  | 'other';

// ============================================================================
// BASE COMPLIANCE RECORD
// ============================================================================

/**
 * Base interface for all compliance records
 */
export interface ComplianceRecord {
  id: string;
  title: string;
  status: ComplianceStatus;
  ragStatus: RAGStatus;
  owner: string;
  created: Date;
  lastReview?: Date;
  due?: Date;
  notes?: string;
  attachments?: number;
  tags?: string[];
}

// ============================================================================
// FAIS (Financial Advisory and Intermediary Services)
// ============================================================================

/**
 * FAIS Fit & Proper Register Record
 */
export interface FAISRecord extends ComplianceRecord {
  // RE (Representative) Information
  reNumber: string;
  reStatus: REStatus;
  reExpiry?: Date;
  
  // Categories
  cob: string;  // Class of Business (I, II, IIA, III, etc.)
  pst: string;  // Product Supplier Type
  
  // CPD (Continuing Professional Development)
  cpdHours: number;
  cpdRequired: number;
  
  // Supervision
  supervisionPlan: SupervisionFrequency;
  
  // Additional fields
  keyIndividual?: boolean;
  fspNumber?: string;
  fspName?: string;
}

// ============================================================================
// AML/FICA (Anti-Money Laundering)
// ============================================================================

/**
 * AML/FICA Check Record
 */
export interface AMLFICARecord extends ComplianceRecord {
  clientId: string;
  clientName: string;
  
  // Check details
  checkType: AMLCheckType;
  checkStatus: AMLCheckStatus;
  riskLevel: RiskLevel;
  
  // Verification
  idVerified: boolean;
  addressVerified: boolean;
  sanctionsScreened: boolean;
  pepsScreened: boolean;
  adverseMediaChecked: boolean;
  
  // Results
  sanctionsMatch: boolean;
  pepsMatch: boolean;
  adverseMediaMatch: boolean;
  
  // Processing
  checkedBy: string;
  checkedAt: Date;
  externalReference?: string;
  
  // Documentation
  documents: string[];
}

// ============================================================================
// POPI/PAIA (Data Protection)
// ============================================================================

/**
 * POPIA Consent Record
 */
export interface POPIAConsentRecord {
  id: string;
  userId: string;
  userName: string;
  
  // Consent details
  consentType: ConsentType;
  consented: boolean;
  consentDate: Date;
  withdrawnDate?: Date;
  
  // Tracking
  ipAddress?: string;
  userAgent?: string;
  method: 'web' | 'email' | 'phone' | 'in-person';
  
  // Documentation
  consentDocument?: string;
  notes?: string;
}

/**
 * PAIA (Access to Information) Request
 */
export interface PAIARequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  
  // Request details
  requestType: 'personal' | 'public' | 'third-party';
  informationRequested: string;
  reasonForRequest: string;
  
  // Processing
  status: 'received' | 'processing' | 'completed' | 'denied';
  receivedDate: Date;
  dueDate: Date;
  completedDate?: Date;
  
  // Response
  outcome?: 'granted' | 'partially-granted' | 'denied';
  denialReason?: string;
  documentsProvided?: string[];
  
  // Tracking
  handledBy: string;
  notes?: string;
}

// ============================================================================
// STATUTORY RETURNS
// ============================================================================

/**
 * Statutory Return Record
 */
export interface StatutoryRecord extends ComplianceRecord {
  returnType: string;  // e.g., 'FSCA Annual Return', 'VAT Return', 'Tax Return'
  period: string;      // e.g., '2024 Q1', '2023 FY'
  authority: string;   // e.g., 'FSCA', 'SARS', 'Companies House'
  
  // Deadlines
  submissionDeadline: Date;
  submittedDate?: Date;
  
  // Status
  prepared: boolean;
  reviewed: boolean;
  submitted: boolean;
  acknowledged: boolean;
  
  // Details
  preparedBy?: string;
  reviewedBy?: string;
  submittedBy?: string;
  
  // References
  referenceNumber?: string;
  acknowledgementNumber?: string;
  
  // Financial (if applicable)
  amount?: number;
  paid?: boolean;
  paymentDate?: Date;
  paymentReference?: string;
}

// ============================================================================
// TCF (Treating Customers Fairly)
// ============================================================================

/**
 * TCF Assessment Record
 */
export interface TCFRecord extends ComplianceRecord {
  // Assessment details
  assessmentType: 'product' | 'service' | 'process' | 'complaint' | 'outcome';
  tcfOutcome: 1 | 2 | 3 | 4 | 5 | 6;  // TCF Outcome numbers
  
  // Findings
  compliant: boolean;
  findings: string;
  recommendations: string;
  
  // Actions
  actionRequired: boolean;
  actionPlan?: string;
  actionOwner?: string;
  actionDeadline?: Date;
  actionCompleted?: boolean;
  
  // Review
  reviewedBy: string;
  reviewDate: Date;
  nextReviewDate?: Date;
}

// ============================================================================
// RECORD KEEPING
// ============================================================================

/**
 * Record Keeping Register Entry
 */
export interface RecordKeepingEntry extends ComplianceRecord {
  // Record details
  recordType: string;  // e.g., 'Client File', 'Policy Document', 'Transaction Record'
  category: 'client' | 'financial' | 'operational' | 'compliance' | 'other';
  
  // Retention
  retentionPeriod: number;  // Years
  retentionStart: Date;
  retentionEnd: Date;
  
  // Storage
  storageLocation: 'physical' | 'digital' | 'both';
  physicalLocation?: string;
  digitalLocation?: string;
  
  // Disposal
  disposalRequired: boolean;
  disposalMethod?: 'shred' | 'delete' | 'archive';
  disposedDate?: Date;
  disposedBy?: string;
  
  // Security
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  accessRestrictions?: string[];
}

// ============================================================================
// DEBARMENT & SUPERVISION
// ============================================================================

/**
 * Debarment Check Record
 */
export interface DebarmentRecord {
  id: string;
  adviserId: string;
  adviserName: string;
  idNumber: string;
  
  // Check details
  checkStatus: 'clear' | 'flagged' | 'pending';
  checkedAt: Date;
  checkedBy: string;
  
  // Results
  debarred: boolean;
  debarmentDetails?: string;
  debarmentDate?: Date;
  debarmentAuthority?: string;
  
  // Tracking
  externalReference?: string;
  notes?: string;
}

/**
 * Supervision Plan Record
 */
export interface SupervisionRecord {
  id: string;
  adviserId: string;
  adviserName: string;
  
  // Plan details
  frequency: SupervisionFrequency;
  lastSupervision?: Date;
  nextSupervision: Date;
  
  // Findings
  findings?: string;
  issuesIdentified?: string[];
  correctiveActions?: string[];
  
  // Tracking
  supervisedBy?: string;
  status: 'current' | 'overdue' | 'pending';
}

// ============================================================================
// CONFLICTS & MARKETING
// ============================================================================

/**
 * Conflict of Interest Record
 */
export interface ConflictRecord extends ComplianceRecord {
  // Conflict details
  conflictType: 'financial' | 'personal' | 'business' | 'other';
  description: string;
  partiesInvolved: string[];
  
  // Assessment
  severity: 'minor' | 'moderate' | 'significant' | 'critical';
  potentialImpact: string;
  
  // Management
  mitigationStrategy: string;
  mitigationOwner: string;
  mitigationDeadline?: Date;
  mitigationCompleted: boolean;
  
  // Disclosure
  disclosed: boolean;
  disclosedTo: string[];
  disclosureDate?: Date;
  
  // Review
  reviewFrequency: 'monthly' | 'quarterly' | 'annual';
  nextReview: Date;
}

/**
 * Marketing Material Record
 */
export interface MarketingRecord extends ComplianceRecord {
  // Material details
  materialType: 'brochure' | 'email' | 'social-media' | 'website' | 'advertisement' | 'other';
  channel: string;
  audience: string;
  
  // Compliance
  approved: boolean;
  approvedBy?: string;
  approvalDate?: Date;
  
  // Content
  claims: string[];
  disclaimers: string[];
  
  // Tracking
  distributionDate?: Date;
  expiryDate?: Date;
  archived: boolean;
}

// ============================================================================
// DOCUMENTS & INSURANCE
// ============================================================================

/**
 * Documents & Insurance Record
 */
export interface DocumentsInsuranceRecord extends ComplianceRecord {
  // Document/Insurance details
  type: 'professional-indemnity' | 'fidelity-guarantee' | 'cyber' | 'directors-officers' | 'other';
  provider: string;
  policyNumber: string;
  
  // Coverage
  coverageAmount: number;
  currency: string;
  
  // Dates
  effectiveDate: Date;
  expiryDate: Date;
  renewalDate: Date;
  
  // Status
  active: boolean;
  renewed: boolean;
  
  // Claims
  claimsMade: number;
  lastClaimDate?: Date;
  
  // Documents
  policyDocument?: string;
  certificateDocument?: string;
}

// ============================================================================
// NEW BUSINESS REGISTER
// ============================================================================

/**
 * New Business Register Entry
 */
export interface NewBusinessRecord extends ComplianceRecord {
  // Client details
  clientId: string;
  clientName: string;
  
  // Product details
  productType: string;
  provider: string;
  policyNumber?: string;
  
  // Financial
  premium: number;
  commission: number;
  frequency: 'once-off' | 'monthly' | 'quarterly' | 'annual';
  
  // Processing
  applicationDate: Date;
  acceptanceDate?: Date;
  declineDate?: Date;
  declineReason?: string;
  
  // Compliance
  needsAnalysisDone: boolean;
  adviceRecordCompleted: boolean;
  clientSignedOff: boolean;
  
  // Commission
  commissionPaid: boolean;
  commissionDate?: Date;
  commissionAmount?: number;
}

// ============================================================================
// COMPLAINTS
// ============================================================================

/**
 * Complaint Record
 */
export interface ComplaintRecord {
  id: string;
  
  // Complainant details
  complainantName: string;
  complainantContact: string;
  clientId?: string;
  
  // Complaint details
  category: ComplaintCategory;
  description: string;
  receivedDate: Date;
  channel: 'email' | 'phone' | 'in-person' | 'online' | 'letter';
  
  // Processing
  status: ComplaintStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
  
  // TCF alignment
  tcfOutcome?: 1 | 2 | 3 | 4 | 5 | 6;
  
  // Resolution
  acknowledgedDate?: Date;
  targetResolutionDate: Date;
  resolvedDate?: Date;
  resolution?: string;
  outcome?: 'upheld' | 'partially-upheld' | 'not-upheld';
  
  // Escalation
  escalated: boolean;
  escalatedTo?: string;
  escalatedDate?: Date;
  ombudsmanReferred: boolean;
  
  // Root cause
  rootCause?: string;
  correctiveAction?: string;
  preventativeAction?: string;
  
  // Tracking
  notes: string;
  documents: string[];
}

// ============================================================================
// COMPLIANCE ACTIVITY & TRACKING
// ============================================================================

/**
 * Compliance Activity Log Entry
 */
export interface ComplianceActivity {
  id: string;
  type: string;
  description: string;
  module: string;  // FAIS, AML, POPIA, etc.
  timestamp: Date;
  performedBy: string;
  relatedRecordId?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Compliance Deadline
 */
export interface ComplianceDeadline {
  id: string;
  title: string;
  description: string;
  module: string;
  dueDate: Date;
  status: 'upcoming' | 'due-soon' | 'overdue' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  relatedRecordId?: string;
}

// ============================================================================
// STATISTICS & REPORTING
// ============================================================================

/**
 * Overall Compliance Statistics
 */
export interface ComplianceStats {
  // FAIS
  fais: {
    total: number;
    current: number;
    dueSoon: number;
    overdue: number;
    avgCPDCompletion: number;
  };
  
  // AML/FICA
  aml: {
    total: number;
    clear: number;
    flagged: number;
    pending: number;
    highRisk: number;
  };
  
  // POPIA
  popia: {
    totalConsents: number;
    activeConsents: number;
    withdrawnConsents: number;
    pendingRequests: number;
  };
  
  // Statutory
  statutory: {
    total: number;
    submitted: number;
    pending: number;
    overdue: number;
  };
  
  // TCF
  tcf: {
    totalAssessments: number;
    compliant: number;
    nonCompliant: number;
    actionRequired: number;
  };
  
  // Complaints
  complaints: {
    total: number;
    open: number;
    resolved: number;
    escalated: number;
    avgResolutionDays: number;
  };
  
  // Overall
  overall: {
    complianceScore: number;  // 0-100
    lastUpdated: Date;
    criticalIssues: number;
  };
}

// ============================================================================
// TABLE CONFIGURATION
// ============================================================================

/**
 * Compliance table column configuration
 */
export interface ComplianceColumn {
  key: string;
  label: string;
  type: 'text' | 'date' | 'badge' | 'number' | 'custom';
  render?: (value: unknown, record: ComplianceRecord) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

/**
 * Compliance table filter configuration
 */
export interface ComplianceFilter {
  key: string;
  label: string;
  type?: 'select' | 'multi-select' | 'date' | 'text';
  options?: Array<{ value: string; label: string }>;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Generic list response
 */
export interface ComplianceListResponse<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
}

/**
 * Generic create request
 */
export type CreateRecordRequest<T> = Omit<T, 'id' | 'created'>;

/**
 * Generic update request
 */
export type UpdateRecordRequest<T> = Partial<T>;

// ============================================================================
// FORM TYPES
// ============================================================================

/**
 * FAIS record form data
 */
export interface FAISFormData {
  title: string;
  reNumber: string;
  reStatus: REStatus;
  reExpiry?: Date;
  cob: string;
  pst: string;
  cpdHours: number;
  cpdRequired: number;
  supervisionPlan: SupervisionFrequency;
  owner: string;
  notes?: string;
  keyIndividual?: boolean;
  fspNumber?: string;
  fspName?: string;
}

/**
 * AML check form data
 */
export interface AMLCheckFormData {
  clientId: string;
  checkType: AMLCheckType;
  idVerified: boolean;
  addressVerified: boolean;
  sanctionsScreened: boolean;
  pepsScreened: boolean;
  adverseMediaChecked: boolean;
  notes?: string;
}

/**
 * Complaint form data
 */
export interface ComplaintFormData {
  complainantName: string;
  complainantContact: string;
  clientId?: string;
  category: ComplaintCategory;
  description: string;
  channel: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Compliance module tabs
 */
export type ComplianceTab = 
  | 'overview'
  | 'fais'
  | 'aml-fica'
  | 'popi-paia'
  | 'statutory'
  | 'tcf'
  | 'record-keeping'
  | 'debarment'
  | 'conflicts'
  | 'documents'
  | 'new-business'
  | 'complaints';

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'excel' | 'pdf';

/**
 * Date range filter
 */
export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Compliance filters
 */
export interface ComplianceFilters {
  status?: ComplianceStatus[];
  ragStatus?: RAGStatus[];
  owner?: string[];
  dateRange?: DateRange;
  search?: string;
}