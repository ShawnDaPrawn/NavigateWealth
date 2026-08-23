/**
 * Characterization net for the client-overview PDF generator, written BEFORE
 * splitting client-overview-pdf-service.ts so the carve is pinned by
 * behaviour, not by assertion.
 *
 * The real jsPDF renders; a recording subclass captures every text() call so
 * the tests can pin the SECTION ORDER and key content without parsing PDF
 * bytes. The y-cursor threading through eighteen sections is exactly what a
 * split could silently break — a reordered or dropped section changes the
 * recorded sequence and goes red here.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const recorded = vi.hoisted(() => ({ texts: [] as string[], factoryRan: false, instantiated: 0 }));

vi.mock('npm:jspdf', async () => {
  const real = await vi.importActual<typeof import('jspdf')>('jspdf');
  recorded.factoryRan = true;
  class RecordingJsPDF extends real.jsPDF {
    constructor(...args: ConstructorParameters<typeof real.jsPDF>) {
      super(...args);
      recorded.instantiated++;
      // jsPDF assigns its API methods onto the instance in the constructor,
      // shadowing any prototype override — so wrap the instance method.
      const origText = this.text.bind(this);
      (this as { text: (...a: unknown[]) => unknown }).text = (...args: unknown[]) => {
        const first = args[0];
        if (typeof first === 'string') recorded.texts.push(first);
        else if (Array.isArray(first)) recorded.texts.push(...first.map(String));
        return origText(...(args as Parameters<typeof origText>));
      };
    }
  }
  return { ...real, jsPDF: RecordingJsPDF };
});

import {
  generateClientOverviewPDF,
  type ClientOverviewReportData,
} from '../client-overview-pdf-service.ts';

const FULL_DATA: ClientOverviewReportData = {
  client: {
    firstName: 'Thandi',
    lastName: 'Mokoena',
    email: 'thandi@example.co.za',
    applicationNumber: 'APP-0042',
    applicationStatus: 'approved',
    createdAt: '2025-03-01T08:00:00.000Z',
  },
  profile: {
    title: 'Ms',
    firstName: 'Thandi',
    lastName: 'Mokoena',
    dateOfBirth: '1985-06-15',
    age: 40,
    gender: 'Female',
    maskedIdNumber: '850615*****88',
    maritalStatus: 'Married',
    email: 'thandi@example.co.za',
    phone: '+27 82 000 0000',
    employmentStatus: 'Employed',
    employer: 'Acme Ltd',
    riskProfile: 'Balanced',
  },
  financials: {
    grossMonthly: 85000,
    grossAnnual: 1020000,
    netMonthly: 62000,
    totalAllPremiums: 7400,
    totalLifeCover: 2500000,
    totalSevereIllness: 900000,
    totalDisability: 1500000,
    retirementCurrentValue: 1250000,
    investmentCurrentValue: 340000,
    totalAssets: 3200000,
    totalLiabilities: 1450000,
    netWorth: 1750000,
    premiumToIncomeRatio: 8.7,
    retirementSavingsRate: 12.5,
    totalMonthlyDebt: 18500,
  },
  policySummary: [
    {
      category: 'Risk',
      provider: 'Discovery',
      premium: 2400,
      coverAmount: 2500000,
      currentValue: 0,
    },
    {
      category: 'Retirement',
      provider: 'Allan Gray',
      premium: 5000,
      coverAmount: 0,
      currentValue: 1250000,
    },
  ],
  gapAnalysis: [
    {
      label: 'Life Cover',
      status: 'adequate',
      current: 'R2,500,000',
      recommended: 'R2,400,000',
      detail: 'Covers outstanding bond and income replacement.',
    },
  ],
  fnaStatuses: [
    {
      name: 'Risk FNA',
      status: 'published',
      publishedAt: '2026-01-10',
      nextReviewDue: '2027-01-10',
    },
  ],
  actionItems: [
    {
      priority: 'high',
      category: 'Risk',
      title: 'Increase disability cover',
      detail: 'Gap of R500k.',
    },
  ],
  assets: [{ description: 'Primary residence', value: 2400000 }],
  liabilities: [{ description: 'Home loan', outstandingBalance: 1400000, monthlyPayment: 16500 }],
  dependants: [
    {
      name: 'Lwazi Mokoena',
      relationship: 'Son',
      dateOfBirth: '2015-02-01',
      isFinanciallyDependent: true,
    },
  ],
  healthScore: 72,
  healthSubScores: { protection: 80, planning: 65, saving: 70, borrowing: 74 },
  kpiSummary: [
    { id: 'cover-ratio', displayValue: '29x', status: 'good', detail: 'Life cover vs income' },
  ],
  cashflow: { grossIncome: 85000, netIncome: 62000, totalPremiums: 7400, debtPayments: 18500 },
  insuranceCoverage: [{ label: 'Life', existing: 2500000, recommended: 2400000 }],
  assetAllocation: [
    { type: 'Property', value: 2400000 },
    { type: 'Retirement funds', value: 1250000 },
  ],
  categoryKPIs: [
    {
      label: 'Risk',
      policyCount: 1,
      monthlyPremium: 2400,
      headlineValue: 'R2.5m',
      headlineLabel: 'Total cover',
    },
  ],
  documentsChecklist: {
    total: 4,
    available: 3,
    missing: 1,
    items: [
      { label: 'ID document', category: 'KYC', status: 'available' },
      { label: 'Proof of residence', category: 'KYC', status: 'missing' },
    ],
  },
  netWorthHistory: [
    { date: '2025-12-31', totalAssets: 3000000, totalLiabilities: 1500000, netWorth: 1500000 },
    { date: '2026-06-30', totalAssets: 3200000, totalLiabilities: 1450000, netWorth: 1750000 },
  ],
  generatedAt: '2026-08-23T12:00:00.000Z',
  advisorName: 'Shawn Francisco',
};

const ALL_HEADINGS = [
  '1. Client Profile',
  '2. Financial Snapshot',
  '2b. Financial Health Score',
  '2c. Key Performance Indicators',
  '2d. Monthly Cashflow Breakdown',
  '2e. Insurance Coverage Comparison',
  '2f. Asset Allocation',
  '2g. Policy Summary by Category',
  '2h. Documents Checklist',
  '3. Action Items & Recommendations',
  '4. Portfolio Summary',
  '5. Coverage & Gap Analysis',
  '6. FNA & Review Status',
  '7. Assets',
  '8. Liabilities',
  '9. Dependants & Family Members',
  'Net Worth Summary',
  'Net Worth Trend',
];

let bytes: Uint8Array;

beforeAll(async () => {
  recorded.texts.length = 0;
  bytes = await generateClientOverviewPDF(FULL_DATA);
});

describe('generateClientOverviewPDF', () => {
  it('actually records through the mocked jsPDF (net is watching, not vacuous)', () => {
    expect(recorded.factoryRan).toBe(true);
    expect(recorded.instantiated).toBeGreaterThanOrEqual(1);
    expect(recorded.texts.length).toBeGreaterThan(50);
  });

  it('returns real PDF bytes', () => {
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(5000);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('renders every section heading exactly once, in order', () => {
    const headings = recorded.texts.filter((t) => ALL_HEADINGS.includes(t));
    expect(headings).toEqual(ALL_HEADINGS);
  });

  it("carries the client's name and the advisor onto the page", () => {
    const all = recorded.texts.join('\n');
    expect(all).toContain('Thandi Mokoena');
    expect(all).toContain('Shawn Francisco');
  });

  it('renders the data rows that flow through the sections', () => {
    const all = recorded.texts.join('\n');
    expect(all).toContain('Increase disability cover'); // action item
    expect(all).toContain('Life Cover'); // gap analysis row label
    expect(all).toContain('Risk FNA'); // FNA status name
    expect(all).toContain('Lwazi Mokoena'); // dependant
  });

  it('numbers the page footers on every page', () => {
    const footers = recorded.texts.filter((t) =>
      /^Navigate Wealth {2}\| {2}Confidential {2}\| {2}Page \d+ of \d+$/.test(t),
    );
    expect(footers.length).toBeGreaterThanOrEqual(2);
    expect(footers[0]).toBe(`Navigate Wealth  |  Confidential  |  Page 1 of ${footers.length}`);
    expect(footers[footers.length - 1]).toBe(
      `Navigate Wealth  |  Confidential  |  Page ${footers.length} of ${footers.length}`,
    );
  });
});

describe('generateClientOverviewPDF with minimal data', () => {
  it('skips the optional sections and still produces a PDF', async () => {
    recorded.texts.length = 0;
    const minimal: ClientOverviewReportData = {
      ...FULL_DATA,
      profile: null,
      healthScore: undefined,
      healthSubScores: undefined,
      kpiSummary: undefined,
      cashflow: undefined,
      insuranceCoverage: undefined,
      assetAllocation: undefined,
      categoryKPIs: undefined,
      documentsChecklist: undefined,
      netWorthHistory: undefined,
      actionItems: [],
      policySummary: [],
      assets: [],
      liabilities: [],
      dependants: [],
    };
    const out = await generateClientOverviewPDF(minimal);
    expect(out.length).toBeGreaterThan(1000);
    const headings = recorded.texts.filter((t) => ALL_HEADINGS.includes(t));
    expect(headings).toEqual([
      '1. Client Profile',
      '2. Financial Snapshot',
      '5. Coverage & Gap Analysis',
      '6. FNA & Review Status',
      'Net Worth Summary',
    ]);
  });
});
