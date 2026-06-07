import { describe, it, expect, vi } from 'vitest';
import type { Client } from '../types';
import {
  calcDTI,
  deriveDTIStatus,
  calcEmergencyFundMonths,
  deriveEmergencyFundStatus,
  calcInsuranceCoverageRatio,
  deriveInsuranceCoverageStatus,
  calcRetirementProgress,
  deriveRetirementProgressStatus,
  deriveSavingsRateStatus,
  deriveNetWorthStatus,
  deriveHealthSubScores,
  calculateGrowthStats,
  deriveAccountStatus,
  countByStatus,
  filterClients,
} from '../utils';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'c1',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@example.com',
  preferredName: 'John',
  createdAt: new Date().toISOString(),
  applicationStatus: 'approved',
  deleted: false,
  suspended: false,
  ...overrides,
});

// ── calcDTI ──────────────────────────────────────────────────────────────────

describe('calcDTI', () => {
  it('returns null when gross income is 0', () => {
    expect(calcDTI(5000, 0)).toBeNull();
  });

  it('returns null when gross income is negative', () => {
    expect(calcDTI(5000, -1000)).toBeNull();
  });

  it('calculates DTI correctly', () => {
    expect(calcDTI(3600, 10000)).toBeCloseTo(36, 1);
    expect(calcDTI(1800, 10000)).toBeCloseTo(18, 1);
  });
});

// ── deriveDTIStatus ──────────────────────────────────────────────────────────

describe('deriveDTIStatus', () => {
  it('returns no-data for null', () => {
    expect(deriveDTIStatus(null)).toBe('no-data');
  });

  it('returns good for DTI < 36', () => {
    expect(deriveDTIStatus(35)).toBe('good');
    expect(deriveDTIStatus(0)).toBe('good');
  });

  it('returns caution for DTI 36–50', () => {
    expect(deriveDTIStatus(36)).toBe('caution');
    expect(deriveDTIStatus(50)).toBe('caution');
  });

  it('returns gap for DTI > 50', () => {
    expect(deriveDTIStatus(51)).toBe('gap');
    expect(deriveDTIStatus(100)).toBe('gap');
  });
});

// ── calcEmergencyFundMonths ──────────────────────────────────────────────────

describe('calcEmergencyFundMonths', () => {
  it('returns null when monthlyExpenses is 0 or negative', () => {
    expect(calcEmergencyFundMonths([], 0)).toBeNull();
    expect(calcEmergencyFundMonths([], -1)).toBeNull();
  });

  it('returns 0 when no liquid assets', () => {
    const assets = [{ type: 'property', value: 1_000_000 }];
    expect(calcEmergencyFundMonths(assets, 10000)).toBe(0);
  });

  it('calculates months from liquid assets', () => {
    const assets = [
      { type: 'savings', value: 60000 },
      { type: 'property', value: 500000 },
    ];
    expect(calcEmergencyFundMonths(assets, 10000)).toBe(6);
  });

  it('recognises all liquid asset keywords', () => {
    const types = [
      'savings',
      'money_market',
      'cash',
      'bank',
      'deposit',
      'emergency',
      'money market',
      'savings account',
      'call deposit',
    ];
    types.forEach((type) => {
      const assets = [{ type, value: 10000 }];
      const result = calcEmergencyFundMonths(assets, 10000);
      expect(result).toBeGreaterThan(0);
    });
  });

  it('treats missing value as 0', () => {
    const assets = [{ type: 'savings' }];
    expect(calcEmergencyFundMonths(assets, 10000)).toBe(0);
  });
});

// ── deriveEmergencyFundStatus ────────────────────────────────────────────────

describe('deriveEmergencyFundStatus', () => {
  it('returns no-data for null', () => {
    expect(deriveEmergencyFundStatus(null)).toBe('no-data');
  });

  it('returns good for >= 6 months', () => {
    expect(deriveEmergencyFundStatus(6)).toBe('good');
    expect(deriveEmergencyFundStatus(12)).toBe('good');
  });

  it('returns caution for 3–5 months', () => {
    expect(deriveEmergencyFundStatus(3)).toBe('caution');
    expect(deriveEmergencyFundStatus(5)).toBe('caution');
  });

  it('returns gap for < 3 months', () => {
    expect(deriveEmergencyFundStatus(0)).toBe('gap');
    expect(deriveEmergencyFundStatus(2.9)).toBe('gap');
  });
});

