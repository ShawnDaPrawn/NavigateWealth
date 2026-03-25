/**
 * Type Definitions for Navigate Wealth Application
 * Centralized type definitions for improved type safety and maintainability
 */

// ============================================================================
// Application Status Types
// ============================================================================

/**
 * Backend database status values (stored in Postgres)
 */
export type BackendApplicationStatus = 
  | 'draft'         // Newly registered - not yet started application
  | 'in_progress' 
  | 'pending'      // New signup - waiting for admin review
  | 'submitted' 
  | 'approved' 
  | 'declined'
  | 'invited';      // Admin-invited, awaiting client action

/**
 * Frontend display status values (used in UI)
 */
export type FrontendApplicationStatus = 
  | 'no_application'
  | 'application_in_progress' 
  | 'submitted_for_review' 
  | 'approved' 
  | 'declined'
  | 'invited';

// ============================================================================
// Application Data Structures
// ============================================================================

/**
 * Personal information section
 */
export interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
}

/**
 * Contact information section
 */
export interface ContactInfo {
  emailAddress: string;
  cellphoneNumber: string;
  residentialAddressLine1: string;
  residentialAddressLine2?: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode: string;
  residentialCountry: string;
}

/**
 * Employment information section
 */
export interface EmploymentInfo {
  employmentStatus: string;
}

/**
 * Services and goals information section
 */
export interface ServicesInfo {
  accountReasons: string[];
  financialGoals: string;
}

/**
 * Terms and consent information section
 */
export interface TermsInfo {
  termsAccepted: boolean;
  popiaConsent: boolean;
  disclosureAcknowledged: boolean;
}

/**
 * Complete application data structure
 */
export interface ApplicationData {
  // Personal
  title?: string;
  firstName: string;
  middleName?: string;
  preferredName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  idType?: 'sa_id' | 'passport' | '';
  idNumber?: string;
  taxNumber?: string;
  isSATaxResident?: boolean | null;
  maritalStatus?: string;
  maritalRegime?: string;
  numberOfDependants?: string;

  // Spouse
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseDateOfBirth?: string;
  spouseEmployed?: string;

  // Contact
  emailAddress: string;
  alternativeEmail?: string;
  cellphoneNumber: string;
  alternativeCellphone?: string;
  whatsappNumber?: string;
  preferredContactMethod?: string;
  bestTimeToContact?: string;
  residentialAddressLine1: string;
  residentialAddressLine2?: string;
  residentialSuburb?: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode: string;
  residentialCountry: string;

  // Employment
  employmentStatus: string;
  jobTitle?: string;
  employerName?: string;
  industry?: string;
  selfEmployedCompanyName?: string;
  selfEmployedIndustry?: string;
  selfEmployedDescription?: string;
  grossMonthlyIncome?: string;
  monthlyExpensesEstimate?: string;

  // Services
  accountReasons: string[];
  otherReason?: string;
  financialGoals: string;
  urgency?: string;
  existingProducts?: string[];

  // Terms
  termsAccepted: boolean;
  popiaConsent: boolean;
  disclosureAcknowledged: boolean;
  faisAcknowledged?: boolean;
  electronicCommunicationConsent?: boolean;
  communicationConsent?: boolean;
  signatureFullName?: string;

  // Allow additional fields for backward compatibility
  [key: string]: unknown;
}

/**
 * Database application record
 */
export interface DatabaseApplication {
  id: string;
  user_id: string;
  status: BackendApplicationStatus;
  application_data: ApplicationData;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enriched application for frontend (with user data)
 */
export interface EnrichedApplication {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  accountStatus: FrontendApplicationStatus;
  accountType: 'personal';
  applicationId: string;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  completionPercentage: number;
  applicationData?: DatabaseApplication;
}

/**
 * Detailed application with all sections
 */
export interface DetailedApplication extends EnrichedApplication {
  personalInfo: PersonalInfo;
  contactInfo: ContactInfo;
  employmentInfo: EmploymentInfo;
  servicesInfo: ServicesInfo;
  termsInfo: TermsInfo;
  rawData: ApplicationData;
}

// ============================================================================
// Email Data Types
// ============================================================================

/**
 * Client approval email data
 */
export interface ClientApprovalEmailData {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Client decline email data
 */
export interface ClientDeclineEmailData {
  email: string;
  firstName: string;
  lastName: string;
  reason: string;
}

/**
 * Admin notification email data
 */
export interface AdminNotificationEmailData {
  userId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicationId: string;
  submittedAt: string;
}

/**
 * Admin approval notification email data
 */
export interface AdminApprovalNotificationData {
  applicationNumber: string;
  clientName: string;
  approvedBy: string;
  // Legacy optional fields
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  applicationId?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Application list response
 */
export interface ApplicationListResponse {
  applications: EnrichedApplication[];
  total: number;
}

/**
 * Application detail response
 */
export interface ApplicationDetailResponse {
  application: DetailedApplication;
}

/**
 * Application statistics
 */
export interface ApplicationStats {
  total: number;
  submitted_for_review: number;
  approved: number;
  declined: number;
  application_in_progress: number;
  invited?: number;
  /** Signups that have not submitted — `draft` count only */
  draft: number;
  /** `draft` + `in_progress` (incomplete onboarding) */
  incomplete: number;
  no_application: number;
  new_applications_7d: number;
  new_this_month: number;
  new_last_month: number;
  // Task statistics
  new_tasks: number;
  pending_tasks: number;
  // Request statistics
  pending_requests: number;
  total_requests: number;
  // E-Signature statistics
  pending_esignatures: number;
  // User statistics
  active_users: number;
  total_clients: number;
}

/**
 * Success response
 */
export interface SuccessResponse {
  success: true;
  message: string;
  applicationId?: string;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: string;
  code?: string;
}