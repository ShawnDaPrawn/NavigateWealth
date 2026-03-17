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
import type { InformationGatheringInput, Dependant, ExistingCover, IncomeProtectionSettings } from '../../types';
import { LIFE_COVER, DISABILITY_COVER, SEVERE_ILLNESS_COVER, INCOME_PROTECTION, SYSTEM_VERSION } from '../../constants';

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
// LIFE COVER
// ============================================================================

describe('calculateLifeCover', () => {
  it('applies 5x multiple for single person with no dependants', () => {
    const input = createInput({ dependants: [] });
    const result = calculateLifeCover(input);

    expect(result.incomeReplacementCapital.incomeMultiple).toBe(5);
    expect(result.incomeReplacementCapital.total).toBe(input.netAnnualIncome * 5);
  });

  it('applies 10x base multiple for married dual-income with 1 dependant', () => {
    const input = createInput({
      dependants: [createDependant()],
      spouseFullName: 'Jane Doe',
      spouseAverageMonthlyIncome: 50_000,
    });
    const result = calculateLifeCover(input);

    expect(result.incomeReplacementCapital.incomeMultiple).toBe(LIFE_COVER.MULTIPLES.MARRIED_YOUNG_CHILDREN_BASE);
  });

  it('applies 14x base multiple for single-income household with 1 dependant', () => {
    const input = createInput({
      dependants: [createDependant()],
      spouseFullName: 'Jane Doe',
      spouseAverageMonthlyIncome: 0,
    });
    const result = calculateLifeCover(input);

    expect(result.incomeReplacementCapital.incomeMultiple).toBe(LIFE_COVER.MULTIPLES.SINGLE_INCOME_HOUSEHOLD_BASE);
  });

  it('adds +1x per additional dependant (Mandatory Fix #1)', () => {
    const input = createInput({
      dependants: [createDependant(), createDependant(), createDependant()],
      spouseFullName: 'Jane Doe',
      spouseAverageMonthlyIncome: 50_000,
    });
    const result = calculateLifeCover(input);

    // Base 10 + (3-1)*1 = 12
    expect(result.incomeReplacementCapital.incomeMultiple).toBe(12);
  });

  it('calculates immediate capital correctly', () => {
    const input = createInput({
      totalOutstandingDebts: 2_000_000,
      totalEstateValue: 5_000_000,
    });
    const result = calculateLifeCover(input);

    expect(result.immediateCapital.outstandingDebt).toBe(2_000_000);
    expect(result.immediateCapital.funeralFinalExpenses).toBe(LIFE_COVER.FUNERAL_FINAL_EXPENSES);
    expect(result.immediateCapital.estateCosts).toBe(5_000_000 * LIFE_COVER.ESTATE_COSTS_PERCENTAGE);
    expect(result.immediateCapital.total).toBe(
      2_000_000 + LIFE_COVER.FUNERAL_FINAL_EXPENSES + (5_000_000 * LIFE_COVER.ESTATE_COSTS_PERCENTAGE)
    );
  });

  it('calculates education capital as monthlyEducationCost * 12 * dependencyTerm per dependant', () => {
    const dep1 = createDependant({ monthlyEducationCost: 5_000, dependencyTerm: 10 });
    const dep2 = createDependant({ monthlyEducationCost: 8_000, dependencyTerm: 5 });
    const input = createInput({ dependants: [dep1, dep2] });
    const result = calculateLifeCover(input);

    const expectedDep1 = 5_000 * 12 * 10; // 600,000
    const expectedDep2 = 8_000 * 12 * 5;  // 480,000
    expect(result.educationCapital.total).toBe(expectedDep1 + expectedDep2);
    expect(result.educationCapital.perDependant).toHaveLength(2);
    expect(result.educationCapital.perDependant[0].total).toBe(expectedDep1);
    expect(result.educationCapital.perDependant[1].total).toBe(expectedDep2);
  });

  it('deducts existing cover from gross need (shortfall cannot be negative)', () => {
    const input = createInput({
      existingCover: createDefaultExistingCover({
        life: { personal: 10_000_000, group: 5_000_000 },
      }),
    });
    const result = calculateLifeCover(input);

    expect(result.existingCover.total).toBe(15_000_000);
    expect(result.netShortfall).toBe(Math.max(0, result.grossNeed - 15_000_000));
  });

  it('returns zero shortfall when existing cover exceeds gross need', () => {
    const input = createInput({
      existingCover: createDefaultExistingCover({
        life: { personal: 100_000_000, group: 0 },
      }),
    });
    const result = calculateLifeCover(input);

    expect(result.netShortfall).toBe(0);
  });

  it('handles zero estate value without errors', () => {
    const input = createInput({ totalEstateValue: 0 });
    const result = calculateLifeCover(input);

    expect(result.immediateCapital.estateCosts).toBe(0);
  });
});

