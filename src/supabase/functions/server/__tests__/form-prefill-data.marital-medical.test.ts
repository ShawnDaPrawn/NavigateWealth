/**
 * Form prefill — estate marital status and medical-aid policy fallback.
 *
 * Estate duty treats a marriage in community of property as a joint estate and
 * any other marriage as the client's alone. The intake stores
 * `married_in_community`; without the underscore fold that string misses
 * "in community" and the plain-"Married" default files it as out of community.
 * The tax form uses a different vocabulary for the same profile fact, and the
 * two must not collapse into one.
 *
 * Medical FNA reads the policy when the client keys are not calculated yet.
 * The first active policy is the plan; the premium is the sum. A blank or
 * unreadable premium must not become zero or NaN and land on the form.
 */
import { describe, expect, it } from 'vitest';
import {
  medicalAidValueFromPolicies,
  normalizeHospitalTariff,
  normalizeMaritalStatusForEstate,
  normalizeMaritalStatusForTax,
  type ClientDataSources,
} from '../form-prefill-data.ts';

const sources = (policiesClient: unknown[]): ClientDataSources => ({
  profile: {},
  clientKeys: {},
  policiesLegacy: {},
  policiesClient,
  intakeInputs: {},
});

describe('normalizeMaritalStatusForEstate', () => {
  it.each([
    // Intake enums. The underscores have to be folded: "married_in_community"
    // does not contain "in community", so it would otherwise take the plain
    // "married" default and be filed out of community.
    ['married_in_community', 'married_cop'],
    ['married_out_community', 'married_anc'],
    ['married_customary', 'married_customary'],
    // Profile wording, and the regime values stored beside "married".
    ['In Community of Property', 'married_cop'],
    ['in_community', 'married_cop'],
    ['Married out of community of property', 'married_anc'],
    ['out_community_accrual', 'married_anc'],
    ['out_community_no_accrual', 'married_anc'],
    ['married', 'married_anc'],
    ['ANC', 'married_anc'],
    // Profile status values. These are checked before the married default.
    ['divorced', 'divorced'],
    ['widowed', 'widowed'],
    ['single', 'single'],
    ['Living together', 'single'],
    // "anc" only counts as a whole word.
    ['finance', 'single'],
    ['', 'single'],
  ])('maps %j to %s', (raw, expected) => {
    expect(normalizeMaritalStatusForEstate(raw)).toBe(expected);
  });

  it('maps a non-string to single', () => {
    expect(normalizeMaritalStatusForEstate(null)).toBe('single');
    expect(normalizeMaritalStatusForEstate(1)).toBe('single');
  });

  it('keeps the tax form on its own vocabulary for the same words', () => {
    expect(normalizeMaritalStatusForTax('married')).toBe('married_out_community');
    expect(normalizeMaritalStatusForTax('married_in_community')).toBe('married_in_community');
    expect(normalizeMaritalStatusForTax('in_community')).toBe('married_in_community');
    expect(normalizeMaritalStatusForTax('In Community of Property')).toBe('married_in_community');
    expect(normalizeMaritalStatusForTax('Married out of community')).toBe('married_out_community');
    expect(normalizeMaritalStatusForTax('ANC')).toBe('single');
    expect(normalizeMaritalStatusForTax('divorced')).toBe('single');
    expect(normalizeMaritalStatusForTax(null)).toBe('single');
  });
});

describe('normalizeHospitalTariff', () => {
  it('keeps 200% cover, which does not contain the digits 100', () => {
    expect(normalizeHospitalTariff('200% of scheme rate')).toBe('200%');
  });

  it('prefers 200% when a label names both scheme rates', () => {
    expect(normalizeHospitalTariff('100% to 200%')).toBe('200%');
  });

  it.each([
    ['100% scheme rate', '100%'],
    ['scheme rate', 'Other'],
    ['', 'Other'],
    [null, 'Other'],
  ])('maps %j to %s', (raw, expected) => {
    expect(normalizeHospitalTariff(raw)).toBe(expected);
  });
});

describe('medicalAidValueFromPolicies', () => {
  const policies = [
    {
      categoryId: 'medical_aid',
      data: { ma_2: '', ma_4: '2', ma_6: Number.NaN, ma_8: 0, ma_10: '' },
    },
    {
      categoryId: 'medical_aid',
      data: { ma_2: 'Comprehensive', ma_4: '5', ma_6: 1500, ma_8: 4000 },
    },
    { categoryId: 'medical_aid', archived: true, data: { ma_6: 5000, ma_2: 'Archived Plan' } },
    { categoryId: 'risk_planning', data: { ma_6: 7000, ma_2: 'Risk' } },
    { categoryId: 'medical_aid', data: 'not-a-record' },
  ];

  it('does not borrow the next policy when the primary field is blank', () => {
    const from = sources(policies);
    expect(medicalAidValueFromPolicies(from, 'medical_aid_plan_type')).toBeUndefined();
    expect(medicalAidValueFromPolicies(from, 'medical_aid_hospital_tariff')).toBeUndefined();
  });

  it('reads a number from the primary policy and keeps a real zero', () => {
    const from = sources(policies);
    expect(medicalAidValueFromPolicies(from, 'medical_aid_dependents')).toBe(2);
    expect(medicalAidValueFromPolicies(from, 'medical_aid_msa')).toBe(0);
  });

  it('sums readable premiums and drops a total of zero', () => {
    expect(medicalAidValueFromPolicies(sources(policies), 'medical_aid_total_premium')).toBe(1500);
    expect(
      medicalAidValueFromPolicies(
        sources([
          { categoryId: 'medical_aid', data: { ma_6: 'n/a' } },
          { categoryId: 'medical_aid', data: { ma_6: '' } },
          { categoryId: 'medical_aid', data: { ma_6: 'R 0' } },
        ]),
        'medical_aid_total_premium',
      ),
    ).toBeUndefined();
  });

  it('skips a NaN dependent count', () => {
    expect(
      medicalAidValueFromPolicies(
        sources([{ categoryId: 'medical_aid', data: { ma_4: Number.NaN } }]),
        'medical_aid_dependents',
      ),
    ).toBeUndefined();
  });

  it('returns nothing for an unknown key or no active medical aid policy', () => {
    expect(medicalAidValueFromPolicies(sources(policies), 'medical_aid_unknown')).toBeUndefined();
    expect(medicalAidValueFromPolicies(sources([]), 'medical_aid_plan_type')).toBeUndefined();
    expect(
      medicalAidValueFromPolicies(
        sources([{ categoryId: 'medical_aid', archived: true, data: { ma_2: 'Old' } }]),
        'medical_aid_plan_type',
      ),
    ).toBeUndefined();
  });
});
