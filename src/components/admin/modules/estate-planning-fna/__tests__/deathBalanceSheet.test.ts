/**
 * Estate Planning — death balance sheet formulas (2026/27).
 *
 * Every expectation is worked by hand in the comment beside it. Administration
 * costs are zero unless a test is about them, so the arithmetic stays visible.
 */
import { describe, expect, it } from 'vitest';
import { EstatePlanningCalculationService, calculateEstateDutyTiers } from '../utils';
import type { EstatePlanningAsset, EstatePlanningInputs, LifePolicy } from '../types';

const calc = (inputs: EstatePlanningInputs) =>
  EstatePlanningCalculationService.calculateEstatePlan(inputs);

function makeInputs(
  overrides: {
    maritalStatus?: EstatePlanningInputs['familyInfo']['maritalStatus'];
    assets?: EstatePlanningAsset[];
    liabilities?: EstatePlanningInputs['liabilities'];
    lifePolicies?: LifePolicy[];
    assumptions?: Partial<EstatePlanningInputs['assumptions']>;
  } = {},
): EstatePlanningInputs {
  return {
    familyInfo: {
      fullName: 'Test Client',
      dateOfBirth: '1960-01-01',
      age: 66,
      maritalStatus: overrides.maritalStatus ?? 'single',
      citizenship: 'South African',
      taxResidency: 'South Africa',
    },
    dependants: [],
    willInfo: {
      hasValidWill: 'yes',
      executorNominated: 'professional',
      guardianNominated: 'unknown',
      specialBequests: [],
      willNeedsUpdate: false,
    },
    assets: overrides.assets ?? [],
    liabilities: overrides.liabilities ?? [],
    lifePolicies: overrides.lifePolicies ?? [],
    assumptions: {
      executorFeePercentage: 0,
      conveyancingFeesPerProperty: 0,
      masterFeesEstimate: 0,
      funeralCostsEstimate: 0,
      estateDutyRate: 0.2,
      estateDutyAbatement: 3_500_000,
      spousalBequest: false,
      cgtInclusionRate: 0.4,
      ...overrides.assumptions,
    },
    hasOffshorAssets: false,
    hasTrusts: false,
    planningNotes: '',
  };
}

function financial(
  value: number,
  extra: Partial<EstatePlanningAsset> = {},
  subType = 'unit_trust',
): EstatePlanningAsset {
  return {
    id: `f-${value}-${subType}`,
    type: 'financial',
    subType,
    description: 'Investment',
    currentValue: value,
    ownership: 'sole',
    ownershipPercentage: 100,
    location: 'south_africa',
    liquidity: 'liquid',
    includeInEstate: true,
    ...extra,
  } as EstatePlanningAsset;
}

function residence(value: number, gain: number, ownershipPercentage = 100): EstatePlanningAsset {
  return {
    id: `home-${value}`,
    type: 'property',
    subType: 'primary_residence',
    description: 'Home',
    currentValue: value,
    ownership: ownershipPercentage === 100 ? 'sole' : 'joint',
    ownershipPercentage,
    location: 'south_africa',
    liquidity: 'illiquid',
    includeInEstate: true,
    purchasePrice: value - gain,
    unrealisedGain: gain,
    bondedAmount: 0,
  };
}

function policy(sumAssured: number, extra: Partial<LifePolicy> = {}): LifePolicy {
  return {
    id: `p-${sumAssured}-${extra.beneficiaryType ?? 'nominated'}-${extra.policyType ?? 'life'}`,
    policyType: 'life_cover',
    sumAssured,
    ownership: 'client',
    beneficiaryType: 'nominated',
    beneficiaries: [],
    payableToEstate: false,
    ...extra,
  };
}

describe('estate duty tiers', () => {
  it('charges 20% on exactly R30m of dutiable amount and nothing at 25%', () => {
    // R33.5m − R3.5m abatement = R30m dutiable → 20% × 30m = R6,000,000
    const sheet = calc(makeInputs({ assets: [financial(33_500_000)] })).deathBalanceSheet;
    expect(sheet.estateDuty.dutiableEstate).toBe(30_000_000);
    expect(sheet.estateDuty.dutyAtFirstRate).toBe(6_000_000);
    expect(sheet.estateDuty.dutyAtUpperRate).toBe(0);
    expect(sheet.estateDuty.estimatedEstateDuty).toBe(6_000_000);
  });

  it('charges 25% on the dutiable amount above R30m', () => {
    // R34.5m − R3.5m = R31m → 20% × 30m + 25% × 1m = 6,000,000 + 250,000
    const sheet = calc(makeInputs({ assets: [financial(34_500_000)] })).deathBalanceSheet;
    expect(sheet.estateDuty.dutyAtUpperRate).toBe(250_000);
    expect(sheet.estateDuty.estimatedEstateDuty).toBe(6_250_000);
  });

  it('calculateEstateDutyTiers uses the given first-tier rate', () => {
    expect(calculateEstateDutyTiers(40_000_000, 0.2).total).toBe(6_000_000 + 2_500_000);
    expect(calculateEstateDutyTiers(-5, 0.2).total).toBe(0);
  });
});

