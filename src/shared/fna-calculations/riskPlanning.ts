/**
 * Risk Planning FNA — calculation engine (system version 3.0.0)
 *
 * The ONE implementation of the risk needs analysis. The admin wizard
 * (src/components/admin/modules/risk-planning-fna) calculates with it in the
 * browser, and the Edge Function (risk-planning-fna-routes.ts) recalculates
 * with it when a draft's inputs are updated. Before 3.0.0 the two sides had
 * their own copies with different constants (estate costs 3.99% here, 5% on
 * the server; different disability multiples), so the same inputs stored
 * different numbers depending on which side calculated last.
 *
 * Method — a capital needs analysis, not income multiples:
 *
 * - Life cover: immediate capital (debts, funeral, estate costs) + the
 *   present value of the household's income need over the dependants'
 *   provision term + the present value of each dependant's education costs,
 *   less liquid assets the family can use. Existing cover is then offset.
 * - Lump-sum disability: the present value of the client's lost income to
 *   retirement age, less the capitalised value of existing permanent income
 *   protection (which already replaces part of that income), plus once-off
 *   adaptation and care costs.
 * - Severe illness: gross-income bands (unchanged method).
 * - Income protection: 100% of net income, checked against an insurable
 *   maximum (unchanged method).
 *
 * Every present value is an annuity paid annually in advance, escalating at
 * an escalation rate and discounted at the investment return assumption,
 * i.e. discounted at the real rate (1 + return) / (1 + escalation) − 1.
 *
 * Deterministic and dependency-free so both runtimes import it unchanged
 * (the server imports it with a `.ts` extension). Old records calculated by
 * the 1.x / 2.x engines keep every result field they had; fields added in 3.0.0
 * are optional on the types so those records still type-check and render.
 */

// ==================== TYPES ====================

export type EmploymentType = 'employed' | 'self-employed';

export type IPBenefitPeriod = '6-months' | '12-months' | '24-months';

export type IPEscalationType =
  'fixed-1' | 'fixed-2' | 'fixed-3' | 'fixed-4' | 'fixed-5' | 'cpi-linked' | 'level';

export interface Dependant {
  id: string;
  relationship: string;
  dependencyTerm: number; // years
  monthlyEducationCost: number;
}

export interface ExistingCover {
  life: { personal: number; group: number };
  disability: { personal: number; group: number };
  severeIllness: { personal: number; group: number };
  incomeProtection: {
    temporary: { personal: number; group: number };
    permanent: { personal: number; group: number };
  };
}

export interface IncomeProtectionSettings {
  temporary: { benefitPeriod: IPBenefitPeriod };
  permanent: { escalation: IPEscalationType };
}

/**
 * Step 1 input. The assumption fields at the bottom were added in 3.0.0 and are
 * optional: drafts and intakes saved before then calculate with the defaults in
 * RISK_ASSUMPTION_DEFAULTS.
 */
export interface RiskCalculationInput {
  // Income
  grossMonthlyIncome: number;
  grossAnnualIncome: number; // grossMonthlyIncome × 12
  netMonthlyIncome: number;
  netAnnualIncome: number; // netMonthlyIncome × 12
  incomeEscalationAssumption: number; // % a year, e.g. 6

  // Personal
  currentAge: number;
  retirementAge: number;
  employmentType: EmploymentType;

  dependants: Dependant[];

  // Financial position
  totalOutstandingDebts: number;
  totalCurrentAssets: number;
  totalEstateValue: number; // totalCurrentAssets − totalOutstandingDebts

  // Spouse
  spouseFullName?: string;
  spouseAverageMonthlyIncome?: number;
  combinedHouseholdIncome: number;
  clientIncomePercentage: number;

  totalHouseholdMonthlyExpenditure: number;

  existingCover: ExistingCover;
  incomeProtectionSettings: IncomeProtectionSettings;

  // Assumptions (3.0.0) — percentages are whole numbers (10 = 10%)
  /** Nominal return the capital is assumed to earn. Default 10. */
  investmentReturnAssumption?: number;
  /** Share of net income the household still needs if the client dies, when no expenditure is given. Default 75. */
  incomeReplacementRatio?: number;
  /** Share of net income to replace on permanent disability. Default 100. */
  disabilityIncomeReplacementRatio?: number;
  /** Yearly increase in education costs. Default 8. */
  educationInflationAssumption?: number;
  /** Cash and investments the family can use on death (not property). Default 0. */
  liquidAssetsAvailable?: number;
}

