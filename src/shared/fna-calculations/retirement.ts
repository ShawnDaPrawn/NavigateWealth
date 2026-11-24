/**
 * Retirement FNA calculation engine — the single implementation.
 *
 * Both the adviser wizard (Step 2 preview) and the Edge Function's
 * `/retirement-fna/:id/calculate` route (which produces the STORED, published
 * results) import this file, so the number an adviser previews is the number
 * that gets published. It is pure: no imports, no I/O, no clock.
 *
 * Method, in order:
 *  1. Target income = replacement ratio × GROSS monthly income, projected to
 *     retirement at salary escalation. The ratio is a gross-income rule of
 *     thumb, so the target is pre-tax and the capital funds a taxable pension.
 *     Older records hold only net income; they fall back to net and say so.
 *  2. Other guaranteed retirement income (today's money, inflated to
 *     retirement) reduces the income the capital itself has to fund.
 *  3. Required capital = that income × an annuity factor at the REAL
 *     post-retirement return, i.e. an income that keeps pace with inflation.
 *  4. Projected capital = retirement savings + other earmarked capital grown at
 *     the pre-retirement return, plus contributions that escalate with salary
 *     (contributions are a percentage of salary) unless the adviser overrides it.
 *  5. The additional contribution that closes any gap, today's-money
 *     equivalents of every capital figure, the initial drawdown rate the
 *     projected capital implies, and an s11F deductibility check.
 */

// ==================== ASSUMPTIONS & CONSTANTS ====================

export const RETIREMENT_DEFAULT_ASSUMPTIONS = {
  retirementAge: 65,
  yearsInRetirement: 25,
  preRetirementReturn: 0.1, // Nominal 10%
  postRetirementReturn: 0.08, // Nominal 8%
  inflationRate: 0.06, // CPI 6%
  replacementRatio: 0.75, // 75% of gross income
  salaryEscalation: 0.07, // 7%
  // There is deliberately no premiumEscalation default: contributions are a
  // percentage of salary, so unless overridden they escalate with salary.
} as const;

/** s11F (2026/27): 27.5% of the greater of remuneration or taxable income, capped. */
export const RETIREMENT_S11F = {
  DEDUCTION_RATE: 0.275,
  ANNUAL_CAP: 430_000,
} as const;

/** Living annuity drawdown band (regulatory) and the sustainability threshold. */
export const RETIREMENT_DRAWDOWN = {
  SUSTAINABLE_MAX: 0.05,
  LIVING_ANNUITY_MIN: 0.025,
  LIVING_ANNUITY_MAX: 0.175,
} as const;

// ==================== TYPES ====================

export interface RetirementEngineInputs {
  currentAge?: number;
  retirementAge?: number;
  /** Net (take-home) monthly income — the legacy basis. */
  currentMonthlyIncome?: number;
  /** Gross monthly income, before tax — the basis of the replacement ratio. */
  currentGrossMonthlyIncome?: number;
  /** Total monthly retirement contributions (employee + employer). */
  currentMonthlyContribution?: number;
  /** Current value of retirement funds. */
  currentRetirementSavings?: number;
  /** Other capital earmarked for retirement (discretionary, preservation funds not counted above). */
  otherRetirementCapital?: number;
  /** Other guaranteed retirement income per month, in today's money (rental, DB pension). */
  otherMonthlyRetirementIncome?: number;
}

export interface RetirementEngineAssumptions {
  retirementAge?: number;
  yearsInRetirement?: number;
  replacementRatio?: number;
  inflationRate?: number;
  preRetirementReturn?: number;
  postRetirementReturn?: number;
  salaryEscalation?: number;
  premiumEscalation?: number;
}

export type RetirementIncomeBasis = 'gross' | 'net';

export type RetirementDrawdownStatus =
  | 'not-required' // the capital does not have to fund any income
  | 'sustainable' // at or below 5% p.a.
  | 'high' // above 5% p.a., within the living annuity maximum
  | 'exceeds-maximum'; // above 17.5% p.a., or no capital at all

export interface RetirementEngineResults {
  // Timeline
  yearsToRetirement: number;
  yearsInRetirement: number;

  /**
   * NOMINAL pre-retirement return. The key name is historical (published
   * records carry it); it has never been a real rate.
   */
  realGrowthRate: number;
  /** NOMINAL salary escalation. Historical key name, as above. */
  realSalaryGrowth: number;

  /** Target monthly income at retirement, NOMINAL (future rands). */
  targetMonthlyIncome: number;
  /** Capital required at retirement, NOMINAL (future rands). */
  requiredCapital: number;
  /** Capital projected at retirement, NOMINAL (future rands). */
  projectedCapital: number;
  /** requiredCapital − projectedCapital, NOMINAL. Negative is a surplus. */
  capitalShortfall: number;
  hasShortfall: boolean;
  shortfallPercentage: number;

