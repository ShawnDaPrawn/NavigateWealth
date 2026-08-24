import { describe, expect, it } from 'vitest';
import {
  type ActionItemsInputs,
  deriveActionDistribution,
  deriveActionItems,
} from '../clientOverview/actionItems';
import { deriveEnrichedActivityEvents } from '../clientOverview/activity';
import {
  deriveAssetAllocation,
  deriveCashflowData,
  deriveInsuranceCoverageItems,
} from '../clientOverview/charts';
import { extractRetirementResults, extractRiskFinalNeeds } from '../clientOverview/fnaExtract';
import {
  addMonths,
  addressLine,
  calcAge,
  daysBetween,
  fmt,
  fmtCompact,
  fmtDate,
  fmtDateTime,
  fmtRelative,
  isPast,
  nextAnniversary,
  pct,
} from '../clientOverview/format';
import { type GapAnalysisInputs, deriveGapAnalysis } from '../clientOverview/gapAnalysis';
import { type HealthScoreInputs, deriveHealthScore } from '../clientOverview/healthScore';
import { type KpiValuesInputs, deriveKpiValues } from '../clientOverview/kpiValues';
import { type PillarsInputs, derivePillars } from '../clientOverview/pillars';
import {
  type Policy,
  normalizePolicyData,
  numVal,
  strVal,
  sumField,
  sumFirstNonZero,
  sumInvestmentPremiums,
  sumMultiField,
  worstGapStatus,
} from '../clientOverview/policyFields';
import type { ProfileData } from '../../types';

const policy = (data: Record<string, unknown>): Policy => ({
  id: 'p',
  providerName: 'Prov',
  categoryId: 'c',
  data,
  updatedAt: '2024-01-01',
});

describe('deriveHealthScore', () => {
  const baseInputs: HealthScoreInputs = {
    gapAnalysis: [],
    fnaStatuses: [],
    grossMonthly: 0,
    profile: null,
    retirementFnaPublished: false,
    retirementFnaResult: null,
    netWorth: -100,
  };

  it('returns 0 when nothing is in place (only profile + net-worth buckets active, all empty)', () => {
    expect(deriveHealthScore({ ...baseInputs })).toBe(0);
  });

  it('returns 100 when every scoring bucket is fully satisfied', () => {
    expect(
      deriveHealthScore({
        gapAnalysis: [
          { label: 'Life', status: 'good', current: '', recommended: '' },
          { label: 'Disability', status: 'good', current: '', recommended: '' },
        ],
        fnaStatuses: [
          { status: 'published', loading: false },
          { status: 'published', loading: false },
        ],
        grossMonthly: 50000,
        profile: {
          taxNumber: '123',
          emergencyContactName: 'Jane',
          familyMembers: [{}],
          assets: [{}],
          liabilities: [],
        },
        retirementFnaPublished: true,
        retirementFnaResult: { results: { hasShortfall: false } },
        netWorth: 1_000_000,
      }),
    ).toBe(100);
  });

  it('awards the minor-shortfall retirement tier (10 of 15)', () => {
    // Active buckets: profile (20 -> 0), savings (15 -> 10), net worth (10 -> 0).
    // round(10 / 45 * 100) = 22.
    expect(
      deriveHealthScore({
        ...baseInputs,
        retirementFnaPublished: true,
        retirementFnaResult: {
          results: { hasShortfall: true, capitalShortfall: 10, requiredCapital: 100 },
        },
        netWorth: -1,
      }),
    ).toBe(22);
  });

  it('gives half credit for caution gaps and a break-even net worth', () => {
    // coverage 30 -> 15 (caution); profile 20 -> 0; net worth 10 -> 5 (break-even).
    // round((15 + 5) / 60 * 100) = 33.
    expect(
      deriveHealthScore({
        ...baseInputs,
        gapAnalysis: [{ label: 'Life', status: 'caution', current: '', recommended: '' }],
        netWorth: 0,
      }),
    ).toBe(33);
  });
});