/** The economic assumptions a calculation actually used, as decimals. */
export interface RiskEconomicAssumptions {
  investmentReturn: number;
  incomeEscalation: number;
  educationInflation: number;
  /** Real return over income escalation: (1 + return) / (1 + escalation) − 1. */
  realReturn: number;
  incomeReplacementRatio: number;
  disabilityIncomeReplacementRatio: number;
}

export type IncomeNeedBasis =
  'household-expenditure' | 'income-replacement-ratio' | 'no-dependants';

export interface LifeCoverCalculation {
  immediateCapital: {
    outstandingDebt: number;
    funeralFinalExpenses: number;
    estateCosts: number;
    total: number;
  };
  incomeReplacementCapital: {
    netAnnualIncome: number;
    /** Since 3.0.0: the equivalent multiple of net annual income (total ÷ net income), for comparison. */
    incomeMultiple: number;
    total: number;
    basis?: IncomeNeedBasis;
    /** Year-one income the household needs replaced. */
    annualIncomeNeed?: number;
    /** Years of provision: the longest dependant's dependency term. */
    provisionTerm?: number;
    householdExpenditureAnnual?: number;
    spouseIncomeAnnual?: number;
    replacementRatio?: number;
  };
  educationCapital: {
    perDependant: Array<{
      dependantId: string;
      relationship: string;
      monthlyEducationCost: number;
      dependencyTerm: number;
      total: number;
    }>;
    total: number;
  };
  /** Immediate + income replacement + education capital (3.0.0). */
  totalCapitalNeed?: number;
  /** Liquid assets offset against the need (3.0.0). */
  liquidAssetsOffset?: number;
  /** Capital to insure: since 3.0.0, totalCapitalNeed less liquid assets. */
  grossNeed: number;
  existingCover: { personal: number; group: number; total: number };
  netShortfall: number;
  economicAssumptions?: RiskEconomicAssumptions;
  assumptions: string[];
  riskNotes: string[];
}

export interface DisabilityCoverCalculation {
  capitalisedIncomeLoss: {
    netAnnualIncome: number;
    /** Since 3.0.0: the equivalent multiple of net annual income (total ÷ net income). */
    disabilityMultiple: number;
    /** Since 3.0.0: capitalised loss AFTER the permanent income protection offset. */
    total: number;
    annualIncomeNeed?: number;
    replacementRatio?: number;
    /** Years from current age to retirement age. */
    termYears?: number;
    /** Present value of the income need before the IP offset. */
    grossCapitalisedLoss?: number;
    /** Present value of existing permanent income protection over the same term. */
    permanentIPOffset?: number;
  };
  additionalDisabilityCosts: {
    homeModifications: number;
    vehicleAdaptation: number;
    medicalEquipment: number;
    onceOffCareCosts: number;
    total: number;
  };
  grossNeed: number;
  existingCover: { personal: number; group: number; total: number };
  netShortfall: number;
  economicAssumptions?: RiskEconomicAssumptions;
  assumptions: string[];
  riskNotes: string[];
}

export interface SevereIllnessCoverCalculation {
  grossAnnualIncome: number;
  incomeMultiple: number;
  grossNeed: number;
  existingCover: { personal: number; group: number; total: number };
  netShortfall: number;
  assumptions: string[];
  riskNotes: string[];
}

export interface IncomeProtectionCalculation {
  temporary: {
    calculatedNeed: number; // 100% of net monthly income
    insurableMaximum: number;
    exceedsLimit: boolean;
    benefitPeriod: IPBenefitPeriod;
    existingCover: { personal: number; group: number; total: number };
    netShortfall: number;
  };
  permanent: {
    calculatedNeed: number;
    insurableMaximum: number;
    exceedsLimit: boolean;
    escalation: IPEscalationType;
    benefitTerm: number; // retirementAge − currentAge
    existingCover: { personal: number; group: number; total: number };
    netShortfall: number;
  };
  assumptions: string[];
  riskNotes: string[];
}

export interface RiskCalculations {
  life: LifeCoverCalculation;
  disability: DisabilityCoverCalculation;
  severeIllness: SevereIllnessCoverCalculation;
  incomeProtection: IncomeProtectionCalculation;
  metadata: {
    calculatedAt: string;
    calculatedBy: string;
    systemVersion: string;
  };
}

// ==================== CONSTANTS ====================

export const RISK_SYSTEM_VERSION = '3.0.0';

