/**
 * Shared Form Prefill Resolver — consolidates profile, keys, policies, and intake sources.
 */

import { getFormFieldMappings } from '../../../shared/form-prefill/form-field-registry.ts';
import type {
  FormPrefillId,
  PrefillConfidence,
  PrefillDataSource,
  PrefillMatch,
  PrefillResolveResponse,
  TemplatePrefillResolveResponse,
} from '../../../shared/form-prefill/types.ts';
import { PREFILL_RESOLVER_VERSION } from '../../../shared/form-prefill/types.ts';
import {
  aggregateInvestmentContribution,
  aggregateRetirementCapital,
  aggregateRetirementContribution,
  calculateAge,
  childrenDependantCount,
  dependantCount,
  dependantsSummaryText,
  existingCoverSummaryText,
  getNestedValue,
  hasSpousePartner,
  isEmptyValue,
  loadClientDataSources,
  normalizeMaritalStatusForTax,
  totalFromAssets,
  totalFromLiabilities,
  valuesConflict,
  type ClientDataSources,
} from './form-prefill-data.ts';

interface ResolveOptions {
  includePolicies?: boolean;
  includeClientKeys?: boolean;
  intakeInputs?: Record<string, unknown>;
  currentFormValues?: Record<string, unknown>;
}

function pickProfile(
  sources: ClientDataSources,
  keys: string[],
): { value: unknown; confidence: PrefillConfidence; source: PrefillDataSource } | null {
  const merged = { ...sources.profile, ...sources.clientKeys };
  for (const key of keys) {
    const value = merged[key];
    if (!isEmptyValue(value)) {
      const source: PrefillDataSource = key in sources.clientKeys ? 'client_keys' : 'profile';
      return { value, confidence: key === keys[0] ? 'exact' : 'alias', source };
    }
  }
  return null;
}