describe("executor's fee VAT", () => {
  it('adds 15% VAT to the 3.5% tariff as its own line (4.025% in total)', () => {
    // R1m × 3.5% = R35,000; VAT 15% = R5,250; total R40,250
    const sheet = calc(
      makeInputs({ assets: [financial(1_000_000)], assumptions: { executorFeePercentage: 3.5 } }),
    ).deathBalanceSheet;
    expect(sheet.administrationCosts.executorFees).toBeCloseTo(35_000, 6);
    expect(sheet.administrationCosts.executorFeesVat).toBeCloseTo(5_250, 6);
    expect(sheet.administrationCosts.total).toBeCloseTo(40_250, 6);
  });
});

describe('deemed property paid to nominated beneficiaries (s3(3)(a))', () => {
  const inputs = makeInputs({
    assets: [financial(2_000_000)],
    lifePolicies: [
      policy(3_000_000),
      // Not deemed property: group life (fund-paid) and a buy-and-sell policy.
      policy(1_000_000, { policyType: 'group_life' }),
      policy(4_000_000, { isBuyAndSellPolicy: true }),
      // Owned by someone else: not the client's deemed property.
      policy(500_000, { ownership: 'spouse' }),
    ],
    assumptions: { executorFeePercentage: 3.5 },
  });
  const results = calc(inputs);
  const sheet = results.deathBalanceSheet;

  it('adds the policy to the dutiable estate only', () => {
    expect(sheet.estateDuty.addDeemedPropertyNominated).toBe(3_000_000);
    // The executor's fee and gross estate are on estate assets alone.
    expect(sheet.grossEstateAssets.total).toBe(2_000_000);
    expect(sheet.administrationCosts.executorFees).toBeCloseTo(70_000, 6);
  });

  it('works out duty with the policy included', () => {
    // Net estate 2,000,000 − costs 80,500 (70,000 + 10,500 VAT) = 1,919,500
    // + 3,000,000 policy = 4,919,500 − 3,500,000 = 1,419,500 dutiable × 20% = 283,900
    expect(sheet.estateDuty.dutiableEstate).toBeCloseTo(1_419_500, 6);
    expect(sheet.estateDuty.estimatedEstateDuty).toBeCloseTo(283_900, 6);
  });

  it('does not count the policy as estate liquidity', () => {
    expect(results.liquidityAnalysis.liquidityAvailable).toBe(2_000_000);
  });

  it('leaves the duty on the policy to its beneficiary (s13) for the heirs figure', () => {
    // Share of duty on the policy: 283,900 × 3,000,000 / 4,919,500
    const onPolicy = (283_900 * 3_000_000) / 4_919_500;
    expect(sheet.netEstateForHeirs).toBeCloseTo(1_919_500 - (283_900 - onPolicy), 4);
  });

  it('charges estate liquidity only with the duty the estate bears', () => {
    const onPolicy = (283_900 * 3_000_000) / 4_919_500;
    expect(sheet.estateDuty.dutyRecoverableFromBeneficiaries).toBeCloseTo(onPolicy, 4);
    expect(results.liquidityAnalysis.liquidityRequired.estateDuty).toBeCloseTo(
      283_900 - onPolicy,
      4,
    );
  });

  it('reports no estate shortfall when all the duty falls on a nominated policy', () => {
    // No estate assets or costs; a R10m policy to a nominated beneficiary.
    // Dutiable 10,000,000 − 3,500,000 = 6,500,000 × 20% = 1,300,000, all recoverable (s13).
    const r = calc(makeInputs({ lifePolicies: [policy(10_000_000)] }));
    expect(r.deathBalanceSheet.estateDuty.estimatedEstateDuty).toBeCloseTo(1_300_000, 6);
    expect(r.deathBalanceSheet.estateDuty.dutyRecoverableFromBeneficiaries).toBeCloseTo(
      1_300_000,
      6,
    );
    expect(r.liquidityAnalysis.liquidityRequired.estateDuty).toBeCloseTo(0, 6);
    expect(r.liquidityAnalysis.liquidityShortfall).toBe(0);
    expect(r.liquidityAnalysis.liquidityRisk).toBe('none');
  });

  it('gives a policy paid to a spouse the s4(q) deduction', () => {
    // 2,000,000 + 3,000,000 = 5,000,000 − 3,000,000 spouse − 3,500,000 → 0 dutiable
    const married = calc(
      makeInputs({
        maritalStatus: 'married_anc',
        assets: [financial(2_000_000)],
        lifePolicies: [policy(3_000_000, { beneficiaryType: 'spouse' })],
      }),
    ).deathBalanceSheet;
    expect(married.estateDuty.lessSpousalDeduction).toBe(3_000_000);
    expect(married.estateDuty.estimatedEstateDuty).toBe(0);
  });
});

