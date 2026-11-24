import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  mget: vi.fn(async (keys: string[]) => keys.map((k) => store.get(k) ?? null)),
  set: vi.fn(),
  del: vi.fn(),
  getByPrefix: vi.fn(async () => []),
}));

import {
  estateAssetsFromProfile,
  estateLiabilitiesFromProfile,
  estateRecordsFromPolicies,
  loadEstateClientRecords,
  unwrapPolicyRegister,
} from '../estate-client-records.ts';

const clientId = '8c4158a6-d7ea-43bf-8386-af0cabda8eee';

describe('estateAssetsFromProfile', () => {
  it('maps Assets & liabilities rows to estate assets', () => {
    const assets = estateAssetsFromProfile([
      {
        id: 'a1',
        name: 'Unit 29 Pebble Creek',
        type: 'Property',
        value: 2100000,
        ownershipType: 'Sole',
      },
      { id: 'a2', name: 'Beach flat', type: 'Property', value: 900000, ownershipType: 'Joint' },
      { id: 'a3', name: 'Call account', type: 'Cash', value: '15 000', ownershipType: 'Sole' },
      { id: 'a4', name: 'Family trust farm', type: 'Property', value: 5, ownershipType: 'Trust' },
      { id: 'a5', name: 'Painting', type: 'Collectibles', value: 1000 },
    ]);

    expect(assets.map((a) => [a.type, a.subType])).toEqual([
      ['property', 'primary_residence'],
      ['property', 'rental'],
      ['financial', 'cash'],
      ['property', 'rental'],
      ['personal', 'art'],
    ]);
    expect(assets[0]).toMatchObject({
      description: 'Unit 29 Pebble Creek',
      currentValue: 2100000,
      ownership: 'sole',
      liquidity: 'illiquid',
      includeInEstate: true,
    });
    expect(assets[1]).toMatchObject({ ownership: 'joint', ownershipPercentage: 50 });
    expect(assets[2]).toMatchObject({ currentValue: 15000, liquidity: 'liquid' });
    expect(assets[3].includeInEstate).toBe(false);
  });

  it('skips empty rows and survives non-arrays', () => {
    expect(estateAssetsFromProfile([{}, null, { name: '', value: 0 }])).toEqual([]);
    expect(estateAssetsFromProfile(undefined)).toEqual([]);
  });
});

describe('estateLiabilitiesFromProfile', () => {
  it('maps liability rows with their balance and creditor', () => {
    expect(
      estateLiabilitiesFromProfile([
        {
          id: 'l1',
          name: 'Credit Card',
          type: 'Credit Card',
          provider: 'Nedbank',
          outstandingBalance: 1100000,
          monthlyPayment: 5000,
        },
        { id: 'l2', name: 'Studies', type: 'Student Loan', outstandingBalance: 40000 },
      ]),
    ).toEqual([
      {
        id: 'l1',
        type: 'credit_card',
        description: 'Credit Card',
        outstandingBalance: 1100000,
        securedAgainst: '',
        lifeCoverCeded: false,
        creditorName: 'Nedbank',
      },
      expect.objectContaining({ id: 'l2', type: 'personal_loan', outstandingBalance: 40000 }),
    ]);
  });
});

describe('estateRecordsFromPolicies', () => {
  const register = [
    {
      id: 'p1',
      categoryId: 'retirement_pre',
      providerName: 'Allan Gray',
      data: { ret_pre_1: 'RA123', ret_pre_2: 'Retirement Annuity', ret_pre_3: 581466.77 },
    },
    {
      id: 'p2',
      categoryId: 'investments_voluntary',
      providerName: 'Allan Gray',
      data: { inv_vol_1: 'AGLP398635', inv_vol_2: 'Unit Trust', inv_vol_3: '345444' },
    },
    { id: 'p3', categoryId: 'risk_planning', providerName: 'Brightrock', data: { rp_2: 3000000 } },
    // No cover amount recorded: nothing to count.
    { id: 'p4', categoryId: 'risk_planning', providerName: 'Hollard', data: { rp_6: 400 } },
    {
      id: 'p5',
      categoryId: 'investments_voluntary',
      archived: true,
      data: { inv_vol_3: 100 },
    },
    { id: 'p6', categoryId: 'medical_aid', data: { ma_6: 3000 } },
  ];

  it('turns funds into assets and risk cover into life policies', () => {
    const { assets, lifePolicies } = estateRecordsFromPolicies(register);
    expect(assets).toEqual([
      expect.objectContaining({
        type: 'retirement',
        subType: 'ra',
        description: 'Allan Gray Retirement Annuity',
        currentValue: 581466.77,
      }),
      expect.objectContaining({
        type: 'financial',
        subType: 'unit_trust',
        currentValue: 345444,
        liquidity: 'liquid',
      }),
    ]);
    expect(lifePolicies).toEqual([
      expect.objectContaining({
        policyType: 'life_cover',
        sumAssured: 3000000,
        payableToEstate: true,
      }),
    ]);
  });
});

describe('unwrapPolicyRegister', () => {
  it('reads every stored shape', () => {
    const row = { id: 'x' };
    expect(unwrapPolicyRegister([row])).toEqual([row]);
    expect(unwrapPolicyRegister({ policies: [row] })).toEqual([row]);
    expect(unwrapPolicyRegister({ value: [row] })).toEqual([row]);
    expect(unwrapPolicyRegister({ a: [row], b: [row] })).toEqual([row, row]);
    expect(unwrapPolicyRegister(null)).toEqual([]);
  });
});

describe('loadEstateClientRecords', () => {
  beforeEach(() => store.clear());

  it('reads the profile and the policy register, not the old asset: keys', async () => {
    store.set(`user_profile:${clientId}:personal_info`, {
      assets: [{ id: 'a1', name: 'Unit 29 Pebble Creek', type: 'Property', value: 2100000 }],
      liabilities: [{ id: 'l1', name: 'Bond', type: 'Home Loan', outstandingBalance: 800000 }],
    });
    store.set(`policies:client:${clientId}`, [
      { id: 'p3', categoryId: 'risk_planning', data: { rp_2: 3000000 } },
      { id: 'p2', categoryId: 'investments_voluntary', data: { inv_vol_3: 345444 } },
    ]);

    const records = await loadEstateClientRecords(clientId);
    expect(records.assets.map((a) => a.currentValue)).toEqual([2100000, 345444]);
    expect(records.liabilities).toEqual([
      expect.objectContaining({ type: 'home_loan', outstandingBalance: 800000 }),
    ]);
    expect(records.lifePolicies).toHaveLength(1);
  });

  it('returns empty lists for a client with no records', async () => {
    expect(await loadEstateClientRecords(clientId)).toEqual({
      assets: [],
      liabilities: [],
      lifePolicies: [],
    });
  });
});