/** Defaults for the 3.0.0 assumption inputs, as whole-number percentages. */
export const RISK_ASSUMPTION_DEFAULTS = {
  INVESTMENT_RETURN: 10,
  INCOME_ESCALATION: 6,
  INCOME_REPLACEMENT_RATIO: 75,
  DISABILITY_INCOME_REPLACEMENT_RATIO: 100,
  EDUCATION_INFLATION: 8,
  LIQUID_ASSETS_AVAILABLE: 0,
} as const;

export const LIFE_COVER = {
  FUNERAL_FINAL_EXPENSES: 100_000,
  /** Executor's fee: 3.5% tariff plus 15% VAT = 4.025% (was 3.99%, i.e. 14% VAT). */
  ESTATE_COSTS_PERCENTAGE: 0.04025,
} as const;

export const DISABILITY_COVER = {
  HOME_MODIFICATIONS: 0,
  VEHICLE_ADAPTATION: 150_000,
  MEDICAL_EQUIPMENT: 200_000,
  ONCE_OFF_CARE_COSTS: 150_000,
} as const;

/**
 * Bands are matched on the upper bound only (first band whose maxIncome the
 * income does not exceed), so there is no gap between R500,000 and R500,001.
 */
export const SEVERE_ILLNESS_COVER = {
  BANDS: [
    { minIncome: 0, maxIncome: 500_000, multiple: 2, label: 'R0 – R500,000 p.a.' },
    {
      minIncome: 500_000,
      maxIncome: 1_500_000,
      multiple: 3,
      label: 'Over R500,000 – R1,500,000 p.a.',
    },
    { minIncome: 1_500_000, maxIncome: Infinity, multiple: 5, label: 'Over R1,500,000 p.a.' },
  ],
} as const;

export const INCOME_PROTECTION = {
  NET_INCOME_PERCENTAGE: 1.0,
  DEFAULT_INSURABLE_MAXIMUM_MONTHLY: 150_000,
  EXCEEDS_LIMIT_WARNING:
    'Calculated need exceeds typical insurer limits and may be restricted by underwriting.',
  BENEFIT_PERIODS: [
    { value: '6-months', label: '6 months' },
    { value: '12-months', label: '12 months' },
    { value: '24-months', label: '24 months' },
  ] as const,
  ESCALATION_OPTIONS: [
    { value: 'fixed-1', label: 'Fixed 1%' },
    { value: 'fixed-2', label: 'Fixed 2%' },
    { value: 'fixed-3', label: 'Fixed 3%' },
    { value: 'fixed-4', label: 'Fixed 4%' },
    { value: 'fixed-5', label: 'Fixed 5%' },
    { value: 'cpi-linked', label: 'CPI-Linked' },
    { value: 'level', label: 'Level' },
  ] as const,
} as const;

// ==================== HELPERS ====================