describe('deriveKpiValues', () => {
  const inputs: KpiValuesInputs = {
    profile: { assets: [{ type: 'cash', value: 600000 }], liabilities: [] },
    grossMonthly: 50000,
    netMonthly: 35000,
    totalMonthlyDebt: 10000,
    totalRetirementPremium: 5000,
    totalInvestmentPremium: 2000,
    riskFnaPublished: false,
    riskFnaResult: null,
    retResults: null,
    retirementSavingsRate: 18,
    netWorth: 1_000_000,
  };

  it('returns the six KPI cards in a fixed order', () => {
    expect(deriveKpiValues(inputs).map((k) => k.id)).toEqual([
      'net_worth',
      'dti',
      'savings_rate',
      'emergency_fund',
      'insurance_coverage',
      'retirement_progress',
    ]);
  });

  it('computes DTI and net-worth status from the financials', () => {
    const kpis = deriveKpiValues(inputs);
    const dti = kpis.find((k) => k.id === 'dti')!;
    expect(dti.rawValue).toBe(20); // 10000 / 50000 * 100
    expect(dti.displayValue).toBe('20.0%');
    expect(dti.status).toBe('good'); // < 36

    const nw = kpis.find((k) => k.id === 'net_worth')!;
    expect(nw.rawValue).toBe(1_000_000);
    expect(nw.status).toBe('good'); // positive + has a balance sheet
  });

  it('reports no-data for retirement/insurance when their FNAs are absent', () => {
    const kpis = deriveKpiValues(inputs);
    expect(kpis.find((k) => k.id === 'retirement_progress')!.status).toBe('no-data');
    expect(kpis.find((k) => k.id === 'insurance_coverage')!.status).toBe('no-data');
    // savings rate 18% (>= 15) with income present -> good
    expect(kpis.find((k) => k.id === 'savings_rate')!.status).toBe('good');
  });
});

describe('deriveActionItems', () => {
  const Icon = () => null;
  const icons = {
    ClipboardCheck: Icon,
    PlayCircle: Icon,
    Clock: Icon,
    FileText: Icon,
    Shield: Icon,
    AlertTriangle: Icon,
    Calendar: Icon,
    DollarSign: Icon,
    Phone: Icon,
    Users: Icon,
    Scale: Icon,
  };
  const base: ActionItemsInputs = {
    fnaStatuses: [],
    gapAnalysis: [],
    allPolicies: [],
    grossMonthly: 50000,
    profile: {
      emergencyContactName: 'Jane',
      taxNumber: '123',
      familyMembers: [{}],
      assets: [{}],
      liabilities: [],
    },
    dependants: [{}],
    isClient: false,
    icons,
  };

  it('returns no items when the profile + coverage are all in order', () => {
    expect(deriveActionItems(base)).toEqual([]);
  });

  it('flags a not-started FNA as a recommended item', () => {
    const items = deriveActionItems({
      ...base,
      fnaStatuses: [{ key: 'risk', name: 'Risk Plan', status: 'not_started', loading: false }],
    });
    const item = items.find((i) => i.id === 'fna-missing-risk');
    expect(item?.priority).toBe('recommended');
    expect(item?.category).toBe('fna');
  });

  it('sorts an urgent critical-cover gap ahead of a recommended item', () => {
    const items = deriveActionItems({
      ...base,
      gapAnalysis: [{ label: 'Life Cover', status: 'gap', current: 'R 0', recommended: 'R 1m' }],
      fnaStatuses: [{ key: 'risk', name: 'Risk Plan', status: 'not_started', loading: false }],
    });
    expect(items[0].priority).toBe('urgent');
    expect(items[0].id).toBe('gap-life-cover');
  });

  it('flags missing income with client-facing copy in client mode', () => {
    const items = deriveActionItems({ ...base, grossMonthly: 0, isClient: true });
    const income = items.find((i) => i.id === 'profile-income-missing');
    expect(income?.title).toBe('We need your income details');
  });
});

