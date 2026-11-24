/**
 * Medical FNA — Regulation 13 Late Joiner Penalty, gap cover and premium
 * affordability.
 */
import { describe, expect, it } from 'vitest';
import { assessLateJoinerPenalty, calculateMedicalNeeds } from '../calculations';
import type { MedicalFNAInputs } from '../../types';

function makeInputs(overrides: Partial<MedicalFNAInputs> = {}): MedicalFNAInputs {
  return {
    currentAge: 40,
    spousePartner: false,
    childrenCount: 0,
    adultDependantsCount: 0,
    chronicPmbCount: 0,
    plannedProcedures24m: false,
    specialistVisitFreq: '0-1',
    providerChoicePreference: 'Network OK',
    annualDayToDayEstimate: 0,
    cashflowSensitivity: 'Low',
    yearsWithoutCoverAfter35: 0,
    ...overrides,
  };
}

describe('Late Joiner Penalty — Regulation 13', () => {
  it('penalty years = age − (35 + creditable cover after 21)', () => {
    // 50 − (35 + 10) = 5 → 25%
    const r = assessLateJoinerPenalty(
      makeInputs({ currentAge: 50, creditableCoverageYearsAfter21: 10 }),
    );
    expect(r.method).toBe('regulation-13');
    expect(r.penaltyYears).toBe(5);
    expect(r.band).toBe('25%');
    expect(r.rationale).toContain('Regulation 13');
  });

  it('maps penalty years onto the regulation bands', () => {
    const band = (age: number, creditable: number) =>
      assessLateJoinerPenalty(
        makeInputs({ currentAge: age, creditableCoverageYearsAfter21: creditable }),
      ).band;
    expect(band(45, 10)).toBe('0%'); // 0 years
    expect(band(40, 1)).toBe('5%'); // 4 years
    expect(band(41, 1)).toBe('25%'); // 5 years
    expect(band(55, 1)).toBe('50%'); // 19 years
    expect(band(60, 0)).toBe('75%'); // 25 years
  });

  it('credits cover held between 21 and 35, which the old input ignored', () => {
    // Joined at 21, left at 35, rejoins at 50: 15 years uncovered after 35, but
    // 14 years of creditable cover → 50 − 49 = 1 penalty year.
    const inputs = makeInputs({
      currentAge: 50,
      yearsWithoutCoverAfter35: 15,
      creditableCoverageYearsAfter21: 14,
    });
    expect(calculateMedicalNeeds(inputs).ljpBand).toBe('5%');
  });

  it('exempts continuous cover since before 1 April 2001', () => {
    const r = calculateMedicalNeeds(
      makeInputs({
        currentAge: 60,
        coveredBeforeApril2001: true,
        creditableCoverageYearsAfter21: 0,
      }),
    );
    expect(r.ljpBand).toBe('0%');
    expect(r.ljpMethod).toBe('exempt-pre-2001');
    expect(r.rationale.ljp).toContain('1 April 2001');
  });

  it('does not apply under 35', () => {
    const r = calculateMedicalNeeds(
      makeInputs({ currentAge: 30, creditableCoverageYearsAfter21: 0 }),
    );
    expect(r.ljpBand).toBe('0%');
    expect(r.ljpMethod).toBe('under-35');
  });

  it('falls back to years without cover when creditable cover was not captured', () => {
    const r = calculateMedicalNeeds(makeInputs({ currentAge: 50, yearsWithoutCoverAfter35: 10 }));
    expect(r.ljpMethod).toBe('years-without-cover');
    expect(r.ljpPenaltyYears).toBe(10);
    expect(r.ljpBand).toBe('25%');
  });
});

describe('gap cover', () => {
  it('is not recommended for low use on a network', () => {
    const r = calculateMedicalNeeds(makeInputs());
    expect(r.gapCoverRecommended).toBe(false);
    expect(r.rationale.gapCover).toContain('optional');
  });

  it('is recommended with a planned procedure', () => {
    expect(
      calculateMedicalNeeds(makeInputs({ plannedProcedures24m: true })).gapCoverRecommended,
    ).toBe(true);
  });

  it('is recommended when the client wants any provider', () => {
    expect(
      calculateMedicalNeeds(makeInputs({ providerChoicePreference: 'Any provider' }))
        .gapCoverRecommended,
    ).toBe(true);
  });

  it('is recommended on 100% cover with regular specialist visits', () => {
    const r = calculateMedicalNeeds(makeInputs({ specialistVisitFreq: '2-4' }));
    expect(r.recommendedInHospitalCover).toBe('100%');
    expect(r.gapCoverRecommended).toBe(true);
    expect(r.rationale.gapCover).toContain('specialist');
  });
});

describe('premium affordability', () => {
  it('is omitted when income or premium is missing', () => {
    const r = calculateMedicalNeeds(makeInputs({ existingTotalPremium: 5_000 }));
    expect(r.premiumAffordability).toBeUndefined();
    expect(r.rationale.affordability).toBeUndefined();
  });

  it('flags a premium above 10% of net income', () => {
    const r = calculateMedicalNeeds(
      makeInputs({ netMonthlyIncome: 40_000, existingTotalPremium: 6_000 }),
    );
    expect(r.premiumAffordability?.premiumToIncomeRatio).toBeCloseTo(0.15, 10);
    expect(r.premiumAffordability?.exceedsGuideline).toBe(true);
    expect(r.rationale.affordability).toContain('15.0%');
  });

  it('accepts a premium within the guideline', () => {
    const r = calculateMedicalNeeds(
      makeInputs({ netMonthlyIncome: 40_000, existingTotalPremium: 4_000 }),
    );
    expect(r.premiumAffordability?.exceedsGuideline).toBe(false);
  });
});
