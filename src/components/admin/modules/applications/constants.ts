/**
 * Applications Module — Constants
 *
 * Centralised configuration for endpoints, status mappings,
 * Application → Client Profile field sync mapping, and
 * external financial product categories.
 *
 * §5.3 — All non-trivial constants must be centralised and typed.
 */

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------
export const ENDPOINTS = {
  APPLICATIONS: 'admin/applications',
  STATS: 'admin/stats',
  APPLICATION_DETAIL: (id: string) => `admin/applications/${id}`,
  UPDATE_APPLICATION: (id: string) => `admin/applications/${id}`,
  APPROVE: (id: string) => `admin/applications/${id}/approve`,
  DECLINE: (id: string) => `admin/applications/${id}/decline`,
  INVITE: 'admin/applications/invite',
  RESEND_INVITE: 'admin/applications/invite/resend',
} as const;

export const STATUS_MAP = {
  pending: 'submitted',
  approved: 'approved',
  rejected: 'declined',
  invited: 'invited',
} as const;

// ---------------------------------------------------------------------------
// Application → Client Profile Field Mapping
// ---------------------------------------------------------------------------
// §9.3 — Ensures synchronisation between application data and client profile.
// Each entry maps an ApplicationData field to its ProfileData equivalent.
// This is the canonical source of truth for onboarding data transfer.

export interface FieldSyncMapping {
  /** ApplicationData field key */
  applicationField: string;
  /** ProfileData field key (dot notation for nested, e.g. 'employers[0].jobTitle') */
  profileField: string;
  /** Human-readable label */
  label: string;
  /** Section grouping */
  section: 'personal' | 'identification' | 'marital' | 'contact' | 'address' | 'employment';
}

export const APPLICATION_PROFILE_FIELD_MAP: FieldSyncMapping[] = [
  // Personal Information
  { applicationField: 'title', profileField: 'title', label: 'Title', section: 'personal' },
  { applicationField: 'firstName', profileField: 'firstName', label: 'First Name', section: 'personal' },
  { applicationField: 'middleName', profileField: 'middleName', label: 'Middle Name', section: 'personal' },
  { applicationField: 'lastName', profileField: 'lastName', label: 'Last Name', section: 'personal' },
  { applicationField: 'dateOfBirth', profileField: 'dateOfBirth', label: 'Date of Birth', section: 'personal' },
  { applicationField: 'gender', profileField: 'gender', label: 'Gender', section: 'personal' },
  { applicationField: 'nationality', profileField: 'nationality', label: 'Nationality', section: 'personal' },

  // Identification
  { applicationField: 'idNumber', profileField: 'idNumber', label: 'ID / Passport Number', section: 'identification' },
  { applicationField: 'taxNumber', profileField: 'taxNumber', label: 'Tax Number', section: 'identification' },

  // Marital
  { applicationField: 'maritalStatus', profileField: 'maritalStatus', label: 'Marital Status', section: 'marital' },
  { applicationField: 'maritalRegime', profileField: 'maritalRegime', label: 'Marital Regime', section: 'marital' },

  // Contact
  { applicationField: 'emailAddress', profileField: 'email', label: 'Email Address', section: 'contact' },
  { applicationField: 'alternativeEmail', profileField: 'secondaryEmail', label: 'Alternative Email', section: 'contact' },
  { applicationField: 'cellphoneNumber', profileField: 'phoneNumber', label: 'Cellphone', section: 'contact' },
  { applicationField: 'alternativeCellphone', profileField: 'alternativePhone', label: 'Alt. Cellphone', section: 'contact' },
  { applicationField: 'preferredContactMethod', profileField: 'preferredContactMethod', label: 'Preferred Contact', section: 'contact' },

  // Address
  { applicationField: 'residentialAddressLine1', profileField: 'residentialAddressLine1', label: 'Address Line 1', section: 'address' },
  { applicationField: 'residentialAddressLine2', profileField: 'residentialAddressLine2', label: 'Address Line 2', section: 'address' },
  { applicationField: 'residentialSuburb', profileField: 'residentialSuburb', label: 'Suburb', section: 'address' },
  { applicationField: 'residentialCity', profileField: 'residentialCity', label: 'City', section: 'address' },
  { applicationField: 'residentialProvince', profileField: 'residentialProvince', label: 'Province', section: 'address' },
  { applicationField: 'residentialPostalCode', profileField: 'residentialPostalCode', label: 'Postal Code', section: 'address' },
  { applicationField: 'residentialCountry', profileField: 'residentialCountry', label: 'Country', section: 'address' },

  // Employment
  { applicationField: 'employmentStatus', profileField: 'employmentStatus', label: 'Employment Status', section: 'employment' },
  { applicationField: 'jobTitle', profileField: 'employers[0].jobTitle', label: 'Job Title', section: 'employment' },
  { applicationField: 'employerName', profileField: 'employers[0].employerName', label: 'Employer Name', section: 'employment' },
  { applicationField: 'industry', profileField: 'employers[0].industry', label: 'Industry', section: 'employment' },
  { applicationField: 'selfEmployedCompanyName', profileField: 'selfEmployedCompanyName', label: 'Company Name', section: 'employment' },
  { applicationField: 'selfEmployedIndustry', profileField: 'selfEmployedIndustry', label: 'Business Industry', section: 'employment' },
  { applicationField: 'selfEmployedDescription', profileField: 'selfEmployedDescription', label: 'Business Description', section: 'employment' },
  { applicationField: 'grossMonthlyIncome', profileField: 'grossMonthlyIncome', label: 'Gross Monthly Income', section: 'employment' },
];

