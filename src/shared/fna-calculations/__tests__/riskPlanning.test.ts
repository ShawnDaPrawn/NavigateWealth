/**
 * Risk Planning FNA engine (3.0.0) — capital needs analysis.
 *
 * Expected values were computed by hand / by summing the yearly cash flows
 * term by term (Σ P·((1+g)/(1+i))^k for k = 0..n−1), independently of the
 * closed form the engine uses.
 */

import { describe, expect, it } from 'vitest';
import {
  calculateDisabilityCover,
  calculateIncomeProtection,
  calculateLifeCover,
  calculateRiskAnalysis,
  calculateSevereIllnessCover,
  LIFE_COVER,
  normaliseRiskInput,
  presentValueOfEscalatingAnnuity,
  realRate,
  resolveRiskAssumptions,
  RISK_SYSTEM_VERSION,
  type Dependant,
  type RiskCalculationInput,
} from '../riskPlanning';

function input(overrides: Partial<RiskCalculationInput> = {}): RiskCalculationInput {
  return {
    grossMonthlyIncome: 80_000,
    grossAnnualIncome: 960_000,
    netMonthlyIncome: 55_000,
    netAnnualIncome: 660_000,
    incomeEscalationAssumption: 6,
    currentAge: 35,
    retirementAge: 65,
    employmentType: 'employed',
    dependants: [],
    totalOutstandingDebts: 1_500_000,
    totalCurrentAssets: 3_000_000,
    totalEstateValue: 1_500_000,
    combinedHouseholdIncome: 80_000,
    clientIncomePercentage: 100,
    totalHouseholdMonthlyExpenditure: 0,
    existingCover: {
      life: { personal: 0, group: 0 },
      disability: { personal: 0, group: 0 },
      severeIllness: { personal: 0, group: 0 },
      incomeProtection: {
        temporary: { personal: 0, group: 0 },
        permanent: { personal: 0, group: 0 },
      },
    },
    incomeProtectionSettings: {
      temporary: { benefitPeriod: '12-months' },
      permanent: { escalation: 'cpi-linked' },
    },
    ...overrides,
  };
}

const child = (overrides: Partial<Dependant> = {}): Dependant => ({
  id: 'child-1',
  relationship: 'Child',
  dependencyTerm: 10,
  monthlyEducationCost: 0,
  ...overrides,
});

describe('presentValueOfEscalatingAnnuity', () => {
  it('discounts level payments in advance: 100,000 for 2 years at 10% = 190,909.09', () => {
    expect(presentValueOfEscalatingAnnuity(100_000, 2, 0.1, 0)).toBeCloseTo(190_909.0909, 3);
  });

  it('escalates payments: 100,000 for 3 years, +6% a year, at 10% = 289,223.14', () => {
    // 100,000 × (1 + 1.06/1.1 + (1.06/1.1)²)
    expect(presentValueOfEscalatingAnnuity(100_000, 3, 0.1, 0.06)).toBeCloseTo(289_223.1405, 3);
  });

  it('a real rate of 0 (return = escalation) is payment × years', () => {
    expect(presentValueOfEscalatingAnnuity(50_000, 10, 0.06, 0.06)).toBe(500_000);
  });

  it('is 0 for no payment or no term', () => {
    expect(presentValueOfEscalatingAnnuity(0, 10, 0.1, 0.06)).toBe(0);
    expect(presentValueOfEscalatingAnnuity(100_000, 0, 0.1, 0.06)).toBe(0);
    expect(presentValueOfEscalatingAnnuity(100_000, -3, 0.1, 0.06)).toBe(0);
  });

  it('realRate is (1 + i) / (1 + g) − 1', () => {
    expect(realRate(0.1, 0.06)).toBeCloseTo(0.0377358, 6);
    expect(realRate(0.06, 0.06)).toBe(0);
  });
});

describe('resolveRiskAssumptions', () => {
  it('applies the defaults to inputs saved before 3.0.0', () => {
    const a = resolveRiskAssumptions({});
    expect(a).toMatchObject({
      investmentReturn: 0.1,
      incomeEscalation: 0.06,
      educationInflation: 0.08,
      incomeReplacementRatio: 0.75,
      disabilityIncomeReplacementRatio: 1,
    });
  });

  it('uses the adviser’s values when given', () => {
    const a = resolveRiskAssumptions({
      investmentReturnAssumption: 9,
      incomeEscalationAssumption: 5,
      educationInflationAssumption: 7,
      incomeReplacementRatio: 70,
      disabilityIncomeReplacementRatio: 80,
    });
    expect(a.investmentReturn).toBeCloseTo(0.09);
    expect(a.incomeEscalation).toBeCloseTo(0.05);
    expect(a.educationInflation).toBeCloseTo(0.07);
    expect(a.incomeReplacementRatio).toBeCloseTo(0.7);
    expect(a.disabilityIncomeReplacementRatio).toBeCloseTo(0.8);
  });
});