// ── calcInsuranceCoverageRatio ───────────────────────────────────────────────

describe('calcInsuranceCoverageRatio', () => {
  it('returns null when recommended is 0', () => {
    expect(calcInsuranceCoverageRatio(100000, 0)).toBeNull();
  });

  it('calculates ratio correctly', () => {
    expect(calcInsuranceCoverageRatio(1000000, 1000000)).toBe(100);
    expect(calcInsuranceCoverageRatio(800000, 1000000)).toBe(80);
  });
});

// ── deriveInsuranceCoverageStatus ────────────────────────────────────────────

describe('deriveInsuranceCoverageStatus', () => {
  it('returns no-data for null', () => {
    expect(deriveInsuranceCoverageStatus(null)).toBe('no-data');
  });

  it('returns good for >= 100%', () => {
    expect(deriveInsuranceCoverageStatus(100)).toBe('good');
    expect(deriveInsuranceCoverageStatus(120)).toBe('good');
  });

  it('returns caution for 80–99%', () => {
    expect(deriveInsuranceCoverageStatus(80)).toBe('caution');
    expect(deriveInsuranceCoverageStatus(99)).toBe('caution');
  });

  it('returns gap for < 80%', () => {
    expect(deriveInsuranceCoverageStatus(79)).toBe('gap');
    expect(deriveInsuranceCoverageStatus(0)).toBe('gap');
  });
});

// ── calcRetirementProgress ───────────────────────────────────────────────────

describe('calcRetirementProgress', () => {
  it('returns null when required is 0', () => {
    expect(calcRetirementProgress(100000, 0)).toBeNull();
  });

  it('calculates retirement progress', () => {
    expect(calcRetirementProgress(900000, 1000000)).toBe(90);
    expect(calcRetirementProgress(600000, 1000000)).toBe(60);
  });
});

// ── deriveRetirementProgressStatus ──────────────────────────────────────────

describe('deriveRetirementProgressStatus', () => {
  it('returns no-data for null', () => {
    expect(deriveRetirementProgressStatus(null)).toBe('no-data');
  });

  it('returns good for >= 90%', () => {
    expect(deriveRetirementProgressStatus(90)).toBe('good');
    expect(deriveRetirementProgressStatus(100)).toBe('good');
  });

  it('returns caution for 60–89%', () => {
    expect(deriveRetirementProgressStatus(60)).toBe('caution');
    expect(deriveRetirementProgressStatus(89)).toBe('caution');
  });

  it('returns gap for < 60%', () => {
    expect(deriveRetirementProgressStatus(59)).toBe('gap');
    expect(deriveRetirementProgressStatus(0)).toBe('gap');
  });
});

// ── deriveSavingsRateStatus ──────────────────────────────────────────────────

describe('deriveSavingsRateStatus', () => {
  it('returns no-data for 0 or negative', () => {
    expect(deriveSavingsRateStatus(0)).toBe('no-data');
    expect(deriveSavingsRateStatus(-5)).toBe('no-data');
  });

  it('returns good for >= 15%', () => {
    expect(deriveSavingsRateStatus(15)).toBe('good');
    expect(deriveSavingsRateStatus(25)).toBe('good');
  });

  it('returns caution for 10–14%', () => {
    expect(deriveSavingsRateStatus(10)).toBe('caution');
    expect(deriveSavingsRateStatus(14)).toBe('caution');
  });

  it('returns gap for < 10%', () => {
    expect(deriveSavingsRateStatus(5)).toBe('gap');
    expect(deriveSavingsRateStatus(1)).toBe('gap');
  });
});

// ── deriveNetWorthStatus ─────────────────────────────────────────────────────

