/**
 * Honeycomb Integration — Server-Side Type Definitions
 *
 * Types for requests to / responses from the Honeycomb public API,
 * plus internal types used across honeycomb-service and honeycomb-routes.
 *
 * Reference: publicapi.honeycombonline.co.za/swagger/index.html
 */

// ============================================================================
// COMMON REQUEST SCHEMAS
// ============================================================================

/**
 * The standard natural-person request body used by most Honeycomb POST endpoints.
 * Maps to MatterApiNaturalPersonRequest in Swagger.
 */
export interface HoneycombNaturalPersonRequest {
  uniqueId: string;
  firstName: string;
  surname: string;
  identityNumber: string;
  passport: string;
}

/**
 * Extended request for bank account verification.
 * Maps to MatterAPIBankAccountVerificationNaturalPersonRequest.
 */
export interface HoneycombBankVerificationRequest extends HoneycombNaturalPersonRequest {
  bankName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
}

/**
 * Request for assessment submissions.
 * Maps to MatterApiNaturalPersonAssessmentRequest.
 */
export interface HoneycombAssessmentRequest {
  matterNaturalPerson: HoneycombNaturalPersonRequest;
  submission: string;
  dueDiligenceAssessmentsId: number;
}

/**
 * Request for IDV with photo (inline, no file upload).
 * Maps to MatterApiIdvPhotoNaturalPersonRequest.
 */
export interface HoneycombIdvPhotoRequest extends HoneycombNaturalPersonRequest {
  photo?: string; // Base64-encoded photo
}

/**
 * Request for IDV without photo.
 * Maps to MatterApiIdvNaturalPersonRequest.
 */
export type HoneycombIdvNoPhotoRequest = HoneycombNaturalPersonRequest;

/**
 * Request for custom screening.
 * Maps to MatterApiNaturalPersonCustomScreeningRequest.
 */
export interface HoneycombCustomScreeningRequest extends HoneycombNaturalPersonRequest {
  packageId?: string;
  screeningPackage?: string;
}

// ============================================================================
// RESPONSE MODELS
// ============================================================================

/**
 * Generic Honeycomb API response wrapper.
 * Most endpoints return a JSON object with varying shapes;
 * we capture the commonly shared fields here.
 */
export interface HoneycombBaseResponse {
  matterId?: string;
  naturalPersonId?: string;
  id?: string;
  reference?: string;
  [key: string]: unknown;
}

/** IDV response — maps to MatterApiIdvNaturalPersonResponse */
export interface HoneycombIdvResponse extends HoneycombBaseResponse {
  idVerified?: boolean;
  photoMatch?: boolean;
  verificationStatus?: string;
  verificationDetails?: Record<string, unknown>;
  failureReason?: string;
}

/** Bank account verification — maps to BankAccountApiResponseRealTime */
export interface HoneycombBankVerificationResponse extends HoneycombBaseResponse {
  verified?: boolean;
  accountExists?: boolean;
  accountOpen?: boolean;
  nameMatch?: boolean;
  accountHolderName?: string;
  bankName?: string;
  branchCode?: string;
}

/** Consumer credit — credit report data */
export interface HoneycombCreditResponse extends HoneycombBaseResponse {
  creditScore?: number;
  accounts?: unknown[];
  judgments?: unknown[];
  defaults?: unknown[];
  enquiries?: unknown[];
}

/** Consumer trace — person trace / locate data */
export interface HoneycombTraceResponse extends HoneycombBaseResponse {
  addresses?: unknown[];
  employers?: unknown[];
  contactNumbers?: unknown[];
  emailAddresses?: unknown[];
}

/** Debt review enquiry — debt counselling status */
export interface HoneycombDebtReviewResponse extends HoneycombBaseResponse {
  isUnderDebtReview?: boolean;
  debtCounsellor?: string;
  applicationDate?: string;
  statusDate?: string;
  accounts?: unknown[];
}

/** CIPC company search */
export interface HoneycombCipcResponse extends HoneycombBaseResponse {
  companies?: CipcCompanyEntry[];
  totalResults?: number;
}

export interface CipcCompanyEntry {
  companyName?: string;
  registrationNumber?: string;
  status?: string;
  type?: string;
  registrationDate?: string;
  [key: string]: unknown;
}

/** Director enquiry — directorship listing */
export interface HoneycombDirectorResponse extends HoneycombBaseResponse {
  directorships?: DirectorshipEntry[];
  totalResults?: number;
}

export interface DirectorshipEntry {
  companyName?: string;
  registrationNumber?: string;
  appointmentDate?: string;
  resignationDate?: string;
  status?: string;
  role?: string;
  [key: string]: unknown;
}

/** Enforcement actions search */
export interface HoneycombEnforcementResponse {
  results?: EnforcementEntry[];
  totalMatches?: number;
  [key: string]: unknown;
}