describe('chart-data derivations', () => {
  it('deriveAssetAllocation maps balance-sheet assets and carries FNA values', () => {
    const out = deriveAssetAllocation({
      assets: [
        { type: 'cash', value: 5000, description: 'Savings' },
        { type: 'property', value: 'oops' as unknown as number },
      ],
      retirementCurrentValue: 100000,
      investmentCurrentValue: 50000,
    });
    expect(out.assets).toEqual([
      { type: 'cash', value: 5000, description: 'Savings' },
      { type: 'property', value: 0, description: undefined },
    ]);
    expect(out.retirementValue).toBe(100000);
    expect(out.investmentValue).toBe(50000);
  });

  it('deriveInsuranceCoverageItems returns [] when the Risk FNA is not published', () => {
    expect(
      deriveInsuranceCoverageItems({ riskFnaPublished: false, riskFnaResult: { results: {} } }),
    ).toEqual([]);
  });

  it('deriveCashflowData maps premiums and falls back to 72% net income', () => {
    const base = {
      grossMonthly: 50000,
      totalRiskPremium: 1000,
      totalMedicalPremium: 2000,
      totalRetirementPremium: 3000,
      totalInvestmentPremium: 1500,
      totalEmployeePremium: 500,
      totalMonthlyDebt: 8000,
    };
    expect(deriveCashflowData({ ...base, netMonthly: 40000 }).netIncome).toBe(40000);
    expect(deriveCashflowData({ ...base, netMonthly: 0 }).netIncome).toBeCloseTo(36000);
    const cf = deriveCashflowData({ ...base, netMonthly: 40000 });
    expect(cf.riskPremiums).toBe(1000);
    expect(cf.debtPayments).toBe(8000);
  });

  it('deriveActionDistribution tallies items by priority', () => {
    const mk = (priority: string) => ({
      id: priority,
      priority,
      category: 'fna',
      title: 't',
      icon: () => null,
    });
    const items = [mk('urgent'), mk('urgent'), mk('attention'), mk('recommended')];
    const dist = deriveActionDistribution(items as Parameters<typeof deriveActionDistribution>[0]);
    expect(dist).toEqual({ urgent: 2, attention: 1, recommended: 1, monitoring: 0 });
  });
});

describe('deriveEnrichedActivityEvents', () => {
  const Icon = () => null;
  const icons = { FileCheck: Icon, ClipboardCheck: Icon, FileText: Icon };

  it('merges FNA events with stored events, drops noise, sorts newest-first', () => {
    const out = deriveEnrichedActivityEvents({
      activityEvents: [
        {
          id: 'a1',
          type: 'login',
          label: 'Login',
          timestamp: '2024-01-01T00:00:00Z',
          icon: Icon,
          iconColor: 'x',
        },
        {
          id: 'noise',
          type: 'session_refresh',
          label: 'Refresh',
          timestamp: '2024-06-01T00:00:00Z',
          icon: Icon,
          iconColor: 'x',
        },
      ],
      fnaStatuses: [
        {
          key: 'risk',
          name: 'Risk Plan',
          status: 'published',
          publishedAt: '2024-03-01T00:00:00Z',
        },
      ],
      isClient: false,
      icons,
    });
    // session_refresh dropped as noise; remaining sorted newest-first
    expect(out.map((e) => e.id)).toEqual(['fna-published-risk', 'a1']);
  });

  it('hides client-restricted activity types in client mode', () => {
    const out = deriveEnrichedActivityEvents({
      activityEvents: [
        {
          id: 'login-fail',
          type: 'login_failure',
          label: 'x',
          timestamp: '2024-01-01T00:00:00Z',
          icon: Icon,
          iconColor: 'x',
        },
      ],
      fnaStatuses: [],
      isClient: true,
      icons,
    });
    expect(out).toEqual([]);
  });
});

describe('currency + percentage formatting', () => {
  it('fmt prefixes R and keeps digits; guards nullish/NaN', () => {
    expect(fmt(12345).startsWith('R ')).toBe(true);
    expect(fmt(12345).replace(/\D/g, '')).toBe('12345');
    expect(fmt(0)).toBe('R 0');
    expect(fmt(undefined)).toBe('R 0');
    expect(fmt(null)).toBe('R 0');
    expect(fmt(NaN)).toBe('R 0');
  });

  it('pct formats to one decimal', () => {
    expect(pct(12.34)).toBe('12.3%');
    expect(pct(5)).toBe('5.0%');
  });

  it('fmtCompact abbreviates millions and hundred-thousands', () => {
    expect(fmtCompact(1_500_000)).toBe('R 1.5m');
    expect(fmtCompact(450_000)).toBe('R 450k');
    expect(fmtCompact(-2_000_000)).toBe('R -2.0m');
    expect(fmtCompact(5000).startsWith('R ')).toBe(true); // falls through to fmt
    expect(fmtCompact(undefined)).toBe('R 0');
  });
});

