import { describe, expect, it } from 'vitest';
import { Shield, FileText } from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getPriorityColor,
  resolveRecommendationIcon,
  mapPortfolioToReportData,
} from '../utils';
import type { PortfolioSummary } from '../api';

describe('formatCurrency', () => {
  it('formats whole rands with thousands separators', () => {
    expect(formatCurrency(0)).toBe('R0');
    expect(formatCurrency(1234567)).toBe('R1,234,567');
    expect(formatCurrency(-1000)).toBe('-R1,000');
  });
  it('returns R0 for nullish / NaN amounts', () => {
    expect(formatCurrency(undefined as unknown as number)).toBe('R0');
    expect(formatCurrency(NaN)).toBe('R0');
  });
});

describe('formatDate', () => {
  it('renders a readable date', () => {
    const s = formatDate('2024-01-15');
    expect(s).toContain('2024');
    expect(s).toContain('Jan');
  });
  it('returns "Not set" for missing values', () => {
    expect(formatDate(null)).toBe('Not set');
    expect(formatDate(undefined)).toBe('Not set');
    expect(formatDate('')).toBe('Not set');
  });
});

describe('getStatusColor', () => {
  it('maps status buckets to colour classes', () => {
    expect(getStatusColor('on-track')).toContain('green');
    expect(getStatusColor('review-needed')).toContain('yellow');
    expect(getStatusColor('urgent')).toContain('red');
    expect(getStatusColor('anything-else')).toContain('gray');
  });
});

describe('getPriorityColor', () => {
  it('maps priorities to left-border classes', () => {
    expect(getPriorityColor('high')).toBe('border-l-blue-500');
    expect(getPriorityColor('medium')).toBe('border-l-yellow-500');
    expect(getPriorityColor('urgent')).toBe('border-l-red-500');
    expect(getPriorityColor('none')).toBe('border-l-gray-500');
  });
});

describe('resolveRecommendationIcon', () => {
  it('resolves known slugs and falls back to FileText', () => {
    expect(resolveRecommendationIcon('shield')).toBe(Shield);
    expect(resolveRecommendationIcon('unknown-slug')).toBe(FileText);
  });
});

function baseSummary(overrides: Record<string, unknown> = {}): PortfolioSummary {
  return {
    clientData: {
      firstName: 'John',
      lastName: 'Doe',
      memberNumber: 'NW123',
      totalWealthValue: 999,
    },
    financialOverview: {
      retirement: { monthlyContribution: 100, currentValue: 1000, status: 'on-track' },
      investment: {
        monthlyContribution: 50,
        totalValue: 2000,
        status: 'on-track',
        performance: 'N/A',
      },
      medicalAid: { monthlyPremium: 300, scheme: 'Discovery', plan: 'Classic', status: 'on-track' },
      risk: { deathCover: 500000, status: 'on-track' },
      estate: { status: 'on-track' },
      tax: { status: 'on-track' },
    },
    recommendations: [],
    adviserDetails: {
      name: 'Adv',
      email: 'adv@nw.co.za',
      phone: '+27 11 111 1111',
      fspReference: 'FSP 123',
    },
    ...overrides,
  } as unknown as PortfolioSummary;
}

describe('mapPortfolioToReportData', () => {
  it('uses real product holdings when present', () => {
    const summary = baseSummary({
      productHoldings: [
        {
          provider: 'P1',
          product: 'Life',
          policyNumber: 'L1',
          value: 1000,
          premium: 100,
          status: 'Active',
          category: 'life',
        },
        {
          provider: 'P2',
          product: 'RA',
          policyNumber: 'R1',
          value: 2000,
          premium: 200,
          status: 'Active',
          category: 'retirement',
        },
        {
          provider: 'P3',
          product: 'EB',
          policyNumber: 'E1',
          value: 500,
          premium: 50,
          status: 'Active',
          category: 'employeeBenefits',
        },
      ],
    });
    const out = mapPortfolioToReportData(summary, { email: 'a@b.co', age: 30 });

    expect(out.products.life).toHaveLength(2); // life + employeeBenefits collapse into life
    expect(out.products.retirement).toHaveLength(1);
    expect(out.monthlyPremiums).toBe(350);
    expect(out.portfolioValue).toBe(3500);
    expect(out.clientName).toBe('John Doe');
    expect(out.age).toBe(30);
    expect(out.adviserName).toBe('Adv');
    expect(out.adviserFSP).toBe('FSP 123');
  });

  it('derives fallback rows and totals from pillar data when no holdings', () => {
    const out = mapPortfolioToReportData(baseSummary(), { email: 'a@b.co' });

    expect(out.monthlyPremiums).toBe(450); // 100 + 50 + 300
    expect(out.portfolioValue).toBe(3000); // 1000 + 2000
    expect(out.products.retirement).toHaveLength(1);
    expect(out.products.investment).toHaveLength(1);
    expect(out.products.life).toHaveLength(1); // risk deathCover > 0
    expect(out.products.medicalAid).toHaveLength(1);
    expect(out.aiInsights.strengths).toHaveLength(6); // all six pillars on-track
    expect(out.age).toBe(0); // ctx.age omitted
  });

  it('routes urgent/high recommendations into opportunities', () => {
    const summary = baseSummary({
      recommendations: [
        { priority: 'urgent', title: 'Act now', description: 'Do this' },
        { priority: 'low', title: 'Later', description: 'Maybe' },
      ],
    });
    const out = mapPortfolioToReportData(summary, { email: 'a@b.co' });

    expect(out.aiInsights.opportunities).toContain('Do this');
    expect(out.aiInsights.recommendations).toContain('Act now: Do this');
    expect(out.aiInsights.recommendations).toContain('Later: Maybe');
  });

  it('falls back to a single strength message and surfaces not-assessed opportunities', () => {
    const summary = baseSummary({
      financialOverview: {
        retirement: { monthlyContribution: 0, currentValue: 0, status: 'not-assessed' },
        investment: {
          monthlyContribution: 0,
          totalValue: 0,
          status: 'not-assessed',
          performance: 'N/A',
        },
        medicalAid: { monthlyPremium: 0, scheme: '', plan: '', status: 'not-assessed' },
        risk: { deathCover: 0, status: 'not-assessed' },
        estate: { status: 'not-assessed' },
        tax: { status: 'not-assessed' },
      },
    });
    const out = mapPortfolioToReportData(summary, { email: 'a@b.co' });

    expect(out.aiInsights.strengths).toHaveLength(1);
    expect(out.aiInsights.opportunities.length).toBeGreaterThanOrEqual(3);
    expect(out.products.retirement).toHaveLength(0);
  });
});
