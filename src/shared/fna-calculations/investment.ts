/**
 * Investment Needs Analysis (INA) calculation engine — the single implementation.
 *
 * The Edge Function's `/investment-ina/client/:clientId/calculate` route
 * produces the STORED, published results with this file, and the adviser
 * wizard's display helpers use the same primitives, so the two cannot drift.
 * It is pure: no imports, no I/O. The clock is passed in (`now`).
 *
 * Method, per goal, all in REAL terms (today's rands):
 *  1. Horizon in whole months to the target date (or whole years to the
 *     target year when no date is held).
 *  2. Risk profile: the goal's own profile, else the client's. A profile with
 *     no expected real return falls back to the client's; if that has none
 *     either, the calculation is refused with a clear error rather than
 *     silently projecting at 0%.
 *  3. Existing capital: each linked investment's ALLOCATED value (the
 *     adviser's percentage, or an equal split between the goals it is linked
 *     to) grown at the real return.
 *  4. Monthly contributions: an ordinary monthly annuity at the monthly
 *     equivalent of the annual real return. Level in real terms, i.e. the
 *     contribution rises with inflation each year.
 *  5. Lump sums (today's rands) grown from when they arrive; one arriving
 *     after the target date does not count towards the goal.
 *  6. The additional monthly contribution (same annuity) or lump sum today
 *     that closes any gap.
 *  7. A suitability check of the risk profile against the horizon.
 *
 * Then, across goals: an affordability check against income, a
 * priority-ordered funding view of what the affordable budget can fully fund,
 * and a capital-weighted portfolio health.
 */

// ==================== CONSTANTS ====================

export type INARiskProfile = 'conservative' | 'moderate' | 'balanced' | 'growth' | 'aggressive';

/** Least to most growth-oriented. */
export const INA_RISK_PROFILE_ORDER: readonly INARiskProfile[] = [
  'conservative',
  'moderate',
  'balanced',
  'growth',
  'aggressive',
];

/**
 * The shortest horizon, in years, for which each risk profile is normally
 * suitable. A goal closer than this carries the risk of a market fall shortly
 * before the money is needed, with no time to recover.
 */
export const INA_MIN_HORIZON_YEARS: Readonly<Record<INARiskProfile, number>> = {
  conservative: 0,
  moderate: 2,
  balanced: 3,
  growth: 5,
  aggressive: 7,
};

/** Guideline: total goal saving should not exceed this % of monthly income. */
export const INA_AFFORDABILITY_LIMIT_PERCENT = 30;

const PRIORITY_RANK: Readonly<Record<string, number>> = { high: 0, medium: 1, low: 2 };

const RISK_PROFILE_LABELS: Readonly<Record<INARiskProfile, string>> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  balanced: 'Balanced',
  growth: 'Growth',
  aggressive: 'Aggressive',
};

/** Shown with every result so the basis of the numbers is on the record. */
export function inaAssumptionNotes(): string[] {
  const horizons = INA_RISK_PROFILE_ORDER.map(
    (p) => `${RISK_PROFILE_LABELS[p].toLowerCase()} ${INA_MIN_HORIZON_YEARS[p]}`,
  ).join(', ');
  return [
    'Expected returns are real returns after fees and inflation, so every amount is in today’s rands.',
    'Monthly contributions are compounded monthly and assumed to increase with inflation each year.',
    'Lump sums are in today’s rands; a lump sum arriving after a goal’s target date does not count towards it.',
    'An investment linked to several goals is split between them by the allocation entered, or equally when none is entered.',
    `Affordability guideline: total goal contributions up to ${INA_AFFORDABILITY_LIMIT_PERCENT}% of gross monthly income (net income when gross is not known). Retirement-fund contributions are not part of this check.`,
    `Minimum investment horizon by risk profile (years): ${horizons}.`,
  ];
}

// ==================== TYPES ====================

export interface INALumpSumInput {
  id?: string;
  amount: number;
  expectedDate: string;
  description?: string;
}

export interface INAGoalInput {
  id: string;
  goalName: string;
  goalType?: string;
  goalAmountToday: number;
  targetYear: number;
  targetDate?: string;
  priorityLevel?: string;
  useClientRiskProfile?: boolean;
  goalSpecificRiskProfile?: string;
  linkedInvestmentIds?: string[];
  /** investmentId → % of that investment earmarked for this goal (0–100). */
  linkedInvestmentAllocations?: Record<string, number>;
  currentContributionToGoal?: number;
  expectedLumpSums?: INALumpSumInput[];
}

export interface INAInvestmentInput {
  id: string;
  productName: string;
  currentValue: number;
}

