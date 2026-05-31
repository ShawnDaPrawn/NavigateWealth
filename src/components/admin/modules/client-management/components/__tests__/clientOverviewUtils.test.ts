import { describe, expect, it } from 'vitest';
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
  numVal,
  pct,
  strVal,
  sumField,
  sumFirstNonZero,
  sumInvestmentPremiums,
  sumMultiField,
  worstGapStatus,
  normalizePolicyData,
  extractRiskFinalNeeds,
  extractRetirementResults,
  type Policy,
} from '../clientOverviewUtils';
import type { ProfileData } from '../../types';

const policy = (data: Record<string, unknown>): Policy => ({
  id: 'p',
  providerName: 'Prov',
  categoryId: 'c',
  data,
  updatedAt: '2024-01-01',
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