/** Quick lookup set: applicationField → true if it syncs to profile */
export const SYNCED_FIELDS = new Set(
  APPLICATION_PROFILE_FIELD_MAP.map(m => m.applicationField)
);

/** Grouped mapping by section for display purposes */
export const FIELD_MAP_BY_SECTION = APPLICATION_PROFILE_FIELD_MAP.reduce<
  Record<string, FieldSyncMapping[]>
>((acc, mapping) => {
  (acc[mapping.section] ??= []).push(mapping);
  return acc;
}, {});

// ---------------------------------------------------------------------------
// External Financial Products
// ---------------------------------------------------------------------------
// Products a client may hold at external providers. These are informational
// only — they do NOT link to the client profile but help admin know where
// to look for existing cover, policies, or investments.

export interface ExternalProductCategory {
  id: string;
  label: string;
  icon: string; // lucide icon slug
  description: string;
}

export const EXTERNAL_PRODUCT_CATEGORIES: ExternalProductCategory[] = [
  { id: 'life_insurance', label: 'Life Insurance', icon: 'heart-pulse', description: 'Life cover, funeral cover, disability' },
  { id: 'medical_aid', label: 'Medical Aid', icon: 'stethoscope', description: 'Medical scheme membership' },
  { id: 'retirement', label: 'Retirement Annuity', icon: 'piggy-bank', description: 'RA, pension, provident fund' },
  { id: 'investments', label: 'Investments', icon: 'trending-up', description: 'Unit trusts, ETFs, savings' },
  { id: 'short_term', label: 'Short-Term Insurance', icon: 'shield-check', description: 'Car, home, contents insurance' },
  { id: 'gap_cover', label: 'Gap Cover', icon: 'shield-plus', description: 'Medical aid shortfall cover' },
  { id: 'home_loan', label: 'Home Loan', icon: 'home', description: 'Bond, mortgage' },
  { id: 'vehicle_finance', label: 'Vehicle Finance', icon: 'car', description: 'Vehicle loan, lease' },
  { id: 'education_policy', label: 'Education Policy', icon: 'graduation-cap', description: 'Education savings plan' },
  { id: 'tax_free_savings', label: 'Tax-Free Savings', icon: 'wallet', description: 'TFSA account' },
  { id: 'will', label: 'Will', icon: 'file-text', description: 'Last will and testament' },
  { id: 'trust', label: 'Trust', icon: 'landmark', description: 'Family trust, testamentary trust' },
];