export interface INAInputs {
  goals: INAGoalInput[];
  clientRiskProfile?: string;
  expectedRealReturns: { [K in INARiskProfile]?: number };
  longTermInflationRate: number;
  discretionaryInvestments?: INAInvestmentInput[];
  grossMonthlyIncome?: number;
  netMonthlyIncome?: number;
}

export interface INALinkedInvestmentResult {
  investmentId: string;
  investmentName: string;
  /** The investment's full current value. */
  currentValue: number;
  /** % of the investment earmarked for this goal. */
  allocationPercent: number;
  /** currentValue × allocationPercent — the part that counts for this goal. */
  allocatedValue: number;
  /** True when the investment is linked to more than one goal. */
  isShared: boolean;
  sharedWithGoalCount: number;
  yearsToGoal: number;
  applicableRealReturn: number;
  futureValue: number;
}

export interface INALumpSumResult {
  lumpSumId: string;
  lumpSumAmount: number;
  lumpSumDate: string;
  yearsFromLumpToGoal: number;
  applicableRealReturn: number;
  futureValue: number;
  /** Arrives after the target date, so it is excluded from the goal. */
  arrivesAfterGoal: boolean;
}

export interface INAFundingGap {
  goalRequiredReal: number;
  totalProjectedCapital: number;
  projectedCapitalAtGoal: number;
  gapAmount: number;
  hasShortfall: boolean;
  fundingPercentage: number;
  gapPercentage: number;
}

export type INACanMeetGoalReason = 'horizon' | 'affordability';

export interface INARequiredContributions {
  currentMonthlyContribution: number;
  requiredAdditionalMonthly: number;
  recommendedTotalMonthly: number;
  alternativeLumpSumToday: number;
  canMeetGoal: boolean;
  canMeetGoalReason?: INACanMeetGoalReason;
}

export type INAGoalStatus =
  'on-track' | 'slight-shortfall' | 'moderate-shortfall' | 'significant-shortfall';

export interface INAGoalResult {
  goalId: string;
  goalName: string;
  goalType?: string;
  priorityLevel?: string;
  goalStatus: INAGoalStatus;
  statusRationale: string;
  timeHorizon: {
    targetYear: number;
    currentYear: number;
    /** Years to the goal, to one decimal (months ÷ 12). */
    yearsToGoal: number;
    monthsToGoal: number;
    isValidTimeHorizon: boolean;
    warningMessage?: string;
  };
  projectedCapital: {
    existingCapital: {
      linkedInvestments: INALinkedInvestmentResult[];
      totalExistingFutureValue: number;
    };
    monthlyContributions: {
      monthlyContributionReal: number;
      yearsToGoal: number;
      monthsToGoal: number;
      applicableRealReturn: number;
      /** Monthly annuity factor: FV of R1 a month for monthsToGoal months. */
      annuityFactor: number;
      compounding: 'monthly';
      futureValueOfContributions: number;
    };
    lumpSums: INALumpSumResult[];
    totalLumpSumFutureValue: number;
    totalProjectedCapital: number;
  };
  fundingGap: INAFundingGap;
  requiredContributions: INARequiredContributions;
  applicableRiskProfile: INARiskProfile;
  applicableRealReturn: number;
  /** Set when the goal's own profile had no return and the client's was used. */
  riskProfileNote?: string;
  /** Set when the risk profile is too growth-oriented for the horizon. */
  suitabilityWarning?: string;
  suggestedRiskProfile?: INARiskProfile;
  calculatedAt: string;
}

export type INAPriorityFundingStatus =
  'fully-funded' | 'partially-funded' | 'not-funded' | 'horizon-passed' | 'not-assessed';

export interface INAPriorityFundingRow {
  goalId: string;
  goalName: string;
  priorityLevel: string;
  /** Total monthly contribution the goal needs (current + additional). */
  requiredMonthly: number;
  /** What the affordable budget can give it, in priority order. */
  allocatedMonthly: number;
  /** Budget used by this goal and every goal above it. */
  cumulativeMonthly: number;
  fundingStatus: INAPriorityFundingStatus;
  /** Funding % of the goal if it receives only allocatedMonthly. */
  projectedFundingPercentage: number;
}

export interface INAAffordability {
  incomeBasis: 'gross' | 'net' | 'none';
  monthlyIncome: number;
  limitPercent: number;
  /** limitPercent × monthlyIncome, or null when no income is held. */
  affordableMonthly: number | null;
  totalRecommendedMonthly: number;
  percentageOfIncome: number;
  isAffordable: boolean;
  warningMessage?: string;
}

export type INAPortfolioHealth = 'excellent' | 'good' | 'needs-attention' | 'critical';