function resolveCanonicalKey(
  canonicalKey: string,
  sources: ClientDataSources,
): {
  value: unknown;
  source: PrefillDataSource;
  confidence: PrefillConfidence;
  sourceDetail?: string;
} | null {
  const { profile, clientKeys, intakeInputs } = sources;
  const merged = { ...profile, ...clientKeys };

  if (canonicalKey.startsWith('derived:')) {
    const transform = canonicalKey.replace('derived:', '');
    switch (transform) {
      case 'age_from_dob': {
        const dob = profile.dateOfBirth || profile.date_of_birth;
        const age = calculateAge(dob);
        return age > 0
          ? { value: age, source: 'derived', confidence: 'derived', sourceDetail: `DOB: ${dob}` }
          : null;
      }
      case 'spouse_age_from_dob': {
        const dob = profile.spouseDateOfBirth;
        const age = calculateAge(dob);
        return age > 0 ? { value: age, source: 'derived', confidence: 'derived' } : null;
      }
      case 'full_name': {
        const first = profile.firstName || profile.profile_first_name || '';
        const last = profile.lastName || profile.profile_last_name || '';
        const name = `${first} ${last}`.trim();
        return name ? { value: name, source: 'profile', confidence: 'derived' } : null;
      }
      case 'total_liabilities':
        return {
          value: totalFromLiabilities(profile),
          source: 'profile',
          confidence: 'derived',
          sourceDetail: 'Sum of liabilities',
        };
      case 'total_assets':
        return {
          value: totalFromAssets(profile),
          source: 'profile',
          confidence: 'derived',
          sourceDetail: 'Sum of assets',
        };
      case 'net_worth':
        return {
          value: totalFromAssets(profile) - totalFromLiabilities(profile),
          source: 'derived',
          confidence: 'derived',
        };
      case 'dependant_count':
        return {
          value: dependantCount(profile),
          source: 'profile',
          confidence: 'derived',
        };
      case 'dependant_count_children':
        return {
          value: childrenDependantCount(profile),
          source: 'profile',
          confidence: 'derived',
        };
      case 'has_spouse':
        return {
          value: hasSpousePartner(profile),
          source: 'profile',
          confidence: 'derived',
        };
      case 'dependants_summary':
        return {
          value: dependantsSummaryText(profile),
          source: 'profile',
          confidence: 'derived',
        };
      case 'existing_cover_summary':
        return {
          value: existingCoverSummaryText(sources),
          source: 'client_keys',
          confidence: 'derived',
        };
      case 'marital_status_tax':
        return {
          value: normalizeMaritalStatusForTax(profile.maritalStatus),
          source: 'profile',
          confidence: 'derived',
        };
      case 'annual_employment_income': {
        const monthly =
          Number(profile.grossMonthlyIncome) ||
          Number(profile.gross_monthly_income) ||
          Number(profile.grossIncome) ||
          0;
        return monthly > 0
          ? {
              value: monthly * 12,
              source: 'profile',
              confidence: 'derived',
              sourceDetail: 'Gross monthly × 12',
            }
          : null;
      }
      case 'medical_scheme_members':
        return {
          value: Math.max(1, dependantCount(profile) + 1),
          source: 'derived',
          confidence: 'derived',
        };
      case 'investment_monthly_contribution':
        return {
          value: aggregateInvestmentContribution(sources),
          source: 'policies',
          confidence: 'derived',
        };
      default:
        return null;
    }
  }

  if (!isEmptyValue(intakeInputs[canonicalKey])) {
    return { value: intakeInputs[canonicalKey], source: 'intake', confidence: 'exact' };
  }

  if (!isEmptyValue(clientKeys[canonicalKey])) {
    return { value: clientKeys[canonicalKey], source: 'client_keys', confidence: 'exact' };
  }

  const aliasMap: Record<string, string[]> = {
    profile_first_name: ['firstName', 'profile_first_name'],
    profile_last_name: ['lastName', 'profile_last_name'],
    profile_email: ['email', 'emailAddress', 'profile_email'],
    profile_phone_number: [
      'phone',
      'phoneNumber',
      'cellphone',
      'cellphoneNumber',
      'mobileNumber',
      'profile_phone_number',
    ],
    profile_id_number: ['idNumber', 'identityNumber', 'passportNumber', 'profile_id_number'],
    profile_date_of_birth: ['dateOfBirth', 'date_of_birth', 'profile_date_of_birth'],
    profile_gross_monthly_income: [
      'grossMonthlyIncome',
      'gross_monthly_income',
      'grossIncome',
      'profile_gross_monthly_income',
    ],
    profile_net_monthly_income: [
      'netMonthlyIncome',
      'net_monthly_income',
      'netIncome',
      'profile_net_monthly_income',
    ],
    profile_tax_number: ['taxNumber', 'profile_tax_number'],
    profile_marital_status: ['maritalStatus', 'profile_marital_status'],
    profile_spouse_name: ['spouseName', 'spouseFullName', 'profile_spouse_name'],
    profile_retirement_age: ['retirementAge', 'intendedRetirementAge', 'profile_retirement_age'],
    profile_employment_type: ['employmentType', 'employmentStatus', 'profile_employment_type'],
    profile_monthly_expenses: [
      'totalMonthlyExpenses',
      'monthlyExpenses',
      'totalHouseholdMonthlyExpenditure',
      'profile_monthly_expenses',
    ],
    profile_risk_tolerance: [
      'riskTolerance',
      'riskAssessment',
      'profile_risk_tolerance',
      'clientRiskProfile',
    ],
    profile_investment_horizon: [
      'investmentHorizonYears',
      'investmentHorizon',
      'profile_investment_horizon',
    ],
    profile_tfsa_contributions: [
      'tfsaContributionsLifetime',
      'tfsaContributions',
      'profile_tfsa_contributions',
    ],
    retirement_fund_value_total: [
      'retirement_fund_value_total',
      'retirement_fund_value',
      'retirement_total_value',
    ],
    retirement_monthly_contribution: [
      'retirement_total_contribution',
      'retirement_monthly_contribution',
      'totalMonthlyContribution',
    ],
    risk_life_cover_total: ['risk_life_cover_total'],
    risk_disability_total: ['risk_disability_total'],
    risk_severe_illness_total: ['risk_severe_illness_total'],
    risk_temporary_icb_total: ['risk_temporary_icb_total'],
    risk_permanent_icb_total: ['risk_permanent_icb_total'],
    medical_aid_plan_type: ['medical_aid_plan_type'],
    medical_aid_total_premium: ['medical_aid_total_premium', 'medical_aid_monthly_premium'],
    medical_aid_msa: ['medical_aid_msa'],
    medical_aid_late_joiner_penalty: ['medical_aid_late_joiner_penalty'],
    medical_aid_dependents: ['medical_aid_dependents'],
    medical_aid_hospital_tariff: [
      'medical_aid_hospital_tariff',
      'existingHospitalCover',
      'hospitalTariff',
    ],
  };

  const keys = aliasMap[canonicalKey] ?? [canonicalKey];
  const picked = pickProfile(sources, keys);
  if (picked) {
    return { value: picked.value, source: picked.source, confidence: picked.confidence };
  }

  if (canonicalKey === 'retirement_fund_value_total') {
    const value = aggregateRetirementCapital(sources);
    return value > 0 ? { value, source: 'policies', confidence: 'derived' } : null;
  }

  if (canonicalKey === 'retirement_monthly_contribution') {
    const value = aggregateRetirementContribution(sources);
    return value > 0 ? { value, source: 'policies', confidence: 'derived' } : null;
  }

  if (merged[canonicalKey] !== undefined && !isEmptyValue(merged[canonicalKey])) {
    return { value: merged[canonicalKey], source: 'profile', confidence: 'exact' };
  }

  return null;
}