  requiredAdditionalContribution: number;
  totalRecommendedContribution: number;
  /** Recommended contribution as % of current income (gross when known, else net). */
  percentageOfIncome: number;

  // ---- Added in engine v2. Optional on the type because older published
  // ---- records do not carry them; the engine always fills them.
  incomeBasis?: RetirementIncomeBasis;
  incomeUsedForTarget?: number;
  replacementRatio?: number;
  inflationRate?: number;
  preRetirementReturn?: number;
  postRetirementReturn?: number;
  premiumEscalation?: number;

  /** Other guaranteed income at retirement, NOMINAL monthly. */
  otherMonthlyIncomeAtRetirement?: number;
  /** Income the capital must fund (target − other income), NOMINAL monthly. */
  monthlyIncomeFromCapital?: number;

  projectedRetirementSavings?: number;
  projectedOtherCapital?: number;
  projectedContributions?: number;

  /** Today's-money equivalents (deflated by inflation over yearsToRetirement). */
  targetMonthlyIncomeToday?: number;
  requiredCapitalToday?: number;
  projectedCapitalToday?: number;
  capitalShortfallToday?: number;

  /** Annual income from capital ÷ projected capital; null when there is no capital to draw on. */
  initialDrawdownRate?: number | null;
  drawdownStatus?: RetirementDrawdownStatus;

  /** First-year contributions (totalRecommendedContribution × 12). */
  annualRecommendedContribution?: number;
  /** min(27.5% × annual income, R430,000). */
  deductibleContributionLimit?: number;
  contributionAboveDeductibleLimit?: number;
  exceedsDeductibleLimit?: boolean;

  assumptionNotes?: string[];
}

export class RetirementCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetirementCalculationError';
  }
}

