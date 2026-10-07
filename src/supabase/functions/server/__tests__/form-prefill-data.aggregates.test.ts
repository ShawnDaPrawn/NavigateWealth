/**
 * The numbers an FNA is prefilled with when a client key has not been stored
 * yet: which policies count as retirement capital, which count as a monthly
 * contribution, and how dependants, assets and an existing form value are read.
 *
 * The resolver tests send one happy-path fixture and only check that a field
 * came back. These pin the rules that change the figure an adviser sees.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import {
  aggregateInvestmentContribution,
  aggregateRetirementCapital,
  aggregateRetirementContribution,
  calculateAge,
  childrenDependantCount,
  dependantCount,
  dependantsSummaryText,
  existingCoverSummaryText,
  getNestedValue,
  hasSpousePartner,
  isEmptyValue,
  loadClientDataSources,
  totalFromAssets,
  totalFromLiabilities,
  valuesConflict,
  type ClientDataSources,
} from '../form-prefill-data.ts';

function sources(overrides: Partial<ClientDataSources> = {}): ClientDataSources {
  return {
    profile: {},
    clientKeys: {},
    policiesLegacy: {},
    policiesClient: [],
    intakeInputs: {},
    ...overrides,
  };
}

/** Local noon, so a date-only UTC parse cannot shift the calendar day. */
function atNoon(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');
  return `${year}-${month}-${date}T12:00:00`;
}

describe('calculateAge', () => {
  it('counts a birthday that has already happened, and not one that is still ahead', () => {
    const today = new Date();
    expect(calculateAge(atNoon(today.getFullYear() - 40, today.getMonth(), today.getDate()))).toBe(
      40,
    );

    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    expect(
      calculateAge(atNoon(tomorrow.getFullYear() - 40, tomorrow.getMonth(), tomorrow.getDate())),
    ).toBe(39);
  });

  it('returns 0 for a missing, non-text, or unreadable date, and no positive age for a future one', () => {
    expect(calculateAge(undefined)).toBe(0);
    expect(calculateAge('')).toBe(0);
    expect(calculateAge(19850615)).toBe(0);
    expect(calculateAge('not-a-date')).toBe(0);

    const today = new Date();
    expect(
      calculateAge(atNoon(today.getFullYear() + 1, today.getMonth(), today.getDate())),
    ).toBeLessThanOrEqual(0);
  });
});

describe('retirement and investment totals from policies', () => {
  const policies = sources({
    policiesLegacy: {
      investments: [
        { category: 'retirement', currentValue: 100, monthlyContribution: 40 },
        { category: 'Pension Fund', currentValue: '200', contribution: 15 },
        { category: 'provident', currentValue: 300, monthlyContribution: 25 },
        { name: 'Retirement Annuity', category: 'savings', currentValue: 50 },
        { category: 'RA', currentValue: 25, monthlyContribution: 5 },
        {
          category: 'unit trust',
          currentValue: 999,
          monthlyContribution: 80,
          isDiscretionary: false,
        },
        {
          category: 'unit trust',
          currentValue: 70,
          monthlyContribution: 8,
          isDiscretionary: true,
        },
        { category: 'unit trust', currentValue: 0, monthlyContribution: 500 },
        { category: 'retirement', currentValue: 0, contribution: 12 },
      ],
    },
  });

  it('sums retirement capital from category, name, and a non-discretionary flag, and keeps a zero value', () => {
    // Pension and provident count by category. A unit trust counts only when
    // it is marked non-discretionary. A discretionary unit trust does not,
    // and a current value of 0 does not borrow that policy's contribution.
    expect(aggregateRetirementCapital(policies)).toBe(100 + 200 + 300 + 50 + 25 + 999);
  });

  it('prefers a stored retirement total, and ignores a zero or an unreadable one', () => {
    expect(
      aggregateRetirementCapital(
        sources({
          ...policies,
          clientKeys: { retirement_fund_value_total: 900000 },
        }),
      ),
    ).toBe(900000);

    expect(
      aggregateRetirementCapital(
        sources({
          profile: { retirement_fund_value_total: 1 },
          clientKeys: { retirement_fund_value_total: 900000 },
          policiesLegacy: policies.policiesLegacy,
        }),
      ),
    ).toBe(900000);

    expect(
      aggregateRetirementCapital(
        sources({
          clientKeys: { retirement_fund_value_total: 0, retirement_fund_value: 'R 900 000' },
          policiesLegacy: policies.policiesLegacy,
        }),
      ),
    ).toBe(100 + 200 + 300 + 50 + 25 + 999);

    expect(
      aggregateRetirementCapital(
        sources({
          profile: { totalCurrentRetirementCapital: 42 },
          policiesLegacy: { investments: [] },
        }),
      ),
    ).toBe(42);
  });

  it('sums a retirement contribution more narrowly than capital, then prefers a stored one', () => {
    // A pension or provident with no non-discretionary flag is capital, not a
    // contribution. A retirement policy with only `contribution` still counts.
    expect(aggregateRetirementContribution(policies)).toBe(40 + 80 + 12);
    expect(aggregateInvestmentContribution(policies)).toBe(8);

    expect(
      aggregateRetirementContribution(
        sources({
          clientKeys: { retirement_total_contribution: 4000 },
          policiesLegacy: policies.policiesLegacy,
        }),
      ),
    ).toBe(4000);
  });
});

