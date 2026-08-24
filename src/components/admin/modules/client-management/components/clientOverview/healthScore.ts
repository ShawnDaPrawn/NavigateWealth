/**
 * The single financial-health score shown at the top of the overview.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import { extractRetirementResults } from './fnaExtract';
import type { GapItem } from './gapAnalysis';

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