describe('calculateLifeCover', () => {
  it('estate costs are 3.5% executor’s fee + 15% VAT = 4.025%', () => {
    expect(LIFE_COVER.ESTATE_COSTS_PERCENTAGE).toBeCloseTo(0.04025, 6);
    const r = calculateLifeCover(input({ totalEstateValue: 2_000_000 }));
    expect(r.immediateCapital.estateCosts).toBeCloseTo(80_500, 6);
  });

  it('with no dependants the need is immediate capital only', () => {
    const r = calculateLifeCover(input({ totalHouseholdMonthlyExpenditure: 45_000 }));
    expect(r.incomeReplacementCapital.basis).toBe('no-dependants');
    expect(r.incomeReplacementCapital.total).toBe(0);
    expect(r.incomeReplacementCapital.incomeMultiple).toBe(0);
    expect(r.educationCapital.total).toBe(0);
    // 1,500,000 debt + 100,000 funeral + 1,500,000 × 4.025% = 60,375
    expect(r.grossNeed).toBeCloseTo(1_660_375, 6);
    expect(r.netShortfall).toBeCloseTo(1_660_375, 6);
  });

  it('household expenditure less the surviving spouse’s income sets the income need', () => {
    const r = calculateLifeCover(
      input({
        dependants: [child({ dependencyTerm: 10 })],
        totalHouseholdMonthlyExpenditure: 45_000, // 540,000 a year
        spouseAverageMonthlyIncome: 20_000, // 240,000 a year
      }),
    );
    expect(r.incomeReplacementCapital.basis).toBe('household-expenditure');
    expect(r.incomeReplacementCapital.annualIncomeNeed).toBe(300_000);
    expect(r.incomeReplacementCapital.provisionTerm).toBe(10);
    // Σ 300,000 × (1.06/1.1)^k, k = 0..9
    expect(r.incomeReplacementCapital.total).toBeCloseTo(2_553_793.1777, 2);
    expect(r.incomeReplacementCapital.incomeMultiple).toBe(3.9); // 2,553,793 / 660,000
  });

  it('caps the expenditure-based need at the client’s net income', () => {
    const r = calculateLifeCover(
      input({
        dependants: [child({ dependencyTerm: 10 })],
        totalHouseholdMonthlyExpenditure: 80_000, // 960,000 a year
      }),
    );
    expect(r.incomeReplacementCapital.annualIncomeNeed).toBe(660_000);
    expect(r.incomeReplacementCapital.total).toBeCloseTo(5_618_344.991, 2);
  });

  it('a spouse earning more than the household spends leaves no income need', () => {
    const r = calculateLifeCover(
      input({
        dependants: [child()],
        totalHouseholdMonthlyExpenditure: 30_000,
        spouseAverageMonthlyIncome: 40_000,
      }),
    );
    expect(r.incomeReplacementCapital.annualIncomeNeed).toBe(0);
    expect(r.incomeReplacementCapital.total).toBe(0);
  });

  it('without expenditure, uses the replacement ratio (75% of net income by default)', () => {
    const r = calculateLifeCover(input({ dependants: [child({ dependencyTerm: 10 })] }));
    expect(r.incomeReplacementCapital.basis).toBe('income-replacement-ratio');
    expect(r.incomeReplacementCapital.annualIncomeNeed).toBe(495_000);
    expect(r.incomeReplacementCapital.total).toBeCloseTo(4_213_758.7432, 2);
  });

  it('provides for the longest dependency term', () => {
    const r = calculateLifeCover(
      input({
        dependants: [child({ id: 'a', dependencyTerm: 4 }), child({ id: 'b', dependencyTerm: 10 })],
      }),
    );
    expect(r.incomeReplacementCapital.provisionTerm).toBe(10);
  });

  it('values education at education inflation (8%), not as a flat sum', () => {
    const r = calculateLifeCover(
      input({ dependants: [child({ monthlyEducationCost: 5_000, dependencyTerm: 10 })] }),
    );
    // Σ 60,000 × (1.08/1.1)^k, k = 0..9 — the old flat sum was 600,000
    expect(r.educationCapital.perDependant[0].total).toBeCloseTo(553_215.1512, 2);
    expect(r.educationCapital.total).toBeCloseTo(553_215.1512, 2);
  });

  it('offsets liquid assets and existing cover, and the parts add up', () => {
    const r = calculateLifeCover(
      input({
        dependants: [child({ monthlyEducationCost: 5_000 })],
        liquidAssetsAvailable: 500_000,
        existingCover: {
          ...input().existingCover,
          life: { personal: 1_000_000, group: 2_000_000 },
        },
      }),
    );
    const total =
      r.immediateCapital.total + r.incomeReplacementCapital.total + r.educationCapital.total;
    expect(r.totalCapitalNeed).toBeCloseTo(total, 6);
    expect(r.liquidAssetsOffset).toBe(500_000);
    expect(r.grossNeed).toBeCloseTo(total - 500_000, 6);
    expect(r.existingCover.total).toBe(3_000_000);
    expect(r.netShortfall).toBeCloseTo(total - 500_000 - 3_000_000, 6);
  });

  it('liquid assets larger than the need leave no need, not a negative one', () => {
    const r = calculateLifeCover(input({ liquidAssetsAvailable: 50_000_000 }));
    expect(r.grossNeed).toBe(0);
    expect(r.netShortfall).toBe(0);
  });

  it('no longer claims a “retirement return rate” in its notes', () => {
    const r = calculateLifeCover(input());
    expect(r.riskNotes.join(' ')).not.toMatch(/retirement return/);
    expect(r.assumptions.join(' ')).toMatch(/capital needs analysis/);
  });
});

