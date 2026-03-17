import {
  TAX_YEAR_2026_2027,
  TaxPlanningInputs,
  TaxCalculationResults,
  TaxRecommendation
} from '../types';

/**
 * 2026/2027 Tax Brackets (Individuals)
 * Source: SARS — year of assessment 1 March 2026 to 28 February 2027
 */
const TAX_BRACKETS = [
  { threshold: 0,        base: 0,       rate: 0.18 },
  { threshold: 245100,   base: 44118,   rate: 0.26 },
  { threshold: 383100,   base: 79998,   rate: 0.31 },
  { threshold: 530200,   base: 125599,  rate: 0.36 },
  { threshold: 695800,   base: 185215,  rate: 0.39 },
  { threshold: 887000,   base: 259783,  rate: 0.41 },
  { threshold: 1878600,  base: 666339,  rate: 0.45 },
];

/**
 * 2026/2027 Rebates
 */
const REBATES = {
  PRIMARY: 17820,
  SECONDARY: 9765,
  TERTIARY: 3249,
};

export class TaxPlanningCalculationService {
  
  static calculate(inputs: TaxPlanningInputs): TaxCalculationResults {
    const TC = TAX_YEAR_2026_2027;

    // ==========================================
    // STEP 2 SEQUENCE (10-Step Deterministic Flow)
    // ==========================================

    // 1) Compute Gross Income (Income Base)
    // Sum of employment, variable, business, rental, foreign, and interest
    // Note: Interest is part of gross income; exemption is applied as a deduction
    const grossIncome = 
      inputs.employmentIncome +
      inputs.variableIncome +
      inputs.businessIncome +
      inputs.rentalIncome +
      inputs.foreignIncome +
      inputs.interestIncome;

    // 2) Apply Interest Exemption
    const exemptionCap = inputs.age >= 65 
      ? TC.INTEREST_EXEMPTION_OVER_65 
      : TC.INTEREST_EXEMPTION_UNDER_65;
    
    const interestExemption = Math.min(inputs.interestIncome, exemptionCap);
    const taxableInterest = inputs.interestIncome - interestExemption;

    // 3) Compute Allowable RA Deduction Cap
    // 27.5% of (Gross Income - Interest Exemption), capped at annual maximum
    const incomeBaseForRA = grossIncome - interestExemption; 
    const calculatedCap = incomeBaseForRA * TC.RA_DEDUCTION_RATE;
    const maxAllowedRADeduction = Math.min(
      Math.max(0, calculatedCap),
      TC.RA_ANNUAL_CAP
    );
    
    const actualRADeduction = Math.min(maxAllowedRADeduction, inputs.raContributions);

    // 4) Compute CGT Inclusion
    // CGT included gain is added to taxable income per standard SA tax law
    const annualExclusion = TC.CGT_ANNUAL_EXCLUSION;
    const taxableGain = Math.max(0, inputs.capitalGainsRealised - annualExclusion);
    const includedGain = taxableGain * TC.CGT_INCLUSION_RATE_INDIVIDUAL;

    // 5) Compute Taxable Income
    const taxableIncome = Math.max(0,
      grossIncome 
      - interestExemption 
      - actualRADeduction
      + includedGain
    );

    // 6) Apply SARS Progressive Tax Tables
    const incomeTaxBeforeRebates = this.lookupTaxTable(taxableIncome);

    // 7) Apply Rebates
    let rebateTotal = REBATES.PRIMARY;
    if (inputs.age >= 65) rebateTotal += REBATES.SECONDARY;
    if (inputs.age >= 75) rebateTotal += REBATES.TERTIARY;

    // 8) Compute Medical Tax Credits (Section 6A)
    // Main member + first dependant each get the primary credit rate
    // Additional dependants get the lower rate
    // Credits are calculated monthly and applied annually
    const medicalTaxCredits = this.calculateMedicalCredits(inputs.medicalSchemeMembers);

    // 9) Net Income Tax (cannot be negative)
    const netIncomeTax = Math.max(0, incomeTaxBeforeRebates - rebateTotal - medicalTaxCredits);

    // 10) Compute Dividend Withholding Tax (flat 20%, separate from normal tax)
    const dividendTax = inputs.dividendIncome * TC.DIVIDEND_WITHHOLDING_RATE;

    // 11) Isolate CGT component for display
    // Method: (Tax with CGT) - (Tax without CGT), using same rebates & credits
    const taxableIncomeNoCGT = Math.max(0, taxableIncome - includedGain);
    const taxNoCGT = Math.max(0, this.lookupTaxTable(taxableIncomeNoCGT) - rebateTotal - medicalTaxCredits);
    const cgtPayable = Math.max(0, netIncomeTax - taxNoCGT);

    // 12) Compute Totals and Effective Rate
    // CGT is already inside netIncomeTax — do not double count
    const totalTaxLiability = netIncomeTax + dividendTax;
    
    // Effective Rate denominator: total economic income (gross + dividends + capital gains)
    const economicGross = grossIncome + inputs.dividendIncome + inputs.capitalGainsRealised;
    const effectiveTaxRate = economicGross > 0 ? totalTaxLiability / economicGross : 0;

    // ==========================================
    // GAP ANALYSIS & LEAKAGE (Math Only)
    // ==========================================

    const raGap = Math.max(0, maxAllowedRADeduction - inputs.raContributions);
    const marginalRate = this.getMarginalRate(taxableIncome);
    const raTaxSavingPotential = raGap * marginalRate;
    const interestTaxLeakage = taxableInterest * marginalRate;
    const tfsaRemainingLifetime = Math.max(0, TC.TFSA_LIFETIME_LIMIT - inputs.tfsaContributionsLifetime);

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
      tfsaRemainingLifetime
    };
  }

  /**
   * Section 6A Medical Scheme Fees Tax Credit
   * Main member + first dependant: R376/month each (2026/2027)
   * Each additional dependant: R254/month
   * Applied as a direct reduction of tax after rebates
   */
  private static calculateMedicalCredits(totalMembers: number): number {
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

  private static lookupTaxTable(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0;

    const sortedBrackets = [...TAX_BRACKETS].sort((a, b) => b.threshold - a.threshold);
    const bracket = sortedBrackets.find(b => taxableIncome >= b.threshold);
    
    if (!bracket) return 0;

    const amountAbove = taxableIncome - bracket.threshold;
    return bracket.base + (amountAbove * bracket.rate);
  }

  private static getMarginalRate(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0.18;

    const sortedBrackets = [...TAX_BRACKETS].sort((a, b) => b.threshold - a.threshold);
    const bracket = sortedBrackets.find(b => taxableIncome >= b.threshold);
    return bracket ? bracket.rate : 0.18;
  }

  static generateRecommendations(results: TaxCalculationResults): TaxRecommendation[] {
    const recs: TaxRecommendation[] = [];
    const TC = TAX_YEAR_2026_2027;
    
    // 1. RA Gap
    if (results.raGap > 0) {
      recs.push({
        id: 'rec_ra',
        triggerType: 'RA_GAP',
        title: 'Maximize Retirement Contributions',
        description: `You have R${Math.round(results.raGap).toLocaleString()} of unused tax-deductible capacity. Contributing this amount could save you R${Math.round(results.raTaxSavingPotential).toLocaleString()} in tax.`,
        impactValue: results.raTaxSavingPotential,
        status: 'pending',
      });
    }

    // 2. Interest Leakage
    if (results.interestTaxLeakage > 0) {
       recs.push({
        id: 'rec_int',
        triggerType: 'INTEREST_LEAKAGE',
        title: 'Optimize Interest-Bearing Investments',
        description: `You are paying tax on interest income above your exemption. Consider moving funds to a Tax-Free Savings Account or endowment structure.`,
        impactValue: results.interestTaxLeakage,
        status: 'pending',
      });
    }

    // 3. TFSA
    if (results.tfsaRemainingLifetime > 0) {
       recs.push({
        id: 'rec_tfsa',
        triggerType: 'TFSA_CAPACITY',
        title: 'Utilize Tax-Free Savings Allowance',
        description: `Ensure you are using your annual R${TC.TFSA_ANNUAL_LIMIT.toLocaleString()} TFSA allowance to build tax-free wealth for the long term.`,
        impactValue: 0,
        status: 'pending',
      });
    }

    return recs;
  }
}
