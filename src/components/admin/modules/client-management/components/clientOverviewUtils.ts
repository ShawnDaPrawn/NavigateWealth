/**
 * Pure helpers extracted from ClientOverviewTab.tsx (Phase 6 god-file split).
 *
 * These are dependency-free formatting, date-math, policy-aggregation and
 * gap-status functions — no React, no hooks, no I/O. They were lifted out of
 * the 3.3k-line component verbatim (behaviour-preserving) so they can be
 * unit-tested and reused, and so the component file shrinks toward its
 * single responsibility (rendering). Tested in clientOverviewUtils.test.ts.
 */

import type { ElementType } from 'react';
import type { ProfileData } from '../types';
import {
  calcDTI,
  deriveDTIStatus,
  calcEmergencyFundMonths,
  deriveEmergencyFundStatus,
  calcInsuranceCoverageRatio,
  deriveInsuranceCoverageStatus,
  calcRetirementProgress,
  deriveRetirementProgressStatus,
  deriveSavingsRateStatus,
  deriveNetWorthStatus,
} from '../utils';
import type { KPIValue } from './overview/KPISummaryTable';

// ── Shared types (relocated from ClientOverviewTab) ──────────────────────

export interface Policy {
  id: string;
  providerName: string;
  categoryId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

export type GapStatus = 'good' | 'caution' | 'gap' | 'none';

/** Pillar health status derived from gap analysis */
export type PillarHealth = 'healthy' | 'attention' | 'critical' | 'no-data';

// ── Formatting helpers ───────────────────────────────────────────────────

export const fmt = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  return `R ${Number(n).toLocaleString('en-ZA')}`;
};

export const pct = (n: number): string => `${n.toFixed(1)}%`;