describe('dates', () => {
  it('calcAge computes whole years and guards bad input', () => {
    const y = new Date().getFullYear();
    expect(calcAge(`${y - 25}-01-01`)).toBe(25);
    expect(calcAge(undefined)).toBeNull();
    expect(calcAge('not-a-date')).toBeNull();
  });

  it('fmtDate / fmtDateTime format valid dates and dash invalid ones', () => {
    expect(fmtDate('2024-03-15')).toContain('2024');
    expect(fmtDate('2024-03-15')).toContain('Mar');
    expect(fmtDate(undefined)).toBe('-');
    expect(fmtDate('nonsense')).toBe('-');
    expect(fmtDateTime('2024-03-15T10:30:00Z')).toContain('2024');
    expect(fmtDateTime(undefined)).toBe('-');
  });

  it('fmtRelative bins elapsed time', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    expect(fmtRelative(ago(0))).toBe('just now');
    expect(fmtRelative(ago(5 * 60_000))).toBe('5m ago');
    expect(fmtRelative(ago(2 * 3600_000))).toBe('2h ago');
    expect(fmtRelative(ago(3 * 86_400_000))).toBe('3d ago');
    expect(fmtRelative(ago(40 * 86_400_000))).toBe('1mo ago');
    expect(fmtRelative(ago(400 * 86_400_000))).toBe('1y ago');
    expect(fmtRelative('bad')).toBe('');
  });

  it('addMonths shifts the month', () => {
    expect(new Date(addMonths('2024-01-15T00:00:00Z', 2)).getUTCMonth()).toBe(2); // March
  });

  it('isPast distinguishes past from future', () => {
    expect(isPast(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isPast(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });

  it('nextAnniversary returns the next future occurrence, preserving month/day', () => {
    const input = '1980-06-15T00:00:00Z';
    const result = nextAnniversary(input);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    const d = new Date(input);
    expect(result!.getMonth()).toBe(d.getMonth());
    expect(result!.getDate()).toBe(d.getDate());
    expect(nextAnniversary('bad')).toBeNull();
  });

  it('daysBetween counts whole days', () => {
    expect(daysBetween(new Date('2024-01-01'), new Date('2024-01-11'))).toBe(10);
  });
});

describe('addressLine', () => {
  it('joins present residential parts', () => {
    const profile = {
      residentialAddressLine1: '1 Main Rd',
      residentialSuburb: 'Sea Point',
      residentialCity: 'Cape Town',
      residentialProvince: 'WC',
      residentialPostalCode: '8001',
    } as unknown as ProfileData;
    expect(addressLine(profile)).toBe('1 Main Rd, Sea Point, Cape Town, WC, 8001');
  });

  it('returns a dash for undefined or empty profiles', () => {
    expect(addressLine(undefined)).toBe('-');
    expect(addressLine({} as ProfileData)).toBe('-');
  });
});

describe('policy value access', () => {
  it('numVal coerces numbers and guards blanks/non-numerics', () => {
    expect(numVal(policy({ x: '123' }), 'x')).toBe(123);
    expect(numVal(policy({ x: 456 }), 'x')).toBe(456);
    expect(numVal(policy({ x: '' }), 'x')).toBe(0);
    expect(numVal(policy({ x: 'abc' }), 'x')).toBe(0);
    expect(numVal(policy({}), 'missing')).toBe(0);
  });

  it('strVal returns strings only', () => {
    expect(strVal(policy({ x: 'hi' }), 'x')).toBe('hi');
    expect(strVal(policy({ x: 123 }), 'x')).toBeUndefined();
    expect(strVal(policy({ x: '' }), 'x')).toBeUndefined();
    expect(strVal(policy({}), 'x')).toBeUndefined();
  });
});

describe('policy aggregation', () => {
  it('sumField totals a key across policies', () => {
    expect(sumField([policy({ a: 10 }), policy({ a: '5' }), policy({ a: 'x' })], 'a')).toBe(15);
  });

  it('sumInvestmentPremiums skips zero and lump-sum-like contributions', () => {
    // genuine monthly contribution (< current value) is counted
    expect(
      sumInvestmentPremiums([
        policy({ invest_monthly_contribution: 1000, invest_current_value: 500000 }),
      ]),
    ).toBe(1000);
    // contribution >= current value => treated as lump sum, excluded
    expect(
      sumInvestmentPremiums([
        policy({ invest_monthly_contribution: 500000, invest_current_value: 500000 }),
      ]),
    ).toBe(0);
    // zero/negative contribution excluded
    expect(sumInvestmentPremiums([policy({ invest_monthly_contribution: 0 })])).toBe(0);
  });

  it('sumFirstNonZero takes the first non-zero candidate per policy', () => {
    expect(sumFirstNonZero([policy({ a: 0, b: 200, c: 999 })], 'a', 'b', 'c')).toBe(200);
    expect(sumFirstNonZero([policy({ a: 0, b: 0 })], 'a', 'b')).toBe(0);
  });

  it('sumMultiField adds every key per policy', () => {
    expect(sumMultiField([policy({ a: 10, b: 20 }), policy({ a: 1, b: 2 })], ['a', 'b'])).toBe(33);
  });
});

describe('worstGapStatus', () => {
  it('reduces a set of gap statuses to the worst pillar health', () => {
    expect(worstGapStatus([])).toBe('no-data');
    expect(worstGapStatus(['none', 'none'])).toBe('no-data');
    expect(worstGapStatus(['good', 'none'])).toBe('healthy');
    expect(worstGapStatus(['caution', 'good'])).toBe('attention');
    expect(worstGapStatus(['gap', 'caution', 'good'])).toBe('critical');
  });
});

describe('normalizePolicyData', () => {
  it('mirrors field-id entries under their keyId, preserving originals', () => {
    const out = normalizePolicyData({ rp_6: 5000, rp_2: 'Discovery' }, [
      { id: 'rp_6', keyId: 'risk_monthly_premium' },
      { id: 'rp_2', keyId: 'risk_provider' },
    ]);
    expect(out.rp_6).toBe(5000); // original kept
    expect(out.risk_monthly_premium).toBe(5000); // mirrored under keyId
    expect(out.risk_provider).toBe('Discovery');
  });

  it('skips fields without a keyId or without a matching data entry', () => {
    const out = normalizePolicyData({ a: 1 }, [
      { id: 'a' }, // no keyId
      { id: 'missing', keyId: 'mapped' }, // no data entry
    ]);
    expect(out).toEqual({ a: 1 });
  });
});

describe('extractRiskFinalNeeds', () => {
  it('returns [] for nullish input or a missing finalNeeds array', () => {
    expect(extractRiskFinalNeeds(null)).toEqual([]);
    expect(extractRiskFinalNeeds(undefined)).toEqual([]);
    expect(extractRiskFinalNeeds({ finalNeeds: 'nope' })).toEqual([]);
  });

  it('maps needs and coerces numbers, defaulting missing fields', () => {
    const out = extractRiskFinalNeeds({
      finalNeeds: [
        {
          riskType: 'life',
          label: 'Life',
          grossNeed: '1000000',
          existingCoverTotal: 400000,
          netShortfall: '600000',
        },
        {},
      ],
    });
    expect(out[0]).toEqual({
      riskType: 'life',
      label: 'Life',
      grossNeed: 1000000,
      existingCoverTotal: 400000,
      netShortfall: 600000,
      finalRecommendedCover: 0,
    });
    expect(out[1]).toEqual({
      riskType: '',
      label: '',
      grossNeed: 0,
      existingCoverTotal: 0,
      netShortfall: 0,
      finalRecommendedCover: 0,
    });
  });
});

describe('extractRetirementResults', () => {
  it('returns null when there is no payload or no results/calculations', () => {
    expect(extractRetirementResults(null)).toBeNull();
    expect(extractRetirementResults({})).toBeNull();
  });

  it('reads from results, falling back to calculations, and coerces', () => {
    const fromResults = extractRetirementResults({
      results: { hasShortfall: true, capitalShortfall: '50000', requiredCapital: 200000 },
    });
    expect(fromResults).toMatchObject({
      hasShortfall: true,
      capitalShortfall: 50000,
      requiredCapital: 200000,
      projectedCapital: 0,
    });

    const fromCalculations = extractRetirementResults({
      calculations: { hasShortfall: false, projectedCapital: 750000 },
    });
    expect(fromCalculations).toMatchObject({ hasShortfall: false, projectedCapital: 750000 });
  });
});

describe('deriveGapAnalysis', () => {
  const base: GapAnalysisInputs = {
    fnaResultsMap: {},
    riskFnaPublished: false,
    retirementFnaPublished: false,
    medicalFnaPublished: false,
    estateFnaPublished: false,
    medicalPolicies: [],
    estatePolicies: [],
  };
  const find = (gaps: ReturnType<typeof deriveGapAnalysis>, label: string) =>
    gaps.find((g) => g.label === label);

  it('returns [] when no FNAs are published', () => {
    expect(deriveGapAnalysis(base)).toEqual([]);
  });

  it('flags a life-cover gap when there is a shortfall and low coverage ratio', () => {
    const gap = find(
      deriveGapAnalysis({
        ...base,
        riskFnaPublished: true,
        fnaResultsMap: {
          risk: {
            finalNeeds: [
              {
                riskType: 'life',
                grossNeed: 1_000_000,
                existingCoverTotal: 400_000,
                netShortfall: 600_000,
              },
            ],
          },
        },
      }),
      'Life Cover',
    );
    expect(gap?.status).toBe('gap'); // ratio 0.4 < 0.8
    expect(gap?.detail).toContain('Shortfall');
    expect(gap?.recommended).toContain('FNA recommended');
  });

  it('marks life cover "caution" when covered >=80% but still short, and "good" when no shortfall', () => {
    const caution = find(
      deriveGapAnalysis({
        ...base,
        riskFnaPublished: true,
        fnaResultsMap: {
          risk: {
            finalNeeds: [
              {
                riskType: 'life',
                grossNeed: 1_000_000,
                existingCoverTotal: 850_000,
                netShortfall: 150_000,
              },
            ],
          },
        },
      }),
      'Life Cover',
    );
    expect(caution?.status).toBe('caution');

    const good = find(
      deriveGapAnalysis({
        ...base,
        riskFnaPublished: true,
        fnaResultsMap: {
          risk: {
            finalNeeds: [
              {
                riskType: 'life',
                grossNeed: 1_000_000,
                existingCoverTotal: 1_200_000,
                netShortfall: 0,
              },
            ],
          },
        },
      }),
      'Life Cover',
    );
    expect(good?.status).toBe('good');
    expect(good?.detail).toBe('Adequately covered');
  });

  it('combines temporary + permanent income protection into one gap', () => {
    const gap = find(
      deriveGapAnalysis({
        ...base,
        riskFnaPublished: true,
        fnaResultsMap: {
          risk: {
            finalNeeds: [
              {
                riskType: 'incomeProtectionTemporary',
                grossNeed: 30_000,
                existingCoverTotal: 10_000,
                netShortfall: 20_000,
              },
              {
                riskType: 'incomeProtectionPermanent',
                grossNeed: 20_000,
                existingCoverTotal: 5_000,
                netShortfall: 15_000,
              },
            ],
          },
        },
      }),
      'Income Protection',
    );
    expect(gap?.status).toBe('gap');
    expect(gap?.detail).toContain('Shortfall'); // combined 35k shortfall
  });

  it('reports medical aid by active-plan count', () => {
    const withPlan = find(
      deriveGapAnalysis({ ...base, medicalFnaPublished: true, medicalPolicies: [policy({})] }),
      'Medical Aid',
    );
    expect(withPlan?.status).toBe('good');
    expect(withPlan?.current).toContain('1 active plan');

    const noPlan = find(
      deriveGapAnalysis({ ...base, medicalFnaPublished: true, medicalPolicies: [] }),
      'Medical Aid',
    );
    expect(noPlan?.status).toBe('gap');
    expect(noPlan?.current).toBe('None');
  });

  it('grades the retirement gap by shortfall size', () => {
    const ret = (capitalShortfall: number, requiredCapital: number, hasShortfall = true) =>
      find(
        deriveGapAnalysis({
          ...base,
          retirementFnaPublished: true,
          fnaResultsMap: {
            retirement: {
              results: {
                hasShortfall,
                capitalShortfall,
                requiredCapital,
                projectedCapital: 100_000,
              },
            },
          },
        }),
        'Retirement Savings',
      );
    expect(ret(800_000, 1_000_000)?.status).toBe('gap'); // 80% short
    expect(ret(100_000, 1_000_000)?.status).toBe('caution'); // <30% short
    expect(ret(0, 1_000_000, false)?.status).toBe('good');
  });

  it('reports estate planning by policy presence', () => {
    expect(
      find(
        deriveGapAnalysis({ ...base, estateFnaPublished: true, estatePolicies: [policy({})] }),
        'Estate Planning',
      )?.status,
    ).toBe('good');
    expect(
      find(
        deriveGapAnalysis({ ...base, estateFnaPublished: true, estatePolicies: [] }),
        'Estate Planning',
      )?.status,
    ).toBe('caution');
  });
});

describe('derivePillars', () => {
  const Icon = () => null;
  const pbase: PillarsInputs = {
    gapAnalysis: [],
    fnaStatuses: [],
    fnaResultsMap: {},
    riskFnaPublished: false,
    medicalFnaPublished: false,
    retirementFnaPublished: false,
    riskPolicies: [],
    medicalPolicies: [],
    retirementPolicies: [],
    investmentPolicies: [],
    estatePolicies: [],
    totalLifeCover: 0,
    totalDisability: 0,
    totalSevereIllness: 0,
    totalIncomeProtection: 0,
    totalRiskPremium: 0,
    totalMedicalPremium: 0,
    retirementCurrentValue: 0,
    totalRetirementPremium: 0,
    investmentCurrentValue: 0,
    totalInvestmentPremium: 0,
    grossMonthly: 0,
    retirementSavingsRate: 0,
    dependants: [],
    taxNumber: undefined,
    icons: { risk: Icon, medical: Icon, retirement: Icon, investment: Icon, estate: Icon },
  };

  it('always returns the five pillars in order, "no-data" when empty, with icons threaded', () => {
    const pillars = derivePillars(pbase);
    expect(pillars.map((p) => p.id)).toEqual([
      'risk-planning',
      'medical-aid',
      'retirement',
      'investment',
      'estate',
    ]);
    expect(pillars.every((p) => p.health === 'no-data')).toBe(true);
    expect(pillars[0].icon).toBe(Icon);
  });

  it('derives risk health from the gap analysis (worst status wins)', () => {
    const pillars = derivePillars({
      ...pbase,
      gapAnalysis: [
        { label: 'Life Cover', status: 'caution', current: '', recommended: '' },
        { label: 'Disability Cover', status: 'gap', current: '', recommended: '' },
      ],
    });
    expect(pillars[0].health).toBe('critical'); // worst of caution + gap
  });

  it('formats the risk pillar primary value, premium label and cover metrics', () => {
    const pillars = derivePillars({
      ...pbase,
      riskPolicies: [policy({})],
      totalRiskPremium: 5000,
      totalLifeCover: 1_000_000,
    });
    const risk = pillars[0];
    expect(risk.primaryValue).toBe('1 Policy');
    expect(risk.primaryLabel).toContain('/m total premium');
    expect(risk.metrics.find((m) => m.label === 'Life Cover')?.value).toBe('R 1.0m');
  });

  it('uses the medical plan name and grades health from the medical gap', () => {
    const pillars = derivePillars({
      ...pbase,
      medicalFnaPublished: true,
      medicalPolicies: [policy({ medical_aid_plan_type: 'Comprehensive' })],
      gapAnalysis: [{ label: 'Medical Aid', status: 'good', current: '', recommended: '' }],
    });
    const medical = pillars[1];
    expect(medical.primaryValue).toBe('Comprehensive');
    expect(medical.health).toBe('healthy');
  });

  it('maps FNA status (and loading) onto the pillar', () => {
    expect(
      derivePillars({
        ...pbase,
        fnaStatuses: [{ key: 'risk', status: 'published', loading: false }],
      })[0].fnaStatus,
    ).toBe('published');
    expect(
      derivePillars({ ...pbase, fnaStatuses: [{ key: 'risk', status: 'draft', loading: true }] })[0]
        .fnaStatus,
    ).toBe('loading');
  });

  it('reflects the tax-number status on the estate pillar', () => {
    const taxMetric = (taxNumber?: string) =>
      derivePillars({ ...pbase, taxNumber })[4].metrics.find((m) => m.label === 'Tax Number')
        ?.value;
    expect(taxMetric('1234567890')).toBe('On File');
    expect(taxMetric(undefined)).toBe('Missing');
  });
});