export interface INAPortfolioSummary {
  totalGoals: number;
  totalRequiredCapital: number;
  totalProjectedCapital: number;
  totalFundingGap: number;
  totalAdditionalMonthlyRequired: number;
  goalsOnTrack: number;
  goalsUnderfunded: number;
  goalsOverfunded: number;
  /** Σ min(projected, required) ÷ Σ required × 100. */
  capitalWeightedFundingPercentage: number;
  overallPortfolioHealth: INAPortfolioHealth;
  affordability: INAAffordability;
  priorityFunding: INAPriorityFundingRow[];
}

export type INARecommendationType = 'funding' | 'affordability' | 'suitability' | 'timeline';

export interface INARecommendation {
  goalId: string;
  goalName: string;
  action: string;
  priority: string;
  impact: string;
  type?: INARecommendationType;
}

export interface INAResults {
  portfolioSummary: INAPortfolioSummary;
  goalResults: INAGoalResult[];
  recommendations: INARecommendation[];
  economicAssumptions: {
    inflationRate: number;
    realReturnsByProfile: INAInputs['expectedRealReturns'];
    realReturnBasis: 'after fees and inflation';
  };
  assumptions: string[];
  calculatedAt: string;
}

/** Inputs the engine refuses to calculate. The message names each problem. */
export class INACalculationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Investment INA cannot be calculated: ${problems.join('; ')}`);
    this.name = 'INACalculationError';
    this.problems = problems;
  }
}

// ==================== MONEY PRIMITIVES ====================

const RATE_EPSILON = 1e-12;

/** The monthly rate equivalent to an annual effective rate. */
export function monthlyRateFromAnnual(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Future value of R1 paid at the end of each month for `months` months.
 * At a zero rate this is its limit, `months` (no 0/0).
 */
export function monthlyAnnuityFactor(monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (Math.abs(monthlyRate) < RATE_EPSILON) return months;
  return (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
}

/** Future value of a monthly contribution at an annual (effective) rate. */
export function futureValueOfMonthlyContributions(
  monthlyPayment: number,
  annualRate: number,
  months: number,
): number {
  if (monthlyPayment <= 0 || months <= 0) return 0;
  return monthlyPayment * monthlyAnnuityFactor(monthlyRateFromAnnual(annualRate), months);
}

/** The monthly contribution whose future value is `target`. */
export function requiredMonthlyContribution(
  target: number,
  annualRate: number,
  months: number,
): number {
  if (target <= 0 || months <= 0) return 0;
  return target / monthlyAnnuityFactor(monthlyRateFromAnnual(annualRate), months);
}

export function futureValueOfLumpSum(presentValue: number, annualRate: number, years: number) {
  return presentValue * Math.pow(1 + annualRate, Math.max(0, years));
}

export function presentValueOfLumpSum(futureValue: number, annualRate: number, years: number) {
  return futureValue / Math.pow(1 + annualRate, Math.max(0, years));
}

// ==================== DATES ====================

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function wholeMonthsBetween(from: Date, to: Date): number {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (months > 0 && to.getUTCDate() < from.getUTCDate()) return months - 1;
  if (months < 0 && to.getUTCDate() > from.getUTCDate()) return months + 1;
  return months;
}

/** Months to the goal: to the target date when held, else to the target year. */
export function goalHorizonMonths(goal: INAGoalInput, now: Date): number {
  const targetDate = parseDate(goal.targetDate);
  if (targetDate) return wholeMonthsBetween(now, targetDate);
  return (Number(goal.targetYear) - now.getUTCFullYear()) * 12;
}

const roundTo = (value: number, places: number) => {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
};

// ==================== RISK PROFILE ====================

function realReturnFor(
  profile: string | undefined,
  returns: INAInputs['expectedRealReturns'] | undefined,
): number | undefined {
  if (!profile || !returns) return undefined;
  const value = (returns as Record<string, unknown>)[profile];
  return typeof value === 'number' && Number.isFinite(value) && value > -1 ? value : undefined;
}

function isRiskProfile(value: string | undefined): value is INARiskProfile {
  return !!value && (INA_RISK_PROFILE_ORDER as readonly string[]).includes(value);
}

type ResolvedProfile =
  | { ok: true; profile: INARiskProfile; realReturn: number; note?: string }
  | { ok: false; problem: string };

/**
 * The goal's own profile when it asks for one, else the client's. A profile
 * with no expected real return falls back to the client's.
 */
export function resolveGoalRiskProfile(goal: INAGoalInput, inputs: INAInputs): ResolvedProfile {
  const clientProfile = inputs.clientRiskProfile;
  const wantsOwn = goal.useClientRiskProfile !== true && !!goal.goalSpecificRiskProfile;
  const requested = wantsOwn ? goal.goalSpecificRiskProfile : clientProfile;

  const requestedReturn = realReturnFor(requested, inputs.expectedRealReturns);
  if (requestedReturn !== undefined && isRiskProfile(requested)) {
    return { ok: true, profile: requested, realReturn: requestedReturn };
  }

  const clientReturn = realReturnFor(clientProfile, inputs.expectedRealReturns);
  if (wantsOwn && clientReturn !== undefined && isRiskProfile(clientProfile)) {
    return {
      ok: true,
      profile: clientProfile,
      realReturn: clientReturn,
      note: `No expected real return is held for the "${requested}" profile, so the client's ${clientProfile} profile was used.`,
    };
  }

  return {
    ok: false,
    problem: `Goal "${goal.goalName || goal.id}": no expected real return for risk profile "${
      requested || 'none'
    }"${wantsOwn ? ` or the client's profile "${clientProfile || 'none'}"` : ''}`,
  };
}

