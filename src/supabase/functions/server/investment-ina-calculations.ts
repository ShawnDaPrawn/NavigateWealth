/**
 * investment-ina-calculations.ts — INA goal-based investment math + domain types
 * (Phase 7 max-lines split). The goal maths itself lives in the shared engine,
 * src/shared/fna-calculations/investment.ts; this file adds the KV-backed
 * pieces (versioning, auto-populate) and the logged entry point the routes use.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { nextVersion } from './fna-versioning.ts';
import {
  calculateINA,
  formatRands,
  type INAInputs,
  type INAResults,
} from '../../../shared/fna-calculations/investment.ts';

const log = createModuleLogger('investment-ina-calculations');

export type {
  INAGoalInput as INAGoal,
  INALumpSumInput as LumpSumEntry,
  INAInputs,
  INAFundingGap as FundingGap,
  INAGoalResult as GoalResult,
  INALinkedInvestmentResult as LinkedInvestmentResult,
  INALumpSumResult as LumpSumResult,
  INAResults,
} from '../../../shared/fna-calculations/investment.ts';
export { INACalculationError } from '../../../shared/fna-calculations/investment.ts';
export interface VersionedSession {
  version: number;
  status?: string;
  [key: string]: unknown;
}
export interface InvestmentEntry {
  id?: string;
  name?: string;
  productName?: string;
  provider?: string;
  currentValue?: string | number;
  contribution?: string | number;
  monthlyContribution?: string | number;
  expectedDrawdownDate?: string;
  riskCategory?: string;
  isDiscretionary?: boolean;
  [key: string]: unknown;
}
export interface DiscretionaryInvestment {
  id: string;
  productName: string;
  provider: string;
  currentValue: number;
  monthlyContribution: number;
  expectedDrawdownDate?: string;
  riskCategory: string;
  isDiscretionary: boolean;
}

export async function getNextVersionNumber(clientId: string): Promise<number> {
  const inas = await kv.getByPrefix(`investment-ina:client:${clientId}:`);
  // Highest stored version, not how many are stored — see fna-versioning.ts.
  return nextVersion(inas);
}

/**
 * Default economic assumptions
 */
export function getDefaultEconomicAssumptions() {
  return {
    longTermInflationRate: 0.06,
    expectedRealReturns: {
      conservative: 0.02,
      moderate: 0.035,
      balanced: 0.05,
      growth: 0.065,
      aggressive: 0.08,
    },
  };
}

/**
 * Auto-populate Investment INA inputs from client profile and existing investments
 */
export async function autoPopulateFromProfile(clientId: string) {
  try {
    log.info('📋 Auto-populating Investment INA for client:', { clientId });
    const { investmentAutoPopulateFromResolver } = await import('./form-prefill-auto-populate.ts');
    const step1 = await investmentAutoPopulateFromResolver(clientId);

    const policiesKey = `policies:${clientId}`;
    const policies = (await kv.get(policiesKey)) || { investments: [] };

    const discretionaryInvestments = (policies.investments || [])
      .filter((inv: InvestmentEntry) => inv.isDiscretionary === true)
      .map((inv: InvestmentEntry) => ({
        id: inv.id,
        productName: inv.name || inv.productName || 'Unnamed Investment',
        provider: inv.provider || '',
        currentValue: parseFloat(String(inv.currentValue)) || 0,
        monthlyContribution: parseFloat(String(inv.contribution || inv.monthlyContribution || 0)),
        expectedDrawdownDate: inv.expectedDrawdownDate,
        riskCategory: inv.riskCategory || 'balanced',
        isDiscretionary: true,
      }));

    const totalDiscretionaryCapitalCurrent = discretionaryInvestments.reduce(
      (sum: number, inv: DiscretionaryInvestment) => sum + inv.currentValue,
      0,
    );

    const totalDiscretionaryMonthlyContributions = discretionaryInvestments.reduce(
      (sum: number, inv: DiscretionaryInvestment) => sum + inv.monthlyContribution,
      0,
    );

    const economicAssumptions = getDefaultEconomicAssumptions();

    return {
      ...step1,
      longTermInflationRate: economicAssumptions.longTermInflationRate,
      expectedRealReturns: economicAssumptions.expectedRealReturns,
      discretionaryInvestments,
      totalDiscretionaryCapitalCurrent,
      totalDiscretionaryMonthlyContributions,
      goals: [],
    };
  } catch (error) {
    log.error('❌ Error auto-populating Investment INA:', error);
    return getDefaultInputs();
  }
}

export function getDefaultInputs() {
  const economicAssumptions = getDefaultEconomicAssumptions();
  return {
    currentAge: 0,
    dateOfBirth: '',
    householdDependants: 0,
    grossMonthlyIncome: 0,
    netMonthlyIncome: 0,
    clientRiskProfile: 'balanced',
    longTermInflationRate: economicAssumptions.longTermInflationRate,
    expectedRealReturns: economicAssumptions.expectedRealReturns,
    discretionaryInvestments: [],
    totalDiscretionaryCapitalCurrent: 0,
    totalDiscretionaryMonthlyContributions: 0,
    goals: [],
  };
}

/**
 * Calculate Investment INA results with the shared engine
 * (src/shared/fna-calculations/investment.ts). Throws INACalculationError
 * for inputs it cannot calculate; the route answers those with a 400.
 */
export function calculateInvestmentINA(inputs: INAInputs, now: Date = new Date()): INAResults {
  log.info('🧮 Calculating Investment INA...');
  return calculateINA(inputs, now);
}

/**
 * A whole-rand amount with comma thousands, without the "R" (callers add it):
 * 2000000 → "2,000,000". Formatted by hand because en-ZA gives spaces in Deno.
 */
export function formatCurrency(amount: number): string {
  return formatRands(amount);
}
