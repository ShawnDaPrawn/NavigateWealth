import { describe, expect, it } from 'vitest';
import { MedicalFNAInputSchema } from '../schema';

// ---------------------------------------------------------------------------
// MedicalFNAInputSchema
// ---------------------------------------------------------------------------
describe('MedicalFNAInputSchema', () => {
  // All fields have defaults, so an empty object is the minimal valid input.
  it('accepts an empty object (all fields have defaults)', () => {
    expect(MedicalFNAInputSchema.safeParse({}).success).toBe(true);
  });

  it('produces correct defaults when parsing empty object', () => {
    const result = MedicalFNAInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data;
    expect(data.spousePartner).toBe(false);
    expect(data.childrenCount).toBe(0);
    expect(data.adultDependantsCount).toBe(0);
    expect(data.chronicPmbCount).toBe(0);
    expect(data.plannedProcedures24m).toBe(false);
    expect(data.specialistVisitFreq).toBe('0-1');
    expect(data.providerChoicePreference).toBe('Network OK');
    expect(data.annualDayToDayEstimate).toBe(0);
    expect(data.cashflowSensitivity).toBe('Medium');
    expect(data.currentAge).toBe(30);
    expect(data.yearsWithoutCoverAfter35).toBe(0);
  });

  it('accepts a fully populated valid object', () => {
    const result = MedicalFNAInputSchema.safeParse({
      spousePartner: true,
      childrenCount: 2,
      adultDependantsCount: 1,
      chronicPmbCount: 3,
      plannedProcedures24m: true,
      specialistVisitFreq: '5+',
      providerChoicePreference: 'Any provider',
      annualDayToDayEstimate: 12_000,
      cashflowSensitivity: 'High',
      currentAge: 45,
      yearsWithoutCoverAfter35: 5,
      existingPlanType: 'Comprehensive',
      existingTotalPremium: 3_500,
      existingMSA: 8_000,
      existingLJP: 50_000,
      existingHospitalCover: 'Private ward',
      existingDependents: 3,
    });
    expect(result.success).toBe(true);
  });

  // --- A. Household ---

  it('accepts spousePartner = true', () => {
    expect(MedicalFNAInputSchema.safeParse({ spousePartner: true }).success).toBe(true);
  });

  it('rejects negative childrenCount', () => {
    expect(MedicalFNAInputSchema.safeParse({ childrenCount: -1 }).success).toBe(false);
  });

  it('rejects negative adultDependantsCount', () => {
    expect(MedicalFNAInputSchema.safeParse({ adultDependantsCount: -1 }).success).toBe(false);
  });

  // --- B. Risk & Utilisation ---

  it('rejects negative chronicPmbCount', () => {
    expect(MedicalFNAInputSchema.safeParse({ chronicPmbCount: -1 }).success).toBe(false);
  });

  it('accepts all valid specialistVisitFreq values', () => {
    for (const freq of ['0-1', '2-4', '5+'] as const) {
      expect(MedicalFNAInputSchema.safeParse({ specialistVisitFreq: freq }).success).toBe(true);
    }
  });

  it('rejects invalid specialistVisitFreq', () => {
    expect(MedicalFNAInputSchema.safeParse({ specialistVisitFreq: '6+' }).success).toBe(false);
  });

  it('accepts all valid providerChoicePreference values', () => {
    for (const pref of ['Network OK', 'Any provider'] as const) {
      expect(MedicalFNAInputSchema.safeParse({ providerChoicePreference: pref }).success).toBe(
        true,
      );
    }
  });

  it('rejects invalid providerChoicePreference', () => {
    expect(
      MedicalFNAInputSchema.safeParse({ providerChoicePreference: 'Preferred network' }).success,
    ).toBe(false);
  });

  // --- C. Day-to-day ---

  it('rejects negative annualDayToDayEstimate', () => {
    expect(MedicalFNAInputSchema.safeParse({ annualDayToDayEstimate: -500 }).success).toBe(false);
  });

  it('accepts all valid cashflowSensitivity values', () => {
    for (const sensitivity of ['Low', 'Medium', 'High'] as const) {
      expect(MedicalFNAInputSchema.safeParse({ cashflowSensitivity: sensitivity }).success).toBe(
        true,
      );
    }
  });

  it('rejects invalid cashflowSensitivity', () => {
    expect(MedicalFNAInputSchema.safeParse({ cashflowSensitivity: 'Very High' }).success).toBe(
      false,
    );
  });

  // --- D. LJP ---

  it('rejects currentAge above 120', () => {
    expect(MedicalFNAInputSchema.safeParse({ currentAge: 121 }).success).toBe(false);
  });

  it('rejects negative currentAge', () => {
    expect(MedicalFNAInputSchema.safeParse({ currentAge: -1 }).success).toBe(false);
  });

  it('rejects negative yearsWithoutCoverAfter35', () => {
    expect(MedicalFNAInputSchema.safeParse({ yearsWithoutCoverAfter35: -1 }).success).toBe(false);
  });

  // --- E. Existing Policy (optional) ---

  it('accepts all existing-policy fields as undefined', () => {
    const result = MedicalFNAInputSchema.safeParse({
      existingPlanType: undefined,
      existingTotalPremium: undefined,
      existingMSA: undefined,
      existingLJP: undefined,
      existingHospitalCover: undefined,
      existingDependents: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative existingTotalPremium', () => {
    expect(MedicalFNAInputSchema.safeParse({ existingTotalPremium: -100 }).success).toBe(false);
  });

  it('rejects negative existingMSA', () => {
    expect(MedicalFNAInputSchema.safeParse({ existingMSA: -1 }).success).toBe(false);
  });

  it('rejects negative existingLJP', () => {
    expect(MedicalFNAInputSchema.safeParse({ existingLJP: -1 }).success).toBe(false);
  });

  it('rejects negative existingDependents', () => {
    expect(MedicalFNAInputSchema.safeParse({ existingDependents: -1 }).success).toBe(false);
  });
});