describe('CGT on death', () => {
  it('applies the primary residence and year-of-death exclusions', () => {
    // Gains: home 3,500,000 + shares (1,000,000 − 400,000 base cost) 600,000 = 4,100,000
    // − R3m primary residence = 1,100,000 − R440,000 = 660,000 × 40% = 264,000 × 45% = 118,800
    const cgt = calc(
      makeInputs({
        assets: [
          residence(5_000_000, 3_500_000),
          financial(1_000_000, { purchasePrice: 400_000 }, 'shares'),
          // No CGT for the client: personal-use asset and endowment.
          {
            ...financial(300_000, { unrealisedGain: 200_000 }),
            type: 'personal',
            subType: 'art',
          } as EstatePlanningAsset,
          financial(800_000, { unrealisedGain: 300_000 }, 'endowment'),
        ],
      }),
    ).deathBalanceSheet.cgtOnDeath;
    expect(cgt.totalUnrealisedGains).toBe(4_100_000);
    expect(cgt.primaryResidenceExclusion).toBe(3_000_000);
    expect(cgt.annualExclusionOnDeath).toBe(440_000);
    expect(cgt.taxableGain).toBe(660_000);
    expect(cgt.inclusionAmount).toBeCloseTo(264_000, 6);
    expect(cgt.estimatedCGT).toBeCloseTo(118_800, 6);
  });

  it('shares the primary residence exclusion by interest held', () => {
    // 50% of a R4m gain = R2m; exclusion 50% × R3m = R1.5m; 500,000 left − 440,000 = 60,000
    const cgt = calc(makeInputs({ assets: [residence(6_000_000, 4_000_000, 50)] }))
      .deathBalanceSheet.cgtOnDeath;
    expect(cgt.totalUnrealisedGains).toBe(2_000_000);
    expect(cgt.primaryResidenceExclusion).toBe(1_500_000);
    expect(cgt.taxableGain).toBe(60_000);
  });

  it('deducts CGT as a debt before working out estate duty', () => {
    // Gain 8,000,000 − 440,000 = 7,560,000 × 40% = 3,024,000 × 45% = 1,360,800 CGT
    // 10,000,000 − 1,360,800 = 8,639,200 − 3,500,000 = 5,139,200 × 20% = 1,027,840 duty
    const sheet = calc(
      makeInputs({ assets: [financial(10_000_000, { purchasePrice: 2_000_000 })] }),
    ).deathBalanceSheet;
    expect(sheet.cgtOnDeath.estimatedCGT).toBeCloseTo(1_360_800, 6);
    expect(sheet.estateDuty.lessCGT).toBeCloseTo(1_360_800, 6);
    expect(sheet.estateDuty.dutiableEstate).toBeCloseTo(5_139_200, 6);
    expect(sheet.estateDuty.estimatedEstateDuty).toBeCloseTo(1_027_840, 6);
    expect(sheet.netEstateForHeirs).toBeCloseTo(10_000_000 - 1_027_840 - 1_360_800, 6);
  });

  it('uses the adviser marginal rate', () => {
    // 7,560,000 × 40% × 36% = 1,088,640
    const sheet = calc(
      makeInputs({
        assets: [financial(10_000_000, { purchasePrice: 2_000_000 })],
        assumptions: { cgtMarginalRate: 0.36 },
      }),
    ).deathBalanceSheet;
    expect(sheet.cgtOnDeath.estimatedCGT).toBeCloseTo(1_088_640, 6);
  });

  it('rolls gains over to a surviving spouse with no CGT (s9HA(2))', () => {
    const sheet = calc(
      makeInputs({
        maritalStatus: 'married_anc',
        assets: [financial(10_000_000, { purchasePrice: 2_000_000 })],
        assumptions: { spousalBequest: true },
      }),
    ).deathBalanceSheet;
    expect(sheet.cgtOnDeath.spousalRolloverGain).toBe(8_000_000);
    expect(sheet.cgtOnDeath.estimatedCGT).toBe(0);
    expect(sheet.estateDuty.estimatedEstateDuty).toBe(0);
  });

  it('does not roll over when the client is not married', () => {
    const sheet = calc(
      makeInputs({
        assets: [financial(10_000_000, { purchasePrice: 2_000_000 })],
        assumptions: { spousalBequest: true },
      }),
    ).deathBalanceSheet;
    expect(sheet.cgtOnDeath.spousalRolloverGain).toBe(0);
    expect(sheet.cgtOnDeath.estimatedCGT).toBeCloseTo(1_360_800, 6);
  });
});

