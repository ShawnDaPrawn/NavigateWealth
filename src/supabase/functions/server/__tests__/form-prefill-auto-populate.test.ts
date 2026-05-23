import { describe, expect, it, vi, beforeEach } from 'vitest';

const resolveFormPrefill = vi.fn();

vi.mock('../form-prefill-resolver.ts', () => ({
  resolveFormPrefill: (...args: unknown[]) => resolveFormPrefill(...args),
}));

vi.mock('../kv_store.tsx', () => ({
  getByPrefix: vi.fn().mockResolvedValue([]),
}));

import {
  estateAutoPopulateFromResolver,
  investmentAutoPopulateFromResolver,
  medicalStep1AutoPopulateFromResolver,
  retirementAutoPopulateFromResolver,
  riskAutoPopulateFromResolver,
  taxAutoPopulateFromResolver,
} from '../form-prefill-auto-populate.ts';

const clientId = '11111111-1111-1111-1111-111111111111';

const proposedFixture: Record<string, Record<string, unknown>> = {
  'retirement-fna-step1': {
    currentAge: 40,
    retirementAge: 65,
    grossMonthlyIncome: 50000,
    currentMonthlyIncome: 35000,
    currentMonthlyContribution: 5500,
    currentRetirementSavings: 900000,
  },
  'risk-fna-step1': {
    grossMonthlyIncome: 50000,
    netMonthlyIncome: 35000,
    currentAge: 40,
    retirementAge: 65,
    employmentType: 'employed',
    totalOutstandingDebts: 200000,
    totalCurrentAssets: 1500000,
    totalHouseholdMonthlyExpenditure: 28000,
    dependantCount: 2,
    spouseFullName: 'Alex Example',
    existingCoverLifePersonal: 1500000,
  },
  'medical-fna-step1': {
    currentAge: 40,
    spousePartner: true,
    childrenCount: 2,
    grossMonthlyIncome: 50000,
    existingPlanType: 'Comprehensive',
    existingHospitalCover: '200%',
    existingTotalPremium: 4200,
  },
  'tax-fna-step1': {
    age: 40,
    maritalStatus: 'married_out_community',
    numberOfDependants: 2,
    employmentIncome: 600000,
    grossMonthlyIncome: 50000,
  },
  'estate-fna-step1': {
    'familyInfo.fullName': 'Taylor Example',
    'familyInfo.age': 40,
    'familyInfo.maritalStatus': 'married',
  },
  'investment-ina-step1': {
    currentAge: 40,
    dateOfBirth: '1985-06-15',
    grossMonthlyIncome: 50000,
    netMonthlyIncome: 35000,
    householdDependants: 2,
    clientRiskProfile: 'growth',
    investmentHorizonYears: 15,
  },
};

describe('form-prefill-auto-populate parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveFormPrefill.mockImplementation(async (_id: string, formId: string) => ({
      formId,
      clientId,
      matches: [],
      unmatchedFormFields: [],
      proposedValues: proposedFixture[formId] ?? {},
      resolverVersion: 'test',
    }));
  });

  it('retirement adapter maps resolver proposedValues to legacy shape', async () => {
    const result = await retirementAutoPopulateFromResolver(clientId);
    expect(result.currentAge).toBe(40);
    expect(result.grossMonthlyIncome).toBe(50000);
    expect(result.totalCurrentRetirementCapital).toBe(900000);
    expect(resolveFormPrefill).toHaveBeenCalledWith(clientId, 'retirement-fna-step1');
  });

  it('risk adapter maps existing cover only from resolver proposed values', async () => {
    const result = await riskAutoPopulateFromResolver(clientId);
    const cover = result.existingCover as {
      life: { personal: number };
      disability: { personal: number };
    };
    expect(cover.life.personal).toBe(1500000);
    expect(cover.disability.personal).toBe(0);
    expect(resolveFormPrefill).toHaveBeenCalledTimes(1);
    expect(resolveFormPrefill).toHaveBeenCalledWith(clientId, 'risk-fna-step1');
  });

  it('risk adapter does not expose duplicate silent-fill API shape beyond resolver', async () => {
    const result = await riskAutoPopulateFromResolver(clientId);
    expect(Object.keys(result)).not.toContain('silentClientKeysFill');
    expect(result.existingCover).toBeDefined();
    expect((result.existingCover as { life: { group: number } }).life.group).toBe(0);
  });

  it('medical adapter maps step1 fields from resolver', async () => {
    const result = await medicalStep1AutoPopulateFromResolver(clientId);
    expect(result.currentAge).toBe(40);
    expect(result.spousePartner).toBe(true);
    expect(result.existingHospitalCover).toBe('200%');
  });

  it('tax adapter merges resolver proposedValues into defaults', async () => {
    const result = await taxAutoPopulateFromResolver(clientId);
    expect(result.age).toBe(40);
    expect(result.numberOfDependants).toBe(2);
    expect(result.employmentIncome).toBe(600000);
  });

  it('estate adapter applies nested familyInfo from resolver', async () => {
    const result = await estateAutoPopulateFromResolver(clientId);
    const family = result.familyInfo as Record<string, unknown>;
    expect(family.fullName).toBe('Taylor Example');
    expect(family.age).toBe(40);
  });

  it('investment adapter maps profile fields from resolver', async () => {
    const result = await investmentAutoPopulateFromResolver(clientId);
    expect(result.currentAge).toBe(40);
    expect(result.clientRiskProfile).toBe('growth');
    expect(result.investmentHorizonYears).toBe(15);
  });
});
