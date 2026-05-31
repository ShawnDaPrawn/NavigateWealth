import { describe, expect, it } from 'vitest';
import { TaxPlanningCalculationService } from '../taxPlanningCalculationService';
import {
  TAX_YEAR_2026_2027,
  type TaxCalculationResults,
  type TaxPlanningInputs,
} from '../../types';

const TC = TAX_YEAR_2026_2027;

function makeInputs(overrides: Partial<TaxPlanningInputs> = {}): TaxPlanningInputs {
  return {
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
    age: 40,
    ...overrides,
  } as unknown as TaxPlanningInputs;
}

describe('TaxPlanningCalculationService.calculate — core pipeline', () => {
  it('computes tax for an employment-only earner in the first bracket', () => {
    const r = TaxPlanningCalculationService.calculate(
      makeInputs({ employmentIncome: 100000, age: 40 }),
    );
    expect(r.grossIncome).toBe(100000);
    expect(r.taxableIncome).toBe(100000);
    expect(r.incomeTaxBeforeRebates).toBeCloseTo(18000, 2); // 100000 * 18%
    expect(r.netIncomeTax).toBeCloseTo(Math.max(0, 18000 - r.primaryRebate), 2);
    expect(r.dividendTax).toBe(0);
    expect(r.cgtPayable).toBe(0);
    expect(r.totalTaxLiability).toBeCloseTo(r.netIncomeTax, 2);
    expect(r.effectiveTaxRate).toBeCloseTo(r.totalTaxLiability / 100000, 6);
  });

  it('applies the progressive table in a higher bracket', () => {
    const r = TaxPlanningCalculationService.calculate(
      makeInputs({ employmentIncome: 300000, age: 40 }),
    );
    // bracket starting at 245100: base 44118 + (300000-245100) * 26%
    expect(r.incomeTaxBeforeRebates).toBeCloseTo(44118 + (300000 - 245100) * 0.26, 2);
  });

  it('floors net income tax at zero for low earners', () => {
    const r = TaxPlanningCalculationService.calculate(
      makeInputs({ employmentIncome: 10000, age: 40 }),
    );
    expect(r.netIncomeTax).toBe(0);
  });

  it('returns a 0 effective rate when there is no economic income', () => {
    expect(TaxPlanningCalculationService.calculate(makeInputs()).effectiveTaxRate).toBe(0);
  });
});

describe('calculate — interest exemption & rebates by age', () => {
  it('caps the interest exemption by age band', () => {
    const under = TaxPlanningCalculationService.calculate(
      makeInputs({ interestIncome: 1_000_000, age: 40 }),
    );
    const over = TaxPlanningCalculationService.calculate(
      makeInputs({ interestIncome: 1_000_000, age: 70 }),
    );
    expect(under.interestExemption).toBe(TC.INTEREST_EXEMPTION_UNDER_65);
    expect(over.interestExemption).toBe(TC.INTEREST_EXEMPTION_OVER_65);
    expect(under.taxableInterest).toBe(1_000_000 - TC.INTEREST_EXEMPTION_UNDER_65);
  });

  it('adds secondary/tertiary rebates at 65 and 75', () => {
    expect(TaxPlanningCalculationService.calculate(makeInputs({ age: 40 })).secondaryRebate).toBe(
      0,
    );
    expect(
      TaxPlanningCalculationService.calculate(makeInputs({ age: 65 })).secondaryRebate,
    ).toBeGreaterThan(0);
    expect(
      TaxPlanningCalculationService.calculate(makeInputs({ age: 75 })).tertiaryRebate,
    ).toBeGreaterThan(0);
  });
});

describe('calculate — RA deduction, CGT, medical credits, dividends, TFSA', () => {
  it('caps the RA deduction at 27.5% of income / the annual cap and reports the gap', () => {
    const r = TaxPlanningCalculationService.calculate(
      makeInputs({ employmentIncome: 1_000_000, raContributions: 50_000, age: 40 }),
    );
    const expectedMax = Math.min(Math.max(0, 1_000_000 * TC.RA_DEDUCTION_RATE), TC.RA_ANNUAL_CAP);
    expect(r.maxAllowedRADeduction).toBeCloseTo(expectedMax, 2);
    expect(r.actualRADeduction).toBeCloseTo(Math.min(expectedMax, 50_000), 2);
    expect(r.raGap).toBeCloseTo(Math.max(0, expectedMax - 50_000), 2);
  });

  it('includes a taxable capital gain and isolates the CGT component', () => {
    const r = TaxPlanningCalculationService.calculate(
      makeInputs({
        employmentIncome: 500_000,
        capitalGainsRealised: TC.CGT_ANNUAL_EXCLUSION + 200_000,
        age: 40,
      }),
    );
    expect(r.cgtPayable).toBeGreaterThan(0);
  });

  it('computes Section 6A medical credits by member count', () => {
    const credits = (members: number) =>
      TaxPlanningCalculationService.calculate(makeInputs({ medicalSchemeMembers: members }))
        .medicalTaxCredits;
    expect(credits(0)).toBe(0);
    expect(credits(1)).toBeCloseTo(TC.MEDICAL_CREDIT_MAIN * 12, 2);
    expect(credits(2)).toBeCloseTo((TC.MEDICAL_CREDIT_MAIN + TC.MEDICAL_CREDIT_FIRST_DEP) * 12, 2);
    expect(credits(4)).toBeCloseTo(
      (TC.MEDICAL_CREDIT_MAIN + TC.MEDICAL_CREDIT_FIRST_DEP + 2 * TC.MEDICAL_CREDIT_ADDITIONAL) *
        12,
      2,
    );
  });

  it('applies flat dividend withholding tax', () => {
    const r = TaxPlanningCalculationService.calculate(makeInputs({ dividendIncome: 100_000 }));
    expect(r.dividendTax).toBeCloseTo(100_000 * TC.DIVIDEND_WITHHOLDING_RATE, 2);
  });

  it('reports remaining lifetime TFSA capacity', () => {
    expect(TaxPlanningCalculationService.calculate(makeInputs()).tfsaRemainingLifetime).toBe(
      TC.TFSA_LIFETIME_LIMIT,
    );
    expect(
      TaxPlanningCalculationService.calculate(
        makeInputs({ tfsaContributionsLifetime: TC.TFSA_LIFETIME_LIMIT + 50_000 }),
      ).tfsaRemainingLifetime,
    ).toBe(0);
  });
});

describe('generateRecommendations', () => {
  it('surfaces RA, interest, and TFSA recommendations when gaps exist', () => {
    const results = TaxPlanningCalculationService.calculate(
      makeInputs({
        employmentIncome: 1_500_000,
        interestIncome: 200_000,
        raContributions: 0,
        tfsaContributionsLifetime: 0,
        age: 40,
      }),
    );
    const ids = TaxPlanningCalculationService.generateRecommendations(results).map((r) => r.id);
    expect(ids).toContain('rec_ra');
    expect(ids).toContain('rec_int');
    expect(ids).toContain('rec_tfsa');
  });

  it('returns no recommendations when there are no gaps', () => {
    const results: TaxCalculationResults = {
      raGap: 0,
      interestTaxLeakage: 0,
      tfsaRemainingLifetime: 0,
    } as unknown as TaxCalculationResults;
    expect(TaxPlanningCalculationService.generateRecommendations(results)).toEqual([]);
  });
});
