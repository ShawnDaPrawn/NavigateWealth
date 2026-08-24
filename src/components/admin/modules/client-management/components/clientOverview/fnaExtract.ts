/**
 * Reading published-FNA payloads into typed shapes.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */

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
