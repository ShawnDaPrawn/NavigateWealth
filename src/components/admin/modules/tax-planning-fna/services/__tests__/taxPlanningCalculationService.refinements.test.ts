/**
 * Tax Planning FNA — refinements to the deterministic engine:
 *   • one s11F limit shared by RA, pension and provident contributions
 *   • the s11F base (greater of remuneration or taxable income, excl. CGT)
 *   • rental / business expenses
 *   • TFSA room this year
 *   • the endowment recommendation only above a 30% marginal rate
 *   • the s6B additional medical expenses credit
 *
 * Expected values are worked by hand from the 2026/27 tables.
 */
import { describe, expect, it } from 'vitest';
import { TaxPlanningCalculationService as Tax } from '../taxPlanningCalculationService';
import {
  TAX_YEAR_2026_2027,
  type TaxCalculationResults,
  type TaxPlanningInputs,
} from '../../types';

const TC = TAX_YEAR_2026_2027;

function makeInputs(overrides: Partial<TaxPlanningInputs> = {}): TaxPlanningInputs {
  return {
    age: 40,
    maritalStatus: 'single',
    taxResidency: 'resident',
    numberOfDependants: 0,
    employmentIncome: 0,
    variableIncome: 0,
    businessIncome: 0,
    rentalIncome: 0,
    foreignIncome: 0,
    interestIncome: 0,
    dividendIncome: 0,
    capitalGainsRealised: 0,
    raContributions: 0,
    tfsaContributionsLifetime: 0,
    medicalSchemeMembers: 0,
    ...overrides,
  };
}

describe('s11F — one limit for RA, pension and provident contributions', () => {
  it('counts employer fund contributions against the same limit', () => {
    const r = Tax.calculate(
      makeInputs({
        employmentIncome: 1_000_000,
        raContributions: 50_000,
        employerFundContributions: 200_000,
      }),
    );
    expect(r.maxAllowedRADeduction).toBe(275_000); // 27.5% × 1,000,000
    expect(r.totalRetirementContributions).toBe(250_000);
    expect(r.actualRADeduction).toBe(250_000);
    expect(r.raGap).toBe(25_000); // not 225,000 as when only the RA was counted
    expect(r.taxableIncome).toBe(750_000);
    expect(r.marginalRate).toBe(0.39);
    expect(r.raTaxSavingPotential).toBeCloseTo(9_750, 6); // 25,000 × 39%
  });

  it('carries forward contributions above the limit and says so', () => {
    const r = Tax.calculate(
      makeInputs({ employmentIncome: 1_000_000, employerFundContributions: 300_000 }),
    );
    expect(r.actualRADeduction).toBe(275_000);
    expect(r.nonDeductibleRetirementContributions).toBe(25_000);
    expect(r.raGap).toBe(0);
    expect(r.notes?.some((n) => n.includes('carry forward'))).toBe(true);
  });

  it('uses the greater of remuneration or taxable income as the base', () => {
    // Remuneration 200,000; taxable income before s11F 200,000 + (400,000 − 100,000).
    const r = Tax.calculate(
      makeInputs({ employmentIncome: 200_000, rentalIncome: 400_000, rentalExpenses: 100_000 }),
    );
    expect(r.retirementDeductionBase).toBe(500_000);
    expect(r.maxAllowedRADeduction).toBe(137_500); // was 165,000 on gross receipts
  });

  it('excludes the taxable capital gain from the base', () => {
    const r = Tax.calculate(
      makeInputs({ employmentIncome: 100_000, capitalGainsRealised: 1_050_000 }),
    );
    expect(r.retirementDeductionBase).toBe(100_000);
    expect(r.maxAllowedRADeduction).toBeCloseTo(27_500, 6);
    expect(r.taxableIncome).toBeCloseTo(500_000, 6); // 100,000 + 40% × (1,050,000 − 50,000)
  });

  it('is unchanged for an FNA saved before the new inputs existed', () => {
    const r = Tax.calculate(makeInputs({ employmentIncome: 1_000_000, raContributions: 50_000 }));
    expect(r.maxAllowedRADeduction).toBe(275_000);
    expect(r.actualRADeduction).toBe(50_000);
    expect(r.raGap).toBe(225_000);
    expect(r.taxableIncome).toBe(950_000);
  });
});

