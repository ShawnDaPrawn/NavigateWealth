import { describe, expect, it, vi, beforeEach } from 'vitest';

const loadClientDataSources = vi.fn();

vi.mock('../form-prefill-data.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../form-prefill-data.ts')>();
  return {
    ...actual,
    loadClientDataSources: (...args: unknown[]) => loadClientDataSources(...args),
  };
});

import { resolveFormPrefill, resolveTemplatePrefill } from '../form-prefill-resolver.ts';

const clientId = '11111111-1111-1111-1111-111111111111';

const flatProfileFixture = {
  profile: {
    dateOfBirth: '1985-06-15',
    grossMonthlyIncome: 45000,
    netMonthlyIncome: 32000,
    retirementAge: 65,
    maritalStatus: 'Married',
    spouseFullName: 'Alex Example',
    dependants: [{ relationship: 'Child' }, { relationship: 'Child' }],
  },
  clientKeys: {
    risk_life_cover_total: 1500000,
    risk_disability_total: 800000,
    medical_aid_plan_type: 'Comprehensive',
    medical_aid_total_premium: 4200,
    medical_aid_hospital_tariff: '200% of scheme rate',
    profile_employment_type: 'employed',
    profile_monthly_expenses: 28000,
    profile_risk_tolerance: 'growth',
    profile_investment_horizon: 15,
  },
  policiesLegacy: {
    investments: [
      { category: 'retirement', currentValue: 850000, monthlyContribution: 5500, isDiscretionary: false },
      { category: 'unit trust', currentValue: 120000, monthlyContribution: 2000, isDiscretionary: true },
    ],
  },
  policiesClient: [],
  intakeInputs: {},
};

const nestedProfileFixture = {
  profile: {
    date_of_birth: '1990-01-20',
    gross_monthly_income: 38000,
    profile_net_monthly_income: 27000,
    profile_marital_status: 'Single',
    firstName: 'Sam',
    lastName: 'Client',
  },
  clientKeys: {},
  policiesLegacy: { investments: [] },
  policiesClient: [],
  intakeInputs: {},
};

const contactProfileFixture = {
  profile: {
    firstName: 'Sam',
    email: 'sam@example.com',
    phoneNumber: '0820000000',
    idNumber: '9001010000000',
  },
  clientKeys: {},
  policiesLegacy: { investments: [] },
  policiesClient: [],
  intakeInputs: {},
};

describe('form-prefill-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves retirement step1 from flat profile and policies', async () => {
    loadClientDataSources.mockResolvedValue(flatProfileFixture);

    const result = await resolveFormPrefill(clientId, 'retirement-fna-step1');

    expect(result.matches.some((m) => m.formField === 'currentAge' && Number(m.proposedValue) > 0)).toBe(true);
    expect(result.matches.some((m) => m.formField === 'currentRetirementSavings')).toBe(true);
    expect(result.matches.some((m) => m.formField === 'currentMonthlyContribution')).toBe(true);
    expect(result.resolverVersion).toBeTruthy();
  });

  it('resolves risk cover totals from client keys without silent profile overwrite', async () => {
    loadClientDataSources.mockResolvedValue(flatProfileFixture);

    const result = await resolveFormPrefill(clientId, 'risk-fna-step1', {
      currentFormValues: { existingCoverLifePersonal: '999' },
    });

    const lifeMatch = result.matches.find((m) => m.formField === 'existingCoverLifePersonal');
    expect(lifeMatch?.proposedValue).toBe('1500000');
    expect(lifeMatch?.conflict).toBe(true);
    expect(lifeMatch?.source).toBe('client_keys');
  });

  it('resolves medical fields including spouse and children counts', async () => {
    loadClientDataSources.mockResolvedValue(flatProfileFixture);

    const result = await resolveFormPrefill(clientId, 'medical-fna-step1');

    expect(result.matches.find((m) => m.formField === 'spousePartner')?.proposedValue).toBe(true);
    expect(result.matches.find((m) => m.formField === 'childrenCount')?.proposedValue).toBe(2);
    expect(result.matches.find((m) => m.formField === 'existingPlanType')?.proposedValue).toBe('Comprehensive');
  });

  it('handles nested personalInformation profile shape', async () => {
    loadClientDataSources.mockResolvedValue(nestedProfileFixture);

    const result = await resolveFormPrefill(clientId, 'estate-fna-step1');

    expect(result.matches.some((m) => m.formField === 'familyInfo.fullName' && m.proposedValue === 'Sam Client')).toBe(true);
    expect(result.matches.some((m) => m.formField === 'familyInfo.dateOfBirth')).toBe(true);
  });

  it('flags conflicts when tax form already has values', async () => {
    loadClientDataSources.mockResolvedValue(flatProfileFixture);

    const result = await resolveFormPrefill(clientId, 'tax-fna-step1', {
      currentFormValues: { age: 50 },
    });

    const ageMatch = result.matches.find((m) => m.formField === 'age');
    expect(ageMatch?.conflict).toBe(true);
  });

  it('resolves expanded risk, medical, and investment registry fields', async () => {
    loadClientDataSources.mockResolvedValue(flatProfileFixture);

    const risk = await resolveFormPrefill(clientId, 'risk-fna-step1');
    expect(risk.matches.find((m) => m.formField === 'employmentType')?.proposedValue).toBe('employed');
    expect(Number(risk.matches.find((m) => m.formField === 'totalHouseholdMonthlyExpenditure')?.proposedValue)).toBe(28000);
    expect(Number(risk.matches.find((m) => m.formField === 'dependantCount')?.proposedValue)).toBe(2);

    const medical = await resolveFormPrefill(clientId, 'medical-fna-step1');
    expect(medical.matches.find((m) => m.formField === 'existingHospitalCover')?.proposedValue).toBe(
      '200% of scheme rate',
    );

    const investment = await resolveFormPrefill(clientId, 'investment-ina-step1');
    expect(investment.matches.find((m) => m.formField === 'clientRiskProfile')?.proposedValue).toBe('growth');
    expect(investment.matches.find((m) => m.formField === 'investmentHorizonYears')?.proposedValue).toBe(15);
  });

  it('resolves email, phone, and ID aliases for template-prefill mappings', async () => {
    loadClientDataSources.mockResolvedValue(contactProfileFixture);

    const result = await resolveTemplatePrefill(clientId, 'template-1', [
      { id: '1', name: 'EmailAddress', label: 'Email Address', canonicalKey: 'profile_email' },
      { id: '2', name: 'CellNumber', label: 'Cell Number', canonicalKey: 'profile_phone_number' },
      { id: '3', name: 'IdNumber', label: 'ID Number', canonicalKey: 'profile_id_number' },
    ]);

    expect(result.matches.find((m) => m.canonicalKey === 'profile_email')?.proposedValue).toBe('sam@example.com');
    expect(result.matches.find((m) => m.canonicalKey === 'profile_phone_number')?.proposedValue).toBe('0820000000');
    expect(result.matches.find((m) => m.canonicalKey === 'profile_id_number')?.proposedValue).toBe('9001010000000');
  });
});
