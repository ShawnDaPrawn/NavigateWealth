import { describe, expect, it } from 'vitest';
import {
  derivePolicyAssetsFromPolicies,
  derivePolicyAssetsFromProductHoldings,
  findPossiblePolicyAssetMatches,
  type DerivedPolicyAsset,
  type ManualAssetDuplicateSource,
  type PolicyAssetSourceRecord,
  type ProductHoldingAssetSource,
} from '../derivedPolicyAssets';

describe('derivePolicyAssetsFromPolicies', () => {
  it('returns [] for empty / non-array input', () => {
    expect(derivePolicyAssetsFromPolicies([])).toEqual([]);
    expect(
      derivePolicyAssetsFromPolicies(undefined as unknown as PolicyAssetSourceRecord[]),
    ).toEqual([]);
  });

  it('derives a retirement asset and applies fallbacks', () => {
    const result = derivePolicyAssetsFromPolicies([
      {
        id: 'p1',
        categoryId: 'retirement_planning',
        // no providerName -> fallback; productType/policyNumber from data
        data: {
          retirement_fund_value: 100000,
          retirement_fund_type: 'Retirement Annuity',
          ret_1: 'RA-001',
        },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'policy-asset:p1',
      policyId: 'p1',
      bucket: 'retirement',
      assetTypeLabel: 'Retirement Policy',
      providerName: 'Retirement Provider',
      productType: 'Retirement Annuity',
      policyNumber: 'RA-001',
      value: 100000,
    });
  });

  it('parses numeric strings and honours the value-key fallback order', () => {
    const result = derivePolicyAssetsFromPolicies([
      {
        id: 'p2',
        category: 'retirement_post',
        providerName: '  Old Mutual  ',
        data: { ret_post_3: 'R 250 000.50' },
      },
    ]);

    expect(result[0].value).toBeCloseTo(250000.5, 2);
    expect(result[0].providerName).toBe('Old Mutual');
    // No product/policy fields -> defaults
    expect(result[0].productType).toBe('Retirement Product');
    expect(result[0].policyNumber).toBe('Policy on file');
  });

  it('derives an investment asset', () => {
    const result = derivePolicyAssetsFromPolicies([
      {
        id: 'p3',
        categoryId: 'investments_voluntary',
        providerName: 'Coronation',
        data: { inv_vol_3: 50000, inv_vol_2: 'Unit Trust', inv_vol_1: 'UT-77' },
      },
    ]);

    expect(result[0]).toMatchObject({
      bucket: 'investment',
      assetTypeLabel: 'Investment Policy',
      providerName: 'Coronation',
      productType: 'Unit Trust',
      policyNumber: 'UT-77',
      value: 50000,
    });
  });

  it('drops archived policies, those without data, non-positive values, and unknown categories', () => {
    const result = derivePolicyAssetsFromPolicies([
      { id: 'a', categoryId: 'retirement_planning', archived: true, data: { ret_3: 1 } },
      { id: 'b', categoryId: 'retirement_planning' }, // no data
      { id: 'c', categoryId: 'retirement_planning', data: { retirement_fund_value: 0 } }, // value 0
      { id: 'd', categoryId: 'medical_aid', data: { foo: 100 } }, // unknown category
    ]);
    expect(result).toEqual([]);
  });

  it('sorts by bucket (investment before retirement) then provider + policy number', () => {
    const result = derivePolicyAssetsFromPolicies([
      {
        id: 'r1',
        categoryId: 'retirement_planning',
        providerName: 'Zurich',
        data: { retirement_fund_value: 10, ret_1: 'Z1' },
      },
      {
        id: 'i1',
        categoryId: 'investments',
        providerName: 'Sygnia',
        data: { invest_current_value: 20, inv_1: 'S1' },
      },
      {
        id: 'i2',
        categoryId: 'investments',
        providerName: 'Allan Gray',
        data: { invest_current_value: 30, inv_1: 'A1' },
      },
    ]);

    expect(result.map((a) => a.policyId)).toEqual(['i2', 'i1', 'r1']);
    expect(result[0].providerName).toBe('Allan Gray');
  });
});

describe('derivePolicyAssetsFromProductHoldings', () => {
  it('returns [] for empty input', () => {
    expect(derivePolicyAssetsFromProductHoldings([])).toEqual([]);
  });

  it('maps retirement/investment holdings and applies defaults', () => {
    const holdings: ProductHoldingAssetSource[] = [
      {
        id: 'h1',
        category: 'Retirement',
        provider: '',
        product: '',
        policyNumber: '',
        value: 75000,
        status: 'active',
      },
    ];
    const [asset] = derivePolicyAssetsFromProductHoldings(holdings);
    expect(asset).toMatchObject({
      id: 'holding-asset:h1',
      bucket: 'retirement',
      providerName: 'Retirement Provider',
      productType: 'Retirement Product',
      policyNumber: 'Policy on file',
      value: 75000,
    });
  });

  it('skips archived, non-positive, and non-retirement/investment categories', () => {
    const result = derivePolicyAssetsFromProductHoldings([
      {
        id: 'a',
        category: 'investment',
        provider: 'X',
        product: 'P',
        policyNumber: '1',
        value: 100,
        status: 'Archived',
      },
      {
        id: 'b',
        category: 'investment',
        provider: 'X',
        product: 'P',
        policyNumber: '1',
        value: 0,
        status: 'active',
      },
      {
        id: 'c',
        category: 'insurance',
        provider: 'X',
        product: 'P',
        policyNumber: '1',
        value: 100,
        status: 'active',
      },
    ]);
    expect(result).toEqual([]);
  });
});

describe('findPossiblePolicyAssetMatches', () => {
  const policyAsset: DerivedPolicyAsset = {
    id: 'policy-asset:p1',
    policyId: 'p1',
    categoryId: 'retirement_planning',
    bucket: 'retirement',
    assetTypeLabel: 'Retirement Policy',
    providerName: 'Allan Gray',
    productType: 'Retirement Annuity',
    policyNumber: 'AG12345',
    value: 100000,
  };

  it('returns {} when either side is empty', () => {
    expect(findPossiblePolicyAssetMatches([], [policyAsset])).toEqual({});
    expect(findPossiblePolicyAssetMatches([{} as ManualAssetDuplicateSource], [])).toEqual({});
  });

  it('matches a manual asset on provider + policy number with a close value', () => {
    const manual: ManualAssetDuplicateSource = {
      id: 'm1',
      type: 'retirement',
      name: 'Allan Gray AG12345',
      description: 'Retirement annuity',
      provider: 'Allan Gray',
      value: 102000, // within 5% of 100000
    };
    const matches = findPossiblePolicyAssetMatches([manual], [policyAsset]);
    expect(matches['m1']).toHaveLength(1);
    expect(matches['m1'][0].policyId).toBe('p1');
  });

  it('does not match when the value is far apart', () => {
    const manual: ManualAssetDuplicateSource = {
      id: 'm2',
      type: 'retirement',
      name: 'Allan Gray AG12345',
      description: '',
      provider: 'Allan Gray',
      value: 500000, // way off
    };
    expect(findPossiblePolicyAssetMatches([manual], [policyAsset])).toEqual({});
  });

  it('does not match on an unrelated provider/policy even with a close value', () => {
    const manual: ManualAssetDuplicateSource = {
      id: 'm3',
      type: 'investment',
      name: 'Discovery savings',
      description: 'Some plan',
      provider: 'Discovery',
      value: 100000,
    };
    expect(findPossiblePolicyAssetMatches([manual], [policyAsset])).toEqual({});
  });
});