describe('deriveNetWorthStatus', () => {
  it('returns no-data when hasData is false', () => {
    expect(deriveNetWorthStatus(100000, false)).toBe('no-data');
  });

  it('returns good for positive net worth', () => {
    expect(deriveNetWorthStatus(1, true)).toBe('good');
    expect(deriveNetWorthStatus(1000000, true)).toBe('good');
  });

  it('returns caution for zero net worth', () => {
    expect(deriveNetWorthStatus(0, true)).toBe('caution');
  });

  it('returns gap for negative net worth', () => {
    expect(deriveNetWorthStatus(-100, true)).toBe('gap');
  });
});

// ── deriveHealthSubScores ────────────────────────────────────────────────────

const baseInputs = {
  gapStatuses: [],
  riskFnaPublished: false,
  medicalFnaPublished: false,
  retirementFnaPublished: false,
  investmentFnaPublished: false,
  estateFnaPublished: false,
  hasRiskPolicies: false,
  hasMedicalPolicies: false,
  hasRetirementPolicies: false,
  hasInvestmentPolicies: false,
  hasEstatePolicies: false,
  retirementHasShortfall: null,
  retirementShortfallSeverity: null,
};

describe('deriveHealthSubScores', () => {
  it('returns all zeros when no data', () => {
    const result = deriveHealthSubScores(baseInputs);
    expect(result.overall).toBe(0);
    expect(result.risk).toBe(0);
    expect(result.medicalAid).toBe(0);
  });

  it('scores risk from gap statuses', () => {
    const inputs = {
      ...baseInputs,
      gapStatuses: [
        { label: 'Life Cover', status: 'good' as const },
        { label: 'Disability', status: 'caution' as const },
        { label: 'Income', status: 'gap' as const },
      ],
    };
    const result = deriveHealthSubScores(inputs);
    expect(result.risk).toBeGreaterThan(0);
    expect(result.risk).toBeLessThan(100);
    expect(result.hasData.risk).toBe(true);
  });

  it('gives partial credit for risk policies without FNA', () => {
    const result = deriveHealthSubScores({ ...baseInputs, hasRiskPolicies: true });
    expect(result.risk).toBe(30);
  });

  it('scores medical at 100 when FNA published', () => {
    const result = deriveHealthSubScores({ ...baseInputs, medicalFnaPublished: true });
    expect(result.medicalAid).toBe(100);
    expect(result.hasData.medicalAid).toBe(true);
  });

  it('scores medical at 40 with policies but no FNA', () => {
    const result = deriveHealthSubScores({ ...baseInputs, hasMedicalPolicies: true });
    expect(result.medicalAid).toBe(40);
  });

  it('scores retirement at 100 with published FNA and no shortfall', () => {
    const inputs = {
      ...baseInputs,
      retirementFnaPublished: true,
      retirementHasShortfall: false,
      retirementShortfallSeverity: 'none' as const,
    };
    expect(deriveHealthSubScores(inputs).retirement).toBe(100);
  });

  it('scores retirement by shortfall severity', () => {
    const base = { ...baseInputs, retirementFnaPublished: true, retirementHasShortfall: true };
    expect(
      deriveHealthSubScores({ ...base, retirementShortfallSeverity: 'minor' }).retirement,
    ).toBe(67);
    expect(
      deriveHealthSubScores({ ...base, retirementShortfallSeverity: 'moderate' }).retirement,
    ).toBe(33);
    expect(
      deriveHealthSubScores({ ...base, retirementShortfallSeverity: 'severe' }).retirement,
    ).toBe(10);
  });

  it('calculates overall as average of active pillars only', () => {
    const inputs = { ...baseInputs, medicalFnaPublished: true, investmentFnaPublished: true };
    const result = deriveHealthSubScores(inputs);
    expect(result.overall).toBe(100);
  });
});

// ── deriveAccountStatus ──────────────────────────────────────────────────────

