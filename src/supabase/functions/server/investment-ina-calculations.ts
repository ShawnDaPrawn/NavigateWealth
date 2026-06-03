/**
 * investment-ina-calculations.ts — INA goal-based investment math + domain types
 * (Phase 7 max-lines split). Extracted verbatim from investment-ina-routes.tsx;
 * the routes import the calc entrypoints from here.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('investment-ina-calculations');

export interface INAGoal {
  id: string;
  goalName: string;
  targetYear: number;
  goalAmountToday: number;
  useClientRiskProfile?: boolean;
  goalSpecificRiskProfile?: string;
  priorityLevel?: string;
  linkedInvestmentIds?: string[];
  currentContributionToGoal?: number;
  expectedLumpSums?: LumpSumEntry[];
  [key: string]: unknown;
}
export interface LumpSumEntry {
  id?: string;
  amount: number;
  expectedDate: string;
  [key: string]: unknown;
}
export interface INAInputs {
  goals: INAGoal[];
  clientRiskProfile: string;
  expectedRealReturns: Record<string, number>;
  longTermInflationRate: number;
  discretionaryInvestments: DiscretionaryInvestment[];
  [key: string]: unknown;
}
export interface FundingGap {
  goalRequiredReal: number;
  totalProjectedCapital: number;
  gapAmount: number;
  hasShortfall: boolean;
  fundingPercentage: number;
  gapPercentage: number;
}
export interface GoalResult {
  goalStatus: string;
  fundingGap: FundingGap;
  projectedCapital: { totalProjectedCapital: number; [key: string]: unknown };
  requiredContributions: { requiredAdditionalMonthly: number; [key: string]: unknown };
  [key: string]: unknown;
}
export interface LinkedInvestmentResult {
  investmentId: string;
  investmentName: string;
  currentValue: number;
  yearsToGoal: number;
  applicableRealReturn: number;
  futureValue: number;
}
export interface LumpSumResult {
  lumpSumId: string;
  lumpSumAmount: number;
  lumpSumDate: string;
  yearsFromLumpToGoal: number;
  applicableRealReturn: number;
  futureValue: number;
}
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
  return (inas?.length || 0) + 1;
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
 * Calculate Investment INA Results
 */