// ============================================================================
// DISABILITY COVER
// ============================================================================

describe('calculateDisabilityCover', () => {
  it('applies 6x multiple for 0 or 1 dependant', () => {
    const input = createInput({ dependants: [] });
    const result = calculateDisabilityCover(input);

    expect(result.capitalisedIncomeLoss.disabilityMultiple).toBe(DISABILITY_COVER.MULTIPLES.ONE_DEPENDANT);
  });

  it('applies 10x multiple for 2-4 dependants', () => {
    const input = createInput({
      dependants: [createDependant(), createDependant(), createDependant()],
    });
    const result = calculateDisabilityCover(input);

    expect(result.capitalisedIncomeLoss.disabilityMultiple).toBe(DISABILITY_COVER.MULTIPLES.TWO_TO_FOUR_DEPENDANTS);
  });

  it('applies 15x multiple for 5+ dependants', () => {
    const deps = Array.from({ length: 5 }, () => createDependant());
    const input = createInput({ dependants: deps });
    const result = calculateDisabilityCover(input);

    expect(result.capitalisedIncomeLoss.disabilityMultiple).toBe(DISABILITY_COVER.MULTIPLES.FIVE_PLUS_DEPENDANTS);
  });

  it('adds fixed additional disability costs', () => {
    const input = createInput();
    const result = calculateDisabilityCover(input);

    expect(result.additionalDisabilityCosts.vehicleAdaptation).toBe(DISABILITY_COVER.VEHICLE_ADAPTATION);
    expect(result.additionalDisabilityCosts.medicalEquipment).toBe(DISABILITY_COVER.MEDICAL_EQUIPMENT);
    expect(result.additionalDisabilityCosts.onceOffCareCosts).toBe(DISABILITY_COVER.ONCE_OFF_CARE_COSTS);
    expect(result.additionalDisabilityCosts.total).toBe(
      DISABILITY_COVER.HOME_MODIFICATIONS +
      DISABILITY_COVER.VEHICLE_ADAPTATION +
      DISABILITY_COVER.MEDICAL_EQUIPMENT +
      DISABILITY_COVER.ONCE_OFF_CARE_COSTS
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
    expect(result.netShortfall).toBe(Math.max(0, result.grossNeed - 1_500_000));
  });
});

// ============================================================================
// SEVERE ILLNESS COVER
// ============================================================================

describe('calculateSevereIllnessCover', () => {
  it('applies 2x multiple for income <= R500,000', () => {
    const input = createInput({ grossAnnualIncome: 400_000 });
    const result = calculateSevereIllnessCover(input);

    expect(result.incomeMultiple).toBe(2);
    expect(result.grossNeed).toBe(400_000 * 2);
  });

  it('applies 3x multiple for income R500,001 - R1,500,000', () => {
    const input = createInput({ grossAnnualIncome: 960_000 });
    const result = calculateSevereIllnessCover(input);

    expect(result.incomeMultiple).toBe(3);
    expect(result.grossNeed).toBe(960_000 * 3);
  });

  it('applies 5x multiple for income > R1,500,000', () => {
    const input = createInput({ grossAnnualIncome: 2_000_000 });
    const result = calculateSevereIllnessCover(input);

    expect(result.incomeMultiple).toBe(5);
    expect(result.grossNeed).toBe(2_000_000 * 5);
  });

  it('returns 0 multiple when income falls outside all bands', () => {
    // Edge case: exactly R500,000 should fall in band 1
    const input = createInput({ grossAnnualIncome: 500_000 });
    const result = calculateSevereIllnessCover(input);

    expect(result.incomeMultiple).toBe(2);
  });

  it('handles band boundary at R500,001 correctly', () => {
    const input = createInput({ grossAnnualIncome: 500_001 });
    const result = calculateSevereIllnessCover(input);

    expect(result.incomeMultiple).toBe(3);
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
