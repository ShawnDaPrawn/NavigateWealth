/**
 * Form Field Registry — maps internal form fields to canonical Key Manager keys.
 */

import type { FormFieldMapping, FormPrefillId } from './types.ts';

export const FORM_FIELD_REGISTRY: Record<FormPrefillId, FormFieldMapping[]> = {
  'retirement-fna-step1': [
    { formField: 'currentAge', label: 'Current age', canonicalKey: 'derived:age_from_dob', group: 'Profile' },
    { formField: 'retirementAge', label: 'Retirement age', canonicalKey: 'profile_retirement_age', group: 'Profile' },
    { formField: 'currentMonthlyIncome', label: 'Net monthly income', canonicalKey: 'profile_net_monthly_income', group: 'Income' },
    { formField: 'currentMonthlyContribution', label: 'Monthly retirement contribution', canonicalKey: 'retirement_monthly_contribution', group: 'Savings' },
    { formField: 'currentRetirementSavings', label: 'Current retirement capital', canonicalKey: 'retirement_fund_value_total', group: 'Savings' },
  ],
  'risk-fna-step1': [
    { formField: 'grossMonthlyIncome', label: 'Gross monthly income', canonicalKey: 'profile_gross_monthly_income', group: 'Income' },
    { formField: 'netMonthlyIncome', label: 'Net monthly income', canonicalKey: 'profile_net_monthly_income', group: 'Income' },
    { formField: 'currentAge', label: 'Current age', canonicalKey: 'derived:age_from_dob', group: 'Profile' },
    { formField: 'retirementAge', label: 'Retirement age', canonicalKey: 'profile_retirement_age', group: 'Profile' },
    { formField: 'totalOutstandingDebts', label: 'Total outstanding debts', canonicalKey: 'derived:total_liabilities', group: 'Financial' },
    { formField: 'totalCurrentAssets', label: 'Total current assets', canonicalKey: 'derived:total_assets', group: 'Financial' },
    { formField: 'spouseFullName', label: 'Spouse full name', canonicalKey: 'profile_spouse_name', group: 'Household' },
    { formField: 'existingCoverLifePersonal', label: 'Existing life cover (personal)', canonicalKey: 'risk_life_cover_total', group: 'Existing cover' },
    { formField: 'existingCoverDisabilityPersonal', label: 'Existing disability cover (personal)', canonicalKey: 'risk_disability_total', group: 'Existing cover' },
    { formField: 'existingCoverSevereIllnessPersonal', label: 'Existing severe illness cover (personal)', canonicalKey: 'risk_severe_illness_total', group: 'Existing cover' },
    { formField: 'existingCoverIPTemporaryPersonal', label: 'Existing temporary IP (personal)', canonicalKey: 'risk_temporary_icb_total', group: 'Existing cover' },
    { formField: 'existingCoverIPPermanentPersonal', label: 'Existing permanent IP (personal)', canonicalKey: 'risk_permanent_icb_total', group: 'Existing cover' },
  ],
  'medical-fna-step1': [
    { formField: 'clientAge', label: 'Client age', canonicalKey: 'derived:age_from_dob', group: 'Profile' },
    { formField: 'spouseAge', label: 'Spouse age', canonicalKey: 'derived:spouse_age_from_dob', group: 'Profile' },
    { formField: 'grossMonthlyIncome', label: 'Gross monthly income', canonicalKey: 'profile_gross_monthly_income', group: 'Income' },
  ],
  'tax-fna-step1': [
    { formField: 'age', label: 'Age', canonicalKey: 'derived:age_from_dob', group: 'Profile' },
    { formField: 'maritalStatus', label: 'Marital status', canonicalKey: 'derived:marital_status_tax', group: 'Profile' },
    { formField: 'numberOfDependants', label: 'Number of dependants', canonicalKey: 'derived:dependant_count', group: 'Profile' },
    { formField: 'employmentIncome', label: 'Employment income (annual)', canonicalKey: 'derived:annual_employment_income', group: 'Income' },
    { formField: 'medicalSchemeMembers', label: 'Medical scheme members', canonicalKey: 'derived:medical_scheme_members', group: 'Medical' },
  ],
  'estate-fna-step1': [
    { formField: 'familyInfo.fullName', label: 'Full name', canonicalKey: 'derived:full_name', group: 'Family' },
    { formField: 'familyInfo.dateOfBirth', label: 'Date of birth', canonicalKey: 'profile_date_of_birth', group: 'Family' },
    { formField: 'familyInfo.maritalStatus', label: 'Marital status', canonicalKey: 'profile_marital_status', group: 'Family' },
    { formField: 'familyInfo.spouseName', label: 'Spouse name', canonicalKey: 'profile_spouse_name', group: 'Family' },
  ],
  'investment-ina-step1': [
    { formField: 'currentAge', label: 'Current age', canonicalKey: 'derived:age_from_dob', group: 'Profile' },
    { formField: 'dateOfBirth', label: 'Date of birth', canonicalKey: 'profile_date_of_birth', group: 'Profile' },
    { formField: 'grossMonthlyIncome', label: 'Gross monthly income', canonicalKey: 'profile_gross_monthly_income', group: 'Income' },
    { formField: 'netMonthlyIncome', label: 'Net monthly income', canonicalKey: 'profile_net_monthly_income', group: 'Income' },
    { formField: 'householdDependants', label: 'Household dependants', canonicalKey: 'derived:dependant_count', group: 'Profile' },
    { formField: 'monthlyContribution', label: 'Monthly contribution', canonicalKey: 'derived:investment_monthly_contribution', group: 'Investments' },
  ],
};

export function getFormFieldMappings(formId: FormPrefillId): FormFieldMapping[] {
  return FORM_FIELD_REGISTRY[formId] ?? [];
}

export function listFormPrefillIds(): FormPrefillId[] {
  return Object.keys(FORM_FIELD_REGISTRY) as FormPrefillId[];
}