describe('calculateDisabilityCover', () => {
  it('capitalises net income to retirement age, plus once-off costs', () => {
    const r = calculateDisabilityCover(input());
    expect(r.capitalisedIncomeLoss.termYears).toBe(30);
    expect(r.capitalisedIncomeLoss.annualIncomeNeed).toBe(660_000);
    // Σ 660,000 × (1.06/1.1)^k, k = 0..29
    expect(r.capitalisedIncomeLoss.grossCapitalisedLoss).toBeCloseTo(12_175_906.2642, 2);
    expect(r.capitalisedIncomeLoss.permanentIPOffset).toBe(0);
    expect(r.additionalDisabilityCosts.total).toBe(500_000);
    expect(r.grossNeed).toBeCloseTo(12_675_906.2642, 2);
  });

  it('offsets existing permanent income protection to avoid over-insurance', () => {
    const r = calculateDisabilityCover(
      input({
        existingCover: {
          ...input().existingCover,
          incomeProtection: {
            temporary: { personal: 0, group: 0 },
            permanent: { personal: 20_000, group: 5_000 }, // 300,000 a year
          },
        },
      }),
    );
    // Σ 300,000 × (1.06/1.1)^k, k = 0..29
    expect(r.capitalisedIncomeLoss.permanentIPOffset).toBeCloseTo(5_534_502.8474, 2);
    expect(r.capitalisedIncomeLoss.total).toBeCloseTo(12_175_906.2642 - 5_534_502.8474, 2);
  });

  it("capitalises existing income protection at the policy's own escalation", () => {
    // Net income R20,000 a month; R20,000 a month permanent IP; 30 years.
    const withIP = (
      escalation: RiskCalculationInput['incomeProtectionSettings']['permanent']['escalation'],
    ) =>
      calculateDisabilityCover(
        input({
          netMonthlyIncome: 20_000,
          netAnnualIncome: 240_000,
          existingCover: {
            ...input().existingCover,
            incomeProtection: {
              temporary: { personal: 0, group: 0 },
              permanent: { personal: 20_000, group: 0 },
            },
          },
          incomeProtectionSettings: {
            temporary: { benefitPeriod: '12-months' },
            permanent: { escalation },
          },
        }),
      ).capitalisedIncomeLoss;

    // Level: Σ 240,000 × (1/1.1)^k, k = 0..29 = 240,000 × (1 − 1.1^−30) / (1 − 1/1.1)
    const levelPV = (240_000 * (1 - Math.pow(1.1, -30))) / (1 - 1 / 1.1);
    const level = withIP('level');
    expect(level.permanentIPOffset).toBeCloseTo(levelPV, 4);
    expect(level.permanentIPOffset).toBeCloseTo(2_488_705.4193, 3);
    // The rest of the R4.43m income need stays uninsured.
    expect(level.total).toBeCloseTo((level.grossCapitalisedLoss ?? 0) - levelPV, 4);
    expect(level.total).toBeGreaterThan(1_900_000);

    // Fixed 3%: v = 1.03/1.1
    const v3 = 1.03 / 1.1;
    expect(withIP('fixed-3').permanentIPOffset).toBeCloseTo(
      (240_000 * (1 - Math.pow(v3, 30))) / (1 - v3),
      4,
    );

    // CPI-linked escalates with the income escalation assumption and offsets it all.
    const cpi = withIP('cpi-linked');
    expect(cpi.permanentIPOffset).toBeCloseTo(cpi.grossCapitalisedLoss ?? Number.NaN, 4);
    expect(cpi.total).toBeCloseTo(0, 4);
  });

  it('does not depend on the number of dependants', () => {
    const none = calculateDisabilityCover(input());
    const many = calculateDisabilityCover(
      input({ dependants: [child({ id: 'a' }), child({ id: 'b' }), child({ id: 'c' })] }),
    );
    expect(many.grossNeed).toBeCloseTo(none.grossNeed, 6);
  });

  it('a younger client needs more than an older one on the same income', () => {
    const young = calculateDisabilityCover(input({ currentAge: 25 }));
    const old = calculateDisabilityCover(input({ currentAge: 60 }));
    expect(young.grossNeed).toBeGreaterThan(old.grossNeed);
  });

  it('applies the disability replacement ratio', () => {
    const r = calculateDisabilityCover(input({ disabilityIncomeReplacementRatio: 50 }));
    expect(r.capitalisedIncomeLoss.annualIncomeNeed).toBe(330_000);
  });
});