// ==================== INVESTMENT ALLOCATION ====================

export interface INAAllocation {
  percent: number;
  isShared: boolean;
  sharedWithGoalCount: number;
}

/**
 * How much of each investment each goal may count, so an investment linked to
 * several goals is never counted in full more than once. Explicit percentages
 * stand; the remainder is split equally between the goals with none.
 */
export function resolveInvestmentAllocations(goals: INAGoalInput[]): {
  allocations: Map<string, Map<string, INAAllocation>>;
  problems: string[];
} {
  const linksByInvestment = new Map<string, INAGoalInput[]>();
  for (const goal of goals) {
    for (const investmentId of new Set(goal.linkedInvestmentIds ?? [])) {
      const list = linksByInvestment.get(investmentId) ?? [];
      list.push(goal);
      linksByInvestment.set(investmentId, list);
    }
  }

  const allocations = new Map<string, Map<string, INAAllocation>>();
  const problems: string[] = [];

  for (const [investmentId, linkedGoals] of linksByInvestment) {
    let explicitTotal = 0;
    let implicitCount = 0;
    for (const goal of linkedGoals) {
      const explicit = goal.linkedInvestmentAllocations?.[investmentId];
      if (typeof explicit === 'number' && Number.isFinite(explicit)) {
        if (explicit < 0 || explicit > 100) {
          problems.push(
            `Goal "${goal.goalName || goal.id}": allocation of investment ${investmentId} must be between 0% and 100%`,
          );
        }
        explicitTotal += explicit;
      } else {
        implicitCount += 1;
      }
    }
    if (explicitTotal > 100 + 1e-9) {
      problems.push(
        `Investment ${investmentId} is allocated ${roundTo(explicitTotal, 2)}% across goals; the total may not exceed 100%`,
      );
    }
    const implicitShare = implicitCount > 0 ? Math.max(0, 100 - explicitTotal) / implicitCount : 0;

    for (const goal of linkedGoals) {
      const explicit = goal.linkedInvestmentAllocations?.[investmentId];
      const percent =
        typeof explicit === 'number' && Number.isFinite(explicit)
          ? Math.min(100, Math.max(0, explicit))
          : implicitShare;
      const forGoal = allocations.get(goal.id) ?? new Map<string, INAAllocation>();
      forGoal.set(investmentId, {
        percent,
        isShared: linkedGoals.length > 1,
        sharedWithGoalCount: linkedGoals.length,
      });
      allocations.set(goal.id, forGoal);
    }
  }

  return { allocations, problems };
}

/** Everything that stops a calculation, as adviser-readable sentences. */
export function validateINAInputs(inputs: INAInputs): string[] {
  const problems = [...resolveInvestmentAllocations(inputs.goals ?? []).problems];
  for (const goal of inputs.goals ?? []) {
    const resolved = resolveGoalRiskProfile(goal, inputs);
    if (!resolved.ok) problems.push(resolved.problem);
  }
  return problems;
}

// ==================== SINGLE GOAL ====================

export function determineGoalStatus(fundingPercentage: number): INAGoalStatus {
  if (fundingPercentage >= 100) return 'on-track';
  if (fundingPercentage >= 90) return 'slight-shortfall';
  if (fundingPercentage >= 70) return 'moderate-shortfall';
  return 'significant-shortfall';
}

/** The most growth-oriented profile whose minimum horizon the goal meets. */
export function suitableRiskProfileFor(years: number): INARiskProfile {
  let best: INARiskProfile = 'conservative';
  for (const profile of INA_RISK_PROFILE_ORDER) {
    if (years >= INA_MIN_HORIZON_YEARS[profile]) best = profile;
  }
  return best;
}

export function calculateFundingGap(goalRequired: number, projectedCapital: number): INAFundingGap {
  const gapAmount = goalRequired - projectedCapital;
  const fundingPercentage = goalRequired > 0 ? (projectedCapital / goalRequired) * 100 : 100;
  return {
    goalRequiredReal: goalRequired,
    totalProjectedCapital: projectedCapital,
    projectedCapitalAtGoal: projectedCapital,
    gapAmount,
    hasShortfall: gapAmount > 0,
    fundingPercentage,
    gapPercentage: goalRequired > 0 ? (gapAmount / goalRequired) * 100 : 0,
  };
}

