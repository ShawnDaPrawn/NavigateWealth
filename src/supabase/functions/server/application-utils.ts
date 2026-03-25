/**
 * Utility Functions for Application Management
 * Shared helper functions to reduce code duplication
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import type {
  DatabaseApplication,
  EnrichedApplication,
  DetailedApplication,
  ApplicationData,
  BackendApplicationStatus,
  FrontendApplicationStatus,
  AdminApprovalNotificationData,
} from './types.ts';
import {
  STATUS_MAP,
  COMPLETION_PERCENTAGE,
  DEFAULT_ACCOUNT_TYPE,
} from './constants.ts';

// ============================================================================
// Status Mapping Functions
// ============================================================================

/**
 * Map backend status to frontend status
 */
export function mapStatusToFrontend(backendStatus: BackendApplicationStatus): FrontendApplicationStatus {
  return STATUS_MAP[backendStatus] || backendStatus as FrontendApplicationStatus;
}

/**
 * Get completion percentage based on status
 */
export function getCompletionPercentage(status: BackendApplicationStatus): number {
  return COMPLETION_PERCENTAGE[status] || 0;
}

// ============================================================================
// Data Transformation Functions
// ============================================================================

/**
 * Transform database application to enriched application for frontend
 */
export async function enrichApplication(
  application: DatabaseApplication,
  supabase: SupabaseClient
): Promise<EnrichedApplication> {
  // Get user email from auth
  const { data: { user } } = await supabase.auth.admin.getUserById(application.user_id);
  
  const appData = application.application_data || {} as ApplicationData;
  
  return {
    id: application.id,
    userId: application.user_id,
    email: user?.email || '',
    firstName: appData.firstName || '',
    lastName: appData.lastName || '',
    accountStatus: mapStatusToFrontend(application.status),
    accountType: DEFAULT_ACCOUNT_TYPE,
    applicationId: application.id,
    submittedAt: application.submitted_at,
    updatedAt: application.updated_at,
    createdAt: application.created_at,
    completionPercentage: getCompletionPercentage(application.status),
    applicationData: application,
  };
}

/**
 * Transform database application to detailed application with all sections
 */