/** R1,234,567 — whole rands, comma thousands, identical in Deno and the browser. */
function rand(amount: number): string {
  if (!Number.isFinite(amount)) return 'R0';
  const whole = Math.round(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}R${whole}`;
}

function pct(decimal: number): string {
  const value = Math.round(decimal * 10_000) / 100;
  return `${value}%`;
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** A percentage input (10 = 10%) as a decimal, or the default when missing/invalid. */
function rateOrDefault(value: unknown, defaultPercent: number): number {
  if (value === undefined || value === null || value === '') return defaultPercent / 100;
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : defaultPercent / 100;
}

/** (1 + return) / (1 + escalation) − 1. */
export function realRate(nominalReturn: number, escalation: number): number {
  return (1 + nominalReturn) / (1 + escalation) - 1;
}

/**
 * Present value today of `years` annual payments made in advance, the first
 * equal to `firstPayment`, each later one growing at `escalation`, discounted
 * at `nominalReturn`:
 *
 *   PV = P × Σ_{k=0}^{n−1} ((1 + g) / (1 + i))^k
 *      = P × (1 − v^n) / (1 − v),  v = (1 + g) / (1 + i)
 *
 * When return equals escalation (real rate 0) every term is 1 and PV = P × n.
 * Fractional years are allowed (the sum is extended continuously).
 */
export function presentValueOfEscalatingAnnuity(
  firstPayment: number,
  years: number,
  nominalReturn: number,
  escalation: number,
): number {
  if (!(firstPayment > 0) || !(years > 0)) return 0;
  const v = (1 + escalation) / (1 + nominalReturn);
  if (Math.abs(1 - v) < 1e-12) return firstPayment * years;
  return (firstPayment * (1 - Math.pow(v, years))) / (1 - v);
}

/**
 * Yearly escalation of an existing income protection benefit, from the policy's
 * escalation option: level 0%, fixed N%, CPI-linked at the income escalation
 * assumption (the analysis's inflation proxy). Unknown or missing options are
 * treated as CPI-linked, the form's default.
 */
export function ipBenefitEscalationRate(
  escalation: IPEscalationType | undefined,
  cpiProxy: number,
): number {
  if (escalation === 'level') return 0;
  const fixed = /^fixed-(\d+)$/.exec(escalation ?? '');
  if (fixed) return Number(fixed[1]) / 100;
  return cpiProxy;
}

/** The assumptions a calculation uses, with defaults for inputs saved before 3.0.0. */
export function resolveRiskAssumptions(
  input: Partial<RiskCalculationInput>,
): RiskEconomicAssumptions {
  const investmentReturn = rateOrDefault(
    input.investmentReturnAssumption,
    RISK_ASSUMPTION_DEFAULTS.INVESTMENT_RETURN,
  );
  const incomeEscalation = rateOrDefault(
    input.incomeEscalationAssumption,
    RISK_ASSUMPTION_DEFAULTS.INCOME_ESCALATION,
  );
  return {
    investmentReturn,
    incomeEscalation,
    educationInflation: rateOrDefault(
      input.educationInflationAssumption,
      RISK_ASSUMPTION_DEFAULTS.EDUCATION_INFLATION,
    ),
    realReturn: realRate(investmentReturn, incomeEscalation),
    incomeReplacementRatio: rateOrDefault(
      input.incomeReplacementRatio,
      RISK_ASSUMPTION_DEFAULTS.INCOME_REPLACEMENT_RATIO,
    ),
    disabilityIncomeReplacementRatio: rateOrDefault(
      input.disabilityIncomeReplacementRatio,
      RISK_ASSUMPTION_DEFAULTS.DISABILITY_INCOME_REPLACEMENT_RATIO,
    ),
  };
}

function coverPair(pair: { personal?: unknown; group?: unknown } | undefined) {
  const personal = num(pair?.personal);
  const group = num(pair?.group);
  return { personal, group, total: personal + group };
}

/**
 * Coerce a loosely-typed input (an old draft, an intake, a request body) into
 * a complete RiskCalculationInput. Missing numbers become 0, missing annual
 * figures are derived from the monthly ones, and assumption fields are kept
 * as given (resolveRiskAssumptions applies their defaults).
 */
export function normaliseRiskInput(raw: unknown): RiskCalculationInput {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const cover = (r.existingCover ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const ip = (cover.incomeProtection ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const settings = (r.incomeProtectionSettings ?? {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;

  const grossMonthlyIncome = num(r.grossMonthlyIncome);
  const netMonthlyIncome = num(r.netMonthlyIncome);
  const spouseMonthly =
    r.spouseAverageMonthlyIncome === undefined || r.spouseAverageMonthlyIncome === null
      ? undefined
      : num(r.spouseAverageMonthlyIncome);
  const totalCurrentAssets = num(r.totalCurrentAssets);
  const totalOutstandingDebts = num(r.totalOutstandingDebts);
  const optionalNumber = (value: unknown) =>
    value === undefined || value === null || value === '' ? undefined : num(value);

  return {
    grossMonthlyIncome,
    grossAnnualIncome: optionalNumber(r.grossAnnualIncome) ?? grossMonthlyIncome * 12,
    netMonthlyIncome,
    netAnnualIncome: optionalNumber(r.netAnnualIncome) ?? netMonthlyIncome * 12,
    incomeEscalationAssumption: num(
      r.incomeEscalationAssumption,
      RISK_ASSUMPTION_DEFAULTS.INCOME_ESCALATION,
    ),
    currentAge: num(r.currentAge),
    retirementAge: num(r.retirementAge),
    employmentType: r.employmentType === 'self-employed' ? 'self-employed' : 'employed',
    dependants: (Array.isArray(r.dependants) ? r.dependants : []).map((d, idx) => {
      const dep = (d ?? {}) as Record<string, unknown>;
      return {
        id: typeof dep.id === 'string' ? dep.id : `dependant-${idx + 1}`,
        relationship: typeof dep.relationship === 'string' ? dep.relationship : 'Dependant',
        dependencyTerm: Math.max(0, num(dep.dependencyTerm)),
        monthlyEducationCost: Math.max(0, num(dep.monthlyEducationCost)),
      };
    }),
    totalOutstandingDebts,
    totalCurrentAssets,
    totalEstateValue:
      optionalNumber(r.totalEstateValue) ?? totalCurrentAssets - totalOutstandingDebts,
    spouseFullName: typeof r.spouseFullName === 'string' ? r.spouseFullName : undefined,
    spouseAverageMonthlyIncome: spouseMonthly,
    combinedHouseholdIncome:
      optionalNumber(r.combinedHouseholdIncome) ?? grossMonthlyIncome + (spouseMonthly ?? 0),
    clientIncomePercentage: num(r.clientIncomePercentage, 100),
    totalHouseholdMonthlyExpenditure: num(r.totalHouseholdMonthlyExpenditure),
    existingCover: {
      life: coverPair(cover.life),
      disability: coverPair(cover.disability),
      severeIllness: coverPair(cover.severeIllness),
      incomeProtection: {
        temporary: coverPair(ip.temporary),
        permanent: coverPair(ip.permanent),
      },
    },
    incomeProtectionSettings: {
      temporary: {
        benefitPeriod: (settings.temporary?.benefitPeriod ?? '12-months') as IPBenefitPeriod,
      },
      permanent: {
        escalation: (settings.permanent?.escalation ?? 'cpi-linked') as IPEscalationType,
      },
    },
    investmentReturnAssumption: optionalNumber(r.investmentReturnAssumption),
    incomeReplacementRatio: optionalNumber(r.incomeReplacementRatio),
    disabilityIncomeReplacementRatio: optionalNumber(r.disabilityIncomeReplacementRatio),
    educationInflationAssumption: optionalNumber(r.educationInflationAssumption),
    liquidAssetsAvailable: optionalNumber(r.liquidAssetsAvailable),
  };
}

function equivalentMultiple(capital: number, netAnnualIncome: number): number {
  if (!(netAnnualIncome > 0)) return 0;
  return Math.round((capital / netAnnualIncome) * 10) / 10;
}

function economicAssumptionLines(a: RiskEconomicAssumptions): string[] {
  return [
    `Investment return ${pct(a.investmentReturn)} a year; income escalation ${pct(
      a.incomeEscalation,
    )} a year (real return ${pct(a.realReturn)})`,
    'Present values assume income is paid yearly in advance, escalating each year',
  ];
}

// ==================== LIFE COVER ====================

/**
 * Life cover: a capital needs analysis.
 *
 * 1. Immediate capital = outstanding debt + funeral costs + estate costs
 *    (executor's fee 3.5% + VAT on the estate value).
 * 2. Income replacement capital = PV of the household's yearly income need over
 *    the provision term (the longest dependant's dependency term).
 *    - With household expenditure: (expenditure − surviving spouse's income) × 12,
 *      floored at 0 and capped at the client's net annual income.
 *    - Without it: net annual income × the income replacement ratio.
 *    - With no dependants there is no one to provide for: 0, and the life need
 *      is immediate capital only.
 * 3. Education capital = PV of each dependant's education costs over their
 *    term, escalating at education inflation.
 * 4. Gross need = total capital need − liquid assets available; net shortfall =
 *    gross need − existing personal and group life cover.
 */
export function calculateLifeCover(input: RiskCalculationInput): LifeCoverCalculation {
  const a = resolveRiskAssumptions(input);
  const netAnnualIncome = num(input.netAnnualIncome);
  const dependants = input.dependants ?? [];

  // 1. Immediate capital
  const outstandingDebt = Math.max(0, num(input.totalOutstandingDebts));
  const estateCosts = Math.max(0, num(input.totalEstateValue) * LIFE_COVER.ESTATE_COSTS_PERCENTAGE);
  const immediateCapital = {
    outstandingDebt,
    funeralFinalExpenses: LIFE_COVER.FUNERAL_FINAL_EXPENSES,
    estateCosts,
    total: outstandingDebt + LIFE_COVER.FUNERAL_FINAL_EXPENSES + estateCosts,
  };

  // 2. Income replacement capital
  const provisionTerm = dependants.reduce((max, d) => Math.max(max, num(d.dependencyTerm)), 0);
  const householdExpenditureAnnual = Math.max(0, num(input.totalHouseholdMonthlyExpenditure)) * 12;
  const spouseIncomeAnnual = Math.max(0, num(input.spouseAverageMonthlyIncome)) * 12;

  let basis: IncomeNeedBasis;
  let annualIncomeNeed: number;
  if (dependants.length === 0 || provisionTerm <= 0) {
    basis = 'no-dependants';
    annualIncomeNeed = 0;
  } else if (householdExpenditureAnnual > 0) {
    basis = 'household-expenditure';
    annualIncomeNeed = Math.min(
      Math.max(0, netAnnualIncome),
      Math.max(0, householdExpenditureAnnual - spouseIncomeAnnual),
    );
  } else {
    basis = 'income-replacement-ratio';
    annualIncomeNeed = Math.max(0, netAnnualIncome) * a.incomeReplacementRatio;
  }

  const incomeCapital = presentValueOfEscalatingAnnuity(
    annualIncomeNeed,
    provisionTerm,
    a.investmentReturn,
    a.incomeEscalation,
  );

  const incomeReplacementCapital = {
    netAnnualIncome,
    incomeMultiple: equivalentMultiple(incomeCapital, netAnnualIncome),
    total: incomeCapital,
    basis,
    annualIncomeNeed,
    provisionTerm: basis === 'no-dependants' ? 0 : provisionTerm,
    householdExpenditureAnnual,
    spouseIncomeAnnual,
    replacementRatio: a.incomeReplacementRatio,
  };

  // 3. Education capital
  const perDependant = dependants.map((dep) => ({
    dependantId: dep.id,
    relationship: dep.relationship,
    monthlyEducationCost: num(dep.monthlyEducationCost),
    dependencyTerm: num(dep.dependencyTerm),
    total: presentValueOfEscalatingAnnuity(
      num(dep.monthlyEducationCost) * 12,
      num(dep.dependencyTerm),
      a.investmentReturn,
      a.educationInflation,
    ),
  }));
  const educationCapital = {
    perDependant,
    total: perDependant.reduce((sum, d) => sum + d.total, 0),
  };

  // 4. Need, offsets, shortfall
  const totalCapitalNeed = immediateCapital.total + incomeCapital + educationCapital.total;
  const liquidAssetsOffset = Math.min(
    totalCapitalNeed,
    Math.max(0, num(input.liquidAssetsAvailable, RISK_ASSUMPTION_DEFAULTS.LIQUID_ASSETS_AVAILABLE)),
  );
  const grossNeed = Math.max(0, totalCapitalNeed - liquidAssetsOffset);
  const existingCover = coverPair(input.existingCover?.life);
  const netShortfall = Math.max(0, grossNeed - existingCover.total);

  const basisLine =
    basis === 'household-expenditure'
      ? `Income need: household expenditure ${rand(householdExpenditureAnnual)} less spouse income ${rand(
          spouseIncomeAnnual,
        )} a year = ${rand(annualIncomeNeed)} (capped at net income ${rand(netAnnualIncome)})`
      : basis === 'income-replacement-ratio'
        ? `Income need: ${pct(a.incomeReplacementRatio)} of net income ${rand(netAnnualIncome)} = ${rand(
            annualIncomeNeed,
          )} a year (no household expenditure given)`
        : 'Income need: none — no dependants, so life cover covers immediate capital only';

  const assumptions = [
    'Method: capital needs analysis (present value of needs less available assets)',
    basisLine,
    ...(basis === 'no-dependants'
      ? []
      : [
          `Income replacement capital: ${rand(annualIncomeNeed)} a year for ${provisionTerm} years = ${rand(
            incomeCapital,
          )} (${incomeReplacementCapital.incomeMultiple}× net income)`,
        ]),
    `Education capital: ${rand(educationCapital.total)} (education inflation ${pct(
      a.educationInflation,
    )} a year)`,
    `Immediate capital: debts ${rand(outstandingDebt)} + funeral ${rand(
      LIFE_COVER.FUNERAL_FINAL_EXPENSES,
    )} + estate costs ${rand(estateCosts)} (${pct(LIFE_COVER.ESTATE_COSTS_PERCENTAGE)} of estate: 3.5% executor's fee + VAT)`,
    `Total capital need ${rand(totalCapitalNeed)} less liquid assets ${rand(
      liquidAssetsOffset,
    )} = ${rand(grossNeed)}`,
    ...economicAssumptionLines(a),
  ];

  const riskNotes = [
    'Life cover should let dependants clear debt, maintain their standard of living and complete their education.',
    `Capital is assumed to be invested at ${pct(a.investmentReturn)} a year and drawn down over the provision term; a lower return needs more capital.`,
    'Retirement fund death benefits are distributed by the fund trustees (s37C) and are not counted as available assets.',
    'Review upon material life events (marriage, birth, divorce, debt changes).',
  ];

  return {
    immediateCapital,
    incomeReplacementCapital,
    educationCapital,
    totalCapitalNeed,
    liquidAssetsOffset,
    grossNeed,
    existingCover,
    netShortfall,
    economicAssumptions: a,
    assumptions,
    riskNotes,
  };
}