/** Compact currency for pillar cards: R 1.2m / R 450k / R 5 000 */
export const fmtCompact = (n: number | undefined | null): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 100_000) return `R ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};

export const calcAge = (dob: string | undefined): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export const fmtDate = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const fmtRelative = (d: string): string => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
};

// ── Date math ──────────────────────────────────────────────────────────────

/** Add months to a date string, return ISO string */
export const addMonths = (d: string, months: number): string => {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + months);
  return dt.toISOString();
};

/** Is the date in the past? */
export const isPast = (d: string): boolean => new Date(d).getTime() < Date.now();

/** Get the next anniversary of a date (next occurrence in the future) */
export const nextAnniversary = (isoDate: string): Date | null => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, d.getMonth(), d.getDate());
  if (candidate.getTime() < now.getTime()) {
    candidate.setFullYear(thisYear + 1);
  }
  return candidate;
};

/** Days between two dates */
export const daysBetween = (a: Date, b: Date): number =>
  Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

export const addressLine = (p: ProfileData | undefined): string => {
  if (!p) return '-';
  const parts = [
    p.residentialAddressLine1,
    p.residentialSuburb,
    p.residentialCity,
    p.residentialProvince,
    p.residentialPostalCode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '-';
};

// ── Policy value access + aggregation ────────────────────────────────────

/**
 * Read a numeric value from policy.data by key.
 * After normalisation the data contains both field-ID and keyId entries,
 * so a simple direct lookup is sufficient.
 */
export const numVal = (policy: Policy, key: string): number => {
  const v = policy.data?.[key];
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Read a string value from policy.data by key.
 */
export const strVal = (policy: Policy, key: string): string | undefined => {
  const v = policy.data?.[key];
  if (v !== undefined && v !== null && v !== '' && typeof v === 'string') return v;
  return undefined;
};

export const sumField = (pols: Policy[], keyId: string): number =>
  pols.reduce((s, p) => s + numVal(p, keyId), 0);

/**
 * Sum investment monthly contributions, excluding lump-sum policies.
 *
 * When an investment policy's "Premium" field (invest_monthly_contribution)
 * equals its "Current Value" field (invest_current_value), the premium
 * represents the initial lump-sum investment — not a recurring monthly
 * contribution. This commonly happens when the AI extraction maps the
 * total investment amount to the schema's "Premium" field.
 *
 * Guard: skip the contribution when it matches the current value.
 */
export const sumInvestmentPremiums = (pols: Policy[]): number =>
  pols.reduce((s, p) => {
    const contribution = numVal(p, 'invest_monthly_contribution');
    if (contribution <= 0) return s;
    const currentValue = numVal(p, 'invest_current_value');
    // If the "premium" is >= the current portfolio value, it's almost
    // certainly a lump-sum initial investment, not a recurring monthly
    // contribution.  A genuine monthly contribution accumulates over time,
    // so the portfolio value will always exceed a single month's payment.
    if (currentValue > 0 && contribution >= currentValue) return s;
    return s + contribution;
  }, 0);

/** Sum the first non-zero value from a list of candidate keyIds per policy
 *  (avoids double-counting when e.g. retirement_fund_value and retirement_current_value
 *   both exist on the same policy) */
export const sumFirstNonZero = (pols: Policy[], ...keyIds: string[]): number =>
  pols.reduce((s, p) => {
    for (const k of keyIds) {
      const v = numVal(p, k);
      if (v > 0) return s + v;
    }
    return s;
  }, 0);

/** Sum all specified keyIds per policy (for additive fields, e.g. EB premiums) */
export const sumMultiField = (pols: Policy[], keyIds: string[]): number =>
  pols.reduce((s, p) => s + keyIds.reduce((fs, k) => fs + numVal(p, k), 0), 0);

// ── Gap status ─────────────────────────────────────────────────────────────

/** Derive worst gap status from a set of statuses */
export function worstGapStatus(statuses: GapStatus[]): PillarHealth {
  const filtered = statuses.filter((s) => s !== 'none');
  if (filtered.length === 0) return 'no-data';
  if (filtered.some((s) => s === 'gap')) return 'critical';
  if (filtered.some((s) => s === 'caution')) return 'attention';
  return 'healthy';
}

// ── Schema-driven policy normalisation ───────────────────────────────────

export interface SchemaField {
  id: string;
  keyId?: string;
  name?: string;
  type?: string;
}

/**
 * Given a policy's data and the schema fields for its category, return a new
 * data object where every entry that has a keyId is ALSO keyed by that keyId.
 * Original field-ID entries are preserved for backward compat.
 */
export function normalizePolicyData(
  data: Record<string, unknown>,
  schemaFields: SchemaField[],
): Record<string, unknown> {
  const out = { ...data };
  for (const field of schemaFields) {
    if (field.keyId && data[field.id] !== undefined) {
      out[field.keyId] = data[field.id];
    }
  }
  return out;
}

// ── FNA result parsers (read published-FNA payloads into typed shapes) ────

export interface RiskFinalNeed {
  riskType: string;
  label: string;
  grossNeed: number;
  existingCoverTotal: number;
  netShortfall: number;
  finalRecommendedCover: number;
}

/** Extract finalNeeds from a published Risk Planning FNA payload. */
export function extractRiskFinalNeeds(
  raw: Record<string, unknown> | null | undefined,
): RiskFinalNeed[] {
  if (!raw) return [];
  const needs = raw.finalNeeds as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(needs)) return [];
  return needs.map((n) => ({
    riskType: (n.riskType as string) || '',
    label: (n.label as string) || '',
    grossNeed: Number(n.grossNeed) || 0,
    existingCoverTotal: Number(n.existingCoverTotal) || 0,
    netShortfall: Number(n.netShortfall) || 0,
    finalRecommendedCover: Number(n.finalRecommendedCover) || 0,
  }));
}

export interface RetirementFnaResults {
  hasShortfall: boolean;
  capitalShortfall: number;
  requiredCapital: number;
  projectedCapital: number;
  totalRecommendedContribution: number;
  requiredAdditionalContribution: number;
  percentageOfIncome: number;
}

/** Extract retirement calculation results from a published Retirement FNA payload. */
export function extractRetirementResults(
  raw: Record<string, unknown> | null | undefined,
): RetirementFnaResults | null {
  if (!raw) return null;
  const results = (raw.results || raw.calculations) as Record<string, unknown> | undefined;
  if (!results) return null;
  return {
    hasShortfall: !!results.hasShortfall,
    capitalShortfall: Number(results.capitalShortfall) || 0,
    requiredCapital: Number(results.requiredCapital) || 0,
    projectedCapital: Number(results.projectedCapital) || 0,
    totalRecommendedContribution: Number(results.totalRecommendedContribution) || 0,
    requiredAdditionalContribution: Number(results.requiredAdditionalContribution) || 0,
    percentageOfIncome: Number(results.percentageOfIncome) || 0,
  };
}

// ── Gap analysis derivation ──────────────────────────────────────────────

export interface GapItem {
  label: string;
  status: GapStatus;
  current: string;
  recommended: string;
  detail?: string;
}

export interface GapAnalysisInputs {
  fnaResultsMap: Record<string, Record<string, unknown> | null>;
  riskFnaPublished: boolean;
  retirementFnaPublished: boolean;
  medicalFnaPublished: boolean;
  estateFnaPublished: boolean;
  medicalPolicies: Policy[];
  estatePolicies: Policy[];
}

/**
 * Derive the cover-gap list from published-FNA results + policy counts.
 * Pure: same inputs -> same GapItem[]. Lifted verbatim from ClientOverviewTab's
 * gapAnalysis useMemo so it can be unit-tested against FNA-result fixtures.
 */
export function deriveGapAnalysis(inputs: GapAnalysisInputs): GapItem[] {
  const {
    fnaResultsMap,
    riskFnaPublished,
    retirementFnaPublished,
    medicalFnaPublished,
    estateFnaPublished,
    medicalPolicies,
    estatePolicies,
  } = inputs;
  const gaps: GapItem[] = [];

  // ── Risk Planning gaps (from published Risk FNA finalNeeds) ──────
  if (riskFnaPublished) {
    const riskNeeds = extractRiskFinalNeeds(fnaResultsMap.risk);

    // Life Cover
    const lifeNeed = riskNeeds.find((n) => n.riskType === 'life');
    if (lifeNeed) {
      const ratio = lifeNeed.grossNeed > 0 ? lifeNeed.existingCoverTotal / lifeNeed.grossNeed : 1;
      gaps.push({
        label: 'Life Cover',
        status: lifeNeed.netShortfall <= 0 ? 'good' : ratio >= 0.8 ? 'caution' : 'gap',
        current: fmt(lifeNeed.existingCoverTotal),
        recommended: `${fmt(lifeNeed.grossNeed)} (FNA recommended)`,
        detail:
          lifeNeed.netShortfall > 0
            ? `Shortfall: ${fmt(lifeNeed.netShortfall)}`
            : lifeNeed.existingCoverTotal > lifeNeed.grossNeed
              ? 'Adequately covered'
              : undefined,
      });
    }

    // Disability Cover
    const disabilityNeed = riskNeeds.find((n) => n.riskType === 'disability');
    if (disabilityNeed) {
      gaps.push({
        label: 'Disability Cover',
        status: disabilityNeed.netShortfall <= 0 ? 'good' : 'gap',
        current:
          disabilityNeed.existingCoverTotal > 0 ? fmt(disabilityNeed.existingCoverTotal) : 'None',
        recommended: `${fmt(disabilityNeed.grossNeed)} (FNA recommended)`,
        detail:
          disabilityNeed.netShortfall > 0
            ? `Shortfall: ${fmt(disabilityNeed.netShortfall)}`
            : undefined,
      });
    }

    // Severe Illness
    const severeNeed = riskNeeds.find((n) => n.riskType === 'severeIllness');
    if (severeNeed) {
      gaps.push({
        label: 'Severe Illness Cover',
        status: severeNeed.netShortfall <= 0 ? 'good' : 'gap',
        current: severeNeed.existingCoverTotal > 0 ? fmt(severeNeed.existingCoverTotal) : 'None',
        recommended: `${fmt(severeNeed.grossNeed)} (FNA recommended)`,
        detail:
          severeNeed.netShortfall > 0 ? `Shortfall: ${fmt(severeNeed.netShortfall)}` : undefined,
      });
    }

    // Income Protection (temporary + permanent)
    const ipTempNeed = riskNeeds.find((n) => n.riskType === 'incomeProtectionTemporary');
    const ipPermNeed = riskNeeds.find((n) => n.riskType === 'incomeProtectionPermanent');
    const ipNeed = ipTempNeed || ipPermNeed; // Use whichever is available
    if (ipNeed) {
      // Combine temporary + permanent if both exist
      const totalIpExisting =
        (ipTempNeed?.existingCoverTotal || 0) + (ipPermNeed?.existingCoverTotal || 0);
      const totalIpGross = (ipTempNeed?.grossNeed || 0) + (ipPermNeed?.grossNeed || 0);
      const totalIpShortfall = (ipTempNeed?.netShortfall || 0) + (ipPermNeed?.netShortfall || 0);

      gaps.push({
        label: 'Income Protection',
        status: totalIpShortfall <= 0 ? 'good' : 'gap',
        current: totalIpExisting > 0 ? fmt(totalIpExisting) : 'None',
        recommended: `${fmt(totalIpGross)} (FNA recommended)`,
        detail: totalIpShortfall > 0 ? `Shortfall: ${fmt(totalIpShortfall)}` : undefined,
      });
    }
  }

  // ── Medical Aid gaps (from published Medical FNA) ────────────────
  if (medicalFnaPublished) {
    const medRaw = fnaResultsMap.medical;
    const medResults = medRaw?.results as Record<string, unknown> | undefined;
    const medFinal = medRaw?.finalNeeds as Record<string, unknown> | undefined;

    // Medical FNA provides qualitative recommendations (plan type, MSA, LJP)
    // We can check if the client has any active medical cover at all
    const hasActivePlan = medicalPolicies.length > 0;
    gaps.push({
      label: 'Medical Aid',
      status: hasActivePlan ? 'good' : 'gap',
      current: hasActivePlan
        ? `${medicalPolicies.length} active plan${medicalPolicies.length > 1 ? 's' : ''}`
        : 'None',
      recommended: medResults
        ? `${(medResults.recommendedInHospitalCover as string) || 'In-hospital'} cover, ${medResults.msaRecommended || medFinal?.msa ? 'MSA recommended' : 'MSA not required'} (FNA)`
        : 'Active medical aid membership (per FNA)',
    });
  }

  // ── Retirement gaps (from published Retirement FNA) ──────────────
  if (retirementFnaPublished) {
    const retResults = extractRetirementResults(fnaResultsMap.retirement);
    if (retResults) {
      gaps.push({
        label: 'Retirement Savings',
        status: !retResults.hasShortfall
          ? 'good'
          : retResults.capitalShortfall < retResults.requiredCapital * 0.3
            ? 'caution'
            : 'gap',
        current: fmt(retResults.projectedCapital) + ' projected',
        recommended: `${fmt(retResults.requiredCapital)} required capital (FNA)`,
        detail: retResults.hasShortfall
          ? `Shortfall: ${fmt(retResults.capitalShortfall)}. Additional ${fmt(retResults.requiredAdditionalContribution)}/m recommended.`
          : 'On track to meet retirement target',
      });
    }
  }

  // ── Estate Planning gaps (from published Estate FNA) ─────────────
  if (estateFnaPublished) {
    gaps.push({
      label: 'Estate Planning',
      status: estatePolicies.length > 0 ? 'good' : 'caution',
      current: estatePolicies.length > 0 ? 'In place' : 'No estate plan on record',
      recommended: 'Will, executor nomination, and estate duty planning (per FNA)',
    });
  }

  return gaps;
}

// ── Pillar cards derivation ──────────────────────────────────────────────

type FnaStatusValue =
  | 'published'
  | 'draft'
  | 'not_started'
  | 'error'
  | 'submitted'
  | 'client_draft';

/** Minimal shape of an FNA status entry the pillar derivation reads. */
export interface PillarFnaStatusItem {
  key: string;
  status?: FnaStatusValue;
  loading: boolean;
}

export interface PillarData {
  id: string;
  title: string;
  icon: ElementType;
  health: PillarHealth;
  primaryValue: string;
  primaryLabel: string;
  metrics: Array<{ label: string; value: string; recommended?: string; highlight?: boolean }>;
  policyCount: number;
  monthlyPremium: number;
  fnaStatus?: FnaStatusValue | 'loading';
}

export interface PillarsInputs {
  gapAnalysis: GapItem[];
  fnaStatuses: PillarFnaStatusItem[];
  fnaResultsMap: Record<string, Record<string, unknown> | null>;
  riskFnaPublished: boolean;
  medicalFnaPublished: boolean;
  retirementFnaPublished: boolean;
  riskPolicies: Policy[];
  medicalPolicies: Policy[];
  retirementPolicies: Policy[];
  investmentPolicies: Policy[];
  estatePolicies: Policy[];
  totalLifeCover: number;
  totalDisability: number;
  totalSevereIllness: number;
  totalIncomeProtection: number;
  totalRiskPremium: number;
  totalMedicalPremium: number;
  retirementCurrentValue: number;
  totalRetirementPremium: number;
  investmentCurrentValue: number;
  totalInvestmentPremium: number;
  grossMonthly: number;
  retirementSavingsRate: number;
  dependants: unknown[];
  taxNumber?: string | null;
  /** Pillar icons threaded in from the component (keeps this module React-free). */
  icons: {
    risk: ElementType;
    medical: ElementType;
    retirement: ElementType;
    investment: ElementType;
    estate: ElementType;
  };
}

/**
 * Build the five financial-pillar cards (Risk / Medical / Retirement / Investment
 * / Estate) from published-FNA results, policy totals and the gap analysis. Pure:
 * lifted verbatim from ClientOverviewTab's `pillars` useMemo. Icons are passed in
 * as data so this module stays free of React/lucide runtime imports.
 */
export function derivePillars(inputs: PillarsInputs): PillarData[] {
  const {
    gapAnalysis,
    fnaStatuses,
    fnaResultsMap,
    riskFnaPublished,
    medicalFnaPublished,
    retirementFnaPublished,
    riskPolicies,
    medicalPolicies,
    retirementPolicies,
    investmentPolicies,
    estatePolicies,
    totalLifeCover,
    totalDisability,
    totalSevereIllness,
    totalIncomeProtection,
    totalRiskPremium,
    totalMedicalPremium,
    retirementCurrentValue,
    totalRetirementPremium,
    investmentCurrentValue,
    totalInvestmentPremium,
    grossMonthly,
    retirementSavingsRate,
    dependants,
    taxNumber,
    icons,
  } = inputs;

  // ── Extract FNA recommendations for comparison ─────────────────────
  const riskNeeds = riskFnaPublished ? extractRiskFinalNeeds(fnaResultsMap.risk) : [];
  const lifeNeed = riskNeeds.find((n) => n.riskType === 'life');
  const disabilityNeed = riskNeeds.find((n) => n.riskType === 'disability');
  const severeNeed = riskNeeds.find((n) => n.riskType === 'severeIllness');
  const ipTempNeed = riskNeeds.find((n) => n.riskType === 'incomeProtectionTemporary');
  const ipPermNeed = riskNeeds.find((n) => n.riskType === 'incomeProtectionPermanent');
  const totalIpNeed = (ipTempNeed?.grossNeed || 0) + (ipPermNeed?.grossNeed || 0);
  const totalIpExisting =
    (ipTempNeed?.existingCoverTotal || 0) + (ipPermNeed?.existingCoverTotal || 0);

  const riskFnaItem = fnaStatuses.find((f) => f.key === 'risk');
  const medFnaItem = fnaStatuses.find((f) => f.key === 'medical');
  const retFnaItem = fnaStatuses.find((f) => f.key === 'retirement');
  const invFnaItem = fnaStatuses.find((f) => f.key === 'investment');
  const estateFnaItem = fnaStatuses.find((f) => f.key === 'estate');

  // ── Medical FNA data ──────────────────────────────────────────────
  const medRaw = fnaResultsMap.medical;
  const medResults = medRaw?.results as Record<string, unknown> | undefined;
  const medFinalNeeds = medRaw?.finalNeeds as Record<string, unknown> | undefined;
  const msaRecommended = medResults?.msaRecommended || medFinalNeeds?.msa;
  const hospitalRate = (medResults?.recommendedInHospitalCover as string) || undefined;

  // Policy-level medical data (resolved via keyId → schema field ID mapping)
  const medPlanName =
    medicalPolicies.length > 0
      ? strVal(medicalPolicies[0], 'medical_aid_plan_type') || medicalPolicies[0].providerName
      : undefined;
  const medHospitalTariff =
    medicalPolicies.length > 0
      ? strVal(medicalPolicies[0], 'medical_aid_hospital_tariff') || undefined
      : undefined;
  const medHasMSA =
    medicalPolicies.length > 0 ? numVal(medicalPolicies[0], 'medical_aid_msa') > 0 : false;

  // ── Retirement FNA data ───────────────────────────────────────────
  const retResults = retirementFnaPublished
    ? extractRetirementResults(fnaResultsMap.retirement)
    : null;

  // ── Risk gap health (from gap analysis or policy fallback) ────────
  const riskGapStatuses = gapAnalysis
    .filter((g) =>
      ['Life Cover', 'Disability Cover', 'Severe Illness Cover', 'Income Protection'].includes(
        g.label,
      ),
    )
    .map((g) => g.status);
  const riskHealth: PillarHealth =
    riskGapStatuses.length > 0
      ? worstGapStatus(riskGapStatuses)
      : riskPolicies.length > 0
        ? 'healthy'
        : 'no-data';

  // ── 1. Risk Planning ──────────────────────────────────────────────
  const riskPillar: PillarData = {
    id: 'risk-planning',
    title: 'Risk',
    icon: icons.risk,
    health: riskHealth,
    fnaStatus: riskFnaItem?.loading ? 'loading' : riskFnaItem?.status,
    primaryValue:
      riskPolicies.length > 0
        ? `${riskPolicies.length} ${riskPolicies.length === 1 ? 'Policy' : 'Policies'}`
        : 'No Policies',
    primaryLabel:
      totalRiskPremium > 0 ? `${fmt(totalRiskPremium)}/m total premium` : 'No risk cover in place',
    metrics: [
      {
        label: 'Life Cover',
        value: totalLifeCover > 0 ? fmtCompact(totalLifeCover) : 'None',
        recommended: lifeNeed ? fmtCompact(lifeNeed.grossNeed) : undefined,
        highlight: lifeNeed ? lifeNeed.netShortfall > 0 : totalLifeCover === 0,
      },
      {
        label: 'Disability',
        value: totalDisability > 0 ? fmtCompact(totalDisability) : 'None',
        recommended: disabilityNeed ? fmtCompact(disabilityNeed.grossNeed) : undefined,
        highlight: disabilityNeed ? disabilityNeed.netShortfall > 0 : totalDisability === 0,
      },
      {
        label: 'Severe Illness',
        value: totalSevereIllness > 0 ? fmtCompact(totalSevereIllness) : 'None',
        recommended: severeNeed ? fmtCompact(severeNeed.grossNeed) : undefined,
        highlight: severeNeed ? severeNeed.netShortfall > 0 : false,
      },
      {
        label: 'Income Protection',
        value:
          totalIncomeProtection > 0
            ? fmtCompact(totalIncomeProtection)
            : totalIpExisting > 0
              ? fmtCompact(totalIpExisting)
              : 'None',
        recommended: totalIpNeed > 0 ? fmtCompact(totalIpNeed) : undefined,
        highlight: totalIpNeed > 0 && totalIpExisting < totalIpNeed,
      },
    ],
    policyCount: riskPolicies.length,
    monthlyPremium: totalRiskPremium,
  };

  // ── 2. Medical Aid ────────────────────────────────────────────────
  const medGapStatus = gapAnalysis.find((g) => g.label === 'Medical Aid')?.status || 'none';
  const medHealth: PillarHealth =
    medGapStatus === 'good'
      ? 'healthy'
      : medGapStatus === 'gap'
        ? 'critical'
        : medicalPolicies.length > 0
          ? 'healthy'
          : 'no-data';

  const medicalPillar: PillarData = {
    id: 'medical-aid',
    title: 'Medical Aid',
    icon: icons.medical,
    health: medHealth,
    fnaStatus: medFnaItem?.loading ? 'loading' : medFnaItem?.status,
    primaryValue:
      medPlanName || (medicalPolicies.length > 0 ? medicalPolicies[0].providerName : 'No Cover'),
    primaryLabel:
      totalMedicalPremium > 0
        ? `${fmt(totalMedicalPremium)}/m premium`
        : 'No medical aid on record',
    metrics: [
      {
        label: 'Hospital Rate',
        value: medHospitalTariff || (medicalPolicies.length > 0 ? 'On plan' : 'N/A'),
        recommended: hospitalRate ? `${hospitalRate} (FNA)` : undefined,
      },
      {
        label: 'MSA',
        value: medicalPolicies.length > 0 ? (medHasMSA ? 'Yes' : 'No') : 'N/A',
        recommended: medicalFnaPublished
          ? msaRecommended
            ? 'Recommended'
            : 'Not required'
          : undefined,
        highlight: medicalFnaPublished && !!msaRecommended && !medHasMSA,
      },
      {
        label: 'Dependants',
        value: `${dependants.length}`,
      },
    ],
    policyCount: medicalPolicies.length,
    monthlyPremium: totalMedicalPremium,
  };

  // ── 3. Retirement Annuity ─────────────────────────────────────────
  const retGapStatus = gapAnalysis.find((g) => g.label === 'Retirement Savings')?.status || 'none';
  const retHealth: PillarHealth =
    retGapStatus === 'good'
      ? 'healthy'
      : retGapStatus === 'caution'
        ? 'attention'
        : retGapStatus === 'gap'
          ? 'critical'
          : retirementPolicies.length > 0
            ? 'healthy'
            : 'no-data';

  const retirementPillar: PillarData = {
    id: 'retirement',
    title: 'Retirement',
    icon: icons.retirement,
    health: retHealth,
    fnaStatus: retFnaItem?.loading ? 'loading' : retFnaItem?.status,
    primaryValue: fmtCompact(retirementCurrentValue),
    primaryLabel: 'Current Fund Value',
    metrics: [
      {
        label: 'Monthly Contrib.',
        value: totalRetirementPremium > 0 ? `${fmtCompact(totalRetirementPremium)}/m` : 'None',
        recommended: retResults
          ? `${fmtCompact(retResults.totalRecommendedContribution)}/m`
          : undefined,
        highlight: retResults ? retResults.hasShortfall : false,
      },
      {
        label: 'Savings Rate',
        value: grossMonthly > 0 ? pct(retirementSavingsRate) : '—',
        recommended:
          retResults && grossMonthly > 0
            ? `${retResults.percentageOfIncome.toFixed(1)}%`
            : undefined,
        highlight: grossMonthly > 0 && retirementSavingsRate < 15,
      },
      {
        label: 'Projected Capital',
        value: retResults ? fmtCompact(retResults.projectedCapital) : '—',
        recommended: retResults ? fmtCompact(retResults.requiredCapital) : undefined,
        highlight: retResults ? retResults.hasShortfall : false,
      },
    ],
    policyCount: retirementPolicies.length,
    monthlyPremium: totalRetirementPremium,
  };

  // ── 4. Investment Planning ─────────────────────────────────────────
  const investmentPillar: PillarData = {
    id: 'investment',
    title: 'Investments',
    icon: icons.investment,
    health: investmentPolicies.length > 0 ? 'healthy' : 'no-data',
    fnaStatus: invFnaItem?.loading ? 'loading' : invFnaItem?.status,
    primaryValue: fmtCompact(investmentCurrentValue),
    primaryLabel: 'Current Portfolio Value',
    metrics: [
      {
        label: 'Monthly Contrib.',
        value: totalInvestmentPremium > 0 ? `${fmtCompact(totalInvestmentPremium)}/m` : 'None',
      },
      {
        label: 'Policies',
        value: `${investmentPolicies.length}`,
      },
    ],
    policyCount: investmentPolicies.length,
    monthlyPremium: totalInvestmentPremium,
  };

  // ── 5. Estate Planning ────────────────────────────────────────────
  const estateGapStatus = gapAnalysis.find((g) => g.label === 'Estate Planning')?.status || 'none';
  const estateHealth: PillarHealth =
    estateGapStatus === 'good'
      ? 'healthy'
      : estateGapStatus === 'caution'
        ? 'attention'
        : estateGapStatus === 'gap'
          ? 'critical'
          : estatePolicies.length > 0
            ? 'healthy'
            : 'no-data';

  const estatePillar: PillarData = {
    id: 'estate',
    title: 'Estate',
    icon: icons.estate,
    health: estateHealth,
    fnaStatus: estateFnaItem?.loading ? 'loading' : estateFnaItem?.status,
    primaryValue: estatePolicies.length > 0 ? 'In Place' : 'Not Set Up',
    primaryLabel: 'Planning Status',
    metrics: [
      {
        label: 'Will / Executor',
        value:
          estateFnaItem?.status === 'published'
            ? 'Reviewed'
            : estateFnaItem?.status === 'draft'
              ? 'In Progress'
              : 'Not Started',
        highlight: estateFnaItem?.status !== 'published',
      },
      {
        label: 'Tax Number',
        value: taxNumber ? 'On File' : 'Missing',
        highlight: !taxNumber,
      },
    ],
    policyCount: estatePolicies.length,
    monthlyPremium: 0,
  };

  return [riskPillar, medicalPillar, retirementPillar, investmentPillar, estatePillar];
}

// ── Financial-health score derivation ────────────────────────────────────

export interface HealthScoreInputs {
  gapAnalysis: GapItem[];
  fnaStatuses: ReadonlyArray<{ loading?: boolean; status?: string }>;
  grossMonthly: number;
  profile:
    | {
        taxNumber?: unknown;
        emergencyContactName?: unknown;
        familyMembers?: unknown[];
        assets?: unknown[];
        liabilities?: unknown[];
      }
    | null
    | undefined;
  retirementFnaPublished: boolean;
  retirementFnaResult: Record<string, unknown> | null;
  netWorth: number;
}

/**
 * Derive the 0–100 financial-health score from gap analysis, FNA completeness,
 * profile completeness, retirement shortfall and net worth. Pure: same inputs
 * -> same number. Lifted verbatim from ClientOverviewTab's healthScore useMemo
 * so the weighted scoring can be unit-tested.
 */
export function deriveHealthScore(inputs: HealthScoreInputs): number {
  const {
    gapAnalysis,
    fnaStatuses,
    grossMonthly,
    profile: p,
    retirementFnaPublished,
    retirementFnaResult,
    netWorth,
  } = inputs;

  let score = 0;
  let maxScore = 0;

  // Coverage health (30 points) — only scored when FNA-driven gaps exist
  if (gapAnalysis.length > 0) {
    gapAnalysis.forEach((gap) => {
      const weight = 30 / gapAnalysis.length;
      maxScore += weight;
      if (gap.status === 'good') score += weight;
      else if (gap.status === 'caution') score += weight * 0.5;
      // 'gap' and 'none' contribute 0
    });
  }

  // FNA completeness (25 points)
  fnaStatuses.forEach((fna) => {
    if (fna.loading) return;
    const weight = 25 / fnaStatuses.length;
    maxScore += weight;
    if (fna.status === 'published') score += weight;
    else if (fna.status === 'draft') score += weight * 0.3;
  });

  // Profile completeness (20 points)
  const profileChecks = [
    !!grossMonthly,
    !!p?.taxNumber,
    !!p?.emergencyContactName,
    (p?.familyMembers || []).length > 0,
    (p?.assets || []).length > 0 || (p?.liabilities || []).length > 0,
  ];
  profileChecks.forEach((check) => {
    const weight = 20 / profileChecks.length;
    maxScore += weight;
    if (check) score += weight;
  });

  // Savings rate (15 points) — only scored when Retirement FNA is published
  if (retirementFnaPublished) {
    const retResults = extractRetirementResults(retirementFnaResult);
    maxScore += 15;
    if (retResults) {
      if (!retResults.hasShortfall) score += 15;
      else if (retResults.capitalShortfall < retResults.requiredCapital * 0.3) score += 10;
      else if (retResults.capitalShortfall < retResults.requiredCapital * 0.6) score += 5;
    }
  }

  // Net worth positive (10 points)
  maxScore += 10;
  if (netWorth > 0) score += 10;
  else if (netWorth === 0) score += 5;

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// ── KPI summary derivation ───────────────────────────────────────────────

export interface KpiValuesInputs {
  profile:
    | {
        assets?: Array<{ type?: string; value?: number }>;
        liabilities?: unknown[];
      }
    | null
    | undefined;
  grossMonthly: number;
  netMonthly: number;
  totalMonthlyDebt: number;
  totalRetirementPremium: number;
  totalInvestmentPremium: number;
  riskFnaPublished: boolean;
  riskFnaResult: Record<string, unknown> | null;
  retResults: RetirementFnaResults | null;
  retirementSavingsRate: number;
  netWorth: number;
}

/**
 * Derive the six headline KPI cards (net worth, DTI, savings rate, emergency
 * fund, insurance coverage, retirement progress) from the client's financials
 * and published-FNA results. Pure: same inputs -> same KPIValue[]. Lifted
 * verbatim from ClientOverviewTab's kpiValues useMemo; the per-metric maths and
 * status thresholds live in the already-extracted calc helpers (../utils).
 */
export function deriveKpiValues(inputs: KpiValuesInputs): KPIValue[] {
  const {
    profile: p,
    grossMonthly,
    netMonthly,
    totalMonthlyDebt,
    totalRetirementPremium,
    totalInvestmentPremium,
    riskFnaPublished,
    riskFnaResult,
    retResults,
    retirementSavingsRate,
    netWorth,
  } = inputs;

  const hasBalanceSheet = (p?.assets || []).length > 0 || (p?.liabilities || []).length > 0;

  // DTI
  const dti = calcDTI(totalMonthlyDebt, grossMonthly);
  const dtiStatus = deriveDTIStatus(dti);

  // Emergency Fund — estimate monthly expenses as net income minus savings contributions
  const estMonthlyExpenses =
    netMonthly > 0
      ? netMonthly - totalRetirementPremium - totalInvestmentPremium
      : grossMonthly * 0.7; // Rough fallback: 70% of gross
  const emergencyMonths = calcEmergencyFundMonths(p?.assets || [], estMonthlyExpenses);
  const emergencyStatus = deriveEmergencyFundStatus(emergencyMonths);

  // Insurance coverage (from Risk FNA gap analysis — life cover)
  const riskNeeds = riskFnaPublished ? extractRiskFinalNeeds(riskFnaResult) : [];
  const lifeNeed = riskNeeds.find((n) => n.riskType === 'life');
  const insuranceRatio = lifeNeed
    ? calcInsuranceCoverageRatio(lifeNeed.existingCoverTotal, lifeNeed.grossNeed)
    : null;
  const insuranceStatus = deriveInsuranceCoverageStatus(insuranceRatio);

  // Retirement progress
  const retProgress = retResults
    ? calcRetirementProgress(retResults.projectedCapital, retResults.requiredCapital)
    : null;
  const retStatus = deriveRetirementProgressStatus(retProgress);

  // Savings rate
  const savingsStatus =
    grossMonthly > 0 ? deriveSavingsRateStatus(retirementSavingsRate) : ('no-data' as const);

  // Net worth
  const nwStatus = deriveNetWorthStatus(netWorth, hasBalanceSheet);

  return [
    {
      id: 'net_worth',
      displayValue: fmt(netWorth),
      rawValue: netWorth,
      status: nwStatus,
      detail:
        netWorth > 0
          ? 'In the green'
          : netWorth === 0
            ? 'Breaking even'
            : 'Owes more than they own',
    },
    {
      id: 'dti',
      displayValue: dti !== null ? `${dti.toFixed(1)}%` : '—',
      rawValue: dti,
      status: dtiStatus,
      detail:
        dti !== null
          ? dti < 36
            ? 'Comfortable range'
            : dti <= 50
              ? 'Getting stretched'
              : 'Under pressure'
          : undefined,
    },
    {
      id: 'savings_rate',
      displayValue: grossMonthly > 0 ? `${retirementSavingsRate.toFixed(1)}%` : '—',
      rawValue: retirementSavingsRate,
      status: savingsStatus,
      detail:
        grossMonthly > 0
          ? retirementSavingsRate >= 15
            ? 'Hitting the target'
            : 'Could save more'
          : undefined,
    },
    {
      id: 'emergency_fund',
      displayValue: emergencyMonths !== null ? `${emergencyMonths.toFixed(1)} months` : '—',
      rawValue: emergencyMonths,
      status: emergencyStatus,
      detail:
        emergencyMonths !== null
          ? emergencyMonths >= 6
            ? 'Well prepared'
            : emergencyMonths >= 3
              ? 'Getting there'
              : 'Needs building up'
          : undefined,
    },
    {
      id: 'insurance_coverage',
      displayValue: insuranceRatio !== null ? `${insuranceRatio.toFixed(0)}%` : '—',
      rawValue: insuranceRatio,
      status: insuranceStatus,
      detail:
        insuranceRatio !== null
          ? insuranceRatio >= 100
            ? 'Fully covered'
            : `${(100 - insuranceRatio).toFixed(0)}% gap to close`
          : riskFnaPublished
            ? 'No life cover need identified'
            : 'Needs a Risk FNA first',
    },
    {
      id: 'retirement_progress',
      displayValue: retProgress !== null ? `${retProgress.toFixed(0)}%` : '—',
      rawValue: retProgress,
      status: retStatus,
      detail:
        retProgress !== null
          ? retProgress >= 90
            ? 'Looking good'
            : `${fmt(retResults?.capitalShortfall)} still needed`
          : 'Needs a Retirement FNA first',
    },
  ];
}

// -- Action-centre derivation --

/** Priority-ordered action item (mode-aware: adviser vs client language) */
export type ActionPriority = 'urgent' | 'attention' | 'recommended';

export interface ActionItem {
  id: string;
  priority: ActionPriority;
  category: 'fna' | 'coverage' | 'renewal' | 'profile' | 'compliance';
  title: string;
  detail?: string;
  icon: ElementType;
}

const INCEPTION_FIELD_IDS = [
  // keyIds (keyManagerConstants.ts)
  'risk_date_of_inception',
  'medical_aid_date_of_inception',
  'retirement_date_of_inception',
  'post_retirement_date_of_inception',
  'invest_date_of_inception',
  'invest_guaranteed_date_of_inception',
  'eb_date_of_inception',
  'eb_risk_date_of_inception',
  'eb_retirement_date_of_inception',
  'estate_date_of_inception',
  // Schema field IDs (default-schemas.ts)
  'rp_inception',
  'ma_inception',
  'ret_inception',
  'ret_pre_inception',
  'ret_post_inception',
  'inv_inception',
  'inv_vol_inception',
  'inv_gua_inception',
  'eb_inception',
  'eb_risk_inception',
  'eb_ret_inception',
  'est_inception',
];

/** Renewal warning window in days */
const RENEWAL_WINDOW_DAYS = 90;

export interface ActionItemIcons {
  ClipboardCheck: ElementType;
  PlayCircle: ElementType;
  Clock: ElementType;
  FileText: ElementType;
  Shield: ElementType;
  AlertTriangle: ElementType;
  Calendar: ElementType;
  DollarSign: ElementType;
  Phone: ElementType;
  Users: ElementType;
  Scale: ElementType;
}

export interface ActionItemsInputs {
  fnaStatuses: ReadonlyArray<{
    loading?: boolean;
    nextReviewDue?: string | null;
    key: string;
    name: string;
    status?: string;
  }>;
  gapAnalysis: GapItem[];
  allPolicies: Policy[];
  grossMonthly: number;
  profile:
    | {
        emergencyContactName?: unknown;
        taxNumber?: unknown;
        familyMembers?: unknown[];
        assets?: unknown[];
        liabilities?: unknown[];
      }
    | null
    | undefined;
  dependants: ReadonlyArray<unknown>;
  isClient: boolean;
  icons: ActionItemIcons;
}

/**
 * Derive the priority-ordered action centre (FNA prompts, coverage gaps, policy
 * renewals, profile/compliance nudges) for adviser or client mode. Pure: same
 * inputs -> same ActionItem[]. Lifted verbatim from ClientOverviewTab; lucide
 * icons are threaded in as data so this stays runtime-React-free.
 */
export function deriveActionItems(inputs: ActionItemsInputs): ActionItem[] {
  const {
    fnaStatuses,
    gapAnalysis,
    allPolicies,
    grossMonthly,
    profile: p,
    dependants,
    isClient,
    icons,
  } = inputs;
  const {
    ClipboardCheck,
    PlayCircle,
    Clock,
    FileText,
    Shield,
    AlertTriangle,
    Calendar,
    DollarSign,
    Phone,
    Users,
    Scale,
  } = icons;
  const items: ActionItem[] = [];

  // --- FNA-derived items ---
  fnaStatuses.forEach((fna) => {
    if (fna.loading) return;

    if (fna.nextReviewDue && isPast(fna.nextReviewDue)) {
      items.push({
        id: `fna-overdue-${fna.key}`,
        priority: 'urgent',
        category: 'fna',
        title: isClient
          ? fna.status === 'published'
            ? `Time to refresh your ${fna.name}`
            : `Your ${fna.name} is overdue for a check-up`
          : `${fna.name} — review overdue`,
        detail: isClient
          ? fna.status === 'published'
            ? `Your last review was due ${fmtDate(fna.nextReviewDue)}. Update your facts and resubmit so your adviser can republish.`
            : `This was due for review on ${fmtDate(fna.nextReviewDue)}. Get in touch with your adviser to book a fresh one.`
          : `Was due ${fmtDate(fna.nextReviewDue)}. Book a new review to make sure the recommendations still hold.`,
        icon: ClipboardCheck,
      });
    }

    if (fna.status === 'client_draft') {
      items.push({
        id: `fna-client-draft-${fna.key}`,
        priority: 'attention',
        category: 'fna',
        title: isClient ? `Continue your ${fna.name}` : `${fna.name} — client draft in progress`,
        detail: isClient
          ? 'You started this discovery — pick up where you left off and submit when ready.'
          : 'Client has started intake but not submitted yet.',
        icon: PlayCircle,
      });
    }

    if (fna.status === 'submitted') {
      items.push({
        id: `fna-submitted-${fna.key}`,
        priority: isClient ? 'recommended' : 'attention',
        category: 'fna',
        title: isClient
          ? `${fna.name} is with your adviser`
          : `${fna.name} — intake in review queue`,
        detail: isClient
          ? 'Submitted for review — not advice until your adviser publishes the formal analysis.'
          : 'Client submitted intake. Accept from the intake queue to continue at Step 2.',
        icon: Clock,
      });
    }

    if (fna.status === 'draft') {
      items.push({
        id: `fna-draft-${fna.key}`,
        priority: 'attention',
        category: 'fna',
        title: isClient ? `Your ${fna.name} is being worked on` : `${fna.name} — draft in progress`,
        detail: isClient
          ? "Your adviser is putting this together. You'll be able to see it once it's ready."
          : 'Finish this up and publish it so the client can see the results.',
        icon: FileText,
      });
    }

    if (fna.status === 'not_started') {
      items.push({
        id: `fna-missing-${fna.key}`,
        priority: 'recommended',
        category: 'fna',
        title: isClient ? `Start your ${fna.name}` : `Start a ${fna.name}`,
        detail: isClient
          ? 'You prepare. We analyse. Together we plan — begin your financial discovery here.'
          : 'No review on file. Worth kicking one off at the next meeting.',
        icon: ClipboardCheck,
      });
    }
  });

  // --- Coverage gap items (friendly, natural language) ---
  gapAnalysis.forEach((gap) => {
    if (gap.status === 'gap') {
      const isCritical = ['Life Cover', 'Disability Cover', 'Income Protection'].includes(
        gap.label,
      );
      items.push({
        id: `gap-${gap.label.toLowerCase().replace(/\s+/g, '-')}`,
        priority: isCritical ? 'urgent' : 'attention',
        category: 'coverage',
        title: isClient
          ? `Your ${gap.label.toLowerCase()} needs topping up`
          : `${gap.label} — falling short`,
        detail: isClient
          ? `Right now you have ${gap.current} in ${gap.label.toLowerCase()}. A bit more cover would go a long way toward protecting you and your family.`
          : `Sitting at ${gap.current} against a recommendation of ${gap.recommended}. Flag this at the next review.`,
        icon: Shield,
      });
    } else if (gap.status === 'caution') {
      items.push({
        id: `gap-caution-${gap.label.toLowerCase().replace(/\s+/g, '-')}`,
        priority: 'attention',
        category: 'coverage',
        title: isClient ? `${gap.label} — almost there` : `${gap.label} — nearly on target`,
        detail: isClient
          ? `Your ${gap.label.toLowerCase()} is close to where it should be. A small tweak could get it just right.`
          : `At ${gap.current}. ${gap.detail || 'Just under the recommendation — probably fine, but worth a quick check next time.'}`,
        icon: AlertTriangle,
      });
    }
  });

  // --- Policy renewal items ---
  allPolicies.forEach((pol) => {
    let inceptionDateStr: string | null = null;
    for (const fieldId of INCEPTION_FIELD_IDS) {
      const val = pol.data?.[fieldId];
      if (val && typeof val === 'string') {
        const dt = new Date(val);
        if (!isNaN(dt.getTime())) {
          inceptionDateStr = val;
          break;
        }
      }
    }

    if (!inceptionDateStr) {
      for (const [key, val] of Object.entries(pol.data || {})) {
        if (key.toLowerCase().includes('inception') && typeof val === 'string') {
          const dt = new Date(val);
          if (!isNaN(dt.getTime())) {
            inceptionDateStr = val;
            break;
          }
        }
      }
    }

    if (inceptionDateStr) {
      const anniversary = nextAnniversary(inceptionDateStr);
      if (anniversary) {
        const daysUntil = daysBetween(new Date(), anniversary);
        if (daysUntil >= 0 && daysUntil <= RENEWAL_WINDOW_DAYS) {
          items.push({
            id: `renewal-${pol.id}`,
            priority: daysUntil <= 14 ? 'urgent' : 'attention',
            category: 'renewal',
            title: isClient
              ? `Your ${pol.providerName} policy is up for renewal soon`
              : `${pol.providerName} — renewal coming up`,
            detail: isClient
              ? `Renews on ${fmtDate(anniversary.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} days away`}). Your adviser might get in touch to go over it.`
              : `Due ${fmtDate(anniversary.toISOString())} (${daysUntil === 0 ? 'today' : `${daysUntil} days away`}). Good time to check the terms and premiums.`,
            icon: Calendar,
          });
        }
      }
    }
  });

  // --- Profile completeness items ---
  if (grossMonthly === 0) {
    items.push({
      id: 'profile-income-missing',
      priority: 'attention',
      category: 'profile',
      title: isClient ? 'We need your income details' : 'Income info is missing',
      detail: isClient
        ? 'Knowing your income lets us give you much more accurate recommendations and savings targets.'
        : "Can't calculate savings rates, gap analysis, or run FNAs properly without income on file.",
      icon: DollarSign,
    });
  }

  if (!p?.emergencyContactName) {
    items.push({
      id: 'profile-emergency-contact',
      priority: 'recommended',
      category: 'profile',
      title: isClient ? 'Add an emergency contact' : 'No emergency contact on file',
      detail: isClient
        ? 'Having someone we can reach in an emergency gives you extra peace of mind.'
        : 'Pop an emergency contact into Personal Details — good practice and covers duty of care.',
      icon: Phone,
    });
  }

  if (!p?.taxNumber) {
    items.push({
      id: 'profile-tax-number',
      priority: 'recommended',
      category: 'profile',
      title: isClient ? 'Add your tax reference number' : 'Tax number is missing',
      detail: isClient
        ? 'We need this for tax planning and to keep everything above board with SARS.'
        : 'Needed for tax planning and SARS compliance. Ask the client for it at the next touchpoint.',
      icon: FileText,
    });
  }

  if ((p?.familyMembers || []).length === 0 && dependants.length === 0) {
    items.push({
      id: 'profile-dependants',
      priority: 'recommended',
      category: 'profile',
      title: isClient ? 'Tell us about your family' : 'No family or dependants on record',
      detail: isClient
        ? 'Adding your family helps your adviser work out the right life cover and estate plan for you.'
        : "Can't size life cover, income protection, or estate plans without knowing the family picture.",
      icon: Users,
    });
  }

  // --- Compliance items (adviser-only) ---
  if (!isClient && (p?.assets || []).length === 0 && (p?.liabilities || []).length === 0) {
    items.push({
      id: 'compliance-balance-sheet',
      priority: 'recommended',
      category: 'compliance',
      title: 'No balance sheet on file',
      detail:
        'Worth capturing assets and liabilities — makes net worth tracking and financial planning much stronger.',
      icon: Scale,
    });
  }

  // Sort: urgent first, then attention, then recommended
  const priorityOrder: Record<ActionPriority, number> = {
    urgent: 0,
    attention: 1,
    recommended: 2,
  };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}