describe('portable abatement (s4A)', () => {
  it("adds a predeceased spouse's unused abatement", () => {
    // 10,000,000 − (3,500,000 + 3,500,000) = 3,000,000 × 20% = 600,000
    const sheet = calc(
      makeInputs({
        maritalStatus: 'widowed',
        assets: [financial(10_000_000)],
        assumptions: { predeceasedSpouseUnusedAbatement: 3_500_000 },
      }),
    ).deathBalanceSheet;
    expect(sheet.estateDuty.lessAbatement).toBe(7_000_000);
    expect(sheet.estateDuty.portedAbatement).toBe(3_500_000);
    expect(sheet.estateDuty.estimatedEstateDuty).toBe(600_000);
  });

  it('caps the ported abatement at R3.5m', () => {
    const sheet = calc(
      makeInputs({
        maritalStatus: 'widowed',
        assets: [financial(10_000_000)],
        assumptions: { predeceasedSpouseUnusedAbatement: 5_000_000 },
      }),
    ).deathBalanceSheet;
    expect(sheet.estateDuty.lessAbatement).toBe(7_000_000);
  });

  it('defaults to no ported abatement on analyses stored before it existed', () => {
    const sheet = calc(makeInputs({ assets: [financial(10_000_000)] })).deathBalanceSheet;
    expect(sheet.estateDuty.portedAbatement).toBe(0);
    expect(sheet.estateDuty.estimatedEstateDuty).toBe(1_300_000);
  });
});

describe('liquidity labels', () => {
  const loan = (amount: number) => ({
    id: `l-${amount}`,
    type: 'personal_loan' as const,
    description: 'Loan',
    outstandingBalance: amount,
    lifeCoverCeded: false,
  });

  it('labels a small shortfall moderate and does not call the estate sufficient', () => {
    // Required 120,000; available 100,000 cash → 20,000 short (16.7%)
    const liquidity = calc(
      makeInputs({
        assets: [financial(100_000, {}, 'bank_account')],
        liabilities: [loan(120_000)],
      }),
    ).liquidityAnalysis;
    expect(liquidity.liquidityShortfall).toBe(20_000);
    expect(liquidity.liquidityRisk).toBe('moderate');
    expect(liquidity.liquidityRecommendations[0]).toContain('Liquidity shortfall of R20,000');
    expect(liquidity.liquidityRecommendations.join(' ')).not.toContain('sufficient liquidity');
  });

  it('labels a shortfall above a quarter of the requirement severe', () => {
    // Required 150,000; available 100,000 → 50,000 short (33%)
    const liquidity = calc(
      makeInputs({
        assets: [financial(100_000, {}, 'bank_account')],
        liabilities: [loan(150_000)],
      }),
    ).liquidityAnalysis;
    expect(liquidity.liquidityRisk).toBe('severe');
  });
});

describe('assumptions and advisory notes', () => {
  it('lists the statutory values used', () => {
    const results = calc(makeInputs({ assumptions: { executorFeePercentage: 3.5 } }));
    const text = (results.assumptions ?? []).join(' | ');
    expect(text).toContain('3.5% of gross estate assets plus 15% VAT (4.025% in total)');
    expect(text).toContain('25% above it');
    expect(text).toContain('R440,000');
  });

  it('flags community of property and accrual', () => {
    expect(calc(makeInputs({ maritalStatus: 'married_cop' })).advisoryNotes?.join(' ')).toContain(
      'community of property',
    );
    expect(calc(makeInputs({ maritalStatus: 'married_anc' })).advisoryNotes?.join(' ')).toContain(
      'accrual',
    );
    expect(calc(makeInputs()).advisoryNotes).toEqual([]);
  });
});
