/**
 * Profile Type Definitions (Reconciled v2)
 *
 * Centralised type definitions for the Profile module.
 * Source of truth — all interfaces match the runtime shapes
 * used in ProfilePage.tsx. See Guidelines §5.2.
 */

// ============================================================================
// Entity Types
// ============================================================================

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

export interface IdentityDocument {
  id: string;
  type: 'national-id' | 'passport' | 'drivers-license';
  number: string;
  countryOfIssue: string;
  expiryDate: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  uploadDate?: string;
  isVerified: boolean;
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

// ============================================================================
// Root Profile Data
// ============================================================================

export interface ProfileData {
  // Personal Information
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
  grossAnnualIncome: number;
  netAnnualIncome: number;

  // Contact Details
  email: string;
  secondaryEmail: string;
  phoneNumber: string;
  alternativePhone: string;
  preferredContactMethod: string;

  // Emergency Contact
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;

  // Identity
  idCountry: string;
  idNumber: string;
  passportCountry: string;
  passportNumber: string;
  employmentCountry: string;
  workPermitNumber: string;
  identityDocuments: IdentityDocument[];

  // Address
  residentialAddressLine1: string;
  residentialAddressLine2: string;
  residentialSuburb: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode: string;
  residentialCountry: string;
  proofOfResidenceUploaded: boolean;
  proofOfResidenceFileName?: string;

  // Work Address
  workAddressLine1: string;
  workAddressLine2: string;
  workSuburb: string;
  workCity: string;
  workProvince: string;
  workPostalCode: string;
  workCountry: string;

  // Employment
  employmentStatus: string;
  employers: Employer[];
  selfEmployedCompanyName: string;
  selfEmployedIndustry: string;
  selfEmployedDescription: string;
  additionalIncomeSources: IncomeSource[];

  // Health
  height: number;
  heightUnit: 'cm' | 'ft';
  weight: number;
  weightUnit: 'kg' | 'lbs';
  bloodType: string;
  smokerStatus: boolean;
  hasChronicConditions: boolean;
  chronicConditions: ChronicCondition[];

  // Family
  familyMembers: FamilyMember[];

  // Banking
  bankAccounts: BankAccount[];

  // Risk Profile
  riskAssessment: RiskAssessment;

  // Assets & Liabilities
  assets: Asset[];
  liabilities: Liability[];
}

// ============================================================================
// Document Type Helpers
// ============================================================================

export type IdentityDocumentType = IdentityDocument['type'];

// ============================================================================
// Section Handler Types (for decomposed section components)
// ============================================================================

/** Handler for simple top-level field changes */
export type HandleInputChange = (field: keyof ProfileData, value: unknown) => void;

/** Generic CRUD handlers for list entities (assets, liabilities, etc.) */
export interface ListEntityHandlers<T> {
  add: () => void;
  update: (id: string, updates: Partial<T>) => void;
  save: (id: string) => void;
  edit: (id: string) => void;
  cancelEdit: (id: string) => void;
  confirmDelete: (id: string) => void;
  remove: (id: string) => void;
}