export function calculateInvestmentINA(inputs: INAInputs) {
  log.info('🧮 Calculating Investment INA...');

  const currentYear = new Date().getFullYear();
  const goalResults: GoalResult[] = [];
  const recommendations: Array<{
    goalId: string;
    goalName: string;
    action: string;
    priority: string | undefined;
    impact: string;
  }> = [];

  // Process each goal
  for (const goal of inputs.goals || []) {
    const result = calculateSingleGoal(goal, inputs, currentYear);
    goalResults.push(result);

    // Generate recommendations based on goal status
    if (result.fundingGap.hasShortfall) {
      recommendations.push({
        goalId: goal.id,
        goalName: goal.goalName,
        action: result.requiredContributions.canMeetGoal
          ? `Increase monthly contribution by R${formatCurrency(result.requiredContributions.requiredAdditionalMonthly)} to meet this goal`
          : `Goal may not be achievable with current time horizon. Consider extending timeline or increasing initial capital`,
        priority: goal.priorityLevel,
        impact: `This will help close the R${formatCurrency(result.fundingGap.gapAmount)} funding gap`,
      });
    }
  }

  // Calculate portfolio summary
  const portfolioSummary = calculatePortfolioSummary(goalResults);

  return {
    portfolioSummary,
    goalResults,
    recommendations,
    economicAssumptions: {
      inflationRate: inputs.longTermInflationRate,
      realReturnsByProfile: inputs.expectedRealReturns,
    },
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate results for a single goal
 */
export function calculateSingleGoal(goal: INAGoal, inputs: INAInputs, currentYear: number) {
  const yearsToGoal = goal.targetYear - currentYear;
  const isValidTimeHorizon = yearsToGoal > 0;

  // Determine applicable risk profile and real return
  const applicableRiskProfile = goal.useClientRiskProfile
    ? inputs.clientRiskProfile
    : goal.goalSpecificRiskProfile;
  const applicableRealReturn = inputs.expectedRealReturns[applicableRiskProfile];

  // Step 1: Calculate time horizon
  const timeHorizon = {
    targetYear: goal.targetYear,
    currentYear,
    yearsToGoal,
    isValidTimeHorizon,
    warningMessage: !isValidTimeHorizon
      ? 'Goal target date is in the past or current year'
      : undefined,
  };

  // Step 2: Project existing capital
  const existingCapital = calculateExistingCapital(goal, inputs, yearsToGoal, applicableRealReturn);

  // Step 3: Project monthly contributions
  const monthlyContributions = calculateMonthlyContributions(
    goal.currentContributionToGoal || 0,
    yearsToGoal,
    applicableRealReturn,
  );

  // Step 4: Project lump sums
  const lumpSums = calculateLumpSums(
    goal.expectedLumpSums || [],
    goal.targetYear,
    applicableRealReturn,
  );
  const totalLumpSumFutureValue = lumpSums.reduce((sum, ls) => sum + ls.futureValue, 0);

  // Step 5: Total projected capital
  const totalProjectedCapital =
    existingCapital.totalExistingFutureValue +
    monthlyContributions.futureValueOfContributions +
    totalLumpSumFutureValue;

  const projectedCapital = {
    existingCapital,
    monthlyContributions,
    lumpSums,
    totalLumpSumFutureValue,
    totalProjectedCapital,
  };

  // Step 6: Calculate funding gap
  const fundingGap = calculateFundingGap(goal.goalAmountToday, totalProjectedCapital);

  // Step 7: Calculate required contributions
  const requiredContributions = calculateRequiredContributions(
    fundingGap,
    goal.currentContributionToGoal || 0,
    yearsToGoal,
    applicableRealReturn,
  );

  // Determine goal status
  const goalStatus = determineGoalStatus(fundingGap.fundingPercentage);
  const statusRationale = generateStatusRationale(fundingGap, goalStatus);

  return {
    goalId: goal.id,
    goalName: goal.goalName,
    goalType: goal.goalType,
    goalStatus,
    statusRationale,
    timeHorizon,
    projectedCapital,
    fundingGap,
    requiredContributions,
    applicableRiskProfile,
    applicableRealReturn,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate existing capital projection
 */
export function calculateExistingCapital(
  goal: INAGoal,
  inputs: INAInputs,
  yearsToGoal: number,
  realReturn: number,
) {
  const linkedInvestments = (goal.linkedInvestmentIds || [])
    .map((invId: string) => {
      const investment = inputs.discretionaryInvestments.find(
        (inv: DiscretionaryInvestment) => inv.id === invId,
      );
      if (!investment) return null;

      const futureValue = investment.currentValue * Math.pow(1 + realReturn, yearsToGoal);

      return {
        investmentId: investment.id,
        investmentName: investment.productName,
        currentValue: investment.currentValue,
        yearsToGoal,
        applicableRealReturn: realReturn,
        futureValue,
      };
    })
    .filter((inv: LinkedInvestmentResult | null): inv is LinkedInvestmentResult => inv !== null);

  const totalExistingFutureValue = linkedInvestments.reduce(
    (sum: number, inv: LinkedInvestmentResult) => sum + inv.futureValue,
    0,
  );

  return {
    linkedInvestments,
    totalExistingFutureValue,
  };
}

/**
 * Calculate monthly contributions projection
 */
export function calculateMonthlyContributions(
  monthlyAmount: number,
  yearsToGoal: number,
  realReturn: number,
) {
  if (monthlyAmount === 0 || yearsToGoal <= 0) {
    return {
      monthlyContributionReal: 0,
      yearsToGoal,
      applicableRealReturn: realReturn,
      annuityFactor: 0,
      futureValueOfContributions: 0,
    };
  }

  // Future value of annuity formula: PMT * 12 * [((1 + r)^n - 1) / r]
  const annuityFactor = (Math.pow(1 + realReturn, yearsToGoal) - 1) / realReturn;
  const futureValueOfContributions = monthlyAmount * 12 * annuityFactor;

  return {
    monthlyContributionReal: monthlyAmount,
    yearsToGoal,
    applicableRealReturn: realReturn,
    annuityFactor,
    futureValueOfContributions,
  };
}

/**
 * Calculate lump sum projections
 */
export function calculateLumpSums(
  lumpSums: LumpSumEntry[],
  targetYear: number,
  realReturn: number,
): LumpSumResult[] {
  return lumpSums.map((ls: LumpSumEntry) => {
    const lumpSumYear = new Date(ls.expectedDate).getFullYear();
    const yearsFromLumpToGoal = targetYear - lumpSumYear;
    const futureValue = ls.amount * Math.pow(1 + realReturn, Math.max(0, yearsFromLumpToGoal));

    return {
      lumpSumId: ls.id,
      lumpSumAmount: ls.amount,
      lumpSumDate: ls.expectedDate,
      yearsFromLumpToGoal,
      applicableRealReturn: realReturn,
      futureValue,
    };
  });
}

/**
 * Calculate funding gap analysis
 */
export function calculateFundingGap(goalRequired: number, projectedCapital: number) {
  const gapAmount = goalRequired - projectedCapital;
  const hasShortfall = gapAmount > 0;
  const fundingPercentage = (projectedCapital / goalRequired) * 100;
  const gapPercentage = (gapAmount / goalRequired) * 100;

  return {
    goalRequiredReal: goalRequired,
    projectedCapitalAtGoal: projectedCapital,
    gapAmount,
    hasShortfall,
    fundingPercentage,
    gapPercentage,
  };
}

/**
 * Calculate required contributions to close funding gap
 */
export function calculateRequiredContributions(
  fundingGap: FundingGap,
  currentMonthly: number,
  yearsToGoal: number,
  realReturn: number,
) {
  if (!fundingGap.hasShortfall) {
    return {
      currentMonthlyContribution: currentMonthly,
      requiredAdditionalMonthly: 0,
      recommendedTotalMonthly: currentMonthly,
      alternativeLumpSumToday: 0,
      canMeetGoal: true,
    };
  }

  if (yearsToGoal <= 0) {
    return {
      currentMonthlyContribution: currentMonthly,
      requiredAdditionalMonthly: 0,
      recommendedTotalMonthly: currentMonthly,
      alternativeLumpSumToday: fundingGap.gapAmount,
      canMeetGoal: false,
    };
  }

  // Calculate required additional monthly contribution
  // Solve: gap = X * 12 * annuityFactor
  const annuityFactor = (Math.pow(1 + realReturn, yearsToGoal) - 1) / realReturn;
  const requiredAdditionalMonthly = fundingGap.gapAmount / (12 * annuityFactor);

  // Calculate alternative lump sum needed today
  const alternativeLumpSumToday = fundingGap.gapAmount / Math.pow(1 + realReturn, yearsToGoal);

  return {
    currentMonthlyContribution: currentMonthly,
    requiredAdditionalMonthly,
    recommendedTotalMonthly: currentMonthly + requiredAdditionalMonthly,
    alternativeLumpSumToday,
    canMeetGoal: true,
  };
}

/**
 * Determine goal status based on funding percentage
 */
export function determineGoalStatus(fundingPercentage: number): string {
  if (fundingPercentage >= 100) return 'on-track';
  if (fundingPercentage >= 90) return 'slight-shortfall';
  if (fundingPercentage >= 70) return 'moderate-shortfall';
  if (fundingPercentage >= 50) return 'significant-shortfall';
  return 'significant-shortfall';
}

/**
 * Generate status rationale
 */
export function generateStatusRationale(fundingGap: FundingGap, _status: string): string {
  if (!fundingGap.hasShortfall) {
    return `Goal is ${fundingGap.fundingPercentage > 100 ? 'overfunded' : 'fully funded'}. Current trajectory exceeds or meets requirements.`;
  }

  return `Goal is ${Math.round(fundingGap.fundingPercentage)}% funded. Shortfall of R${formatCurrency(fundingGap.gapAmount)} needs to be addressed.`;
}

/**
 * Calculate portfolio summary
 */
export function calculatePortfolioSummary(goalResults: GoalResult[]) {
  const totalGoals = goalResults.length;
  const totalRequiredCapital = goalResults.reduce(
    (sum, g) => sum + g.fundingGap.goalRequiredReal,
    0,
  );
  const totalProjectedCapital = goalResults.reduce(
    (sum, g) => sum + g.projectedCapital.totalProjectedCapital,
    0,
  );
  const totalFundingGap = goalResults.reduce(
    (sum, g) => sum + (g.fundingGap.hasShortfall ? g.fundingGap.gapAmount : 0),
    0,
  );
  const totalAdditionalMonthlyRequired = goalResults.reduce(
    (sum, g) => sum + g.requiredContributions.requiredAdditionalMonthly,
    0,
  );

  const goalsOnTrack = goalResults.filter((g) => g.goalStatus === 'on-track').length;
  const goalsUnderfunded = goalResults.filter((g) => g.fundingGap.hasShortfall).length;
  const goalsOverfunded = goalResults.filter(
    (g) => !g.fundingGap.hasShortfall && g.fundingGap.fundingPercentage > 100,
  ).length;

  // Determine overall portfolio health
  let overallPortfolioHealth = 'excellent';
  const fundingRatio = totalGoals > 0 ? goalsOnTrack / totalGoals : 0;
  if (fundingRatio < 0.3) overallPortfolioHealth = 'critical';
  else if (fundingRatio < 0.6) overallPortfolioHealth = 'needs-attention';
  else if (fundingRatio < 0.9) overallPortfolioHealth = 'good';

  return {
    totalGoals,
    totalRequiredCapital,
    totalProjectedCapital,
    totalFundingGap,
    totalAdditionalMonthlyRequired,
    goalsOnTrack,
    goalsUnderfunded,
    goalsOverfunded,
    overallPortfolioHealth,
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString('en-ZA');
}
