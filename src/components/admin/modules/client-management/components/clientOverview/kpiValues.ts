/**
 * The KPI summary table rows.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import type { KPIValue } from '../overview/KPISummaryTable';
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
} from '../../utils';
import { type RetirementFnaResults, extractRiskFinalNeeds } from './fnaExtract';
import { fmt } from './format';

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