describe('rental and business expenses', () => {
  it('taxes rental income net of expenses', () => {
    const r = Tax.calculate(
      makeInputs({ employmentIncome: 300_000, rentalIncome: 120_000, rentalExpenses: 70_000 }),
    );
    expect(r.grossIncome).toBe(420_000);
    expect(r.allowableExpenses).toBe(70_000);
    expect(r.taxableIncome).toBe(350_000);
  });

  it('sets a business loss off against other income and flags s20A', () => {
    const r = Tax.calculate(
      makeInputs({
        employmentIncome: 500_000,
        businessIncome: 100_000,
        businessExpenses: 150_000,
      }),
    );
    expect(r.taxableIncome).toBe(450_000);
    expect(r.notes?.some((n) => n.includes('20A'))).toBe(true);
  });

  it('measures the effective rate on income after expenses', () => {
    const r = Tax.calculate(
      makeInputs({ employmentIncome: 300_000, rentalIncome: 120_000, rentalExpenses: 70_000 }),
    );
    expect(r.effectiveTaxRate).toBeCloseTo(r.totalTaxLiability / 350_000, 10);
  });
});

describe('TFSA room this year', () => {
  it('is the annual limit less this year, capped by the lifetime room', () => {
    expect(
      Tax.calculate(
        makeInputs({ tfsaContributionsThisYear: 30_000, tfsaContributionsLifetime: 100_000 }),
      ).tfsaRemainingThisYear,
    ).toBe(16_000);
    expect(
      Tax.calculate(makeInputs({ tfsaContributionsLifetime: 490_000 })).tfsaRemainingThisYear,
    ).toBe(10_000);
  });

  it('recommends the TFSA only when there is room this year, and states the amount', () => {
    const full = Tax.calculate(makeInputs({ tfsaContributionsThisYear: TC.TFSA_ANNUAL_LIMIT }));
    expect(Tax.generateRecommendations(full).map((r) => r.id)).not.toContain('rec_tfsa');

    const partial = Tax.calculate(makeInputs({ tfsaContributionsThisYear: 30_000 }));
    const rec = Tax.generateRecommendations(partial).find((r) => r.id === 'rec_tfsa');
    expect(rec?.description).toContain('16');
  });

  it('caps an older FNA (lifetime room only) at the annual limit', () => {
    const legacy = {
      raGap: 0,
      interestTaxLeakage: 0,
      tfsaRemainingLifetime: 300_000,
    } as unknown as TaxCalculationResults;
    const rec = Tax.generateRecommendations(legacy).find((r) => r.id === 'rec_tfsa');
    expect(rec?.description).toContain('46');
  });
});

describe('interest leakage — endowment only above a 30% marginal rate', () => {
  it('does not suggest an endowment at an 18% marginal rate', () => {
    const r = Tax.calculate(makeInputs({ interestIncome: 200_000 }));
    expect(r.marginalRate).toBe(0.18);
    expect(r.interestTaxLeakage).toBeCloseTo(176_200 * 0.18, 6);
    const rec = Tax.generateRecommendations(r).find((x) => x.id === 'rec_int');
    expect(rec?.description).toContain('not recommended');
  });

  it('suggests an endowment at a 45% marginal rate', () => {
    const r = Tax.calculate(makeInputs({ employmentIncome: 1_900_000, interestIncome: 200_000 }));
    expect(r.marginalRate).toBe(0.45);
    const rec = Tax.generateRecommendations(r).find((x) => x.id === 'rec_int');
    expect(rec?.description).toContain('an endowment taxes interest at 30%');
  });
});