// ==================== DISABILITY ====================

/**
 * Lump-sum disability: PV of net income × replacement ratio from today to
 * retirement age, less the PV of existing permanent income protection over the
 * same term (both escalating at income escalation), plus once-off costs.
 */
export function calculateDisabilityCover(input: RiskCalculationInput): DisabilityCoverCalculation {
  const a = resolveRiskAssumptions(input);
  const netAnnualIncome = num(input.netAnnualIncome);
  const termYears = Math.max(0, num(input.retirementAge) - num(input.currentAge));
  const annualIncomeNeed = Math.max(0, netAnnualIncome) * a.disabilityIncomeReplacementRatio;

  const grossCapitalisedLoss = presentValueOfEscalatingAnnuity(
    annualIncomeNeed,
    termYears,
    a.investmentReturn,
    a.incomeEscalation,
  );
  const permanentIPMonthly = coverPair(input.existingCover?.incomeProtection?.permanent).total;
  const permanentIPEscalationType = input.incomeProtectionSettings?.permanent?.escalation;
  const permanentIPEscalation = ipBenefitEscalationRate(
    permanentIPEscalationType,
    a.incomeEscalation,
  );
  const permanentIPOffset = Math.min(
    grossCapitalisedLoss,
    presentValueOfEscalatingAnnuity(
      permanentIPMonthly * 12,
      termYears,
      a.investmentReturn,
      permanentIPEscalation,
    ),
  );
  const capitalisedTotal = Math.max(0, grossCapitalisedLoss - permanentIPOffset);

  const capitalisedIncomeLoss = {
    netAnnualIncome,
    disabilityMultiple: equivalentMultiple(capitalisedTotal, netAnnualIncome),
    total: capitalisedTotal,
    annualIncomeNeed,
    replacementRatio: a.disabilityIncomeReplacementRatio,
    termYears,
    grossCapitalisedLoss,
    permanentIPOffset,
  };

  const additionalDisabilityCosts = {
    homeModifications: DISABILITY_COVER.HOME_MODIFICATIONS,
    vehicleAdaptation: DISABILITY_COVER.VEHICLE_ADAPTATION,
    medicalEquipment: DISABILITY_COVER.MEDICAL_EQUIPMENT,
    onceOffCareCosts: DISABILITY_COVER.ONCE_OFF_CARE_COSTS,
    total:
      DISABILITY_COVER.HOME_MODIFICATIONS +
      DISABILITY_COVER.VEHICLE_ADAPTATION +
      DISABILITY_COVER.MEDICAL_EQUIPMENT +
      DISABILITY_COVER.ONCE_OFF_CARE_COSTS,
  };

  const grossNeed = capitalisedTotal + additionalDisabilityCosts.total;
  const existingCover = coverPair(input.existingCover?.disability);
  const netShortfall = Math.max(0, grossNeed - existingCover.total);

  const assumptions = [
    'Method: present value of lost income to retirement age, less existing permanent income protection',
    `Income need: ${pct(a.disabilityIncomeReplacementRatio)} of net income = ${rand(
      annualIncomeNeed,
    )} a year for ${termYears} years (to age ${num(input.retirementAge)}) = ${rand(
      grossCapitalisedLoss,
    )}`,
    `Less existing permanent income protection ${rand(permanentIPMonthly)} a month, escalating at ${pct(
      permanentIPEscalation,
    )} a year, capitalised = ${rand(permanentIPOffset)}`,
    `Capitalised income loss: ${rand(capitalisedTotal)} (${capitalisedIncomeLoss.disabilityMultiple}× net income)`,
    `Once-off costs: vehicle adaptation ${rand(DISABILITY_COVER.VEHICLE_ADAPTATION)}, medical equipment ${rand(
      DISABILITY_COVER.MEDICAL_EQUIPMENT,
    )}, care ${rand(DISABILITY_COVER.ONCE_OFF_CARE_COSTS)}`,
    ...economicAssumptionLines(a),
  ];

  const riskNotes = [
    'Lump sum disability cover provides capital for income loss and adaptation costs.',
    'Assumes total and permanent disability as defined by the insurer.',
    'Existing permanent income protection already replaces part of the income, so it is offset to avoid over-insurance.',
    'Consider pairing with income protection for ongoing income replacement.',
  ];

  return {
    capitalisedIncomeLoss,
    additionalDisabilityCosts,
    grossNeed,
    existingCover,
    netShortfall,
    economicAssumptions: a,
    assumptions,
    riskNotes,
  };
}

