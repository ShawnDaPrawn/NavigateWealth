import { describe, it, expect } from 'vitest';
import {
  classifyLiquidity,
  assessLiquidityRisk,
  formatCurrency,
  EstatePlanningCalculationService,
} from '../utils';
import type { EstatePlanningInputs } from '../types';
import { ESTATE_PLANNING_CONSTANTS } from '../constants';

// ── classifyLiquidity ─────────────────────────────────────────────────────────

describe('classifyLiquidity', () => {
  it('classifies bank_account, cash, money_market as liquid', () => {
    expect(classifyLiquidity('financial', 'bank_account')).toBe('liquid');
    expect(classifyLiquidity('financial', 'cash')).toBe('liquid');
    expect(classifyLiquidity('financial', 'money_market')).toBe('liquid');
  });

  it('classifies unit_trust and shares as liquid', () => {
    expect(classifyLiquidity('financial', 'unit_trust')).toBe('liquid');
    expect(classifyLiquidity('financial', 'shares')).toBe('liquid');
  });

  it('classifies endowment as semi_liquid', () => {
    expect(classifyLiquidity('financial', 'endowment')).toBe('semi_liquid');
  });

  it('classifies property as illiquid', () => {
    expect(classifyLiquidity('property', 'primary_residence')).toBe('illiquid');
    expect(classifyLiquidity('property', 'rental')).toBe('illiquid');
  });

  it('classifies business as illiquid', () => {
    expect(classifyLiquidity('business', 'shares')).toBe('illiquid');
  });

  it('classifies personal assets as illiquid', () => {
    expect(classifyLiquidity('personal', 'vehicle')).toBe('illiquid');
  });

  it('defaults to semi_liquid for unknown types', () => {
    expect(classifyLiquidity('other', 'unknown')).toBe('semi_liquid');
    expect(classifyLiquidity('financial', 'other_financial')).toBe('semi_liquid');
  });
});

// ── assessLiquidityRisk ───────────────────────────────────────────────────────

describe('assessLiquidityRisk', () => {
  it('returns none for zero or negative shortfall', () => {
    expect(assessLiquidityRisk(0)).toBe('none');
    expect(assessLiquidityRisk(-100000)).toBe('none');
  });

  it('returns none for shortfall below moderate threshold', () => {
    expect(assessLiquidityRisk(50000)).toBe('none');
    expect(
      assessLiquidityRisk(ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_MODERATE_THRESHOLD - 1),
    ).toBe('none');
  });

  it('returns moderate for shortfall at moderate threshold', () => {
    expect(
      assessLiquidityRisk(ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_MODERATE_THRESHOLD),
    ).toBe('moderate');
    expect(assessLiquidityRisk(250000)).toBe('moderate');
  });

  it('returns severe for shortfall at or above severe threshold', () => {
    expect(
      assessLiquidityRisk(ESTATE_PLANNING_CONSTANTS.LIQUIDITY_SHORTFALL_SEVERE_THRESHOLD),
    ).toBe('severe');
    expect(assessLiquidityRisk(1000000)).toBe('severe');
  });
});

// ── formatCurrency ────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('rounds and formats with thousand separators', () => {
    const result = formatCurrency(1234567.89);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('568'); // rounded
  });

  it('formats zero as 0', () => {
    expect(formatCurrency(0)).toBe('0');
  });

  it('handles negative amounts', () => {
    const result = formatCurrency(-50000);
    expect(result).toContain('50');
  });
});

// ── EstatePlanningCalculationService ─────────────────────────────────────────

const makeMinimalInputs = (
  overrides: Partial<EstatePlanningInputs> = {},
): EstatePlanningInputs => ({
  familyInfo: {
    fullName: 'Test Client',
    dateOfBirth: '1980-01-01',
    age: 46,
    maritalStatus: 'married_anc',
    spouseName: 'Test Spouse',
    citizenship: 'South African',
    taxResidency: 'South Africa',
  },
  dependants: [],
  willInfo: {
    hasValidWill: 'yes',
    executorNominated: 'professional',
    guardianNominated: 'no',
    specialBequests: [],
    willNeedsUpdate: false,
  },
  assets: [],
  liabilities: [],
  lifePolicies: [],
  assumptions: {
    executorFeePercentage: ESTATE_PLANNING_CONSTANTS.DEFAULT_EXECUTOR_FEE_PERCENTAGE,
    conveyancingFeesPerProperty: ESTATE_PLANNING_CONSTANTS.DEFAULT_CONVEYANCING_FEE_PER_PROPERTY,
    masterFeesEstimate: ESTATE_PLANNING_CONSTANTS.DEFAULT_MASTER_FEES,
    funeralCostsEstimate: ESTATE_PLANNING_CONSTANTS.DEFAULT_FUNERAL_COSTS,
    estateDutyRate: ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_RATE,
    estateDutyAbatement: ESTATE_PLANNING_CONSTANTS.ESTATE_DUTY_ABATEMENT,
    spousalBequest: true,
    cgtInclusionRate: ESTATE_PLANNING_CONSTANTS.CGT_INCLUSION_RATE_INDIVIDUAL,
  },
  hasOffshorAssets: false,
  hasTrusts: false,
  planningNotes: '',
  ...overrides,
});

