import { describe, expect, it } from 'vitest';
import {
  AssetItemSchema,
  AssumptionsSchema,
  DependantSchema,
  EstatePlanningInputSchema,
  FamilyInformationSchema,
  LiabilityItemSchema,
  LifePolicyBeneficiarySchema,
  LifePolicySchema,
  WillInformationSchema,
} from '../schema';

// ---------------------------------------------------------------------------
// FamilyInformationSchema
// ---------------------------------------------------------------------------
describe('FamilyInformationSchema', () => {
  const valid = {
    fullName: 'Jane Doe',
    dateOfBirth: '1985-03-12',
    age: 39,
    maritalStatus: 'married_anc' as const,
    citizenship: 'South African',
    taxResidency: 'South Africa',
  };

  it('accepts minimal valid data', () => {
    expect(FamilyInformationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional spouse fields', () => {
    const result = FamilyInformationSchema.safeParse({
      ...valid,
      spouseName: 'John Doe',
      spouseId: '8501015800083',
      spouseAge: 40,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fullName', () => {
    const { fullName: _omit, ...rest } = valid;
    expect(FamilyInformationSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty fullName', () => {
    expect(FamilyInformationSchema.safeParse({ ...valid, fullName: '' }).success).toBe(false);
  });

  it('rejects invalid maritalStatus', () => {
    expect(
      FamilyInformationSchema.safeParse({ ...valid, maritalStatus: 'unknown_status' }).success,
    ).toBe(false);
  });

  it('rejects age above 120', () => {
    expect(FamilyInformationSchema.safeParse({ ...valid, age: 121 }).success).toBe(false);
  });

  it('rejects negative age', () => {
    expect(FamilyInformationSchema.safeParse({ ...valid, age: -1 }).success).toBe(false);
  });

  it('rejects missing citizenship', () => {
    const { citizenship: _omit, ...rest } = valid;
    expect(FamilyInformationSchema.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DependantSchema
// ---------------------------------------------------------------------------
describe('DependantSchema', () => {
  const valid = {
    name: 'Child A',
    age: 10,
    relationship: 'child',
    specialNeeds: false,
  };

  it('accepts minimal valid data', () => {
    expect(DependantSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts specialNeeds = true', () => {
    expect(DependantSchema.safeParse({ ...valid, specialNeeds: true }).success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name: _omit, ...rest } = valid;
    expect(DependantSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(DependantSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects missing relationship', () => {
    const { relationship: _omit, ...rest } = valid;
    expect(DependantSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects age above 120', () => {
    expect(DependantSchema.safeParse({ ...valid, age: 200 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WillInformationSchema
// ---------------------------------------------------------------------------
describe('WillInformationSchema', () => {
  const valid = {
    hasValidWill: 'yes' as const,
    executorNominated: 'professional' as const,
    guardianNominated: 'no' as const,
    specialBequests: [],
    willNeedsUpdate: false,
  };

  it('accepts minimal valid data', () => {
    expect(WillInformationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts all optional fields present', () => {
    const result = WillInformationSchema.safeParse({
      ...valid,
      dateOfLastWill: '2020-01-01',
      executorName: 'Executor Corp',
      guardianName: 'Uncle Bob',
      specialBequests: ['Watch to nephew'],
      willNeedsUpdate: true,
      willUpdateReason: 'New child born',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hasValidWill value', () => {
    expect(WillInformationSchema.safeParse({ ...valid, hasValidWill: 'maybe' }).success).toBe(
      false,
    );
  });

  it('rejects invalid executorNominated value', () => {
    expect(
      WillInformationSchema.safeParse({ ...valid, executorNominated: 'company' }).success,
    ).toBe(false);
  });

  it('rejects invalid guardianNominated value', () => {
    expect(WillInformationSchema.safeParse({ ...valid, guardianNominated: 'maybe' }).success).toBe(
      false,
    );
  });

  it('rejects missing specialBequests array', () => {
    const { specialBequests: _omit, ...rest } = valid;
    expect(WillInformationSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-boolean willNeedsUpdate', () => {
    expect(WillInformationSchema.safeParse({ ...valid, willNeedsUpdate: 'yes' }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// AssetItemSchema
// ---------------------------------------------------------------------------
describe('AssetItemSchema', () => {
  const valid = {
    id: 'asset-1',
    type: 'property' as const,
    subType: 'residential',
    description: 'Primary home',
    currentValue: 2_000_000,
    ownership: 'sole' as const,
    ownershipPercentage: 100,
    location: 'south_africa' as const,
    liquidity: 'illiquid' as const,
    includeInEstate: true,
  };

  it('accepts minimal valid data', () => {
    expect(AssetItemSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional property fields', () => {
    const result = AssetItemSchema.safeParse({
      ...valid,
      purchasePrice: 1_500_000,
      unrealisedGain: 500_000,
      bondedAmount: 800_000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional business fields', () => {
    const result = AssetItemSchema.safeParse({
      ...valid,
      type: 'business',
      hasBuyAndSellAgreement: true,
      buyAndSellFunded: false,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional retirement fields', () => {
    const result = AssetItemSchema.safeParse({
      ...valid,
      type: 'retirement',
      beneficiaryNominated: true,
      beneficiaryDetails: 'Spouse',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const { id: _omit, ...rest } = valid;
    expect(AssetItemSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid asset type', () => {
    expect(AssetItemSchema.safeParse({ ...valid, type: 'crypto' }).success).toBe(false);
  });

  it('rejects negative currentValue', () => {
    expect(AssetItemSchema.safeParse({ ...valid, currentValue: -1 }).success).toBe(false);
  });

  it('rejects ownershipPercentage above 100', () => {
    expect(AssetItemSchema.safeParse({ ...valid, ownershipPercentage: 101 }).success).toBe(false);
  });

  it('rejects invalid location', () => {
    expect(AssetItemSchema.safeParse({ ...valid, location: 'onshore' }).success).toBe(false);
  });

  it('rejects invalid liquidity', () => {
    expect(AssetItemSchema.safeParse({ ...valid, liquidity: 'very_liquid' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LiabilityItemSchema
// ---------------------------------------------------------------------------
describe('LiabilityItemSchema', () => {
  const valid = {
    id: 'liab-1',
    type: 'home_loan' as const,
    description: 'Home loan on primary residence',
    outstandingBalance: 800_000,
    lifeCoverCeded: false,
  };

  it('accepts minimal valid data', () => {
    expect(LiabilityItemSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const result = LiabilityItemSchema.safeParse({
      ...valid,
      securedAgainst: 'Primary home',
      lifeCoverCeded: true,
      creditorName: 'FNB',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const { id: _omit, ...rest } = valid;
    expect(LiabilityItemSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid liability type', () => {
    expect(LiabilityItemSchema.safeParse({ ...valid, type: 'student_loan' }).success).toBe(false);
  });

  it('rejects negative outstandingBalance', () => {
    expect(LiabilityItemSchema.safeParse({ ...valid, outstandingBalance: -100 }).success).toBe(
      false,
    );
  });

  it('rejects empty description', () => {
    expect(LiabilityItemSchema.safeParse({ ...valid, description: '' }).success).toBe(false);
  });

  it('rejects missing lifeCoverCeded', () => {
    const { lifeCoverCeded: _omit, ...rest } = valid;
    expect(LiabilityItemSchema.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LifePolicyBeneficiarySchema
// ---------------------------------------------------------------------------
describe('LifePolicyBeneficiarySchema', () => {
  const valid = {
    name: 'Jane Doe',
    relationship: 'spouse',
    percentage: 100,
  };

  it('accepts valid beneficiary', () => {
    expect(LifePolicyBeneficiarySchema.safeParse(valid).success).toBe(true);
  });

  it('accepts 0% percentage', () => {
    expect(LifePolicyBeneficiarySchema.safeParse({ ...valid, percentage: 0 }).success).toBe(true);
  });

  it('rejects percentage above 100', () => {
    expect(LifePolicyBeneficiarySchema.safeParse({ ...valid, percentage: 101 }).success).toBe(
      false,
    );
  });

  it('rejects empty name', () => {
    expect(LifePolicyBeneficiarySchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects empty relationship', () => {
    expect(LifePolicyBeneficiarySchema.safeParse({ ...valid, relationship: '' }).success).toBe(
      false,
    );
  });

  it('rejects missing percentage', () => {
    const { percentage: _omit, ...rest } = valid;
    expect(LifePolicyBeneficiarySchema.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LifePolicySchema
// ---------------------------------------------------------------------------
describe('LifePolicySchema', () => {
  const valid = {
    id: 'policy-1',
    policyType: 'life_cover' as const,
    sumAssured: 5_000_000,
    ownership: 'client' as const,
    beneficiaryType: 'nominated' as const,
    beneficiaries: [{ name: 'Jane Doe', relationship: 'spouse', percentage: 100 }],
    payableToEstate: false,
  };

  it('accepts minimal valid data', () => {
    expect(LifePolicySchema.safeParse(valid).success).toBe(true);
  });

  it('accepts empty beneficiaries array', () => {
    const result = LifePolicySchema.safeParse({ ...valid, beneficiaries: [] });
    expect(result.success).toBe(true);
  });

  it('accepts optional cededTo field', () => {
    const result = LifePolicySchema.safeParse({ ...valid, cededTo: 'FNB Home Loans' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid policyType', () => {
    expect(LifePolicySchema.safeParse({ ...valid, policyType: 'disability' }).success).toBe(false);
  });

  it('rejects invalid ownership', () => {
    expect(LifePolicySchema.safeParse({ ...valid, ownership: 'nominee' }).success).toBe(false);
  });

  it('rejects invalid beneficiaryType', () => {
    expect(LifePolicySchema.safeParse({ ...valid, beneficiaryType: 'other' }).success).toBe(false);
  });

  it('rejects negative sumAssured', () => {
    expect(LifePolicySchema.safeParse({ ...valid, sumAssured: -1 }).success).toBe(false);
  });

  it('rejects missing id', () => {
    const { id: _omit, ...rest } = valid;
    expect(LifePolicySchema.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AssumptionsSchema
// ---------------------------------------------------------------------------
describe('AssumptionsSchema', () => {
  const valid = {
    executorFeePercentage: 3.5,
    conveyancingFeesPerProperty: 25_000,
    masterFeesEstimate: 7_000,
    funeralCostsEstimate: 50_000,
    estateDutyRate: 0.2,
    estateDutyAbatement: 3_500_000,
    spousalBequest: true,
    cgtInclusionRate: 0.4,
  };

  it('accepts valid assumptions', () => {
    expect(AssumptionsSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts boundary values (0 and max)', () => {
    const boundary = {
      ...valid,
      executorFeePercentage: 0,
      estateDutyRate: 1,
      cgtInclusionRate: 1,
    };
    expect(AssumptionsSchema.safeParse(boundary).success).toBe(true);
  });

  it('rejects executorFeePercentage above 10', () => {
    expect(AssumptionsSchema.safeParse({ ...valid, executorFeePercentage: 11 }).success).toBe(
      false,
    );
  });

  it('rejects negative conveyancingFeesPerProperty', () => {
    expect(AssumptionsSchema.safeParse({ ...valid, conveyancingFeesPerProperty: -1 }).success).toBe(
      false,
    );
  });

  it('rejects estateDutyRate above 1', () => {
    expect(AssumptionsSchema.safeParse({ ...valid, estateDutyRate: 1.01 }).success).toBe(false);
  });

  it('rejects cgtInclusionRate above 1', () => {
    expect(AssumptionsSchema.safeParse({ ...valid, cgtInclusionRate: 1.5 }).success).toBe(false);
  });

  it('rejects non-boolean spousalBequest', () => {
    expect(AssumptionsSchema.safeParse({ ...valid, spousalBequest: 'yes' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EstatePlanningInputSchema (composite)
// ---------------------------------------------------------------------------
describe('EstatePlanningInputSchema', () => {
  const familyInfo = {
    fullName: 'Jane Doe',
    dateOfBirth: '1985-03-12',
    age: 39,
    maritalStatus: 'married_anc' as const,
    citizenship: 'South African',
    taxResidency: 'South Africa',
  };

  const willInfo = {
    hasValidWill: 'yes' as const,
    executorNominated: 'professional' as const,
    guardianNominated: 'no' as const,
    specialBequests: [],
    willNeedsUpdate: false,
  };

  const assumptions = {
    executorFeePercentage: 3.5,
    conveyancingFeesPerProperty: 25_000,
    masterFeesEstimate: 7_000,
    funeralCostsEstimate: 50_000,
    estateDutyRate: 0.2,
    estateDutyAbatement: 3_500_000,
    spousalBequest: true,
    cgtInclusionRate: 0.4,
  };

  const minimalValid = {
    familyInfo,
    dependants: [],
    willInfo,
    assets: [],
    liabilities: [],
    lifePolicies: [],
    assumptions,
    hasOffshorAssets: false,
    hasTrusts: false,
    planningNotes: '',
  };

  it('accepts minimal valid composite input', () => {
    expect(EstatePlanningInputSchema.safeParse(minimalValid).success).toBe(true);
  });

  it('accepts populated arrays and optional fields', () => {
    const result = EstatePlanningInputSchema.safeParse({
      ...minimalValid,
      dependants: [{ name: 'Child A', age: 8, relationship: 'child', specialNeeds: false }],
      assets: [
        {
          id: 'asset-1',
          type: 'property',
          subType: 'residential',
          description: 'Primary home',
          currentValue: 2_000_000,
          ownership: 'sole',
          ownershipPercentage: 100,
          location: 'south_africa',
          liquidity: 'illiquid',
          includeInEstate: true,
        },
      ],
      liabilities: [
        {
          id: 'liab-1',
          type: 'home_loan',
          description: 'Home loan',
          outstandingBalance: 800_000,
          lifeCoverCeded: false,
        },
      ],
      lifePolicies: [
        {
          id: 'policy-1',
          policyType: 'life_cover',
          sumAssured: 5_000_000,
          ownership: 'client',
          beneficiaryType: 'spouse',
          beneficiaries: [],
          payableToEstate: false,
        },
      ],
      hasTrusts: true,
      trustDetails: 'Family discretionary trust',
      planningNotes: 'Review annually',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing familyInfo', () => {
    const { familyInfo: _omit, ...rest } = minimalValid;
    expect(EstatePlanningInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing willInfo', () => {
    const { willInfo: _omit, ...rest } = minimalValid;
    expect(EstatePlanningInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing assumptions', () => {
    const { assumptions: _omit, ...rest } = minimalValid;
    expect(EstatePlanningInputSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-boolean hasOffshorAssets', () => {
    expect(
      EstatePlanningInputSchema.safeParse({ ...minimalValid, hasOffshorAssets: 'yes' }).success,
    ).toBe(false);
  });

  it('rejects non-boolean hasTrusts', () => {
    expect(EstatePlanningInputSchema.safeParse({ ...minimalValid, hasTrusts: 1 }).success).toBe(
      false,
    );
  });

  it('rejects invalid nested asset in assets array', () => {
    const result = EstatePlanningInputSchema.safeParse({
      ...minimalValid,
      assets: [
        {
          id: '',
          type: 'property',
          subType: 'x',
          description: 'x',
          currentValue: -1,
          ownership: 'sole',
          ownershipPercentage: 50,
          location: 'south_africa',
          liquidity: 'liquid',
          includeInEstate: true,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