describe('calculateSevereIllnessCover', () => {
  it.each([
    [400_000, 2],
    [500_000, 2],
    [500_000.5, 3], // no gap between the first two bands
    [960_000, 3],
    [1_500_000, 3],
    [1_500_000.5, 5],
    [2_000_000, 5],
  ])('gross income %d → %d×', (income, multiple) => {
    const r = calculateSevereIllnessCover(input({ grossAnnualIncome: income }));
    expect(r.incomeMultiple).toBe(multiple);
    expect(r.grossNeed).toBeCloseTo(income * multiple, 6);
  });
});

describe('calculateIncomeProtection', () => {
  it('keeps the 100%-of-net-income method and the insurable maximum warning', () => {
    const r = calculateIncomeProtection(input({ netMonthlyIncome: 200_000 }));
    expect(r.temporary.calculatedNeed).toBe(200_000);
    expect(r.permanent.exceedsLimit).toBe(true);
    expect(r.permanent.benefitTerm).toBe(30);
  });
});

describe('normaliseRiskInput', () => {
  it('fills a thin request body so the engine never throws', () => {
    const n = normaliseRiskInput({ netMonthlyIncome: '10000', dependants: [{}] });
    expect(n.netAnnualIncome).toBe(120_000);
    expect(n.dependants).toHaveLength(1);
    expect(n.existingCover.life).toMatchObject({ personal: 0, group: 0 });
    expect(() => calculateRiskAnalysis(n)).not.toThrow();
  });

  it('keeps given values and leaves missing assumptions to the defaults', () => {
    const n = normaliseRiskInput(input({ investmentReturnAssumption: 9 }));
    expect(n.investmentReturnAssumption).toBe(9);
    expect(n.incomeReplacementRatio).toBeUndefined();
    expect(n.netAnnualIncome).toBe(660_000);
  });

  it('calculates the same as the typed input', () => {
    const typed = input({ dependants: [child({ monthlyEducationCost: 3_000 })] });
    const viaNormalise = calculateRiskAnalysis(normaliseRiskInput(typed), 'x');
    const direct = calculateRiskAnalysis(typed, 'x');
    expect(viaNormalise.life.grossNeed).toBeCloseTo(direct.life.grossNeed, 6);
    expect(viaNormalise.disability.grossNeed).toBeCloseTo(direct.disability.grossNeed, 6);
  });
});

describe('calculateRiskAnalysis', () => {
  it('stamps system version 3.0.0', () => {
    expect(RISK_SYSTEM_VERSION).toBe('3.0.0');
    expect(calculateRiskAnalysis(input(), 'adviser').metadata).toMatchObject({
      calculatedBy: 'adviser',
      systemVersion: '3.0.0',
    });
  });
});
