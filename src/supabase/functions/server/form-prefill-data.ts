/**
 * Loads and normalizes client data sources for form prefill.
 */

import * as kv from './kv_store.tsx';

export interface ClientDataSources {
  profile: Record<string, unknown>;
  clientKeys: Record<string, unknown>;
  policiesLegacy: Record<string, unknown>;
  policiesClient: unknown[];
  intakeInputs: Record<string, unknown>;
}

function flattenProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const personal =
    raw.personalInformation && typeof raw.personalInformation === 'object'
      ? (raw.personalInformation as Record<string, unknown>)
      : {};

  return { ...personal, ...raw, ...Object.fromEntries(
    Object.entries(raw).filter(([k]) => k !== 'personalInformation'),
  ) };
}

export function calculateAge(dob: unknown): number {
  if (!dob || typeof dob !== 'string') return 0;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export async function loadClientDataSources(
  clientId: string,
  options?: { intakeInputs?: Record<string, unknown> },
): Promise<ClientDataSources> {
  const [personalInfo, clientKeys, policiesLegacy, policiesClientRaw] = await Promise.all([
    kv.get(`user_profile:${clientId}:personal_info`),
    kv.get(`user_profile:${clientId}:client_keys`),
    kv.get(`policies:${clientId}`),
    kv.get(`policies:client:${clientId}`),
  ]);

  const profile = flattenProfile((personalInfo as Record<string, unknown>) || {});

  return {
    profile,
    clientKeys: (clientKeys as Record<string, unknown>) || {},
    policiesLegacy: (policiesLegacy as Record<string, unknown>) || {},
    policiesClient: Array.isArray(policiesClientRaw) ? policiesClientRaw : [],
    intakeInputs: options?.intakeInputs || {},
  };
}

export function sumPolicyInvestments(
  investments: unknown[],
  predicate: (inv: Record<string, unknown>) => boolean,
  field: 'currentValue' | 'contribution' | 'monthlyContribution',
): number {
  return investments.reduce((sum: number, item) => {
    const inv = item as Record<string, unknown>;
    if (!predicate(inv)) return sum;
    const raw = inv[field] ?? inv.monthlyContribution ?? inv.contribution ?? 0;
    return sum + (parseFloat(String(raw)) || 0);
  }, 0);
}

export function aggregateRetirementCapital(sources: ClientDataSources): number {
  const merged = { ...sources.profile, ...sources.clientKeys };
  const investments = Array.isArray(sources.policiesLegacy.investments)
    ? sources.policiesLegacy.investments
    : [];

  const aggregated = sumPolicyInvestments(investments, (inv) => {
    const name = String(inv.name || inv.productName || '').toLowerCase();
    const category = String(inv.category || inv.productCategory || '').toLowerCase();
    return (
      category.includes('retirement') ||
      category.includes('pension') ||
      category.includes('provident') ||
      category.includes('ra') ||
      name.includes('retirement') ||
      inv.isDiscretionary === false
    );
  }, 'currentValue');

  return (
    Number(merged.retirement_fund_value_total) ||
    Number(merged.retirement_fund_value) ||
    aggregated ||
    Number(merged.totalCurrentRetirementCapital) ||
    0
  );
}

export function aggregateRetirementContribution(sources: ClientDataSources): number {
  const merged = { ...sources.profile, ...sources.clientKeys };
  const investments = Array.isArray(sources.policiesLegacy.investments)
    ? sources.policiesLegacy.investments
    : [];

  const aggregated = sumPolicyInvestments(investments, (inv) => {
    const category = String(inv.category || inv.productCategory || '').toLowerCase();
    return category.includes('retirement') || inv.isDiscretionary === false;
  }, 'monthlyContribution');

  return (
    Number(merged.retirement_total_contribution) ||
    Number(merged.retirement_monthly_contribution) ||
    aggregated ||
    Number(merged.totalMonthlyContribution) ||
    0
  );
}

export function aggregateInvestmentContribution(sources: ClientDataSources): number {
  const investments = Array.isArray(sources.policiesLegacy.investments)
    ? sources.policiesLegacy.investments
    : [];
  return sumPolicyInvestments(investments, (inv) => inv.isDiscretionary === true, 'monthlyContribution');
}

export function totalFromLiabilities(profile: Record<string, unknown>): number {
  if (profile.totalLiabilities) return Number(profile.totalLiabilities) || 0;
  const liabilities = profile.liabilities;
  if (!Array.isArray(liabilities)) return 0;
  return liabilities.reduce((sum, item) => {
    const row = item as Record<string, unknown>;
    return sum + (Number(row.outstandingBalance) || 0);
  }, 0);
}

export function totalFromAssets(profile: Record<string, unknown>): number {
  if (profile.totalAssets) return Number(profile.totalAssets) || 0;
  const assets = profile.assets;
  if (!Array.isArray(assets)) return 0;
  return assets.reduce((sum, item) => {
    const row = item as Record<string, unknown>;
    return sum + (Number(row.value) || 0);
  }, 0);
}

export function dependantCount(profile: Record<string, unknown>): number {
  const family = profile.familyMembers;
  if (Array.isArray(family)) {
    return family.filter((fm) => {
      const row = fm as Record<string, unknown>;
      return row.isFinanciallyDependent || row.relationship === 'Child';
    }).length;
  }
  const dependants = profile.dependants;
  if (Array.isArray(dependants)) {
    return dependants.length;
  }
  return 0;
}

export function childrenDependantCount(profile: Record<string, unknown>): number {
  const family = profile.familyMembers;
  if (Array.isArray(family)) {
    return family.filter((fm) => (fm as Record<string, unknown>).relationship === 'Child').length;
  }
  const dependants = profile.dependants;
  if (Array.isArray(dependants)) {
    return dependants.filter((d) => (d as Record<string, unknown>).relationship === 'Child').length;
  }
  return 0;
}

export function hasSpousePartner(profile: Record<string, unknown>): boolean {
  const marital = String(profile.maritalStatus || profile.profile_marital_status || '').toLowerCase();
  if (marital.includes('married')) return true;
  return Boolean(profile.spouseFullName || profile.spouseName || profile.profile_spouse_name);
}

export function dependantsSummaryText(profile: Record<string, unknown>): string {
  const family = profile.familyMembers;
  if (!Array.isArray(family) || family.length === 0) return '';
  return family
    .map((fm) => {
      const row = fm as Record<string, unknown>;
      const name = row.fullName || row.firstName || row.relationship || 'Dependant';
      const age = row.dateOfBirth ? calculateAge(String(row.dateOfBirth)) : '';
      return age ? `${name} (${age})` : String(name);
    })
    .join(', ');
}

export function existingCoverSummaryText(sources: ClientDataSources): string {
  const keys = sources.clientKeys;
  const parts: string[] = [];
  if (keys.risk_life_cover_total) parts.push(`Life: R${keys.risk_life_cover_total}`);
  if (keys.risk_disability_total) parts.push(`Disability: R${keys.risk_disability_total}`);
  if (keys.risk_severe_illness_total) parts.push(`Severe illness: R${keys.risk_severe_illness_total}`);
  return parts.join('; ');
}

export function normalizeMaritalStatusForTax(raw: unknown): string {
  if (typeof raw !== 'string') return 'single';
  const lower = raw.toLowerCase();
  if (lower.includes('community') && lower.includes('in')) return 'married_in_community';
  if (lower.includes('married') || lower.includes('community')) return 'married_out_community';
  return 'single';
}

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return false;
}

export function valuesConflict(current: unknown, proposed: unknown): boolean {
  if (isEmptyValue(current)) return false;
  return String(current) !== String(proposed);
}
