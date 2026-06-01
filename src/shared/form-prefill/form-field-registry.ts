/**
 * Form Field Registry — maps internal form fields to canonical Key Manager keys.
 */

import type { FormFieldMapping, FormPrefillId } from './types.ts';

export const FORM_FIELD_REGISTRY: Record<FormPrefillId, FormFieldMapping[]> = {
  'retirement-fna-step1': [
    {
      formField: 'currentAge',
      label: 'Current age',
      canonicalKey: 'derived:age_from_dob',
      group: 'Profile',
    },
    {
      formField: 'retirementAge',
      label: 'Retirement age',
      canonicalKey: 'profile_retirement_age',
      group: 'Profile',
    },
    {
      formField: 'currentMonthlyIncome',
      label: 'Net monthly income',
      canonicalKey: 'profile_net_monthly_income',
      group: 'Income',
    },
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
    {
      formField: 'grossMonthlyIncome',
      label: 'Gross monthly income',
      canonicalKey: 'profile_gross_monthly_income',
      group: 'Income',
    },
  ],
  'risk-fna-step1': [
    {
      formField: 'grossMonthlyIncome',
      label: 'Gross monthly income',
      canonicalKey: 'profile_gross_monthly_income',
      group: 'Income',
    },
    {
      formField: 'netMonthlyIncome',
      label: 'Net monthly income',
      canonicalKey: 'profile_net_monthly_income',
      group: 'Income',
    },
    {
      formField: 'currentAge',
      label: 'Current age',
      canonicalKey: 'derived:age_from_dob',
      group: 'Profile',
    },
    {
      formField: 'retirementAge',
      label: 'Retirement age',
      canonicalKey: 'profile_retirement_age',
      group: 'Profile',
    },
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
      formField: 'spouseFullName',
      label: 'Spouse full name',
      canonicalKey: 'profile_spouse_name',
      group: 'Household',
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
    {
      formField: 'employmentType',
      label: 'Employment type',
      canonicalKey: 'profile_employment_type',
      group: 'Profile',
    },
    {
      formField: 'totalHouseholdMonthlyExpenditure',
      label: 'Household monthly expenditure',
      canonicalKey: 'profile_monthly_expenses',
      group: 'Financial',
    },
    {
      formField: 'dependantCount',
      label: 'Number of dependants',
      canonicalKey: 'derived:dependant_count',
      group: 'Profile',
    },
  ],
  'medical-fna-step1': [
    {
      formField: 'currentAge',
      label: 'Client age',
      canonicalKey: 'derived:age_from_dob',
      group: 'Profile',
    },
    {
      formField: 'spousePartner',
      label: 'Spouse / partner on cover',
      canonicalKey: 'derived:has_spouse',
      group: 'Profile',
    },
    {
      formField: 'childrenCount',
      label: 'Number of children',
      canonicalKey: 'derived:dependant_count_children',
      group: 'Profile',
    },
    {
      formField: 'grossMonthlyIncome',
      label: 'Gross monthly income',
      canonicalKey: 'profile_gross_monthly_income',
      group: 'Income',
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
  'tax-fna-step1': [
    { formField: 'age', label: 'Age', canonicalKey: 'derived:age_from_dob', group: 'Profile' },
    {
      formField: 'maritalStatus',
      label: 'Marital status',
      canonicalKey: 'derived:marital_status_tax',
      group: 'Profile',
    },
    {
      formField: 'numberOfDependants',
      label: 'Number of dependants',
      canonicalKey: 'derived:dependant_count',
      group: 'Profile',
    },
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
      group: 'Medical',
    },
    {
      formField: 'grossMonthlyIncome',
      label: 'Gross monthly income',
      canonicalKey: 'profile_gross_monthly_income',
      group: 'Income',
    },
    {
      formField: 'taxNumber',
      label: 'Tax number',
      canonicalKey: 'profile_tax_number',
      group: 'Profile',
    },
  ],
  'estate-fna-step1': [
    {
      formField: 'familyInfo.fullName',
      label: 'Full name',
      canonicalKey: 'derived:full_name',
      group: 'Family',
    },
    {
      formField: 'familyInfo.dateOfBirth',
      label: 'Date of birth',
      canonicalKey: 'profile_date_of_birth',
      group: 'Family',
    },
    {
      formField: 'familyInfo.maritalStatus',
      label: 'Marital status',
      canonicalKey: 'profile_marital_status',
      group: 'Family',
    },
    {
      formField: 'familyInfo.spouseName',
      label: 'Spouse name',
      canonicalKey: 'profile_spouse_name',
      group: 'Family',
    },
    {
      formField: 'familyInfo.age',
      label: 'Age',
      canonicalKey: 'derived:age_from_dob',
      group: 'Family',
    },
  ],
  'investment-ina-step1': [
    {
      formField: 'currentAge',
      label: 'Current age',
      canonicalKey: 'derived:age_from_dob',
      group: 'Profile',
    },
    {
      formField: 'dateOfBirth',
      label: 'Date of birth',
      canonicalKey: 'profile_date_of_birth',
      group: 'Profile',
    },
    {
      formField: 'grossMonthlyIncome',
      label: 'Gross monthly income',
      canonicalKey: 'profile_gross_monthly_income',
      group: 'Income',
    },
    {
      formField: 'netMonthlyIncome',
      label: 'Net monthly income',
      canonicalKey: 'profile_net_monthly_income',
      group: 'Income',
    },
    {
      formField: 'householdDependants',
      label: 'Household dependants',
      canonicalKey: 'derived:dependant_count',
      group: 'Profile',
    },
    {
      formField: 'monthlyContribution',
      label: 'Monthly contribution',
      canonicalKey: 'derived:investment_monthly_contribution',
      group: 'Investments',
    },
    {
      formField: 'fullName',
      label: 'Full name',
      canonicalKey: 'derived:full_name',
      group: 'Profile',
    },
    {
      formField: 'maritalStatus',
      label: 'Marital status',
      canonicalKey: 'profile_marital_status',
      group: 'Profile',
    },
    {
      formField: 'clientRiskProfile',
      label: 'Risk tolerance',
      canonicalKey: 'profile_risk_tolerance',
      group: 'Profile',
    },
    {
      formField: 'investmentHorizonYears',
      label: 'Investment horizon (years)',
      canonicalKey: 'profile_investment_horizon',
      group: 'Profile',
    },
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
