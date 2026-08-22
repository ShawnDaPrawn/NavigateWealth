/**
 * Pillar cards: one health summary per advice pillar.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import type { ElementType } from 'react';
import { extractRetirementResults, extractRiskFinalNeeds } from './fnaExtract';
import { fmt, fmtCompact, pct } from './format';
import type { GapItem } from './gapAnalysis';
import { type PillarHealth, type Policy, numVal, strVal, worstGapStatus } from './policyFields';

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