function calculateGoal(
  goal: INAGoalInput,
  inputs: INAInputs,
  allocations: Map<string, INAAllocation> | undefined,
  now: Date,
): INAGoalResult {
  const resolved = resolveGoalRiskProfile(goal, inputs);
  if (!resolved.ok) throw new INACalculationError([resolved.problem]);
  const { profile, realReturn } = resolved;

  const months = goalHorizonMonths(goal, now);
  const growthMonths = Math.max(0, months);
  const growthYears = growthMonths / 12;
  const isValidTimeHorizon = months > 0;
  const targetDate = parseDate(goal.targetDate);
  const targetYear = targetDate ? targetDate.getUTCFullYear() : Number(goal.targetYear);

  // Existing capital — only the allocated part of each linked investment.
  const linkedInvestments: INALinkedInvestmentResult[] = [];
  for (const investmentId of new Set(goal.linkedInvestmentIds ?? [])) {
    const investment = (inputs.discretionaryInvestments ?? []).find((i) => i.id === investmentId);
    if (!investment) continue;
    const allocation = allocations?.get(investmentId) ?? {
      percent: 100,
      isShared: false,
      sharedWithGoalCount: 1,
    };
    const currentValue = Number(investment.currentValue) || 0;
    const allocatedValue = (currentValue * allocation.percent) / 100;
    linkedInvestments.push({
      investmentId: investment.id,
      investmentName: investment.productName,
      currentValue,
      allocationPercent: allocation.percent,
      allocatedValue,
      isShared: allocation.isShared,
      sharedWithGoalCount: allocation.sharedWithGoalCount,
      yearsToGoal: roundTo(growthYears, 1),
      applicableRealReturn: realReturn,
      futureValue: futureValueOfLumpSum(allocatedValue, realReturn, growthYears),
    });
  }
  const totalExistingFutureValue = linkedInvestments.reduce((s, i) => s + i.futureValue, 0);

  // Monthly contributions — ordinary monthly annuity at the monthly real rate.
  const monthlyContribution = Math.max(0, Number(goal.currentContributionToGoal) || 0);
  const annuityFactor = monthlyAnnuityFactor(monthlyRateFromAnnual(realReturn), growthMonths);
  const futureValueOfContributions = monthlyContribution * annuityFactor;

  // Lump sums — grown from when they arrive (not before today); excluded if
  // they arrive after the target date.
  const lumpSums: INALumpSumResult[] = (goal.expectedLumpSums ?? []).map((lumpSum) => {
    const arrives = parseDate(lumpSum.expectedDate);
    const start = arrives && arrives.getTime() > now.getTime() ? arrives : now;
    const monthsFromLumpToGoal = targetDate
      ? wholeMonthsBetween(start, targetDate)
      : (targetYear - start.getUTCFullYear()) * 12;
    const arrivesAfterGoal = monthsFromLumpToGoal < 0;
    const amount = Number(lumpSum.amount) || 0;
    return {
      lumpSumId: lumpSum.id ?? '',
      lumpSumAmount: amount,
      lumpSumDate: lumpSum.expectedDate,
      yearsFromLumpToGoal: roundTo(monthsFromLumpToGoal / 12, 1),
      applicableRealReturn: realReturn,
      futureValue: arrivesAfterGoal
        ? 0
        : futureValueOfLumpSum(amount, realReturn, monthsFromLumpToGoal / 12),
      arrivesAfterGoal,
    };
  });
  const totalLumpSumFutureValue = lumpSums.reduce((s, l) => s + l.futureValue, 0);

  const totalProjectedCapital =
    totalExistingFutureValue + futureValueOfContributions + totalLumpSumFutureValue;
  const goalAmount = Number(goal.goalAmountToday) || 0;
  const fundingGap = calculateFundingGap(goalAmount, totalProjectedCapital);

  // Closing the gap.
  let requiredContributions: INARequiredContributions;
  if (!fundingGap.hasShortfall) {
    requiredContributions = {
      currentMonthlyContribution: monthlyContribution,
      requiredAdditionalMonthly: 0,
      recommendedTotalMonthly: monthlyContribution,
      alternativeLumpSumToday: 0,
      canMeetGoal: true,
    };
  } else if (!isValidTimeHorizon) {
    requiredContributions = {
      currentMonthlyContribution: monthlyContribution,
      requiredAdditionalMonthly: 0,
      recommendedTotalMonthly: monthlyContribution,
      alternativeLumpSumToday: fundingGap.gapAmount,
      canMeetGoal: false,
      canMeetGoalReason: 'horizon',
    };
  } else {
    const requiredAdditionalMonthly = fundingGap.gapAmount / annuityFactor;
    requiredContributions = {
      currentMonthlyContribution: monthlyContribution,
      requiredAdditionalMonthly,
      recommendedTotalMonthly: monthlyContribution + requiredAdditionalMonthly,
      alternativeLumpSumToday: presentValueOfLumpSum(fundingGap.gapAmount, realReturn, growthYears),
      canMeetGoal: true,
    };
  }

  // Suitability of the risk profile for the horizon.
  const yearsToGoal = roundTo(growthYears, 1);
  const minYears = INA_MIN_HORIZON_YEARS[profile];
  let suitabilityWarning: string | undefined;
  let suggestedRiskProfile: INARiskProfile | undefined;
  if (isValidTimeHorizon && growthYears < minYears) {
    suggestedRiskProfile = suitableRiskProfileFor(growthYears);
    suitabilityWarning =
      `The ${RISK_PROFILE_LABELS[profile]} profile normally needs at least ${minYears} years; ` +
      `this goal is ${yearsToGoal} years away. Consider the ` +
      `${RISK_PROFILE_LABELS[suggestedRiskProfile]} profile for this goal.`;
  }

  const goalStatus = determineGoalStatus(fundingGap.fundingPercentage);

  return {
    goalId: goal.id,
    goalName: goal.goalName,
    goalType: goal.goalType,
    priorityLevel: goal.priorityLevel,
    goalStatus,
    statusRationale: statusRationale(fundingGap),
    timeHorizon: {
      targetYear,
      currentYear: now.getUTCFullYear(),
      yearsToGoal,
      monthsToGoal: months,
      isValidTimeHorizon,
      warningMessage: isValidTimeHorizon
        ? undefined
        : 'Goal target date is in the past or this month',
    },
    projectedCapital: {
      existingCapital: { linkedInvestments, totalExistingFutureValue },
      monthlyContributions: {
        monthlyContributionReal: monthlyContribution,
        yearsToGoal,
        monthsToGoal: growthMonths,
        applicableRealReturn: realReturn,
        annuityFactor,
        compounding: 'monthly',
        futureValueOfContributions,
      },
      lumpSums,
      totalLumpSumFutureValue,
      totalProjectedCapital,
    },
    fundingGap,
    requiredContributions,
    applicableRiskProfile: profile,
    applicableRealReturn: realReturn,
    ...(resolved.note ? { riskProfileNote: resolved.note } : {}),
    ...(suitabilityWarning ? { suitabilityWarning, suggestedRiskProfile } : {}),
    calculatedAt: now.toISOString(),
  };
}

