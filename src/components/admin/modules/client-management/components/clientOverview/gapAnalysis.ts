/**
 * Gap analysis: what cover a client has versus what the FNA says they need.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import { extractRetirementResults, extractRiskFinalNeeds } from './fnaExtract';
import { fmt } from './format';
import type { GapStatus, Policy } from './policyFields';

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