describe('s6B additional medical expenses credit', () => {
  it('under 65: 25% of the excess over 4 × s6A and 7.5% of taxable income', () => {
    const r = Tax.calculate(
      makeInputs({
        employmentIncome: 400_000,
        medicalSchemeMembers: 2,
        medicalSchemeContributions: 60_000,
        outOfPocketMedicalExpenses: 30_000,
      }),
    );
    expect(r.medicalTaxCredits).toBe(9_024); // (376 + 376) × 12
    // excess contributions 60,000 − 36,096 = 23,904; + 30,000 − 30,000 (7.5% × 400,000)
    expect(r.additionalMedicalTaxCredit).toBeCloseTo(5_976, 6);
    // 85,237 − 17,820 − 9,024 − 5,976
    expect(r.netIncomeTax).toBeCloseTo(52_417, 6);
  });

  it('65 and older: 33.3% of the excess over 3 × s6A plus out-of-pocket expenses', () => {
    const r = Tax.calculate(
      makeInputs({
        age: 70,
        employmentIncome: 300_000,
        medicalSchemeMembers: 1,
        medicalSchemeContributions: 30_000,
        outOfPocketMedicalExpenses: 10_000,
      }),
    );
    // 30,000 − 3 × 4,512 = 16,464; 0.333 × (16,464 + 10,000)
    expect(r.additionalMedicalTaxCredit).toBeCloseTo(8_812.512, 6);
  });

  it('a disability qualifies for the 33.3% rate under 65', () => {
    const r = Tax.calculate(
      makeInputs({
        employmentIncome: 300_000,
        medicalSchemeMembers: 1,
        medicalSchemeContributions: 30_000,
        outOfPocketMedicalExpenses: 10_000,
        hasDisability: true,
      }),
    );
    expect(r.additionalMedicalTaxCredit).toBeCloseTo(8_812.512, 6);
  });

  it('is zero when the expenses do not exceed the thresholds', () => {
    const r = Tax.calculate(
      makeInputs({
        employmentIncome: 400_000,
        medicalSchemeMembers: 2,
        medicalSchemeContributions: 30_000,
        outOfPocketMedicalExpenses: 5_000,
      }),
    );
    expect(r.additionalMedicalTaxCredit).toBe(0);
  });

  it('recomputes s6B without the gain when isolating CGT', () => {
    const r = Tax.calculate(
      makeInputs({
        employmentIncome: 400_000,
        capitalGainsRealised: 150_000,
        medicalSchemeMembers: 2,
        medicalSchemeContributions: 60_000,
        outOfPocketMedicalExpenses: 30_000,
      }),
    );
    expect(r.taxableIncome).toBe(440_000);
    // 23,904 + 30,000 − 33,000 = 20,904 → 25%
    expect(r.additionalMedicalTaxCredit).toBeCloseTo(5_226, 6);
    // 97,637 − 17,820 − 9,024 − 5,226
    expect(r.netIncomeTax).toBeCloseTo(65_567, 6);
    expect(r.cgtPayable).toBeCloseTo(65_567 - 52_417, 6);
  });
});

describe('notes on what the calculation does not model', () => {
  it('always states the age convention', () => {
    expect(Tax.calculate(makeInputs()).notes?.[0]).toContain('28 February 2027');
  });

  it('flags residency, marital regime and foreign income', () => {
    const notes =
      Tax.calculate(
        makeInputs({
          taxResidency: 'non_resident',
          maritalStatus: 'married_in_community',
          foreignIncome: 100_000,
        }),
      ).notes ?? [];
    expect(notes.some((n) => n.includes('resident basis'))).toBe(true);
    expect(notes.some((n) => n.includes('7(2C)'))).toBe(true);
    expect(notes.some((n) => n.includes('10(1)(o)(ii)'))).toBe(true);
  });
});