export async function enrichApplicationWithDetails(
  application: DatabaseApplication,
  supabase: SupabaseClient
): Promise<DetailedApplication> {
  const baseEnriched = await enrichApplication(application, supabase);
  const appData = application.application_data || {} as ApplicationData;
  
  return {
    ...baseEnriched,
    personalInfo: {
      firstName: appData.firstName || '',
      lastName: appData.lastName || '',
      dateOfBirth: appData.dateOfBirth || '',
      gender: appData.gender || '',
      nationality: appData.nationality || '',
    },
    contactInfo: {
      emailAddress: appData.emailAddress || '',
      cellphoneNumber: appData.cellphoneNumber || '',
      residentialAddressLine1: appData.residentialAddressLine1 || '',
      residentialAddressLine2: appData.residentialAddressLine2 || '',
      residentialCity: appData.residentialCity || '',
      residentialProvince: appData.residentialProvince || '',
      residentialPostalCode: appData.residentialPostalCode || '',
      residentialCountry: appData.residentialCountry || '',
    },
    employmentInfo: {
      employmentStatus: appData.employmentStatus || '',
    },
    servicesInfo: {
      accountReasons: appData.accountReasons || [],
      financialGoals: appData.financialGoals || '',
    },
    termsInfo: {
      termsAccepted: appData.termsAccepted || false,
      popiaConsent: appData.popiaConsent || false,
      disclosureAcknowledged: appData.disclosureAcknowledged || false,
    },
    rawData: appData,
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if application can be approved (must be in submitted, pending, or invited status)
 */
export function canApproveApplication(status: BackendApplicationStatus): boolean {
  return status === 'submitted' || status === 'pending' || status === 'invited' || status === 'draft' || status === 'in_progress';
}

/**
 * Check if application can be declined (must be in submitted, pending, or invited status)
 */
export function canDeclineApplication(status: BackendApplicationStatus): boolean {
  return status === 'submitted' || status === 'pending' || status === 'invited' || status === 'draft' || status === 'in_progress';
}

/**
 * Validate application status transition
 */
export function validateStatusTransition(
  currentStatus: BackendApplicationStatus,
  newStatus: BackendApplicationStatus
): { valid: boolean; error?: string } {
  // Define valid transitions
  const validTransitions: Record<BackendApplicationStatus, BackendApplicationStatus[]> = {
    'draft': ['in_progress', 'submitted', 'approved', 'declined'],
    'in_progress': ['submitted', 'approved', 'declined'],
    'pending': ['approved', 'declined'],
    'submitted': ['approved', 'declined'],
    'approved': [],
    'declined': [],
  };

  const allowedTransitions = validTransitions[currentStatus] || [];
  
  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// User Metadata Functions
// ============================================================================

/**
 * Build user metadata update for approval
 */
export function buildApprovalMetadata(appData: ApplicationData) {
  return {
    accountStatus: 'approved',
    firstName: appData.firstName,
    lastName: appData.lastName,
    preferredName: appData.preferredName || '',
  };
}

/**
 * Build user metadata update for decline
 */
export function buildDeclineMetadata(appData: ApplicationData) {
  return {
    accountStatus: 'declined',
    firstName: appData.firstName,
    lastName: appData.lastName,
  };
}

// ============================================================================
// Client Profile Mapping Functions
// ============================================================================

/**
 * Build initial client profile from application data.
 * Maps application form fields to the ProfileData structure used by
 * the admin client profile viewer (user_profile:{userId}:personal_info).
 *
 * This ensures that when an application is approved, the client's profile
 * is pre-populated with all data they provided during onboarding —
 * so the admin doesn't have to re-enter it.
 */
export function buildClientProfileFromApplication(appData: ApplicationData): Record<string, unknown> {
  // Build employers array from application employment data
  const employers: Array<{ id: string; jobTitle: string; employerName: string; industry: string }> = [];
  if (
    (appData.employmentStatus === 'employed' || appData.employmentStatus === 'contract') &&
    (appData.jobTitle || appData.employerName)
  ) {
    employers.push({
      id: crypto.randomUUID(),
      jobTitle: appData.jobTitle || '',
      employerName: appData.employerName || '',
      industry: appData.industry || '',
    });
  }

  // Build identity documents array from application ID data
  const identityDocuments: Array<{
    id: string;
    type: 'national-id' | 'passport';
    number: string;
    countryOfIssue: string;
    expiryDate: string;
    isVerified: boolean;
  }> = [];
  if (appData.idType && appData.idNumber) {
    identityDocuments.push({
      id: crypto.randomUUID(),
      type: appData.idType === 'sa_id' ? 'national-id' : 'passport',
      number: appData.idNumber,
      countryOfIssue: appData.idType === 'sa_id' ? 'South Africa' : (appData.nationality || ''),
      expiryDate: '',
      isVerified: false,
    });
  }

  // Build family members from spouse data
  const familyMembers: Array<Record<string, unknown>> = [];
  if (
    (appData.maritalStatus === 'Married' || appData.maritalStatus === 'Life Partner') &&
    appData.spouseFirstName
  ) {
    familyMembers.push({
      id: crypto.randomUUID(),
      fullName: `${appData.spouseFirstName} ${appData.spouseLastName || ''}`.trim(),
      relationship: 'Spouse',
      dateOfBirth: appData.spouseDateOfBirth || '',
      gender: '',
      idPassportNumber: '',
      isFinanciallyDependent: false,
      isIncludedInEstatePlanning: true,
      shareProfileInformation: false,
      shareEmail: '',
      notes: appData.spouseEmployed ? `Employment: ${appData.spouseEmployed}` : '',
    });
  }

  return {
    // Personal details
    title: appData.title || '',
    firstName: appData.firstName || '',
    middleName: appData.middleName || '',
    lastName: appData.lastName || '',
    preferredName: appData.preferredName || '',
    dateOfBirth: appData.dateOfBirth || '',
    gender: appData.gender || '',
    nationality: appData.nationality || '',
    taxNumber: appData.taxNumber || '',
    maritalStatus: appData.maritalStatus || '',
    maritalRegime: appData.maritalRegime || '',

    // Identity
    idNumber: appData.idType === 'sa_id' ? appData.idNumber : '',
    idCountry: appData.idType === 'sa_id' ? 'South Africa' : '',
    passportNumber: appData.idType === 'passport' ? appData.idNumber : '',
    passportCountry: appData.idType === 'passport' ? (appData.nationality || '') : '',
    identityDocuments,

    // Contact
    email: appData.emailAddress || '',
    secondaryEmail: appData.alternativeEmail || '',
    phoneNumber: appData.cellphoneNumber || '',
    alternativePhone: appData.alternativeCellphone || '',
    preferredContactMethod: appData.preferredContactMethod || '',

    // Address
    residentialAddressLine1: appData.residentialAddressLine1 || '',
    residentialAddressLine2: appData.residentialAddressLine2 || '',
    residentialSuburb: appData.residentialSuburb || '',
    residentialCity: appData.residentialCity || '',
    residentialProvince: appData.residentialProvince || '',
    residentialPostalCode: appData.residentialPostalCode || '',
    residentialCountry: appData.residentialCountry || '',

    // Employment
    employmentStatus: appData.employmentStatus || '',
    employers,
    selfEmployedCompanyName: appData.selfEmployedCompanyName || '',
    selfEmployedIndustry: appData.selfEmployedIndustry || '',
    selfEmployedDescription: appData.selfEmployedDescription || '',

    // Income (stored as 0 since application only collects ranges)
    grossIncome: 0,
    netIncome: 0,
    grossMonthlyIncome: 0,
    netMonthlyIncome: 0,
    grossAnnualIncome: 0,
    netAnnualIncome: 0,

    // Family
    familyMembers,

    // Empty defaults for sections not captured in application
    bankAccounts: [],
    assets: [],
    liabilities: [],
    chronicConditions: [],
    additionalIncomeSources: [],
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactPhone: '',
    emergencyContactEmail: '',
    workAddressLine1: '',
    workAddressLine2: '',
    workSuburb: '',
    workCity: '',
    workProvince: '',
    workPostalCode: '',
    workCountry: '',
    employmentCountry: '',
    workPermitNumber: '',
    proofOfResidenceUploaded: false,
    height: 0,
    heightUnit: 'cm',
    weight: 0,
    weightUnit: 'kg',
    bloodType: '',
    smokerStatus: false,
    hasChronicConditions: false,
    riskAssessment: {
      question1: 0, question2: 0, question3: 0, question4: 0, question5: 0,
      question6: 0, question7: 0, question8: 0, question9: 0, question10: 0,
      totalScore: 0, riskCategory: '', dateCompleted: '', canRetake: true,
    },

    // Application metadata (useful for admin reference)
    _applicationMeta: {
      isSATaxResident: appData.isSATaxResident,
      numberOfDependants: appData.numberOfDependants || '',
      grossMonthlyIncomeRange: appData.grossMonthlyIncome || '',
      monthlyExpensesRange: appData.monthlyExpensesEstimate || '',
      servicesRequested: appData.accountReasons || [],
      urgency: appData.urgency || '',
      existingProducts: appData.existingProducts || [],
      financialGoals: appData.financialGoals || '',
      bestTimeToContact: appData.bestTimeToContact || '',
      whatsappNumber: appData.whatsappNumber || '',
      popiaConsent: appData.popiaConsent || false,
      faisAcknowledged: appData.faisAcknowledged || false,
      electronicCommunicationConsent: appData.electronicCommunicationConsent || false,
      communicationConsent: appData.communicationConsent || false,
    },
  };
}

// ============================================================================
// Email Data Extraction Functions
// ============================================================================

/**
 * Extract approval email data from application
 */
export function extractApprovalEmailData(
  email: string,
  appData: ApplicationData,
  applicationId: string
) {
  return {
    to: email,
    clientName: `${appData.firstName || ''} ${appData.lastName || ''}`.trim(),
    applicationNumber: applicationId,
  };
}

/**
 * Extract decline email data from application
 */
export function extractDeclineEmailData(
  email: string,
  appData: ApplicationData,
  reason: string,
  applicationId: string
) {
  return {
    to: email,
    clientName: `${appData.firstName || ''} ${appData.lastName || ''}`.trim(),
    applicationNumber: applicationId,
    reason: reason || 'Please contact support for more information.',
  };
}

/**
 * Extract admin notification email data from application
 */
export function extractAdminNotificationData(
  email: string,
  appData: ApplicationData,
  applicationId: string,
  approvedBy: string
): AdminApprovalNotificationData {
  return {
    applicationNumber: applicationId,
    clientName: `${appData.firstName || ''} ${appData.lastName || ''}`.trim(),
    approvedBy: approvedBy || 'Admin',
    // Legacy fields for backward compatibility
    email,
    phone: appData.cellphoneNumber || 'N/A',
    applicationId,
    firstName: appData.firstName || '',
    lastName: appData.lastName || '',
  };
}

// ============================================================================
// Query Parameter Helpers
// ============================================================================

/**
 * Parse and validate sort parameters
 */
export function parseSortParams(sortBy?: string, sortOrder?: string) {
  const SORT_COLUMN_MAP: Record<string, string> = {
    'submittedAt': 'submitted_at',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'submitted_at': 'submitted_at',
    'created_at': 'created_at',
    'updated_at': 'updated_at',
  };

  const column = SORT_COLUMN_MAP[sortBy || 'submitted_at'] || 'submitted_at';
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  return { column, order };
}

/**
 * Parse status filter parameter
 */
export function parseStatusFilter(status?: string): BackendApplicationStatus[] | 'all' {
  if (!status || status === 'all') {
    return ['pending', 'submitted', 'approved', 'declined']; // Default: show all submitted/reviewed applications
  }
  
  // Validate status is a valid backend status
  const validStatuses: BackendApplicationStatus[] = ['draft', 'in_progress', 'pending', 'submitted', 'approved', 'declined'];
  
  if (validStatuses.includes(status as BackendApplicationStatus)) {
    return [status as BackendApplicationStatus];
  }
  
  // Invalid status, return default
  return ['pending', 'submitted', 'approved', 'declined'];
}