function statusRationale(fundingGap: INAFundingGap): string {
  if (!fundingGap.hasShortfall) {
    return `Goal is ${fundingGap.fundingPercentage > 100 ? 'overfunded' : 'fully funded'}. Current trajectory exceeds or meets requirements.`;
  }
  return `Goal is ${Math.round(fundingGap.fundingPercentage)}% funded. Shortfall of R${formatRands(fundingGap.gapAmount)} needs to be addressed.`;
}

// ==================== PORTFOLIO ====================

export function calculateINAAffordability(
  totalRecommendedMonthly: number,
  grossMonthlyIncome: number | undefined,
  netMonthlyIncome: number | undefined,
): INAAffordability {
  const gross = Number(grossMonthlyIncome) || 0;
  const net = Number(netMonthlyIncome) || 0;
  const incomeBasis = gross > 0 ? 'gross' : net > 0 ? 'net' : 'none';
  const monthlyIncome = gross > 0 ? gross : net;
  const limitPercent = INA_AFFORDABILITY_LIMIT_PERCENT;

  if (incomeBasis === 'none') {
    return {
      incomeBasis,
      monthlyIncome: 0,
      limitPercent,
      affordableMonthly: null,
      totalRecommendedMonthly,
      percentageOfIncome: 0,
      isAffordable: true,
      warningMessage: 'No income is held for the client, so affordability was not checked.',
    };
  }

  const affordableMonthly = (monthlyIncome * limitPercent) / 100;
  const percentageOfIncome = (totalRecommendedMonthly / monthlyIncome) * 100;
  const isAffordable = totalRecommendedMonthly <= affordableMonthly + 1e-9;
  return {
    incomeBasis,
    monthlyIncome,
    limitPercent,
    affordableMonthly,
    totalRecommendedMonthly,
    percentageOfIncome,
    isAffordable,
    warningMessage: isAffordable
      ? undefined
      : `The goals need R${formatRands(totalRecommendedMonthly)} a month, ${roundTo(
          percentageOfIncome,
          1,
        )}% of ${incomeBasis} income, above the ${limitPercent}% guideline of R${formatRands(
          affordableMonthly,
        )}.`,
  };
}

