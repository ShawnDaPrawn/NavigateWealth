/**
 * Delegates domain auto-populate endpoints to the unified form prefill resolver.
 */

import type { FormPrefillId } from '../../../shared/form-prefill/types.ts';
import * as kv from './kv_store.tsx';
import { resolveFormPrefill } from './form-prefill-resolver.ts';

interface VersionedSession {
  version?: number;
  inputs?: Record<string, unknown>;
}

export function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

export function applyProposedValues(
  target: Record<string, unknown>,
  proposed: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(proposed)) {
    if (value === undefined || value === null) continue;
    if (key.includes('.')) {
      setNestedValue(target, key, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export async function resolveAutoPopulateValues(
  clientId: string,
  formId: FormPrefillId,
): Promise<Record<string, unknown>> {
  const result = await resolveFormPrefill(clientId, formId);
  return result.proposedValues;
}

export async function retirementAutoPopulateFromResolver(
  clientId: string,
): Promise<Record<string, unknown>> {
  const proposed = await resolveAutoPopulateValues(clientId, 'retirement-fna-step1');
  return {
    currentAge: proposed.currentAge ?? 30,
    intendedRetirementAge: proposed.retirementAge ?? 65,
    grossMonthlyIncome: proposed.grossMonthlyIncome ?? 0,
    netMonthlyIncome: proposed.currentMonthlyIncome ?? 0,
    totalMonthlyContribution: proposed.currentMonthlyContribution ?? 0,
    totalCurrentRetirementCapital: proposed.currentRetirementSavings ?? 0,
  };
}

export async function riskAutoPopulateFromResolver(
  clientId: string,
): Promise<Record<string, unknown>> {
  const proposed = await resolveAutoPopulateValues(clientId, 'risk-fna-step1');
  const gross = Number(proposed.grossMonthlyIncome) || 0;
  const net = Number(proposed.netMonthlyIncome) || 0;
  return {
    grossMonthlyIncome: gross,
    grossAnnualIncome: gross * 12,
    netMonthlyIncome: net,
    netAnnualIncome: net * 12,
    incomeEscalationAssumption: 6,
    currentAge: proposed.currentAge ?? 30,
    retirementAge: proposed.retirementAge ?? 65,
    employmentType: proposed.employmentType ?? 'employed',
    dependants: [],
    totalOutstandingDebts: Number(proposed.totalOutstandingDebts) || 0,
    totalCurrentAssets: Number(proposed.totalCurrentAssets) || 0,
    totalEstateValue:
      (Number(proposed.totalCurrentAssets) || 0) - (Number(proposed.totalOutstandingDebts) || 0),
    spouseFullName: proposed.spouseFullName ?? '',
    spouseAverageMonthlyIncome: 0,
    combinedHouseholdIncome: gross,
    clientIncomePercentage: 100,
    totalHouseholdMonthlyExpenditure: Number(proposed.totalHouseholdMonthlyExpenditure) || 0,
    dependantCount: Number(proposed.dependantCount) || 0,
    existingCover: {
      life: { personal: Number(proposed.existingCoverLifePersonal) || 0, group: 0 },
      disability: { personal: Number(proposed.existingCoverDisabilityPersonal) || 0, group: 0 },
      severeIllness: {
        personal: Number(proposed.existingCoverSevereIllnessPersonal) || 0,
        group: 0,
      },
      incomeProtection: {
        temporary: { personal: Number(proposed.existingCoverIPTemporaryPersonal) || 0, group: 0 },
        permanent: { personal: Number(proposed.existingCoverIPPermanentPersonal) || 0, group: 0 },
      },
    },
    incomeProtectionSettings: {
      temporary: { benefitPeriod: '12-months' as const },
      permanent: { escalation: 'cpi-linked' as const },
    },
  };
}

export async function medicalStep1AutoPopulateFromResolver(
  clientId: string,
): Promise<Record<string, unknown>> {
  const proposed = await resolveAutoPopulateValues(clientId, 'medical-fna-step1');
  return {
    currentAge: proposed.currentAge ?? 30,
    spousePartner: proposed.spousePartner ?? false,
    childrenCount: proposed.childrenCount ?? 0,
    grossMonthlyIncome: proposed.grossMonthlyIncome ?? 0,
    existingPlanType: proposed.existingPlanType ?? '',
    existingHospitalCover: proposed.existingHospitalCover ?? proposed.existingHospitalTariff ?? '',
    existingTotalPremium: proposed.existingTotalPremium ?? 0,
    existingMSA: proposed.existingMSA ?? 0,
    existingLJP: proposed.existingLJP ?? 0,
    existingDependents: proposed.existingDependents ?? 0,
  };
}

/** Overlay RA/TFSA/medical members from domain FNA sessions (not in unified resolver). */
export async function enrichTaxFromDomainSessions(
  clientId: string,
  inputs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const enriched = { ...inputs };
  const dependantsCount = Number(inputs.numberOfDependants) || 0;

  try {
    const retirementFNAs = await kv.getByPrefix(`retirement-fna:${clientId}:`);
    if (retirementFNAs?.length) {
      const latest = retirementFNAs.sort(
        (a: VersionedSession, b: VersionedSession) => (b.version || 0) - (a.version || 0),
      )[0];
      const monthly = latest?.inputs?.currentMonthlyRAContribution;
      if (monthly != null) {
        const parsed = parseFloat(String(monthly));
        if (!isNaN(parsed) && parsed >= 0) enriched.raContributions = parsed * 12;
      }
    }
  } catch {
    // non-fatal
  }

  let medicalMembers = Math.max(1, dependantsCount + 1);
  try {
    const medicalFNAs = await kv.getByPrefix(`medical-fna:${clientId}:`);
    if (medicalFNAs?.length) {
      const latest = medicalFNAs.sort(
        (a: VersionedSession, b: VersionedSession) => (b.version || 0) - (a.version || 0),
      )[0];
      if (latest?.inputs?.numberOfDependants != null) {
        const depCount = parseInt(String(latest.inputs.numberOfDependants), 10);
        if (!isNaN(depCount) && depCount >= 0) medicalMembers = depCount + 1;
      }
    }
  } catch {
    // non-fatal
  }
  enriched.medicalSchemeMembers = medicalMembers;

  try {
    const investmentINAs = await kv.getByPrefix(`investment-ina:client:${clientId}:`);
    if (investmentINAs?.length) {
      const latest = investmentINAs.sort(
        (a: VersionedSession, b: VersionedSession) => (b.version || 0) - (a.version || 0),
      )[0];
      if (latest?.inputs?.tfsaLifetimeContributions != null) {
        const val = parseFloat(String(latest.inputs.tfsaLifetimeContributions));
        if (!isNaN(val) && val >= 0) enriched.tfsaContributionsLifetime = val;
      }
    }
  } catch {
    // non-fatal
  }

  return enriched;
}

export async function taxAutoPopulateFromResolver(
  clientId: string,
): Promise<Record<string, unknown>> {
  const defaults: Record<string, unknown> = {
    age: 45,
    maritalStatus: 'single',
    taxResidency: 'resident',
    numberOfDependants: 0,
    employmentIncome: 0,
    variableIncome: 0,
    businessIncome: 0,
    rentalIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    foreignIncome: 0,
    capitalGainsRealised: 0,
    raContributions: 0,
    tfsaContributionsLifetime: 0,
    medicalSchemeMembers: 1,
    grossMonthlyIncome: 0,
    taxNumber: '',
  };
  const proposed = await resolveAutoPopulateValues(clientId, 'tax-fna-step1');
  return applyProposedValues(defaults, proposed);
}

export async function investmentAutoPopulateFromResolver(
  clientId: string,
): Promise<Record<string, unknown>> {
  const defaults: Record<string, unknown> = {
    currentAge: 0,
    dateOfBirth: '',
    householdDependants: 0,
    grossMonthlyIncome: 0,
    netMonthlyIncome: 0,
    fullName: '',
    maritalStatus: '',
    monthlyContribution: 0,
    clientRiskProfile: 'balanced',
    discretionaryInvestments: [],
    totalDiscretionaryCapitalCurrent: 0,
    totalDiscretionaryMonthlyContributions: 0,
  };
  const proposed = await resolveAutoPopulateValues(clientId, 'investment-ina-step1');
  const merged = applyProposedValues(defaults, proposed);
  if (proposed.clientRiskProfile) merged.clientRiskProfile = proposed.clientRiskProfile;
  if (proposed.investmentHorizonYears != null) {
    merged.investmentHorizonYears = proposed.investmentHorizonYears;
  }
  return merged;
}

export async function estateAutoPopulateFromResolver(
  clientId: string,
): Promise<Record<string, unknown>> {
  const base: Record<string, unknown> = {
    familyInfo: {
      fullName: '',
      dateOfBirth: '',
      age: 0,
      maritalStatus: 'single',
      citizenship: 'South Africa',
      taxResidency: 'South Africa',
    },
    dependants: [],
    willInfo: {
      hasValidWill: 'unknown',
      executorNominated: 'unknown',
      guardianNominated: 'unknown',
      specialBequests: [],
      willNeedsUpdate: false,
    },
    assets: [],
    liabilities: [],
    lifePolicies: [],
    assumptions: {},
    hasOffshorAssets: false,
    hasTrusts: false,
    planningNotes: '',
  };
  const proposed = await resolveAutoPopulateValues(clientId, 'estate-fna-step1');
  return applyProposedValues(base, proposed);
}
