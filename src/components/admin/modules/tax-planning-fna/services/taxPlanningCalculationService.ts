import {
  TAX_YEAR_2026_2027,
  TaxPlanningInputs,
  TaxCalculationResults,
  TaxRecommendation,
} from '../types';
import { formatCurrencyWhole } from '../../../../../utils/currencyFormatter';

/**
 * 2026/2027 Tax Brackets (Individuals)
 * Source: SARS — year of assessment 1 March 2026 to 28 February 2027
 */
const TAX_BRACKETS = [
  { threshold: 0, base: 0, rate: 0.18 },
  { threshold: 245100, base: 44118, rate: 0.26 },
  { threshold: 383100, base: 79998, rate: 0.31 },
  { threshold: 530200, base: 125599, rate: 0.36 },
  { threshold: 695800, base: 185215, rate: 0.39 },
  { threshold: 887000, base: 259783, rate: 0.41 },
  { threshold: 1878600, base: 666339, rate: 0.45 },
];

/**
 * 2026/2027 Rebates
 */
const REBATES = {
  PRIMARY: 17820,
  SECONDARY: 9765,
  TERTIARY: 3249,
};

/** Optional numeric input → a finite, non-negative number (absent on older FNAs). */
function amount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export class TaxPlanningCalculationService {
  static calculate(inputs: TaxPlanningInputs): TaxCalculationResults {
    const TC = TAX_YEAR_2026_2027;

    // ==========================================
    // STEP 2 SEQUENCE (Deterministic Flow)
    // ==========================================

    // 1) Gross Income (receipts). Rental and business income are entered gross;
    //    their allowable expenses are deducted in step 1b. Interest is part of
    //    gross income; the exemption is applied as a deduction.
    const grossIncome =
      inputs.employmentIncome +
      inputs.variableIncome +
      inputs.businessIncome +
      inputs.rentalIncome +
      inputs.foreignIncome +
      inputs.interestIncome;

    // 1b) Allowable rental / business expenses. A net loss reduces other income
    //     here; s20A ring-fencing may disallow that (flagged in the notes).
    const rentalExpenses = amount(inputs.rentalExpenses);
    const businessExpenses = amount(inputs.businessExpenses);
    const allowableExpenses = rentalExpenses + businessExpenses;

    // 2) Interest Exemption
    const exemptionCap =
      inputs.age >= 65 ? TC.INTEREST_EXEMPTION_OVER_65 : TC.INTEREST_EXEMPTION_UNDER_65;

    const interestExemption = Math.min(inputs.interestIncome, exemptionCap);
    const taxableInterest = inputs.interestIncome - interestExemption;

    // 3) Section 11F retirement fund deduction
    //    One limit covers RA, pension and provident contributions, including
    //    the employer's (the employer contribution is a taxable fringe benefit
    //    and a deemed employee contribution).
    //    Limit = min(R430,000, 27.5% × greater of remuneration or taxable income),
    //    where taxable income is before s11F and excludes taxable capital gains.
    const remuneration = inputs.employmentIncome + inputs.variableIncome;
    const taxableIncomeBeforeS11F = grossIncome - allowableExpenses - interestExemption;
    const retirementDeductionBase = Math.max(remuneration, taxableIncomeBeforeS11F);
    const calculatedCap = retirementDeductionBase * TC.RA_DEDUCTION_RATE;
    const maxAllowedRADeduction = Math.min(Math.max(0, calculatedCap), TC.RA_ANNUAL_CAP);

    const totalRetirementContributions =
      amount(inputs.raContributions) + amount(inputs.employerFundContributions);

    // The deduction also cannot exceed taxable income before s11F (excluding
    // the taxable capital gain).
    const actualRADeduction = Math.min(
      maxAllowedRADeduction,
      totalRetirementContributions,
      Math.max(0, taxableIncomeBeforeS11F),
    );
    const nonDeductibleRetirementContributions = Math.max(
      0,
      totalRetirementContributions - actualRADeduction,
    );

    // 4) CGT Inclusion
    const annualExclusion = TC.CGT_ANNUAL_EXCLUSION;
    const taxableGain = Math.max(0, inputs.capitalGainsRealised - annualExclusion);
    const includedGain = taxableGain * TC.CGT_INCLUSION_RATE_INDIVIDUAL;

    // 5) Taxable Income
    const taxableIncome = Math.max(0, taxableIncomeBeforeS11F - actualRADeduction + includedGain);

    // 6) SARS Progressive Tax Tables
    const incomeTaxBeforeRebates = this.lookupTaxTable(taxableIncome);

    // 7) Rebates (age on the last day of the tax year)
    let rebateTotal = REBATES.PRIMARY;
    if (inputs.age >= 65) rebateTotal += REBATES.SECONDARY;
    if (inputs.age >= 75) rebateTotal += REBATES.TERTIARY;

    // 8) Medical Tax Credits — Section 6A (scheme fees) and Section 6B
    //    (additional medical expenses). 6B depends on taxable income for
    //    taxpayers under 65, so it is recomputed for the no-CGT comparison.
    const medicalTaxCredits = this.calculateMedicalCredits(inputs.medicalSchemeMembers);
    const additionalMedicalTaxCredit = this.calculateAdditionalMedicalCredit(
      inputs,
      medicalTaxCredits,
      taxableIncome,
    );

    // 9) Net Income Tax (cannot be negative)
    const netIncomeTax = Math.max(
      0,
      incomeTaxBeforeRebates - rebateTotal - medicalTaxCredits - additionalMedicalTaxCredit,
    );

    // 10) Dividend Withholding Tax (flat 20%, separate from normal tax)
    const dividendTax = inputs.dividendIncome * TC.DIVIDEND_WITHHOLDING_RATE;

    // 11) Isolate CGT component for display
    // Method: (Tax with CGT) - (Tax without CGT), using the same rebates & credits
    const taxableIncomeNoCGT = Math.max(0, taxableIncome - includedGain);
    const additionalMedicalTaxCreditNoCGT = this.calculateAdditionalMedicalCredit(
      inputs,
      medicalTaxCredits,
      taxableIncomeNoCGT,
    );
    const taxNoCGT = Math.max(
      0,
      this.lookupTaxTable(taxableIncomeNoCGT) -
        rebateTotal -
        medicalTaxCredits -
        additionalMedicalTaxCreditNoCGT,
    );
    const cgtPayable = Math.max(0, netIncomeTax - taxNoCGT);

    // 12) Totals and Effective Rate
    // CGT is already inside netIncomeTax — do not double count
    const totalTaxLiability = netIncomeTax + dividendTax;

    // Denominator: economic income (income after allowable expenses + dividends + gains)
    const economicGross =
      grossIncome - allowableExpenses + inputs.dividendIncome + inputs.capitalGainsRealised;
    const effectiveTaxRate = economicGross > 0 ? totalTaxLiability / economicGross : 0;

    // ==========================================
    // GAP ANALYSIS & LEAKAGE (Math Only)
    // ==========================================

    // Unused s11F capacity after ALL fund contributions (RA + employer fund).
    const raGap = Math.max(0, maxAllowedRADeduction - totalRetirementContributions);
    const marginalRate = this.getMarginalRate(taxableIncome);
    const raTaxSavingPotential = raGap * marginalRate;
    const interestTaxLeakage = taxableInterest * marginalRate;
    const tfsaRemainingLifetime = Math.max(
      0,
      TC.TFSA_LIFETIME_LIMIT - inputs.tfsaContributionsLifetime,
    );
    const tfsaRemainingThisYear = Math.max(
      0,
      Math.min(
        TC.TFSA_ANNUAL_LIMIT - amount(inputs.tfsaContributionsThisYear),
        tfsaRemainingLifetime,
      ),
    );

    return {
      grossIncome,
      interestExemption,
      taxableInterest,
      maxAllowedRADeduction,
      actualRADeduction,
      taxableIncome,
      incomeTaxBeforeRebates,
      primaryRebate: REBATES.PRIMARY,
      secondaryRebate: inputs.age >= 65 ? REBATES.SECONDARY : 0,
      tertiaryRebate: inputs.age >= 75 ? REBATES.TERTIARY : 0,
      medicalTaxCredits,
      netIncomeTax,
      dividendTax,
      cgtPayable,
      totalTaxLiability,
      effectiveTaxRate,
      raGap,
      raTaxSavingPotential,
      interestTaxLeakage,
      tfsaRemainingLifetime,
      allowableExpenses,
      totalRetirementContributions,
      retirementDeductionBase,
      nonDeductibleRetirementContributions,
      additionalMedicalTaxCredit,
      marginalRate,
      tfsaRemainingThisYear,
      notes: this.buildNotes(inputs, {
        rentalExpenses,
        businessExpenses,
        nonDeductibleRetirementContributions,
      }),
    };
  }

  /**
   * What the calculation assumes, or does not model, for this client. Shown
   * with the results so the adviser and client can see the limits of the figure.
   */
  static buildNotes(
    inputs: TaxPlanningInputs,
    derived: {
      rentalExpenses: number;
      businessExpenses: number;
      nonDeductibleRetirementContributions: number;
    },
  ): string[] {
    const notes: string[] = [
      "Rebates and the interest exemption use the client's age on the last day of the tax year (28 February 2027).",
    ];

    if (inputs.taxResidency === 'non_resident' || inputs.taxResidency === 'dual') {
      notes.push(
        'Calculated on the South African resident basis (worldwide income). A non-resident is taxed only on SA-source income, and a dual resident may be treated as non-resident under a tax treaty — the liability may differ materially.',
      );
    }
    if (inputs.maritalStatus === 'married_in_community') {
      notes.push(
        "Married in community of property: s7(2C) splits interest, dividends, rental income and capital gains on joint assets equally between the spouses. This calculation taxes the amounts entered in full in the client's hands.",
      );
    }
    if (inputs.foreignIncome > 0) {
      notes.push(
        'Foreign income is taxed in full here. The s10(1)(o)(ii) foreign employment exemption (up to R1.25 million) and s6quat credits for foreign tax paid are not modelled.',
      );
    }
    const netRental = inputs.rentalIncome - derived.rentalExpenses;
    const netBusiness = inputs.businessIncome - derived.businessExpenses;
    if (netRental < 0 || netBusiness < 0) {
      notes.push(
        'A rental or business loss has been set off against other income. Section 20A may ring-fence the loss if the client\'s taxable income is at or above the maximum marginal rate threshold and the activity is a "suspect" trade.',
      );
    }
    if (derived.nonDeductibleRetirementContributions > 0) {
      notes.push(
        `Retirement contributions of ${formatCurrencyWhole(derived.nonDeductibleRetirementContributions)} exceed this year's deduction limit. They carry forward to later years and can be deducted against retirement lump sums or annuity income.`,
      );
    }
    return notes;
  }

  /**
   * Section 6A Medical Scheme Fees Tax Credit
   * Main member + first dependant: R376/month each (2026/2027)
   * Each additional dependant: R254/month
   * Applied as a direct reduction of tax after rebates
   */
  static calculateMedicalCredits(totalMembers: number): number {
    const TC = TAX_YEAR_2026_2027;
    if (totalMembers <= 0) return 0;

    let monthlyCredit = 0;

    // Main member always gets the primary credit
    monthlyCredit += TC.MEDICAL_CREDIT_MAIN;

    // First dependant (member 2) gets the first-dependant credit
    if (totalMembers >= 2) {
      monthlyCredit += TC.MEDICAL_CREDIT_FIRST_DEP;
    }

    // Additional dependants (member 3+) get the lower credit
    if (totalMembers > 2) {
      monthlyCredit += (totalMembers - 2) * TC.MEDICAL_CREDIT_ADDITIONAL;
    }

    // Annualise (12 months)
    return monthlyCredit * 12;
  }

  /**
   * Section 6B Additional Medical Expenses Tax Credit
   *
   * Aged 65+, or the taxpayer / spouse / child has a disability:
   *   33.3% × [(scheme contributions − 3 × s6A credit) + out-of-pocket expenses]
   * Under 65 with no disability:
   *   25% × [(scheme contributions − 4 × s6A credit) + out-of-pocket expenses
   *          − 7.5% × taxable income]
   * Each "excess contributions" part is floored at zero, and so is the credit.
   * Applied after the s6A credit; it cannot make net tax negative.
   */
  static calculateAdditionalMedicalCredit(
    inputs: TaxPlanningInputs,
    annualS6ACredit: number,
    taxableIncome: number,
  ): number {
    const TC = TAX_YEAR_2026_2027;
    const contributions = amount(inputs.medicalSchemeContributions);
    const outOfPocket = amount(inputs.outOfPocketMedicalExpenses);
    if (contributions === 0 && outOfPocket === 0) return 0;

    if (inputs.age >= 65 || inputs.hasDisability === true) {
      const excessContributions = Math.max(
        0,
        contributions - TC.S6B_CONTRIBUTION_MULTIPLE_65_OR_DISABLED * annualS6ACredit,
      );
      return TC.S6B_RATE_65_OR_DISABLED * (excessContributions + outOfPocket);
    }

    const excessContributions = Math.max(
      0,
      contributions - TC.S6B_CONTRIBUTION_MULTIPLE_UNDER_65 * annualS6ACredit,
    );
    const qualifying =
      excessContributions +
      outOfPocket -
      TC.S6B_TAXABLE_INCOME_THRESHOLD * Math.max(0, taxableIncome);
    return TC.S6B_RATE_UNDER_65 * Math.max(0, qualifying);
  }

  private static lookupTaxTable(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0;

    const sortedBrackets = [...TAX_BRACKETS].sort((a, b) => b.threshold - a.threshold);
    const bracket = sortedBrackets.find((b) => taxableIncome >= b.threshold);

    if (!bracket) return 0;

    const amountAbove = taxableIncome - bracket.threshold;
    return bracket.base + amountAbove * bracket.rate;
  }

  private static getMarginalRate(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0.18;

    const sortedBrackets = [...TAX_BRACKETS].sort((a, b) => b.threshold - a.threshold);
    const bracket = sortedBrackets.find((b) => taxableIncome >= b.threshold);
    return bracket ? bracket.rate : 0.18;
  }

  static generateRecommendations(results: TaxCalculationResults): TaxRecommendation[] {
    const recs: TaxRecommendation[] = [];
    const TC = TAX_YEAR_2026_2027;

    // TFSA room this year. FNAs calculated before the annual figure existed
    // only know the lifetime room, so cap that at the annual limit.
    const tfsaRoomThisYear =
      results.tfsaRemainingThisYear ??
      Math.min(TC.TFSA_ANNUAL_LIMIT, results.tfsaRemainingLifetime ?? 0);

    // 1. Retirement fund deduction gap — already net of employer fund contributions
    if (results.raGap > 0) {
      recs.push({
        id: 'rec_ra',
        triggerType: 'RA_GAP',
        title: 'Maximize Retirement Contributions',
        description: `After all retirement annuity, pension and provident contributions (including the employer's), ${formatCurrencyWhole(results.raGap)} of the annual s11F deduction limit is unused. Contributing it could save about ${formatCurrencyWhole(results.raTaxSavingPotential)} in tax this year. The money is preserved until retirement, subject to the two-pot rules.`,
        impactValue: results.raTaxSavingPotential,
        status: 'pending',
      });
    }

    // 2. Interest leakage. An endowment only helps when the client's marginal
    //    rate is above the 30% rate the endowment fund itself pays.
    if (results.interestTaxLeakage > 0) {
      const marginal = results.marginalRate;
      const endowmentHelps = marginal !== undefined && marginal > TC.ENDOWMENT_WRAPPER_RATE;
      const tfsaPart =
        tfsaRoomThisYear > 0
          ? `Use the ${formatCurrencyWhole(tfsaRoomThisYear)} of TFSA room left this year first — interest inside a TFSA is fully exempt.`
          : 'The TFSA allowance for this year is already used.';
      const endowmentPart = endowmentHelps
        ? ` For larger amounts, an endowment taxes interest at ${Math.round(TC.ENDOWMENT_WRAPPER_RATE * 100)}% inside the policy instead of the client's ${Math.round((marginal ?? 0) * 100)}% marginal rate (subject to the 5-year restriction period).`
        : marginal !== undefined
          ? ` An endowment is not recommended: it pays ${Math.round(TC.ENDOWMENT_WRAPPER_RATE * 100)}% tax inside the policy, which is not lower than the client's ${Math.round(marginal * 100)}% marginal rate.`
          : '';
      recs.push({
        id: 'rec_int',
        triggerType: 'INTEREST_LEAKAGE',
        title: 'Optimize Interest-Bearing Investments',
        description: `${formatCurrencyWhole(results.interestTaxLeakage)} of tax is paid on interest above the annual exemption. ${tfsaPart}${endowmentPart}`,
        impactValue: results.interestTaxLeakage,
        status: 'pending',
      });
    }

    // 3. TFSA — only when there is room this year
    if (tfsaRoomThisYear > 0) {
      recs.push({
        id: 'rec_tfsa',
        triggerType: 'TFSA_CAPACITY',
        title: 'Utilize Tax-Free Savings Allowance',
        description: `${formatCurrencyWhole(tfsaRoomThisYear)} of this year's ${formatCurrencyWhole(TC.TFSA_ANNUAL_LIMIT)} TFSA allowance is unused (${formatCurrencyWhole(results.tfsaRemainingLifetime)} of the ${formatCurrencyWhole(TC.TFSA_LIFETIME_LIMIT)} lifetime limit remains). Growth, interest and dividends inside a TFSA are tax-free. Contributions above the limits are taxed at 40%.`,
        impactValue: 0,
        status: 'pending',
      });
    }

    return recs;
  }
}