/**
 * Hands the affordable monthly budget to goals in priority order (high,
 * medium, low; then the nearest target date first). A goal is fully funded
 * only if the budget left after every goal above it covers all it needs.
 */
export function calculatePriorityFunding(
  goalResults: INAGoalResult[],
  affordableMonthly: number | null,
): INAPriorityFundingRow[] {
  const ordered = goalResults
    .map((result, index) => ({ result, index }))
    .sort((a, b) => {
      const rank =
        (PRIORITY_RANK[a.result.priorityLevel ?? 'medium'] ?? 1) -
        (PRIORITY_RANK[b.result.priorityLevel ?? 'medium'] ?? 1);
      if (rank !== 0) return rank;
      const months = a.result.timeHorizon.monthsToGoal - b.result.timeHorizon.monthsToGoal;
      return months !== 0 ? months : a.index - b.index;
    })
    .map(({ result }) => result);

  let remaining = affordableMonthly ?? Infinity;
  let cumulative = 0;

  return ordered.map((goal) => {
    const required = goal.requiredContributions.recommendedTotalMonthly;
    const base = {
      goalId: goal.goalId,
      goalName: goal.goalName,
      priorityLevel: goal.priorityLevel ?? 'medium',
      requiredMonthly: required,
    };

    if (!goal.timeHorizon.isValidTimeHorizon) {
      return {
        ...base,
        allocatedMonthly: 0,
        cumulativeMonthly: cumulative,
        fundingStatus: 'horizon-passed' as const,
        projectedFundingPercentage: goal.fundingGap.fundingPercentage,
      };
    }

    const allocated = Math.max(0, Math.min(required, remaining));
    remaining -= allocated;
    cumulative += allocated;

    const fundingStatus: INAPriorityFundingStatus =
      affordableMonthly === null
        ? 'not-assessed'
        : allocated >= required - 0.005
          ? 'fully-funded'
          : allocated > 0
            ? 'partially-funded'
            : 'not-funded';

    // Funding % if the goal receives only `allocated` a month.
    const contributions = goal.projectedCapital.monthlyContributions;
    const projectedWithAllocation =
      goal.projectedCapital.totalProjectedCapital -
      contributions.futureValueOfContributions +
      allocated * contributions.annuityFactor;
    const goalRequired = goal.fundingGap.goalRequiredReal;

    return {
      ...base,
      allocatedMonthly: allocated,
      cumulativeMonthly: cumulative,
      fundingStatus,
      projectedFundingPercentage:
        goalRequired > 0 ? (projectedWithAllocation / goalRequired) * 100 : 100,
    };
  });
}

/** Capital-weighted: each goal counts up to 100% funded, weighted by size. */
export function calculatePortfolioHealth(goalResults: INAGoalResult[]): {
  capitalWeightedFundingPercentage: number;
  overallPortfolioHealth: INAPortfolioHealth;
} {
  const required = goalResults.reduce((s, g) => s + g.fundingGap.goalRequiredReal, 0);
  const fundedUpToRequired = goalResults.reduce(
    (s, g) =>
      s +
      Math.min(
        Math.max(0, g.projectedCapital.totalProjectedCapital),
        g.fundingGap.goalRequiredReal,
      ),
    0,
  );
  const pct = required > 0 ? (fundedUpToRequired / required) * 100 : 0;
  const overallPortfolioHealth: INAPortfolioHealth =
    pct >= 90 ? 'excellent' : pct >= 70 ? 'good' : pct >= 50 ? 'needs-attention' : 'critical';
  return { capitalWeightedFundingPercentage: pct, overallPortfolioHealth };
}

// ==================== ENTRY POINT ====================

