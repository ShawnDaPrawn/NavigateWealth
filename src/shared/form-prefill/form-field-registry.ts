/**
 * Form Field Registry — maps internal form fields to canonical Key Manager keys.
 *
 * Every FNA / INA wizard prefills its Step 1 from this registry through one
 * resolver, so a client value means the same thing in every analysis.
 *
 * The client keys the analyses share (age, date of birth, income, marital
 * status, dependants, …) are declared ONCE in FNA_CLIENT_KEYS: one canonical
 * key, one label, one group. A form maps its own field name onto a shared key
 * with `clientKey()`; it cannot give the same client value a different key or
 * label. Keys that only one analysis uses (existing risk cover, medical aid
 * plan details, retirement capital) are declared inline on that form.
 *
 * Map only fields the form actually has. A mapping for a field the form
 * lacks shows the adviser a match in the review and then silently drops it.
 */

import type { FormFieldMapping, FormPrefillId } from './types.ts';

type SharedClientKey = Omit<FormFieldMapping, 'formField'>;

/** Client keys shared by the FNA wizards. */
export const FNA_CLIENT_KEYS = {
  age: { canonicalKey: 'derived:age_from_dob', label: 'Current age', group: 'Profile' },
  dateOfBirth: { canonicalKey: 'profile_date_of_birth', label: 'Date of birth', group: 'Profile' },
  fullName: { canonicalKey: 'derived:full_name', label: 'Full name', group: 'Profile' },
  maritalStatus: {
    canonicalKey: 'profile_marital_status',
    label: 'Marital status',
    group: 'Profile',
  },
  retirementAge: {
    canonicalKey: 'profile_retirement_age',
    label: 'Retirement age',
    group: 'Profile',
  },
  employmentType: {
    canonicalKey: 'profile_employment_type',
    label: 'Employment type',
    group: 'Profile',
  },
  riskTolerance: {
    canonicalKey: 'profile_risk_tolerance',
    label: 'Risk tolerance',
    group: 'Profile',
  },
  spouseName: { canonicalKey: 'profile_spouse_name', label: 'Spouse name', group: 'Household' },
  dependantCount: {
    canonicalKey: 'derived:dependant_count',
    label: 'Number of dependants',
    group: 'Household',
  },
  grossMonthlyIncome: {
    canonicalKey: 'profile_gross_monthly_income',
    label: 'Gross monthly income',
    group: 'Income',
  },
  netMonthlyIncome: {
    canonicalKey: 'profile_net_monthly_income',
    label: 'Net monthly income',
    group: 'Income',
  },
  monthlyExpenses: {
    canonicalKey: 'profile_monthly_expenses',
    label: 'Household monthly expenditure',
    group: 'Financial',
  },
} as const satisfies Record<string, SharedClientKey>;

export type FNAClientKeyName = keyof typeof FNA_CLIENT_KEYS;

/** Maps a form's own field name onto a shared client key. */
export function clientKey(name: FNAClientKeyName, formField: string): FormFieldMapping {
  return { formField, ...FNA_CLIENT_KEYS[name] };
}

