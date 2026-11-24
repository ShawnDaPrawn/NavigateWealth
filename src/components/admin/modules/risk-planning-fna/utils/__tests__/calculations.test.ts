/**
 * Risk Planning FNA Calculation Tests
 *
 * Unit tests for the deterministic, auditable FAIS-compliant calculation engine.
 * These tests verify the exact financial formulas specified in constants.ts.
 *
 * Run with: npx vitest run components/admin/modules/risk-planning-fna/utils/__tests__/calculations.test.ts
 *
 * @module risk-planning-fna/utils/__tests__/calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLifeCover,
  calculateDisabilityCover,
  calculateSevereIllnessCover,
  calculateIncomeProtection,
  calculateRiskAnalysis,
} from '../calculations';
import type {
  InformationGatheringInput,
  Dependant,
  ExistingCover,
  IncomeProtectionSettings,
} from '../../types';
import { LIFE_COVER, DISABILITY_COVER, INCOME_PROTECTION, SYSTEM_VERSION } from '../../constants';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createDefaultExistingCover(overrides?: Partial<ExistingCover>): ExistingCover {
  return {
    life: { personal: 0, group: 0, ...overrides?.life },
    disability: { personal: 0, group: 0, ...overrides?.disability },
    severeIllness: { personal: 0, group: 0, ...overrides?.severeIllness },
    incomeProtection: {
      temporary: { personal: 0, group: 0, ...overrides?.incomeProtection?.temporary },
      permanent: { personal: 0, group: 0, ...overrides?.incomeProtection?.permanent },
    },
  };
}

function createDefaultIPSettings(): IncomeProtectionSettings {
  return {
    temporary: { benefitPeriod: '12-months' },
    permanent: { escalation: 'cpi-linked' },
  };
}

function createDependant(overrides?: Partial<Dependant>): Dependant {
  return {
    id: overrides?.id || `dep-${Math.random().toString(36).slice(2, 8)}`,
    relationship: overrides?.relationship || 'Child',
    dependencyTerm: overrides?.dependencyTerm ?? 10,
    monthlyEducationCost: overrides?.monthlyEducationCost ?? 5_000,
  };
}

function createInput(overrides?: Partial<InformationGatheringInput>): InformationGatheringInput {
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
    spouseFullName: undefined,
    spouseAverageMonthlyIncome: undefined,
    combinedHouseholdIncome: 80_000,
    clientIncomePercentage: 100,
    totalHouseholdMonthlyExpenditure: 45_000,
    existingCover: createDefaultExistingCover(),
    incomeProtectionSettings: createDefaultIPSettings(),
    ...overrides,
  };
}

// ============================================================================
// LIFE COVER, DISABILITY, SEVERE ILLNESS (system version 3.0.0)
//
// These replaced tests that asserted the 2.x income multiples (5× / 10× / 14×
// life, 6× / 10× / 15× disability). The engine is now a capital needs
// analysis in src/shared/fna-calculations/riskPlanning.ts, whose own suite
// (src/shared/fna-calculations/__tests__/riskPlanning.test.ts) holds the
// hand-computed present values. These check the module wires through to it.
// ============================================================================

describe('calculateLifeCover (capital needs)', () => {
  it('a single client with no dependants needs immediate capital only', () => {
    const result = calculateLifeCover(createInput({ dependants: [] }));

    expect(result.incomeReplacementCapital.total).toBe(0);
    expect(result.grossNeed).toBeCloseTo(
      1_500_000 +
        LIFE_COVER.FUNERAL_FINAL_EXPENSES +
        1_500_000 * LIFE_COVER.ESTATE_COSTS_PERCENTAGE,
      6,
    );
  });

  it('uses household expenditure less spouse income, over the dependency term', () => {
    const result = calculateLifeCover(
      createInput({
        dependants: [createDependant({ dependencyTerm: 10, monthlyEducationCost: 0 })],
        spouseFullName: 'Jane Doe',
        spouseAverageMonthlyIncome: 20_000,
        totalHouseholdMonthlyExpenditure: 45_000,
      }),
    );

    expect(result.incomeReplacementCapital.basis).toBe('household-expenditure');
    expect(result.incomeReplacementCapital.annualIncomeNeed).toBe(300_000);
    expect(result.incomeReplacementCapital.total).toBeCloseTo(2_553_793.1777, 2);
  });

  it('deducts existing cover from gross need (shortfall cannot be negative)', () => {
    const input = createInput({
      existingCover: createDefaultExistingCover({ life: { personal: 500_000, group: 300_000 } }),
    });
    const result = calculateLifeCover(input);

    expect(result.existingCover.total).toBe(800_000);
    expect(result.netShortfall).toBeCloseTo(Math.max(0, result.grossNeed - 800_000), 6);
  });

  it('returns zero shortfall when existing cover exceeds gross need', () => {
    const input = createInput({
      existingCover: createDefaultExistingCover({ life: { personal: 50_000_000, group: 0 } }),
    });
    expect(calculateLifeCover(input).netShortfall).toBe(0);
  });

  it('handles zero estate value without errors', () => {
    const result = calculateLifeCover(createInput({ totalEstateValue: 0 }));
    expect(result.immediateCapital.estateCosts).toBe(0);
  });
});

describe('calculateDisabilityCover (capital needs)', () => {
  it('capitalises net income to retirement age and adds the fixed costs', () => {
    const result = calculateDisabilityCover(createInput());

    expect(result.capitalisedIncomeLoss.termYears).toBe(30);
    expect(result.capitalisedIncomeLoss.total).toBeCloseTo(12_175_906.2642, 2);
    expect(result.additionalDisabilityCosts.total).toBe(
      DISABILITY_COVER.VEHICLE_ADAPTATION +
        DISABILITY_COVER.MEDICAL_EQUIPMENT +
        DISABILITY_COVER.ONCE_OFF_CARE_COSTS,
    );
  });

  it('deducts existing disability cover', () => {
    const input = createInput({
      existingCover: createDefaultExistingCover({
        disability: { personal: 1_000_000, group: 500_000 },
      }),
    });
    const result = calculateDisabilityCover(input);

    expect(result.existingCover.total).toBe(1_500_000);
    expect(result.netShortfall).toBeCloseTo(result.grossNeed - 1_500_000, 6);
  });
});

describe('calculateSevereIllnessCover', () => {
  it('applies 2x multiple for income <= R500,000', () => {
    const result = calculateSevereIllnessCover(createInput({ grossAnnualIncome: 400_000 }));
    expect(result.incomeMultiple).toBe(2);
    expect(result.grossNeed).toBe(400_000 * 2);
  });

  it('applies 3x multiple for income R500,001 - R1,500,000', () => {
    const result = calculateSevereIllnessCover(createInput({ grossAnnualIncome: 960_000 }));
    expect(result.incomeMultiple).toBe(3);
  });

  it('applies 5x multiple for income > R1,500,000', () => {
    const result = calculateSevereIllnessCover(createInput({ grossAnnualIncome: 2_000_000 }));
    expect(result.incomeMultiple).toBe(5);
  });

  it('puts exactly R500,000 in the first band', () => {
    expect(
      calculateSevereIllnessCover(createInput({ grossAnnualIncome: 500_000 })).incomeMultiple,
    ).toBe(2);
  });

  it('has no gap between bands (R500,000.50 is in the second band, not 0×)', () => {
    expect(
      calculateSevereIllnessCover(createInput({ grossAnnualIncome: 500_000.5 })).incomeMultiple,
    ).toBe(3);
  });
});

// ============================================================================
// INCOME PROTECTION
// ============================================================================

describe('calculateIncomeProtection', () => {
  it('calculates need as 100% of net monthly income', () => {
    const input = createInput({ netMonthlyIncome: 55_000 });
    const result = calculateIncomeProtection(input);

    expect(result.temporary.calculatedNeed).toBe(55_000);
    expect(result.permanent.calculatedNeed).toBe(55_000);
  });

  it('sets exceedsLimit flag when need > insurable maximum', () => {
    const input = createInput({ netMonthlyIncome: 200_000 });
    const result = calculateIncomeProtection(input);

    expect(result.temporary.exceedsLimit).toBe(true);
    expect(result.permanent.exceedsLimit).toBe(true);
  });

  it('does NOT set exceedsLimit when need <= insurable maximum', () => {
    const input = createInput({ netMonthlyIncome: 100_000 });
    const result = calculateIncomeProtection(input);

    expect(result.temporary.exceedsLimit).toBe(false);
    expect(result.permanent.exceedsLimit).toBe(false);
  });

  it('calculates permanent benefit term as retirementAge - currentAge', () => {
    const input = createInput({ currentAge: 35, retirementAge: 65 });
    const result = calculateIncomeProtection(input);

    expect(result.permanent.benefitTerm).toBe(30);
  });

  it('does NOT cross-offset temporary and permanent existing cover', () => {
    const input = createInput({
      netMonthlyIncome: 60_000,
      existingCover: createDefaultExistingCover({
        incomeProtection: {
          temporary: { personal: 30_000, group: 10_000 },
          permanent: { personal: 0, group: 0 },
        },
      }),
    });
    const result = calculateIncomeProtection(input);

    expect(result.temporary.existingCover.total).toBe(40_000);
    expect(result.temporary.netShortfall).toBe(20_000);
    expect(result.permanent.existingCover.total).toBe(0);
    expect(result.permanent.netShortfall).toBe(60_000);
  });

  it('adds exceeds-limit warning to risk notes', () => {
    const input = createInput({ netMonthlyIncome: 200_000 });
    const result = calculateIncomeProtection(input);

    expect(result.riskNotes).toContain(INCOME_PROTECTION.EXCEEDS_LIMIT_WARNING);
  });
});

// ============================================================================
// MASTER CALCULATION
// ============================================================================

describe('calculateRiskAnalysis', () => {
  it('returns all four calculation sections', () => {
    const input = createInput({ dependants: [createDependant()] });
    const result = calculateRiskAnalysis(input);

    expect(result.life).toBeDefined();
    expect(result.disability).toBeDefined();
    expect(result.severeIllness).toBeDefined();
    expect(result.incomeProtection).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('includes system version in metadata', () => {
    const input = createInput();
    const result = calculateRiskAnalysis(input);

    expect(result.metadata.systemVersion).toBe(SYSTEM_VERSION);
  });

  it('records calculatedBy in metadata', () => {
    const input = createInput();
    const result = calculateRiskAnalysis(input, 'adviser-123');

    expect(result.metadata.calculatedBy).toBe('adviser-123');
  });

  it('defaults calculatedBy to "System"', () => {
    const input = createInput();
    const result = calculateRiskAnalysis(input);

    expect(result.metadata.calculatedBy).toBe('System');
  });

  it('sets a valid ISO timestamp', () => {
    const input = createInput();
    const result = calculateRiskAnalysis(input);

    const parsed = new Date(result.metadata.calculatedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });
});