describe('EstatePlanningCalculationService.calculateEstatePlan', () => {
  it('returns all required result sections for empty estate', () => {
    const result = EstatePlanningCalculationService.calculateEstatePlan(makeMinimalInputs());
    expect(result).toHaveProperty('deathBalanceSheet');
    expect(result).toHaveProperty('liquidityAnalysis');
    expect(result).toHaveProperty('beneficiaryAlignment');
    expect(result).toHaveProperty('minorChildrenAnalysis');
    expect(result).toHaveProperty('businessContinuity');
    expect(result).toHaveProperty('structuralRisks');
    expect(result).toHaveProperty('executiveSummary');
    expect(result).toHaveProperty('integrationWithOtherFNAs');
  });

  it('calculates zero estate duty for empty estate', () => {
    const result = EstatePlanningCalculationService.calculateEstatePlan(makeMinimalInputs());
    expect(result.deathBalanceSheet.estateDuty.estimatedEstateDuty).toBe(0);
  });

  it('includes financial assets in gross estate', () => {
    const inputs = makeMinimalInputs({
      assets: [
        {
          id: 'a1',
          type: 'financial',
          subType: 'unit_trust',
          description: 'Unit Trust',
          currentValue: 1000000,
          ownership: 'sole',
          ownershipPercentage: 100,
          location: 'south_africa',
          liquidity: 'liquid',
          includeInEstate: true,
        },
      ],
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.deathBalanceSheet.grossEstateAssets.financial).toBe(1000000);
    expect(result.deathBalanceSheet.grossEstateAssets.total).toBe(1000000);
  });

  it('calculates estate duty when estate exceeds abatement', () => {
    const inputs = makeMinimalInputs({
      assets: [
        {
          id: 'a1',
          type: 'financial',
          subType: 'unit_trust',
          description: 'Investments',
          currentValue: 10000000,
          ownership: 'sole',
          ownershipPercentage: 100,
          location: 'south_africa',
          liquidity: 'liquid',
          includeInEstate: true,
        },
      ],
      familyInfo: {
        fullName: 'Test',
        dateOfBirth: '1980-01-01',
        age: 46,
        maritalStatus: 'single', // no spousal deduction
        citizenship: 'South African',
        taxResidency: 'South Africa',
      },
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.deathBalanceSheet.estateDuty.estimatedEstateDuty).toBeGreaterThan(0);
  });

  it('deems life policies payable to estate as estate assets', () => {
    const inputs = makeMinimalInputs({
      lifePolicies: [
        {
          id: 'p1',
          policyType: 'life_cover',
          sumAssured: 500000,
          ownership: 'client',
          beneficiaryType: 'estate',
          beneficiaries: [],
          payableToEstate: true,
        },
      ],
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.deathBalanceSheet.grossEstateAssets.deemedProperty).toBe(500000);
  });

  it('excludes assets with includeInEstate=false', () => {
    const inputs = makeMinimalInputs({
      assets: [
        {
          id: 'a1',
          type: 'financial',
          subType: 'unit_trust',
          description: 'Trust Asset',
          currentValue: 2000000,
          ownership: 'trust',
          ownershipPercentage: 100,
          location: 'south_africa',
          liquidity: 'liquid',
          includeInEstate: false,
        },
      ],
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.deathBalanceSheet.grossEstateAssets.financial).toBe(0);
  });

  it('handles liabilities across all types', () => {
    const inputs = makeMinimalInputs({
      liabilities: [
        {
          id: 'l1',
          type: 'home_loan',
          description: 'Bond',
          outstandingBalance: 1000000,
          lifeCoverCeded: false,
        },
        {
          id: 'l2',
          type: 'vehicle_finance',
          description: 'Car',
          outstandingBalance: 200000,
          lifeCoverCeded: false,
        },
        {
          id: 'l3',
          type: 'credit_card',
          description: 'CC',
          outstandingBalance: 50000,
          lifeCoverCeded: false,
        },
        {
          id: 'l4',
          type: 'personal_loan',
          description: 'Loan',
          outstandingBalance: 100000,
          lifeCoverCeded: false,
        },
        {
          id: 'l5',
          type: 'business_debt',
          description: 'Biz',
          outstandingBalance: 300000,
          lifeCoverCeded: false,
        },
        {
          id: 'l6',
          type: 'tax_liability',
          description: 'Tax',
          outstandingBalance: 80000,
          lifeCoverCeded: false,
        },
      ],
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.deathBalanceSheet.liabilities.homeLoan).toBe(1000000);
    expect(result.deathBalanceSheet.liabilities.vehicleFinance).toBe(200000);
    expect(result.deathBalanceSheet.liabilities.creditCards).toBe(50000);
    expect(result.deathBalanceSheet.liabilities.total).toBe(1730000);
  });

  it('handles minor dependants in children analysis', () => {
    const inputs = makeMinimalInputs({
      dependants: [
        { name: 'Child 1', age: 8, relationship: 'child', specialNeeds: false },
        { name: 'Adult Child', age: 22, relationship: 'child', specialNeeds: false },
      ],
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.minorChildrenAnalysis).toBeDefined();
  });

  it('handles business assets and continuity analysis', () => {
    const inputs = makeMinimalInputs({
      assets: [
        {
          id: 'b1',
          type: 'business',
          subType: 'private_company_shares',
          description: 'Company',
          currentValue: 5000000,
          ownership: 'sole',
          ownershipPercentage: 100,
          location: 'south_africa',
          liquidity: 'illiquid',
          includeInEstate: true,
          hasBuyAndSellAgreement: false,
          buyAndSellFunded: false,
        },
      ],
    });
    const result = EstatePlanningCalculationService.calculateEstatePlan(inputs);
    expect(result.businessContinuity).toBeDefined();
  });
});