export const FORM_FIELD_REGISTRY: Record<FormPrefillId, FormFieldMapping[]> = {
  'risk-fna-step1': [
    clientKey('age', 'currentAge'),
    clientKey('retirementAge', 'retirementAge'),
    clientKey('employmentType', 'employmentType'),
    clientKey('grossMonthlyIncome', 'grossMonthlyIncome'),
    clientKey('netMonthlyIncome', 'netMonthlyIncome'),
    clientKey('spouseName', 'spouseFullName'),
    clientKey('monthlyExpenses', 'totalHouseholdMonthlyExpenditure'),
    {
      formField: 'totalOutstandingDebts',
      label: 'Total outstanding debts',
      canonicalKey: 'derived:total_liabilities',
      group: 'Financial',
    },
    {
      formField: 'totalCurrentAssets',
      label: 'Total current assets',
      canonicalKey: 'derived:total_assets',
      group: 'Financial',
    },
    {
      formField: 'existingCoverLifePersonal',
      label: 'Existing life cover (personal)',
      canonicalKey: 'risk_life_cover_total',
      group: 'Existing cover',
    },
    {
      formField: 'existingCoverDisabilityPersonal',
      label: 'Existing disability cover (personal)',
      canonicalKey: 'risk_disability_total',
      group: 'Existing cover',
    },
    {
      formField: 'existingCoverSevereIllnessPersonal',
      label: 'Existing severe illness cover (personal)',
      canonicalKey: 'risk_severe_illness_total',
      group: 'Existing cover',
    },
    {
      formField: 'existingCoverIPTemporaryPersonal',
      label: 'Existing temporary IP (personal)',
      canonicalKey: 'risk_temporary_icb_total',
      group: 'Existing cover',
    },
    {
      formField: 'existingCoverIPPermanentPersonal',
      label: 'Existing permanent IP (personal)',
      canonicalKey: 'risk_permanent_icb_total',
      group: 'Existing cover',
    },
  ],
  'medical-fna-step1': [
    clientKey('age', 'currentAge'),
    {
      formField: 'spousePartner',
      label: 'Spouse / partner on cover',
      canonicalKey: 'derived:has_spouse',
      group: 'Household',
    },
    {
      formField: 'childrenCount',
      label: 'Number of children',
      canonicalKey: 'derived:dependant_count_children',
      group: 'Household',
    },
    {
      formField: 'existingPlanType',
      label: 'Existing plan type',
      canonicalKey: 'medical_aid_plan_type',
      group: 'Existing cover',
    },
    {
      formField: 'existingTotalPremium',
      label: 'Existing total premium',
      canonicalKey: 'medical_aid_total_premium',
      group: 'Existing cover',
    },
    {
      formField: 'existingMSA',
      label: 'Existing MSA',
      canonicalKey: 'medical_aid_msa',
      group: 'Existing cover',
    },
    {
      formField: 'existingLJP',
      label: 'Late joiner penalty',
      canonicalKey: 'medical_aid_late_joiner_penalty',
      group: 'Existing cover',
    },
    {
      formField: 'existingDependents',
      label: 'Existing dependants on policy',
      canonicalKey: 'medical_aid_dependents',
      group: 'Existing cover',
    },
    {
      formField: 'existingHospitalCover',
      label: 'Existing hospital cover',
      canonicalKey: 'medical_aid_hospital_tariff',
      group: 'Existing cover',
    },
  ],
  'retirement-fna-step1': [
    clientKey('age', 'currentAge'),
    clientKey('retirementAge', 'retirementAge'),
    clientKey('netMonthlyIncome', 'currentMonthlyIncome'),
    {
      formField: 'currentMonthlyContribution',
      label: 'Monthly retirement contribution',
      canonicalKey: 'retirement_monthly_contribution',
      group: 'Savings',
    },
    {
      formField: 'currentRetirementSavings',
      label: 'Current retirement capital',
      canonicalKey: 'retirement_fund_value_total',
      group: 'Savings',
    },
  ],
  'tax-fna-step1': [
    clientKey('age', 'age'),
    clientKey('maritalStatus', 'maritalStatus'),
    clientKey('dependantCount', 'numberOfDependants'),
    {
      formField: 'employmentIncome',
      label: 'Employment income (annual)',
      canonicalKey: 'derived:annual_employment_income',
      group: 'Income',
    },
    {
      formField: 'medicalSchemeMembers',
      label: 'Medical scheme members',
      canonicalKey: 'derived:medical_scheme_members',
      group: 'Household',
    },
  ],
  'estate-fna-step1': [
    clientKey('fullName', 'familyInfo.fullName'),
    clientKey('dateOfBirth', 'familyInfo.dateOfBirth'),
    clientKey('age', 'familyInfo.age'),
    clientKey('maritalStatus', 'familyInfo.maritalStatus'),
    clientKey('spouseName', 'familyInfo.spouseName'),
  ],
  'investment-ina-step1': [
    clientKey('age', 'currentAge'),
    clientKey('dateOfBirth', 'dateOfBirth'),
    clientKey('grossMonthlyIncome', 'grossMonthlyIncome'),
    clientKey('netMonthlyIncome', 'netMonthlyIncome'),
    clientKey('dependantCount', 'householdDependants'),
    clientKey('riskTolerance', 'clientRiskProfile'),
  ],
};

/** Profile fields advisers should complete for richer prefill matches. */
export const PREFILL_PROFILE_HINTS: Record<string, string> = {
  profile_date_of_birth: 'Date of birth',
  profile_gross_monthly_income: 'Gross monthly income',
  profile_net_monthly_income: 'Net monthly income',
  profile_marital_status: 'Marital status',
  profile_spouse_name: 'Spouse name',
  profile_retirement_age: 'Retirement age',
  profile_tax_number: 'Tax number',
};

export function getFormFieldMappings(formId: FormPrefillId): FormFieldMapping[] {
  return FORM_FIELD_REGISTRY[formId] ?? [];
}

export function listFormPrefillIds(): FormPrefillId[] {
  return Object.keys(FORM_FIELD_REGISTRY) as FormPrefillId[];
}

export function getCanonicalKeysForForm(formId: FormPrefillId): string[] {
  return getFormFieldMappings(formId).map((m) => m.canonicalKey);
}
