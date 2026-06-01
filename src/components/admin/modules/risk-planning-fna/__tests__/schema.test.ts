/**
 * risk-planning-fna/schema — unit tests (Phase 4 coverage push).
 *
 * Zod validation for the Information Gathering form (incl. cross-field rules:
 * retirement>current age, net<=gross income), the dependant + override schemas,
 * and transformFormToInput (string form values -> typed calculation inputs).
 */
import { describe, expect, it } from 'vitest';
import {
  DependantSchema,
  InformationGatheringSchema,
  OverrideSchema,
  transformFormToInput,
} from '../schema';

function validForm() {
  return {
    grossMonthlyIncome: '50000',
    netMonthlyIncome: '35000',
    incomeEscalationAssumption: '6',
    currentAge: '30',
    retirementAge: '65',
    employmentType: 'employed',
    dependants: [
      { id: 'd1', relationship: 'Child', dependencyTerm: '10', monthlyEducationCost: '2000' },
    ],
    totalOutstandingDebts: '100000',
    totalCurrentAssets: '500000',
    estateWorth: '400000',
    spouseFullName: undefined,
    spouseAverageMonthlyIncome: undefined,
    totalHouseholdMonthlyExpenditure: '20000',
    existingCoverLifePersonal: '0',
    existingCoverLifeGroup: '0',
    existingCoverDisabilityPersonal: '0',
    existingCoverDisabilityGroup: '0',
    existingCoverSevereIllnessPersonal: '0',
    existingCoverSevereIllnessGroup: '0',
    existingCoverIPTemporaryPersonal: '0',
    existingCoverIPTemporaryGroup: '0',
    existingCoverIPPermanentPersonal: '0',
    existingCoverIPPermanentGroup: '0',
    ipTemporaryBenefitPeriod: '12-months',
    ipPermanentEscalation: 'level',
  };
}

describe('DependantSchema', () => {
  it('accepts a valid dependant', () => {
    expect(
      DependantSchema.safeParse({
        id: 'd1',
        relationship: 'Child',
        dependencyTerm: '10',
        monthlyEducationCost: '2000',
      }).success,
    ).toBe(true);
  });
  it('rejects a missing relationship / non-numeric term', () => {
    expect(
      DependantSchema.safeParse({
        id: 'd1',
        relationship: '',
        dependencyTerm: 'abc',
        monthlyEducationCost: '2000',
      }).success,
    ).toBe(false);
  });
});

describe('InformationGatheringSchema', () => {
  it('accepts a fully valid form', () => {
    expect(InformationGatheringSchema.safeParse(validForm()).success).toBe(true);
  });
  it('requires retirement age greater than current age', () => {
    const r = InformationGatheringSchema.safeParse({
      ...validForm(),
      currentAge: '40',
      retirementAge: '30',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === 'Retirement age must be greater than current age'),
      ).toBe(true);
    }
  });
  it('requires net income not to exceed gross income', () => {
    const r = InformationGatheringSchema.safeParse({
      ...validForm(),
      grossMonthlyIncome: '40000',
      netMonthlyIncome: '50000',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === 'Net income cannot exceed gross income'),
      ).toBe(true);
    }
  });
});

describe('OverrideSchema', () => {
  const base = {
    originalValue: 1,
    overrideValue: 2,
    classification: 'Other',
    overriddenAt: 'now',
    overriddenBy: 'me',
  };
  it('requires a detailed reason (>=10 chars)', () => {
    expect(OverrideSchema.safeParse({ ...base, reason: 'short' }).success).toBe(false);
    expect(
      OverrideSchema.safeParse({ ...base, reason: 'a sufficiently long reason' }).success,
    ).toBe(true);
  });
});

describe('transformFormToInput', () => {
  it('annualizes income, derives totals, nests cover, maps dependants', () => {
    const out = transformFormToInput(validForm() as never);
    expect(out.grossAnnualIncome).toBe(600000);
    expect(out.netAnnualIncome).toBe(420000);
    expect(out.clientIncomePercentage).toBe(100); // no spouse
    expect(out.totalEstateValue).toBe(400000); // 500000 - 100000
    expect(out.dependants[0]).toEqual({
      id: 'd1',
      relationship: 'Child',
      dependencyTerm: 10,
      monthlyEducationCost: 2000,
    });
    expect(out.existingCover.life.personal).toBe(0);
    expect(out.incomeProtectionSettings.temporary.benefitPeriod).toBe('12-months');
  });
  it('combines household income + client % with a spouse', () => {
    const out = transformFormToInput({
      ...validForm(),
      spouseAverageMonthlyIncome: '50000',
    } as never);
    expect(out.combinedHouseholdIncome).toBe(100000);
    expect(out.clientIncomePercentage).toBe(50);
    expect(out.spouseAverageMonthlyIncome).toBe(50000);
  });
});