export interface EnforcementEntry {
  name?: string;
  source?: string;
  actionType?: string;
  actionDate?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Best known address / address verification */
export interface HoneycombAddressResponse extends HoneycombBaseResponse {
  addresses?: AddressEntry[];
  bestKnownAddress?: AddressEntry;
}

export interface AddressEntry {
  line1?: string;
  line2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  source?: string;
  lastReported?: string;
  [key: string]: unknown;
}

/** Custom screening response */
export interface HoneycombCustomScreeningResponse extends HoneycombBaseResponse {
  screeningOutcome?: string;
  screeningResults?: unknown[];
  packageName?: string;
}

/** Lifestyle audit — spending/property/vehicle profiling */
export interface HoneycombLifestyleAuditResponse extends HoneycombBaseResponse {
  properties?: unknown[];
  vehicles?: unknown[];
  estimatedIncome?: number;
  lifestyleScore?: number;
  spendingProfile?: Record<string, unknown>;
}

/** Income predictor — estimated income based on credit bureau data */
export interface HoneycombIncomePredictorResponse extends HoneycombBaseResponse {
  estimatedIncome?: number;
  confidenceLevel?: string;
  incomeRange?: { min?: number; max?: number };
  methodology?: string;
  factors?: unknown[];
}

/** Tenders blue list — government tender participation */
export interface HoneycombTendersBlueResponse extends HoneycombBaseResponse {
  tenders?: TendersBlueEntry[];
  totalResults?: number;
}

export interface TendersBlueEntry {
  tenderNumber?: string;
  description?: string;
  department?: string;
  value?: number;
  awardDate?: string;
  status?: string;
  [key: string]: unknown;
}

/** Bulk IDV — batch identity verification response */
export interface HoneycombBulkIdvResponse extends HoneycombBaseResponse {
  results?: BulkIdvEntry[];
  totalProcessed?: number;
  totalMatched?: number;
  totalFailed?: number;
}

export interface BulkIdvEntry {
  uniqueId?: string;
  firstName?: string;
  surname?: string;
  identityNumber?: string;
  status?: string;
  matchResult?: string;
  [key: string]: unknown;
}

// ============================================================================
// INTERNAL TYPES (Service & Route layer)
// ============================================================================

/** KV-stored result entry for any Honeycomb check */
export interface HoneycombCheckResult {
  id: string;
  checkType: HoneycombCheckType;
  clientId: string;
  matterId: string | null;
  submittedAt: string;
  status: 'completed' | 'pending' | 'failed';
  summary: string;
  rawResponse: unknown;
}

/** All check types supported by the integration */
export type HoneycombCheckType =
  | 'idv_no_photo'
  | 'idv_with_photo'
  | 'idv_no_photo_secondary'
  | 'idv_with_photo_secondary'
  | 'idv_bulk'
  | 'bank_verification'
  | 'consumer_credit'
  | 'consumer_trace'
  | 'debt_enquiry'
  | 'lifestyle_audit'
  | 'income_predictor'
  | 'cipc'
  | 'director_enquiry'
  | 'tenders_blue'
  | 'custom_screening'
  | 'sanctions_search'
  | 'enforcement_actions'
  | 'legal_a_listing'
  | 'best_known_address'
  | 'cdd_report'
  | 'assessment'
  | 'registration';

/** Input shape for the unified runCheck service method */
export interface RunCheckInput {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  checkType: HoneycombCheckType;
  /** Extra data required by specific check types (e.g. bank details) */
  extra?: Record<string, unknown>;
}

/** Sanctions search query parameters */
export interface SanctionsSearchParams {
  clientId: string;
  name?: string;
  surname?: string;
  identityNumber?: string;
  uniqueId?: string;
  source?: string;
}

/** Unified service result returned to routes */
export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  matterId?: string;
  checkType?: HoneycombCheckType;
}

// ============================================================================
// COMPLIANCE DASHBOARD (computed, not from Honeycomb API)
// ============================================================================

/** Category grouping for the compliance check matrix */
export interface ComplianceCategory {
  id: string;
  label: string;
  checkTypes: HoneycombCheckType[];
  colour: string;
}

/** Dashboard summary returned to the frontend */
export interface ComplianceDashboardData {
  /** 0–100 readiness score */
  readinessScore: number;
  /** Total unique check types completed */
  completedCheckTypes: number;
  /** Total possible check types */
  totalCheckTypes: number;
  /** Per-category completion status */
  categories: CategoryStatus[];
  /** Individual check statuses */
  checks: CheckStatus[];
  /** Risk flags extracted from completed checks */
  riskFlags: RiskFlag[];
  /** Last check date across all types */
  lastCheckDate: string | null;
  /** Total number of individual check runs */
  totalCheckRuns: number;
}

export interface CategoryStatus {
  id: string;
  label: string;
  colour: string;
  completedCount: number;
  totalCount: number;
  percentage: number;
}

export interface CheckStatus {
  checkType: HoneycombCheckType;
  label: string;
  category: string;
  completed: boolean;
  lastRun: string | null;
  runCount: number;
  lastMatterId: string | null;
}

export interface RiskFlag {
  severity: 'high' | 'medium' | 'low' | 'info';
  source: string;
  message: string;
  checkType: HoneycombCheckType;
  detectedAt: string;
}

/** Legal A listing search */
export interface HoneycombLegalAListingResponse {
  results?: LegalAListingEntry[];
  totalMatches?: number;
  [key: string]: unknown;
}

export interface LegalAListingEntry {
  name?: string;
  caseNumber?: string;
  court?: string;
  judgmentDate?: string;
  amount?: number;
  status?: string;
  [key: string]: unknown;
}

/** Sanctions search — maps to SanctionsApiNaturalPersonListingResponse */
export interface HoneycombSanctionsResponse {
  results?: SanctionsMatch[];
  totalMatches?: number;
  searchedLists?: string[];
  [key: string]: unknown;
}

export interface SanctionsMatch {
  name?: string;
  source?: string;
  matchScore?: number;
  listingDate?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}