// ==================== SEVERE ILLNESS ====================

export function calculateSevereIllnessCover(
  input: RiskCalculationInput,
): SevereIllnessCoverCalculation {
  const grossAnnualIncome = num(input.grossAnnualIncome);
  const band =
    SEVERE_ILLNESS_COVER.BANDS.find((b) => grossAnnualIncome <= b.maxIncome) ??
    SEVERE_ILLNESS_COVER.BANDS[SEVERE_ILLNESS_COVER.BANDS.length - 1];
  const incomeMultiple = band.multiple;
  const grossNeed = Math.max(0, grossAnnualIncome) * incomeMultiple;
  const existingCover = coverPair(input.existingCover?.severeIllness);
  const netShortfall = Math.max(0, grossNeed - existingCover.total);

  return {
    grossAnnualIncome,
    incomeMultiple,
    grossNeed,
    existingCover,
    netShortfall,
    assumptions: [
      `Income band: ${band.label}`,
      `Income multiple: ${incomeMultiple}×`,
      `Gross annual income: ${rand(grossAnnualIncome)}`,
    ],
    riskNotes: [
      'Severe illness cover provides a lump sum upon diagnosis of specified conditions.',
      'Common conditions include cancer, heart attack, stroke, and organ failure.',
      'Benefit typically pays out once, accelerating death benefit.',
    ],
  };
}

