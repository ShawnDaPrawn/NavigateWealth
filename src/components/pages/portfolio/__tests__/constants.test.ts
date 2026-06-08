import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIENT_DATA, DEFAULT_FINANCIAL_OVERVIEW } from '../constants';

describe('portfolio/constants', () => {
  it('DEFAULT_CLIENT_DATA has required fields', () => {
    expect(typeof DEFAULT_CLIENT_DATA.firstName).toBe('string');
    expect(typeof DEFAULT_CLIENT_DATA.totalWealthValue).toBe('number');
    expect(DEFAULT_CLIENT_DATA.financialScore).toBe(0);
  });

  it('DEFAULT_CLIENT_DATA has ISO-format lastUpdated', () => {
    expect(DEFAULT_CLIENT_DATA.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('DEFAULT_FINANCIAL_OVERVIEW has all six pillars', () => {
    expect(DEFAULT_FINANCIAL_OVERVIEW.retirement).toBeDefined();
    expect(DEFAULT_FINANCIAL_OVERVIEW.risk).toBeDefined();
    expect(DEFAULT_FINANCIAL_OVERVIEW.investment).toBeDefined();
    expect(DEFAULT_FINANCIAL_OVERVIEW.estate).toBeDefined();
    expect(DEFAULT_FINANCIAL_OVERVIEW.medicalAid).toBeDefined();
    expect(DEFAULT_FINANCIAL_OVERVIEW.tax).toBeDefined();
  });

  it('each pillar has a status and statusText', () => {
    const pillars = [
      DEFAULT_FINANCIAL_OVERVIEW.retirement,
      DEFAULT_FINANCIAL_OVERVIEW.risk,
      DEFAULT_FINANCIAL_OVERVIEW.investment,
    ];
    pillars.forEach((pillar) => {
      expect(typeof pillar.status).toBe('string');
      expect(typeof pillar.statusText).toBe('string');
    });
  });

  it('DEFAULT_FINANCIAL_OVERVIEW.retirement has numeric projections', () => {
    expect(DEFAULT_FINANCIAL_OVERVIEW.retirement.currentValue).toBe(0);
    expect(DEFAULT_FINANCIAL_OVERVIEW.retirement.projectedValue).toBe(0);
  });
});
