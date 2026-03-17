export type TabStatus = 'pending' | 'approved' | 'rejected' | 'invited';

export type ApplicationStatus = 'draft' | 'submitted' | 'approved' | 'declined' | 'in_progress' | 'invited';

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

  // Address
  residentialAddressLine1: string;
  residentialAddressLine2?: string;
  residentialSuburb?: string;
  residentialCity: string;
  residentialProvince: string;
  residentialPostalCode?: string;
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

  // External Providers (FSPs the client may hold policies with)
  externalProviders?: string[];
  customProviders?: string[];

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

export interface Application {
  id: string;
  user_id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  application_number?: string;
  origin?: 'admin_import' | string;
  onboarded_by?: string;
  application_data: ApplicationData;
  user_email?: string;
  user_name?: string;
}

export interface ApplicationStats {
  total: number;
  submitted_for_review: number;
  approved: number;
  declined: number;
  application_in_progress: number;
  invited?: number;
}

export interface ApplicationsResponse {
  applications: Application[];
  count: number;
}

export interface StatsResponse {
  stats: ApplicationStats;
}