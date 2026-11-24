import { describe, expect, it } from 'vitest';
import {
  applicationHints,
  createProfileGoal,
  defaultProfileExtensionFields,
  emergencyFundTarget,
  emptyEmployerBenefits,
  emptyPlanningProfile,
  employerBenefitLines,
  formatPostalAddress,
  goalProgressPercent,
  hasEmployerBenefits,
  normalizeEmployerBenefits,
  normalizePlanningProfile,
  normalizeProfileExtensionFields,
  normalizeProfileGoals,
  yearsToRetirement,
} from '..';

describe('normalizeProfileExtensionFields', () => {
  it('gives a record saved before these fields existed complete defaults', () => {
    expect(normalizeProfileExtensionFields({ firstName: 'Old' })).toEqual(
      defaultProfileExtensionFields(),
    );
    expect(normalizeProfileExtensionFields(null)).toEqual(defaultProfileExtensionFields());
  });

  it('treats a stored postal line without the flag as a separate postal address', () => {
    const r = normalizeProfileExtensionFields({ postalAddressLine1: 'PO Box 12' });
    expect(r.postalSameAsResidential).toBe(false);
    expect(r.postalAddressLine1).toBe('PO Box 12');
  });

  it('keeps an explicit flag and the smoking history', () => {
    const r = normalizeProfileExtensionFields({
      postalSameAsResidential: true,
      postalAddressLine1: 'PO Box 12',
      formerSmoker: true,
      quitSmokingYear: '2019',
      alcoholConsumption: 'occasionally',
    });
    expect(r).toMatchObject({
      postalSameAsResidential: true,
      formerSmoker: true,
      quitSmokingYear: '2019',
      alcoholConsumption: 'occasionally',
    });
  });
});

describe('formatPostalAddress', () => {
  it('is empty when the residential address applies', () => {
    expect(formatPostalAddress(defaultProfileExtensionFields())).toBe('');
  });

  it('joins the filled parts', () => {
    expect(
      formatPostalAddress({
        ...defaultProfileExtensionFields(),
        postalSameAsResidential: false,
        postalAddressLine1: 'PO Box 12',
        postalCity: 'Durban',
        postalPostalCode: '4000',
      }),
    ).toBe('PO Box 12, Durban, 4000, South Africa');
  });
});

describe('applicationHints', () => {
  it('reads the goals and tax residency the application recorded', () => {
    expect(
      applicationHints({
        _applicationMeta: { financialGoals: 'Retire at 60', isSATaxResident: true },
      }),
    ).toEqual({ goals: 'Retire at 60', saTaxResident: true });
    expect(applicationHints({})).toEqual({ goals: '', saTaxResident: false });
    expect(applicationHints(undefined)).toEqual({ goals: '', saTaxResident: false });
  });
});

describe('goals', () => {
  it('normalises stored goals and drops unknown categories to "other"', () => {
    expect(
      normalizeProfileGoals([
        { id: 'g1', category: 'education', name: 'Uni', targetAmount: 400000, priority: 'high' },
        { category: 'yacht', targetAmount: -5, priority: 'urgent' },
      ]),
    ).toEqual([
      {
        ...createProfileGoal('g1'),
        category: 'education',
        name: 'Uni',
        targetAmount: 400000,
        priority: 'high',
      },
      { ...createProfileGoal('goal-2'), category: 'other' },
    ]);
    expect(normalizeProfileGoals('nope')).toEqual([]);
  });

  it('works out progress against the target', () => {
    const goal = { ...createProfileGoal('g'), targetAmount: 200000, amountSaved: 50000 };
    expect(goalProgressPercent(goal)).toBe(25);
    expect(goalProgressPercent({ ...goal, amountSaved: 500000 })).toBe(100);
    expect(goalProgressPercent({ ...goal, targetAmount: 0 })).toBeNull();
  });
});

describe('planning profile', () => {
  it('normalises numbers and choices', () => {
    expect(
      normalizePlanningProfile({
        plannedRetirementAge: '65',
        capacityForLoss: 'medium',
        investmentKnowledge: 'guru',
        investmentProductsHeld: ['etfs', 7],
      }),
    ).toEqual({
      ...emptyPlanningProfile(),
      plannedRetirementAge: 65,
      capacityForLoss: 'medium',
      investmentProductsHeld: ['etfs'],
    });
  });

  it('counts the years to retirement from the date of birth', () => {
    const today = new Date(2026, 10, 24);
    expect(yearsToRetirement('1980-11-25', 65, today)).toBe(20); // still 45
    expect(yearsToRetirement('1980-11-24', 65, today)).toBe(19); // turned 46 today
    expect(yearsToRetirement('1950-01-01', 65, today)).toBe(0);
    expect(yearsToRetirement('', 65, today)).toBeNull();
    expect(yearsToRetirement('1980-01-01', 0, today)).toBeNull();
  });

  it('sizes the emergency fund', () => {
    expect(emergencyFundTarget(3, 25000)).toBe(75000);
    expect(emergencyFundTarget(0, 25000)).toBe(0);
    expect(emergencyFundTarget(3, 0)).toBe(0);
  });
});

describe('employer benefits', () => {
  it('normalises and detects recorded benefits', () => {
    expect(normalizeEmployerBenefits(undefined)).toEqual(emptyEmployerBenefits());
    expect(hasEmployerBenefits(emptyEmployerBenefits())).toBe(false);
    const b = normalizeEmployerBenefits({
      retirementFund: 'provident',
      groupLifeCover: 1500000,
      groupIncomeProtection: -1,
      medicalAidSubsidy: 'maybe',
    });
    expect(b).toEqual({
      ...emptyEmployerBenefits(),
      retirementFund: 'provident',
      groupLifeCover: 1500000,
    });
    expect(hasEmployerBenefits(b)).toBe(true);
  });

  it('describes them one line each', () => {
    expect(
      employerBenefitLines(
        { retirementFund: 'pension', groupLifeCover: 1000000, medicalAidSubsidy: 'no' },
        (n) => `R${n}`,
      ),
    ).toEqual(['Pension fund', 'Group life cover: R1000000', 'No medical aid subsidy']);
    expect(employerBenefitLines(undefined, String)).toEqual([]);
  });
});
