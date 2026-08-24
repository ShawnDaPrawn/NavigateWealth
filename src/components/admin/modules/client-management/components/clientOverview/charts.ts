/**
 * Chart-data derivations: asset allocation, insurance coverage, cashflow.
 *
 * Split out of `clientOverviewUtils.ts` (1,650 lines), itself an earlier
 * extraction from `ClientOverviewTab.tsx`. Pure functions — no React, no
 * hooks, no I/O.
 */
import type {
  AssetAllocationData,
  InsuranceCoverageItem,
  CashflowWaterfallData,
} from '../overview/OverviewCharts';
import { extractRiskFinalNeeds } from './fnaExtract';

// ── Chart-data derivations ───────────────────────────────────────────────

export interface AssetAllocationInputs {
  profile:
    | { assets?: Array<{ type?: string; value?: number; description?: string }> }
    | null
    | undefined;
  retirementCurrentValue: number;
  investmentCurrentValue: number;
}

/** Build the asset-allocation chart payload from the profile balance sheet. */
export function deriveAssetAllocation(inputs: AssetAllocationInputs): AssetAllocationData {
  const { profile: p, retirementCurrentValue, investmentCurrentValue } = inputs;
  return {
    assets: (p?.assets || []).map((a) => ({
      type: a.type,
      value: Number(a.value) || 0,
      description: a.description,
    })),
    retirementValue: retirementCurrentValue,
    investmentValue: investmentCurrentValue,
  };
}

export interface InsuranceCoverageInputs {
  riskFnaPublished: boolean;
  riskFnaResult: Record<string, unknown> | null;
}

/** Map published Risk-FNA needs into existing-vs-recommended coverage bars. */
export function deriveInsuranceCoverageItems(
  inputs: InsuranceCoverageInputs,
): InsuranceCoverageItem[] {
  const { riskFnaPublished, riskFnaResult } = inputs;
  if (!riskFnaPublished) return [];
  const riskNeeds = extractRiskFinalNeeds(riskFnaResult);
  return riskNeeds
    .filter((n) => n.grossNeed > 0 || n.existingCoverTotal > 0)
    .map((n) => ({
      riskType: n.riskType,
      label: n.label,
      existing: n.existingCoverTotal,
      recommended: n.grossNeed,
    }));
}

export interface CashflowInputs {
  grossMonthly: number;
  netMonthly: number;
  totalRiskPremium: number;
  totalMedicalPremium: number;
  totalRetirementPremium: number;
  totalInvestmentPremium: number;
  totalEmployeePremium: number;
  totalMonthlyDebt: number;
}

/** Build the monthly cash-flow waterfall payload (income -> premiums / debt). */
export function deriveCashflowData(inputs: CashflowInputs): CashflowWaterfallData {
  const {
    grossMonthly,
    netMonthly,
    totalRiskPremium,
    totalMedicalPremium,
    totalRetirementPremium,
    totalInvestmentPremium,
    totalEmployeePremium,
    totalMonthlyDebt,
  } = inputs;
  return {
    grossIncome: grossMonthly,
    netIncome: netMonthly > 0 ? netMonthly : grossMonthly * 0.72,
    riskPremiums: totalRiskPremium,
    medicalPremiums: totalMedicalPremium,
    retirementPremiums: totalRetirementPremium,
    investmentPremiums: totalInvestmentPremium,
    employeePremiums: totalEmployeePremium,
    debtPayments: totalMonthlyDebt,
  };
}

/** Count action items by priority bucket for the priority-distribution bar. */