describe('deriveAccountStatus', () => {
  it('returns active by default', () => {
    expect(deriveAccountStatus(makeClient())).toBe('active');
  });

  it('returns closed when deleted flag is set', () => {
    expect(deriveAccountStatus(makeClient({ deleted: true }))).toBe('closed');
  });

  it('returns closed when accountStatus is closed', () => {
    expect(deriveAccountStatus(makeClient({ accountStatus: 'closed' }))).toBe('closed');
  });

  it('returns suspended when suspended flag is set', () => {
    expect(deriveAccountStatus(makeClient({ suspended: true }))).toBe('suspended');
  });

  it('returns suspended when accountStatus is suspended', () => {
    expect(deriveAccountStatus(makeClient({ accountStatus: 'suspended' }))).toBe('suspended');
  });

  it('prioritises deleted over suspended', () => {
    expect(deriveAccountStatus(makeClient({ deleted: true, suspended: true }))).toBe('closed');
  });
});

// ── countByStatus ────────────────────────────────────────────────────────────

describe('countByStatus', () => {
  it('counts correctly across statuses', () => {
    const clients = [
      makeClient(),
      makeClient({ deleted: true }),
      makeClient({ suspended: true }),
      makeClient(),
    ];
    const result = countByStatus(clients);
    expect(result.active).toBe(2);
    expect(result.closed).toBe(1);
    expect(result.suspended).toBe(1);
  });

  it('returns all zeros for empty list', () => {
    const result = countByStatus([]);
    expect(result).toEqual({ active: 0, suspended: 0, closed: 0 });
  });
});

// ── filterClients ────────────────────────────────────────────────────────────

describe('filterClients', () => {
  const clients = [
    makeClient({ id: 'c1', firstName: 'Alice', lastName: 'Wonder', email: 'alice@test.com' }),
    makeClient({ id: 'c2', firstName: 'Bob', lastName: 'Builder', email: 'bob@test.com' }),
    makeClient({
      id: 'c3',
      firstName: 'Charlie',
      lastName: 'Brown',
      email: 'charlie@test.com',
      suspended: true,
    }),
  ];

  it('returns all non-rejected clients when no filters', () => {
    const result = filterClients(clients, {});
    expect(result).toHaveLength(3);
  });

  it('filters by account status', () => {
    const result = filterClients(clients, { accountStatus: 'suspended' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c3');
  });

  it('filters active clients only', () => {
    const result = filterClients(clients, { accountStatus: 'active' });
    expect(result).toHaveLength(2);
  });

  it('filters by search term (first name)', () => {
    const result = filterClients(clients, { search: 'alice' });
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe('Alice');
  });

  it('filters by search term (email)', () => {
    const result = filterClients(clients, { search: 'bob@test' });
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe('Bob');
  });

  it('returns empty when search has no matches', () => {
    const result = filterClients(clients, { search: 'xyz_not_found' });
    expect(result).toHaveLength(0);
  });

  it('excludes declined/rejected clients', () => {
    const withRejected = [
      ...clients,
      makeClient({ id: 'c4', firstName: 'Dave', applicationStatus: 'declined' }),
    ];
    const result = filterClients(withRejected, {});
    expect(result.find((c) => c.id === 'c4')).toBeUndefined();
  });
});

// ── calculateGrowthStats ─────────────────────────────────────────────────────

describe('calculateGrowthStats', () => {
  it('returns total count', () => {
    const clients = [makeClient(), makeClient()];
    const result = calculateGrowthStats(clients);
    expect(result.total).toBe(2);
  });

  it('counts clients created this month', () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthDate = new Date(startOfMonth.getTime() + 1000).toISOString();
    const lastMonthDate = new Date(startOfMonth.getTime() - 86400000).toISOString();

    const clients = [
      makeClient({ createdAt: thisMonthDate }),
      makeClient({ createdAt: thisMonthDate }),
      makeClient({ createdAt: lastMonthDate }),
    ];
    const result = calculateGrowthStats(clients);
    expect(result.newCount).toBe(2);
  });

  it('shows 100% growth when starting from 0', () => {
    const now = new Date();
    const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
    const result = calculateGrowthStats([makeClient({ createdAt: thisMonthDate })]);
    expect(result.growthRate).toBe('100.0');
  });
});