export function calculateINA(inputs: INAInputs, now: Date): INAResults {
  const goals = inputs.goals ?? [];
  const problems = validateINAInputs(inputs);
  if (problems.length > 0) throw new INACalculationError(problems);

  const { allocations } = resolveInvestmentAllocations(goals);
  const goalResults = goals.map((goal) =>
    calculateGoal(goal, inputs, allocations.get(goal.id), now),
  );

  const totalRecommendedMonthly = goalResults
    .filter((g) => g.timeHorizon.isValidTimeHorizon)
    .reduce((s, g) => s + g.requiredContributions.recommendedTotalMonthly, 0);
  const affordability = calculateINAAffordability(
    totalRecommendedMonthly,
    inputs.grossMonthlyIncome,
    inputs.netMonthlyIncome,
  );
  const priorityFunding = calculatePriorityFunding(goalResults, affordability.affordableMonthly);

  // A goal the affordable budget cannot fully fund cannot be met as planned.
  for (const row of priorityFunding) {
    if (row.fundingStatus !== 'partially-funded' && row.fundingStatus !== 'not-funded') continue;
    const goal = goalResults.find((g) => g.goalId === row.goalId);
    if (goal && goal.requiredContributions.canMeetGoal) {
      goal.requiredContributions.canMeetGoal = false;
      goal.requiredContributions.canMeetGoalReason = 'affordability';
    }
  }

  const health = calculatePortfolioHealth(goalResults);
  const portfolioSummary: INAPortfolioSummary = {
    totalGoals: goalResults.length,
    totalRequiredCapital: goalResults.reduce((s, g) => s + g.fundingGap.goalRequiredReal, 0),
    totalProjectedCapital: goalResults.reduce(
      (s, g) => s + g.projectedCapital.totalProjectedCapital,
      0,
    ),
    totalFundingGap: goalResults.reduce(
      (s, g) => s + (g.fundingGap.hasShortfall ? g.fundingGap.gapAmount : 0),
      0,
    ),
    totalAdditionalMonthlyRequired: goalResults.reduce(
      (s, g) => s + g.requiredContributions.requiredAdditionalMonthly,
      0,
    ),
    goalsOnTrack: goalResults.filter((g) => g.goalStatus === 'on-track').length,
    goalsUnderfunded: goalResults.filter((g) => g.fundingGap.hasShortfall).length,
    goalsOverfunded: goalResults.filter(
      (g) => !g.fundingGap.hasShortfall && g.fundingGap.fundingPercentage > 100,
    ).length,
    ...health,
    affordability,
    priorityFunding,
  };

  return {
    portfolioSummary,
    goalResults,
    recommendations: buildRecommendations(goalResults, affordability, priorityFunding),
    economicAssumptions: {
      inflationRate: inputs.longTermInflationRate,
      realReturnsByProfile: inputs.expectedRealReturns,
      realReturnBasis: 'after fees and inflation',
    },
    assumptions: inaAssumptionNotes(),
    calculatedAt: now.toISOString(),
  };
}

// ==================== RECOMMENDATIONS ====================

function buildRecommendations(
  goalResults: INAGoalResult[],
  affordability: INAAffordability,
  priorityFunding: INAPriorityFundingRow[],
): INARecommendation[] {
  const recommendations: INARecommendation[] = [];

  if (!affordability.isAffordable && affordability.affordableMonthly !== null) {
    recommendations.push({
      goalId: 'portfolio',
      goalName: 'All goals',
      action: `${affordability.warningMessage} Fund the goals in priority order and revisit target dates or amounts for the rest.`,
      priority: 'high',
      impact: 'Keeps the savings plan sustainable for the client.',
      type: 'affordability',
    });
  }

  for (const goal of goalResults) {
    const rc = goal.requiredContributions;
    const priority = goal.priorityLevel ?? 'medium';

    if (goal.fundingGap.hasShortfall || rc.canMeetGoalReason) {
      let action: string;
      let type: INARecommendationType = 'funding';
      if (rc.canMeetGoalReason === 'horizon') {
        type = 'timeline';
        action =
          'The target date has passed or falls this month. Set a new target date, or fund the ' +
          `shortfall of R${formatRands(goal.fundingGap.gapAmount)} as a lump sum.`;
      } else if (rc.canMeetGoalReason === 'affordability') {
        type = 'affordability';
        const row = priorityFunding.find((r) => r.goalId === goal.goalId);
        action =
          `Within the affordable budget this goal can receive R${formatRands(
            row?.allocatedMonthly ?? 0,
          )} of the R${formatRands(rc.recommendedTotalMonthly)} a month it needs. ` +
          'Consider extending the target date, reducing the goal amount' +
          (rc.alternativeLumpSumToday > 0
            ? `, or a lump sum of R${formatRands(rc.alternativeLumpSumToday)} today.`
            : '.');
      } else {
        action = `Increase monthly contribution by R${formatRands(rc.requiredAdditionalMonthly)} to meet this goal, or invest a lump sum of R${formatRands(rc.alternativeLumpSumToday)} today.`;
      }
      recommendations.push({
        goalId: goal.goalId,
        goalName: goal.goalName,
        action,
        priority,
        impact: goal.fundingGap.hasShortfall
          ? `This will help close the R${formatRands(goal.fundingGap.gapAmount)} funding gap`
          : 'Keeps the goal on track within the client’s budget',
        type,
      });
    }

    if (goal.suitabilityWarning) {
      recommendations.push({
        goalId: goal.goalId,
        goalName: goal.goalName,
        action: goal.suitabilityWarning,
        priority,
        impact: 'Reduces the risk of a market fall shortly before the money is needed.',
        type: 'suitability',
      });
    }
  }

  return recommendations;
}

/**
 * A whole-rand amount with comma thousands, without the "R" (callers add it):
 * 2000000 → "2,000,000". Formatted by hand because en-ZA gives spaces in Deno.
 */
export function formatRands(amount: number): string {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
