import { describe, expect, it } from 'vitest';
import { calculateMedicalNeeds } from '../calculations';
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
  } as unknown as MedicalFNAInputs;
}

describe('calculateMedicalNeeds — dependents', () => {
  it('counts the main member plus spouse, children and adult dependants', () => {
    expect(calculateMedicalNeeds(makeInputs()).recommendedDependents).toBe('1');
    expect(
      calculateMedicalNeeds(
        makeInputs({ spousePartner: true, childrenCount: 2, adultDependantsCount: 1 }),
      ).recommendedDependents,
    ).toBe('5');
  });

  it('caps the display at 6+', () => {
    expect(
      calculateMedicalNeeds(makeInputs({ spousePartner: true, childrenCount: 4 }))
        .recommendedDependents,
    ).toBe('6+');
  });
});

describe('calculateMedicalNeeds — in-hospital cover (H-score)', () => {
  it('recommends 100% when expected utilisation is low', () => {
    expect(calculateMedicalNeeds(makeInputs()).recommendedInHospitalCover).toBe('100%');
  });

  it('recommends 200% once the H-score reaches 5', () => {
    // chronic PMBs >= 2 (+2) and a planned procedure (+3) = 5
    const r = calculateMedicalNeeds(makeInputs({ chronicPmbCount: 2, plannedProcedures24m: true }));
    expect(r.recommendedInHospitalCover).toBe('200%');
  });

  it('accumulates from specialist frequency and provider choice', () => {
    // specialist 5+ (+2) + any-provider (+2) + 1 chronic (+1) = 5
    const r = calculateMedicalNeeds(
      makeInputs({
        specialistVisitFreq: '5+',
        providerChoicePreference: 'Any provider',
        chronicPmbCount: 1,
      }),
    );
    expect(r.recommendedInHospitalCover).toBe('200%');
  });
});

describe('calculateMedicalNeeds — MSA recommendation', () => {
  it('recommends an MSA when day-to-day spend is high', () => {
    expect(calculateMedicalNeeds(makeInputs({ annualDayToDayEstimate: 6000 })).msaRecommended).toBe(
      true,
    );
  });

  it('recommends an MSA for high cashflow sensitivity or 2+ children', () => {
    expect(calculateMedicalNeeds(makeInputs({ cashflowSensitivity: 'High' })).msaRecommended).toBe(
      true,
    );
    expect(calculateMedicalNeeds(makeInputs({ childrenCount: 2 })).msaRecommended).toBe(true);
  });

  it('does not recommend an MSA when all triggers are below threshold', () => {
    expect(
      calculateMedicalNeeds(
        makeInputs({ annualDayToDayEstimate: 5999, cashflowSensitivity: 'Low', childrenCount: 1 }),
      ).msaRecommended,
    ).toBe(false);
  });
});

describe('calculateMedicalNeeds — Late Joiner Penalty band', () => {
  it('does not apply under age 35', () => {
    expect(
      calculateMedicalNeeds(makeInputs({ currentAge: 30, yearsWithoutCoverAfter35: 20 })).ljpBand,
    ).toBe('0%');
  });

  it('maps uncovered years to penalty bands at age 35+', () => {
    const band = (years: number) =>
      calculateMedicalNeeds(makeInputs({ currentAge: 50, yearsWithoutCoverAfter35: years }))
        .ljpBand;
    expect(band(0)).toBe('0%');
    expect(band(3)).toBe('5%');
    expect(band(10)).toBe('25%');
    expect(band(20)).toBe('50%');
    expect(band(30)).toBe('75%');
  });

  it('returns rationale text for each section', () => {
    const r = calculateMedicalNeeds(makeInputs());
    expect(r.rationale.hospital.length).toBeGreaterThan(0);
    expect(r.rationale.msa.length).toBeGreaterThan(0);
    expect(r.rationale.ljp.length).toBeGreaterThan(0);
    expect(r.rationale.dependents).toContain('1');
  });
});