/** Resolve a single canonical key for external template fill. */
export async function resolveCanonicalValueForClient(
  clientId: string,
  canonicalKey: string,
  intakeInputs?: Record<string, unknown>,
): Promise<{ value: unknown; source: PrefillDataSource } | null> {
  const sources = await loadClientDataSources(clientId, { intakeInputs });
  const resolved = resolveCanonicalKey(canonicalKey, sources);
  if (!resolved || isEmptyValue(resolved.value)) return null;
  return { value: resolved.value, source: resolved.source };
}

function formatRiskFormValue(formField: string, value: unknown): unknown {
  if (
    formField.startsWith('existingCover') ||
    formField === 'grossMonthlyIncome' ||
    formField === 'netMonthlyIncome' ||
    formField === 'currentAge' ||
    formField === 'retirementAge' ||
    formField === 'totalOutstandingDebts' ||
    formField === 'totalCurrentAssets' ||
    formField === 'totalHouseholdMonthlyExpenditure' ||
    formField === 'dependantCount'
  ) {
    return String(value);
  }
  return value;
}

function formatFormValue(formId: FormPrefillId, formField: string, value: unknown): unknown {
  if (formId === 'risk-fna-step1') return formatRiskFormValue(formField, value);
  if (formId === 'medical-fna-step1') {
    if (formField === 'spousePartner') return Boolean(value);
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return value;
  }
  if (formId === 'retirement-fna-step1' && typeof value === 'string') {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  return value;
}

export async function resolveFormPrefill(
  clientId: string,
  formId: FormPrefillId,
  options: ResolveOptions = {},
): Promise<PrefillResolveResponse> {
  const sources = await loadClientDataSources(clientId, {
    intakeInputs: options.intakeInputs,
  });

  const mappings = getFormFieldMappings(formId);
  const currentFormValues = options.currentFormValues ?? {};
  const matches: PrefillMatch[] = [];
  const proposedValues: Record<string, unknown> = {};
  const matchedFields = new Set<string>();

  for (const mapping of mappings) {
    const resolved = resolveCanonicalKey(mapping.canonicalKey, sources);
    if (!resolved || isEmptyValue(resolved.value)) continue;

    const proposedValue = formatFormValue(formId, mapping.formField, resolved.value);
    const currentFormValue = getNestedValue(currentFormValues, mapping.formField);

    matches.push({
      formField: mapping.formField,
      label: mapping.label,
      proposedValue,
      canonicalKey: mapping.canonicalKey,
      source: resolved.source,
      confidence: resolved.confidence,
      currentFormValue,
      conflict: valuesConflict(currentFormValue, proposedValue),
      sourceDetail: resolved.sourceDetail,
    });

    proposedValues[mapping.formField] = proposedValue;
    matchedFields.add(mapping.formField);
  }

  const unmatchedFormFields = mappings
    .map((m) => m.formField)
    .filter((field) => !matchedFields.has(field));

  return {
    formId,
    clientId,
    matches,
    unmatchedFormFields,
    proposedValues,
    resolverVersion: PREFILL_RESOLVER_VERSION,
  };
}

export function applySelectedMatches(
  currentValues: Record<string, unknown>,
  matches: PrefillMatch[],
  selectedFields: string[],
  overwriteConflicts = false,
): Record<string, unknown> {
  const next = { ...currentValues };

  for (const match of matches) {
    if (!selectedFields.includes(match.formField)) continue;
    if (match.conflict && !overwriteConflicts) continue;

    const parts = match.formField.split('.');
    if (parts.length === 1) {
      next[match.formField] = match.proposedValue;
    } else {
      let cursor: Record<string, unknown> = next;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
        cursor = cursor[key] as Record<string, unknown>;
      }
      cursor[parts[parts.length - 1]] = match.proposedValue;
    }
  }

  return next;
}

/** Resolve template PDF field mappings against client data. */
export async function resolveTemplatePrefill(
  clientId: string,
  templateId: string,
  fields: Array<{ id: string; name: string; label: string; canonicalKey?: string }>,
): Promise<TemplatePrefillResolveResponse> {
  const sources = await loadClientDataSources(clientId);
  const matches: PrefillMatch[] = [];
  const matchedFields = new Set<string>();

  for (const field of fields) {
    if (!field.canonicalKey) continue;
    const resolved = resolveCanonicalKey(field.canonicalKey, sources);
    if (!resolved || isEmptyValue(resolved.value)) continue;

    matches.push({
      formField: field.name,
      label: field.label || field.name,
      proposedValue: resolved.value,
      canonicalKey: field.canonicalKey,
      source: resolved.source,
      confidence: resolved.confidence,
      conflict: false,
      sourceDetail: resolved.sourceDetail,
    });
    matchedFields.add(field.name);
  }

  const unmatchedFormFields = fields
    .filter((f) => f.canonicalKey && !matchedFields.has(f.name))
    .map((f) => f.name);

  return {
    templateId,
    clientId,
    matches,
    unmatchedFormFields,
    resolverVersion: PREFILL_RESOLVER_VERSION,
  };
}
