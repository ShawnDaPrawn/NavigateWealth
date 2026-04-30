// Domain Types
// Re-exports from shared types (§9.3 — single source of truth)
export type { AccountStatus, AccountType, ApplicationStatus, ClientSecurity, Address, BaseClient } from '../../../../shared/types';
import type { BaseClient } from '../../../../shared/types';

/** Dashboard display mode for ClientOverviewTab — Phase C */
export type { DashboardMode } from './components/ClientOverviewTab';

export type KYCStatus = 'Verified' | 'Pending' | 'Rejected' | 'Expired' | string;

export interface Client extends BaseClient {
  preferredName: string;
  createdAt: string;
  applicationNumber?: string;
  applicationStatus: string;
  accountType?: string;
  deleted: boolean;
  suspended: boolean;
  profile?: ClientProfile;
  application?: ClientApplication;
}

export interface ClientFilters {
  search?: string;
  adviserId?: string;
  productType?: string;
  ageBand?: string;
  gender?: string;
  kycStatus?: KYCStatus;
  riskScore?: string;
  tags?: string[];
  accountStatus?: 'all' | 'active' | 'suspended' | 'closed';
}

export interface ClientProfile {
  personalInformation?: ProfileData;
  role?: string;
  /** Backward-compatible index for legacy profile fields not yet typed */
  [key: string]: unknown;
}

export interface ClientApplication {
  id: string;
  status: string;
  type: string;
  /** Backward-compatible index for additional application fields */
  [key: string]: unknown;
}

// Interfaces extracted from ClientProfileViewerFull.tsx
export interface BankAccount {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  branchCode: string;
  isPrimary: boolean;
  customBankName?: string;
  customBranchCode?: string;
  proofOfBankDocument?: string;
  proofOfBankFileName?: string;
}

export interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  dateOfBirth: string;
  gender: string;
  idPassportNumber: string;
  isFinanciallyDependent: boolean;
  isIncludedInEstatePlanning: boolean;
  shareProfileInformation: boolean;
  shareEmail: string;
  notes: string;
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  description: string;
  value: number;
  ownershipType: string;
  provider: string;
  customType?: string;
}

export interface Liability {
  id: string;
  type: string;
  name: string;
  description: string;
  provider: string;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  customType?: string;
}

export type IdentityDocumentType =
  | 'national-id'
  | 'passport'
  | 'drivers-license'
  | 'proof-of-residence'
  | 'proof-primary-bank-account'
  | 'utility-bill';

export interface IdentityDocument {
  id: string;
  type: IdentityDocumentType;
  number: string;
  countryOfIssue: string;
  expiryDate: string;
  fileName?: string;
  fileSize?: number;
  uploadDate?: string;
  isVerified: boolean;
  fileUrl?: string;
}

export interface IncomeSource {
  id: string;
  sourceType: string;
  description: string;
  monthlyIncome: number;
  startDate: string;
}

export interface Employer {
  id: string;
  jobTitle: string;
  employerName: string;
  industry: string;
}

export interface ChronicCondition {
  id: string;
  conditionName: string;
  monthDiagnosed: string;
  yearDiagnosed: string;
  onTreatment: boolean;
  treatingDoctor: string;
}

export interface RiskAssessment {
  question1: number;
  question2: number;
  question3: number;
  question4: number;
  question5: number;
  question6: number;
  question7: number;
  question8: number;
  question9: number;
  question10: number;
  totalScore: number;
  riskCategory: string;
  dateCompleted: string;
  canRetake: boolean;
}

export interface ProfileData {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  taxNumber: string;
  maritalStatus: string;
  maritalRegime: string;
  grossIncome: number;
  netIncome: number;
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  grossAnnualIncome: number;
  netAnnualIncome: number;
  email: string;
  secondaryEmail: string;
  phoneNumber: string;
  alternativePhone: string;
  preferredContactMethod: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
  
  // Identity Fields
  idCountry: string;
  idNumber: string;
  passportCountry: string;
  passportNumber: string;
  employmentCountry: string;
  workPermitNumber: string;
  
  identityDocuments: IdentityDocument[];
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  residentialSuburb: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode: string;
  residentialCountry: string;
  proofOfResidenceUploaded: boolean;
  proofOfResidenceFileName?: string;
  workAddressLine1: string;
  workAddressLine2: string;
  workSuburb: string;
  workCity: string;
  workProvince: string;
  workPostalCode: string;
  workCountry: string;
  employmentStatus: string;
  employers: Employer[];
  selfEmployedCompanyName: string;
  selfEmployedIndustry: string;
  selfEmployedDescription: string;
  additionalIncomeSources?: IncomeSource[];
  height: number;
  heightUnit: 'cm' | 'ft';
  weight: number;
  weightUnit: 'kg' | 'lbs';
  bloodType: string;
  smokerStatus: boolean;
  hasChronicConditions: boolean;
  chronicConditions: ChronicCondition[];
  familyMembers: FamilyMember[];
  bankAccounts: BankAccount[];
  riskAssessment: RiskAssessment;
  assets: Asset[];
  liabilities: Liability[];
}

// API Responses
export interface ApiUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: {
    firstName?: string;
    surname?: string;
    /** Additional metadata fields from Supabase Auth */
    [key: string]: unknown;
  };
  name?: string;
  application_number?: string;
  application_status?: string;
  account_type?: string;
  deleted?: boolean;
  suspended?: boolean;
  account_status?: string;
  profile?: ClientProfile;
  application?: ClientApplication;
}

export interface GetClientsResponse {
  count?: number;
  /** @deprecated Server now returns `clients` — kept for backward compatibility */
  users?: ApiUser[];
  /** Current server response field (PaginatedClientResponse shape) */
  clients?: ApiUser[];
  /** Pagination fields — present when page/perPage query params are sent */
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}

export interface UpdateClientMetadataResponse {
  success: boolean;
  /** Server may return additional fields */
  [key: string]: unknown;
}

export interface GetClientProfileResponse {
  success: boolean;
  data: ProfileData;
}

/** Shape returned by POST /clients/maintenance/cleanup */
export interface CleanupResult {
  success: boolean;
  dryRun: boolean;
  totalProfilesScanned: number;
  orphanedProfilesClosed: number;
  deletedStatusBackfilled: number;
  suspendedStatusBackfilled: number;
  durationMs: number;
  timestamp: string;
  affectedRecords: Array<{
    userId: string;
    action: 'orphan_closed' | 'deleted_backfill' | 'suspended_backfill';
    previousAccountStatus?: string;
    newAccountStatus: string;
  }>;
}

/** Shape returned by POST /kv-cleanup/run */
export interface KvCleanupCategoryResult {
  keysFound: number;
  keysDeleted: number;
  sampleKeys: string[];
}

export interface KvCleanupResult {
  success: boolean;
  dryRun: boolean;
  retentionDays: number;
  categories: {
    rateLimits: KvCleanupCategoryResult;
    expiredNewsletterTokens: KvCleanupCategoryResult;
    oldContactForms: KvCleanupCategoryResult;
    oldQuoteRequests: KvCleanupCategoryResult;
    staleAuditEntries: KvCleanupCategoryResult;
  };
  totalKeysFound: number;
  totalKeysDeleted: number;
  timestamp: string;
  durationMs: number;
}