describe('assets, liabilities, and dependants', () => {
  it('uses a stored total when one is set, otherwise sums the rows it can read', () => {
    expect(
      totalFromLiabilities({
        totalLiabilities: 250000,
        liabilities: [{ outstandingBalance: 1 }],
      }),
    ).toBe(250000);
    expect(
      totalFromLiabilities({
        liabilities: [{ outstandingBalance: 100 }, { outstandingBalance: 'nope' }, { value: 9 }],
      }),
    ).toBe(100);
    expect(totalFromLiabilities({})).toBe(0);
    expect(totalFromLiabilities({ liabilities: 'none' })).toBe(0);

    expect(totalFromAssets({ totalAssets: '1500', assets: [{ value: 1 }] })).toBe(1500);
    expect(
      totalFromAssets({ assets: [{ value: 10 }, { value: '20' }, { outstandingBalance: 5 }] }),
    ).toBe(30);
    expect(totalFromAssets({ assets: null })).toBe(0);
  });

  it('counts a child even when not marked dependent, and does not fall through an empty family list', () => {
    const family = {
      familyMembers: [
        { relationship: 'Child' },
        { relationship: 'Spouse', isFinanciallyDependent: true },
        { relationship: 'Spouse' },
        { relationship: 'child', isFinanciallyDependent: true },
      ],
    };
    expect(dependantCount(family)).toBe(3);
    expect(childrenDependantCount(family)).toBe(1);

    expect(
      dependantCount({
        familyMembers: [],
        dependants: [{ relationship: 'Child' }, { relationship: 'Child' }],
      }),
    ).toBe(0);
    expect(dependantCount({ dependants: [{ relationship: 'Spouse' }] })).toBe(1);
    expect(
      childrenDependantCount({
        dependants: [{ relationship: 'Child' }, { relationship: 'child' }],
      }),
    ).toBe(1);
  });

  it('treats a spouse name as a spouse, and a plain single profile as none', () => {
    expect(hasSpousePartner({ maritalStatus: 'Married' })).toBe(true);
    expect(hasSpousePartner({ maritalStatus: 'single', spouseFullName: 'Alex Example' })).toBe(
      true,
    );
    expect(hasSpousePartner({ profile_spouse_name: 'Alex Example' })).toBe(true);
    expect(hasSpousePartner({ maritalStatus: 'single' })).toBe(false);
    expect(hasSpousePartner({})).toBe(false);
  });

  it('summarises dependants with an age only when a date of birth is present', () => {
    expect(dependantsSummaryText({})).toBe('');
    expect(dependantsSummaryText({ familyMembers: [] })).toBe('');

    const today = new Date();
    const text = dependantsSummaryText({
      familyMembers: [
        {
          fullName: 'Alex Example',
          dateOfBirth: atNoon(today.getFullYear() - 10, today.getMonth(), today.getDate()),
        },
        { firstName: 'Sam' },
        {},
      ],
    });
    expect(text).toBe('Alex Example (10), Sam, Dependant');
  });

  it('lists only the cover totals that are actually on the client', () => {
    expect(
      existingCoverSummaryText(
        sources({
          clientKeys: {
            risk_life_cover_total: 1500000,
            risk_disability_total: 0,
            risk_severe_illness_total: 800000,
          },
        }),
      ),
    ).toBe('Life: R1500000; Severe illness: R800000');
    expect(existingCoverSummaryText(sources())).toBe('');
  });
});

describe('conflicts and nested reads', () => {
  it('does not call an empty current value a conflict, including a blank string or NaN', () => {
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue('  ')).toBe(true);
    expect(isEmptyValue(Number.NaN)).toBe(true);

    expect(valuesConflict(undefined, 100)).toBe(false);
    expect(valuesConflict('', 100)).toBe(false);
    expect(valuesConflict('  ', 100)).toBe(false);
    expect(valuesConflict(Number.NaN, 100)).toBe(false);
    expect(valuesConflict(0, 5000)).toBe(true);
    expect(valuesConflict(100, '100')).toBe(false);
    expect(valuesConflict(100, '101')).toBe(true);
  });

  it('reads a dotted path and stops when a segment is missing', () => {
    expect(getNestedValue({ familyInfo: { fullName: 'Sam Client' } }, 'familyInfo.fullName')).toBe(
      'Sam Client',
    );
    expect(getNestedValue({ familyInfo: null }, 'familyInfo.fullName')).toBeUndefined();
    expect(getNestedValue({}, 'familyInfo.age')).toBeUndefined();
  });
});

describe('loadClientDataSources', () => {
  beforeEach(() => kvStore.clear());

  it('lifts personalInformation, lets a top-level field win, and ignores a policies value that is not a list', async () => {
    kvStore.set('user_profile:c1:personal_info', {
      personalInformation: { dateOfBirth: '1980-01-01T12:00:00', firstName: 'Nested' },
      firstName: 'Top',
    });
    kvStore.set('user_profile:c1:client_keys', { risk_life_cover_total: 10 });
    kvStore.set('policies:c1', { investments: [{ currentValue: 1 }] });
    kvStore.set('policies:client:c1', { not: 'a list' });

    const loaded = await loadClientDataSources('c1', { intakeInputs: { note: 'kept' } });

    expect(loaded.profile.dateOfBirth).toBe('1980-01-01T12:00:00');
    expect(loaded.profile.firstName).toBe('Top');
    expect(loaded.clientKeys).toEqual({ risk_life_cover_total: 10 });
    expect(loaded.policiesLegacy).toEqual({ investments: [{ currentValue: 1 }] });
    expect(loaded.policiesClient).toEqual([]);
    expect(loaded.intakeInputs).toEqual({ note: 'kept' });
  });

  it('returns empty sources when nothing is stored for the client', async () => {
    const loaded = await loadClientDataSources('missing');
    expect(loaded.profile).toEqual({});
    expect(loaded.clientKeys).toEqual({});
    expect(loaded.policiesLegacy).toEqual({});
    expect(loaded.policiesClient).toEqual([]);
    expect(loaded.intakeInputs).toEqual({});
  });
});