// ==================== INCOME PROTECTION ====================

export function calculateIncomeProtection(
  input: RiskCalculationInput,
): IncomeProtectionCalculation {
  const calculatedNeed = num(input.netMonthlyIncome) * INCOME_PROTECTION.NET_INCOME_PERCENTAGE;
  const insurableMaximum = INCOME_PROTECTION.DEFAULT_INSURABLE_MAXIMUM_MONTHLY;
  const exceedsLimit = calculatedNeed > insurableMaximum;
  const tempExisting = coverPair(input.existingCover?.incomeProtection?.temporary);
  const permExisting = coverPair(input.existingCover?.incomeProtection?.permanent);
  const benefitTerm = num(input.retirementAge) - num(input.currentAge);
  const settings = input.incomeProtectionSettings;

  const riskNotes = [
    'Income protection replaces income during disability, subject to waiting periods.',
    'Temporary IP typically covers short-term disabilities (6-24 months).',
    'Permanent IP provides income until recovery or retirement age.',
    'Do not cross-offset temporary and permanent benefits.',
  ];
  if (exceedsLimit) riskNotes.push(INCOME_PROTECTION.EXCEEDS_LIMIT_WARNING);

  return {
    temporary: {
      calculatedNeed,
      insurableMaximum,
      exceedsLimit,
      benefitPeriod: settings?.temporary?.benefitPeriod ?? '12-months',
      existingCover: tempExisting,
      netShortfall: Math.max(0, calculatedNeed - tempExisting.total),
    },
    permanent: {
      calculatedNeed,
      insurableMaximum,
      exceedsLimit,
      escalation: settings?.permanent?.escalation ?? 'cpi-linked',
      benefitTerm,
      existingCover: permExisting,
      netShortfall: Math.max(0, calculatedNeed - permExisting.total),
    },
    assumptions: [
      `Calculated need: ${rand(calculatedNeed)} per month (100% of net income)`,
      `Insurable maximum: ${rand(insurableMaximum)} per month`,
      `Benefit term (permanent): ${benefitTerm} years (to age ${num(input.retirementAge)})`,
      `Temporary benefit period: ${settings?.temporary?.benefitPeriod ?? '12-months'}`,
      `Permanent escalation: ${settings?.permanent?.escalation ?? 'cpi-linked'}`,
    ],
    riskNotes,
  };
}

// ==================== ENTRY POINT ====================

export function calculateRiskAnalysis(
  input: RiskCalculationInput,
  calculatedBy: string = 'System',
): RiskCalculations {
  return {
    life: calculateLifeCover(input),
    disability: calculateDisabilityCover(input),
    severeIllness: calculateSevereIllnessCover(input),
    incomeProtection: calculateIncomeProtection(input),
    metadata: {
      calculatedAt: new Date().toISOString(),
      calculatedBy,
      systemVersion: RISK_SYSTEM_VERSION,
    },
  };
}