// ==================== HELPERS ====================

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function nonNegative(value: unknown): number {
  const n = num(value);
  return n !== undefined && n > 0 ? n : 0;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** FV factor of a monthly payment escalating at g, growing at r, over n months. */
function growingAnnuityFactor(r: number, g: number, months: number): number {
  if (months <= 0) return 0;
  if (Math.abs(r - g) < 0.000001) return months * Math.pow(1 + r, months - 1);
  return (Math.pow(1 + r, months) - Math.pow(1 + g, months)) / (r - g);
}

function pct(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

function rand(amount: number): string {
  return `R${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * The reason a retirement FNA cannot be calculated, or null when it can.
 * The client's age is required: the engine never invents one.
 */
export function retirementInputProblem(inputs: { currentAge?: unknown }): string | null {
  const age = num(inputs.currentAge);
  if (age === undefined || age <= 0) {
    return "The client's current age is required to calculate a retirement FNA.";
  }
  return null;
}

// ==================== ENGINE ====================

export function calculateRetirement(
  inputs: RetirementEngineInputs,
  assumptions: RetirementEngineAssumptions = {},
): RetirementEngineResults {
  const problem = retirementInputProblem(inputs);
  if (problem) throw new RetirementCalculationError(problem);

  const D = RETIREMENT_DEFAULT_ASSUMPTIONS;
  const currentAge = num(inputs.currentAge)!;
  const retirementAge =
    num(assumptions.retirementAge) || num(inputs.retirementAge) || D.retirementAge;
  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const yearsInRetirement = num(assumptions.yearsInRetirement) || D.yearsInRetirement;

  const inflation = num(assumptions.inflationRate) ?? D.inflationRate;
  const preRetReturn = num(assumptions.preRetirementReturn) ?? D.preRetirementReturn;
  const postRetReturn = num(assumptions.postRetirementReturn) ?? D.postRetirementReturn;
  const salaryEscalation = num(assumptions.salaryEscalation) ?? D.salaryEscalation;
  const replaceRatio = num(assumptions.replacementRatio) ?? D.replacementRatio;
  const premiumEscalationOverridden = num(assumptions.premiumEscalation) !== undefined;
  const premiumEscalation = num(assumptions.premiumEscalation) ?? salaryEscalation;

  const monthlyGrowth = Math.pow(1 + preRetReturn, 1 / 12) - 1;
  const monthlyEscalation = Math.pow(1 + premiumEscalation, 1 / 12) - 1;
  const realPostReturn = (1 + postRetReturn) / (1 + inflation) - 1;
  const deflator = Math.pow(1 + inflation, yearsToRetirement);

  // 1. Target income — gross basis, net fallback for records without gross.
  const grossIncome = nonNegative(inputs.currentGrossMonthlyIncome);
  const netIncome = nonNegative(inputs.currentMonthlyIncome);
  const incomeBasis: RetirementIncomeBasis = grossIncome > 0 ? 'gross' : 'net';
  const incomeUsedForTarget = incomeBasis === 'gross' ? grossIncome : netIncome;
  const projectedFinalIncome =
    incomeUsedForTarget * Math.pow(1 + salaryEscalation, yearsToRetirement);
  const targetMonthlyIncome = projectedFinalIncome * replaceRatio;

  // 2. Other guaranteed income reduces what the capital must fund.
  const otherIncomeToday = nonNegative(inputs.otherMonthlyRetirementIncome);
  const otherMonthlyIncomeAtRetirement = otherIncomeToday * deflator;
  const monthlyIncomeFromCapital = Math.max(
    0,
    targetMonthlyIncome - otherMonthlyIncomeAtRetirement,
  );
  const annualIncomeFromCapital = monthlyIncomeFromCapital * 12;

  // 3. Required capital for an inflation-linked income.
  const requiredCapital =
    Math.abs(realPostReturn) < 0.000001
      ? annualIncomeFromCapital * yearsInRetirement
      : annualIncomeFromCapital *
        ((1 - Math.pow(1 + realPostReturn, -yearsInRetirement)) / realPostReturn);

  // 4. Projected capital.
  const months = yearsToRetirement * 12;
  const growth = Math.pow(1 + preRetReturn, yearsToRetirement);
  const projectedRetirementSavings = nonNegative(inputs.currentRetirementSavings) * growth;
  const projectedOtherCapital = nonNegative(inputs.otherRetirementCapital) * growth;
  const monthlyContrib = nonNegative(inputs.currentMonthlyContribution);
  const annuityFactor = growingAnnuityFactor(monthlyGrowth, monthlyEscalation, months);
  const projectedContributions = monthlyContrib * annuityFactor;
  const projectedCapital =
    projectedRetirementSavings + projectedOtherCapital + projectedContributions;

  // 5. Gap and the contribution that closes it.
  const capitalShortfall = requiredCapital - projectedCapital;
  const hasShortfall = capitalShortfall > 0;
  const shortfallPercentage = requiredCapital > 0 ? (capitalShortfall / requiredCapital) * 100 : 0;
  const requiredAdditionalContribution =
    hasShortfall && annuityFactor > 0 ? capitalShortfall / annuityFactor : 0;
  const totalRecommendedContribution = monthlyContrib + requiredAdditionalContribution;
  const percentageOfIncome =
    incomeUsedForTarget > 0 ? (totalRecommendedContribution / incomeUsedForTarget) * 100 : 0;

  // Drawdown the projected capital would have to sustain.
  let initialDrawdownRate: number | null;
  let drawdownStatus: RetirementDrawdownStatus;
  if (annualIncomeFromCapital <= 0) {
    initialDrawdownRate = 0;
    drawdownStatus = 'not-required';
  } else if (projectedCapital <= 0) {
    initialDrawdownRate = null;
    drawdownStatus = 'exceeds-maximum';
  } else {
    initialDrawdownRate = annualIncomeFromCapital / projectedCapital;
    drawdownStatus =
      initialDrawdownRate > RETIREMENT_DRAWDOWN.LIVING_ANNUITY_MAX
        ? 'exceeds-maximum'
        : initialDrawdownRate > RETIREMENT_DRAWDOWN.SUSTAINABLE_MAX
          ? 'high'
          : 'sustainable';
  }

  // s11F deductibility of the recommended contribution (first year).
  const annualRecommendedContribution = totalRecommendedContribution * 12;
  const deductibleContributionLimit = Math.min(
    RETIREMENT_S11F.DEDUCTION_RATE * incomeUsedForTarget * 12,
    RETIREMENT_S11F.ANNUAL_CAP,
  );
  const contributionAboveDeductibleLimit = Math.max(
    0,
    annualRecommendedContribution - deductibleContributionLimit,
  );

  const assumptionNotes: string[] = [
    incomeBasis === 'gross'
      ? `Target income: ${pct(replaceRatio, 0)} of gross income (${rand(grossIncome)} p.m.), projected at ${pct(salaryEscalation)} salary escalation. The target is pre-tax: the capital funds a taxable pension.`
      : `Gross income was not captured, so the ${pct(replaceRatio, 0)} target is applied to NET income (${rand(netIncome)} p.m.). This understates the need; capture gross income for a reliable figure.`,
    premiumEscalationOverridden
      ? `Contributions escalate at ${pct(premiumEscalation)} p.a. (adviser override).`
      : `Contributions escalate with salary at ${pct(premiumEscalation)} p.a., as they are a percentage of salary.`,
    `Returns: ${pct(preRetReturn)} p.a. before retirement and ${pct(postRetReturn)} p.a. after, with inflation at ${pct(inflation)}; the retirement income keeps pace with inflation for ${yearsInRetirement} years.`,
    `Capital figures at retirement are in future rands; today's-money figures are deflated by ${pct(inflation)} inflation over ${yearsToRetirement} years.`,
    'Two-pot: any withdrawals from the savings component before retirement reduce the capital projected here.',
  ];
  if (otherIncomeToday > 0) {
    assumptionNotes.push(
      `Other guaranteed retirement income of ${rand(otherIncomeToday)} p.m. (today's money) reduces the income the capital must fund.`,
    );
  }
  if (nonNegative(inputs.otherRetirementCapital) > 0) {
    assumptionNotes.push(
      `Other capital earmarked for retirement (${rand(nonNegative(inputs.otherRetirementCapital))}) is grown at the pre-retirement return.`,
    );
  }
  if (drawdownStatus === 'high' || drawdownStatus === 'exceeds-maximum') {
    assumptionNotes.push(
      initialDrawdownRate === null
        ? 'No capital is projected at retirement to fund the required income.'
        : `The projected capital would need an initial drawdown of ${pct(initialDrawdownRate)} p.a. Above ${pct(RETIREMENT_DRAWDOWN.SUSTAINABLE_MAX, 0)} a living annuity is at high risk of depletion (regulatory range ${pct(RETIREMENT_DRAWDOWN.LIVING_ANNUITY_MIN)}–${pct(RETIREMENT_DRAWDOWN.LIVING_ANNUITY_MAX)}).`,
    );
  }
  assumptionNotes.push(
    contributionAboveDeductibleLimit > 0
      ? `Recommended contributions of ${rand(annualRecommendedContribution)} p.a. exceed the s11F deductible limit of ${rand(deductibleContributionLimit)} (27.5% of income, capped at ${rand(RETIREMENT_S11F.ANNUAL_CAP)}); ${rand(contributionAboveDeductibleLimit)} would not be deductible this year.`
      : `Recommended contributions of ${rand(annualRecommendedContribution)} p.a. are within the s11F deductible limit of ${rand(deductibleContributionLimit)} (combined pension, provident and RA, including employer contributions).`,
  );
  if (incomeBasis === 'net') {
    assumptionNotes.push(
      'The s11F limit above is worked out on net income, so the real limit (on remuneration) is higher.',
    );
  }

  return {
    yearsToRetirement,
    yearsInRetirement,
    realGrowthRate: preRetReturn,
    realSalaryGrowth: salaryEscalation,
    targetMonthlyIncome: finite(targetMonthlyIncome),
    requiredCapital: finite(requiredCapital),
    projectedCapital: finite(projectedCapital),
    capitalShortfall: finite(capitalShortfall),
    hasShortfall,
    shortfallPercentage: finite(shortfallPercentage),
    requiredAdditionalContribution: finite(requiredAdditionalContribution),
    totalRecommendedContribution: finite(totalRecommendedContribution),
    percentageOfIncome: finite(percentageOfIncome),

    incomeBasis,
    incomeUsedForTarget,
    replacementRatio: replaceRatio,
    inflationRate: inflation,
    preRetirementReturn: preRetReturn,
    postRetirementReturn: postRetReturn,
    premiumEscalation,

    otherMonthlyIncomeAtRetirement: finite(otherMonthlyIncomeAtRetirement),
    monthlyIncomeFromCapital: finite(monthlyIncomeFromCapital),
    projectedRetirementSavings: finite(projectedRetirementSavings),
    projectedOtherCapital: finite(projectedOtherCapital),
    projectedContributions: finite(projectedContributions),

    targetMonthlyIncomeToday: finite(targetMonthlyIncome / deflator),
    requiredCapitalToday: finite(requiredCapital / deflator),
    projectedCapitalToday: finite(projectedCapital / deflator),
    capitalShortfallToday: finite(capitalShortfall / deflator),

    initialDrawdownRate: initialDrawdownRate === null ? null : finite(initialDrawdownRate),
    drawdownStatus,

    annualRecommendedContribution: finite(annualRecommendedContribution),
    deductibleContributionLimit: finite(deductibleContributionLimit),
    contributionAboveDeductibleLimit: finite(contributionAboveDeductibleLimit),
    exceedsDeductibleLimit: contributionAboveDeductibleLimit > 0,

    assumptionNotes,
  };
}