/** Map product strings from the application form to category IDs */
export const PRODUCT_LABEL_MAP: Record<string, string> = {
  'Life Insurance': 'life_insurance',
  'Medical Aid': 'medical_aid',
  'Retirement Annuity': 'retirement',
  'Investments': 'investments',
  'Short-Term Insurance': 'short_term',
  'Gap Cover': 'gap_cover',
  'Home Loan': 'home_loan',
  'Vehicle Finance': 'vehicle_finance',
  'Education Policy': 'education_policy',
  'Tax-Free Savings Account': 'tax_free_savings',
  'Will': 'will',
  'Trust': 'trust',
};

// ---------------------------------------------------------------------------
// South African Financial Service Providers (FSPs)
// ---------------------------------------------------------------------------
// §5.3 — Centralised, typed constants for external provider tracking.
// Checkboxes for common providers; free-text input for unlisted ones.

export interface FinancialServiceProvider {
  id: string;
  name: string;
  /** Optional short description (e.g. "Insurance & Investments") */
  category: string;
}

export const SA_FINANCIAL_PROVIDERS: FinancialServiceProvider[] = [
  // Insurance & Life
  { id: 'old_mutual', name: 'Old Mutual', category: 'Insurance & Investments' },
  { id: 'sanlam', name: 'Sanlam', category: 'Insurance & Investments' },
  { id: 'discovery', name: 'Discovery', category: 'Health, Insurance & Investments' },
  { id: 'liberty', name: 'Liberty', category: 'Insurance & Investments' },
  { id: 'momentum', name: 'Momentum', category: 'Insurance & Investments' },
  { id: 'hollard', name: 'Hollard', category: 'Insurance' },
  { id: 'pps', name: 'PPS', category: 'Insurance (Professionals)' },
  { id: 'brightrock', name: 'BrightRock', category: 'Life Insurance' },
  { id: 'fnb_life', name: 'FNB Life', category: 'Insurance' },

  // Short-Term Insurance
  { id: 'santam', name: 'Santam', category: 'Short-Term Insurance' },
  { id: 'outsurance', name: 'OUTsurance', category: 'Short-Term Insurance' },
  { id: 'miway', name: 'MiWay', category: 'Short-Term Insurance' },
  { id: 'king_price', name: 'King Price', category: 'Short-Term Insurance' },

  // Investment & Asset Management
  { id: 'allan_gray', name: 'Allan Gray', category: 'Asset Management' },
  { id: 'coronation', name: 'Coronation', category: 'Asset Management' },
  { id: 'ninety_one', name: 'Ninety One', category: 'Asset Management' },
  { id: 'psg', name: 'PSG', category: 'Wealth & Investments' },
  { id: '10x', name: '10X Investments', category: 'Investments' },
  { id: 'glacier', name: 'Glacier (Sanlam)', category: 'Investment Platform' },

  // Banks
  { id: 'absa', name: 'Absa', category: 'Banking & Insurance' },
  { id: 'fnb', name: 'FNB', category: 'Banking' },
  { id: 'nedbank', name: 'Nedbank', category: 'Banking & Investments' },
  { id: 'standard_bank', name: 'Standard Bank', category: 'Banking & Insurance' },
  { id: 'capitec', name: 'Capitec', category: 'Banking' },
  { id: 'investec', name: 'Investec', category: 'Private Banking & Investments' },

  // Employee Benefits & Group
  { id: 'alexander_forbes', name: 'Alexander Forbes', category: 'Employee Benefits & Retirement' },
  { id: 'fedgroup', name: 'Fedgroup', category: 'Investments & Insurance' },
];

/** Quick lookup: provider id → provider */
export const SA_PROVIDER_MAP = Object.fromEntries(
  SA_FINANCIAL_PROVIDERS.map(p => [p.id, p]),
) as Record<string, FinancialServiceProvider>;

// ---------------------------------------------------------------------------
// Section Labels (for grouping in field mapping display)
// ---------------------------------------------------------------------------
export const SECTION_LABELS: Record<string, string> = {
  personal: 'Personal Information',
  identification: 'Identification',
  marital: 'Marital Status',
  contact: 'Contact Information',
  address: 'Residential Address',
  employment: 'Employment & Income',
};