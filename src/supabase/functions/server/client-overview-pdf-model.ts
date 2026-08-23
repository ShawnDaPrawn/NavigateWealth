/**
 * Shared model for the client overview PDF: the report payload type, the
 * jsPDF/jsPDF-AutoTable typing workarounds, brand colours, and the small
 * formatting helpers used by every section renderer. All moved verbatim from
 * client-overview-pdf-service.ts.
 */

import { jsPDF } from 'npm:jspdf';
import autoTableMod from 'npm:jspdf-autotable';
// Cast to callable — npm type resolution exposes module type, not the function signature
export const autoTable = autoTableMod as unknown as (
  doc: jsPDF,
  options: Record<string, unknown>,
) => void;

/**
 * Minimal type for jsPDF-AutoTable's didParseCell hook callback data.
 * The library does not export a usable type — this covers the properties
 * we read and write.
 *
 * // WORKAROUND: jsPDF-AutoTable does not export hook types (v3.x)
 */
export interface AutoTableHookData {
  section: string;
  column: { index: number };
  row: { index: number };
  cell: {
    raw: unknown;
    styles: Record<string, unknown>;
  };
  [key: string]: unknown;
}

/**
 * Typed accessor for the jsPDF instance extended by jsPDF-AutoTable.
 * // WORKAROUND: jsPDF-AutoTable augments the doc object at runtime
 */
export interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

// ── Types ───────────────────────────────────────────────────────────────

export interface ClientOverviewReportData {
  client: {
    firstName: string;
    lastName: string;
    preferredName?: string;
    email: string;
    applicationNumber?: string;
    applicationStatus: string;
    createdAt: string;
  };
  profile: {
    title?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dateOfBirth?: string;
    age: number | null;
    gender?: string;
    maskedIdNumber?: string;
    taxNumber?: string;
    nationality?: string;
    maritalStatus?: string;
    maritalRegime?: string;
    smokerStatus?: boolean;
    email?: string;
    phone?: string;
    address?: string;
    employmentStatus?: string;
    employer?: string;
    position?: string;
    industry?: string;
    riskProfile?: string;
  } | null;
  financials: {
    grossMonthly: number;
    grossAnnual: number;
    netMonthly: number;
    totalAllPremiums: number;
    totalLifeCover: number;
    totalSevereIllness: number;
    totalDisability: number;
    retirementCurrentValue: number;
    investmentCurrentValue: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    premiumToIncomeRatio: number;
    retirementSavingsRate: number;
    totalMonthlyDebt: number;
  };
  policySummary: Array<{
    category: string;
    provider: string;
    premium: number;
    coverAmount: number;
    currentValue: number;
  }>;
  gapAnalysis: Array<{
    label: string;
    status: string;
    current: string;
    recommended: string;
    detail?: string;
  }>;
  fnaStatuses: Array<{
    name: string;
    status: string;
    updatedAt?: string;
    publishedAt?: string;
    nextReviewDue?: string;
  }>;
  actionItems: Array<{
    priority: string;
    category: string;
    title: string;
    detail?: string;
  }>;
  assets: Array<{
    description: string;
    value: number;
  }>;
  liabilities: Array<{
    description: string;
    outstandingBalance: number;
    monthlyPayment: number;
  }>;
  dependants: Array<{
    name: string;
    relationship?: string;
    dateOfBirth?: string;
    isFinanciallyDependent: boolean;
  }>;
  // Phase 1 additions
  healthScore?: number;
  healthSubScores?: {
    protection: number;
    planning: number;
    saving: number;
    borrowing: number;
  };
  kpiSummary?: Array<{
    id: string;
    displayValue: string;
    status: string;
    detail?: string;
  }>;
  // Phase 2 additions
  cashflow?: {
    grossIncome: number;
    netIncome: number;
    totalPremiums: number;
    debtPayments: number;
  };
  insuranceCoverage?: Array<{
    label: string;
    existing: number;
    recommended: number;
  }>;
  // Phase 3 additions
  assetAllocation?: Array<{
    type: string;
    value: number;
  }>;
  categoryKPIs?: Array<{
    label: string;
    policyCount: number;
    monthlyPremium: number;
    headlineValue: string;
    headlineLabel: string;
  }>;
  documentsChecklist?: {
    total: number;
    available: number;
    missing: number;
    items: Array<{
      label: string;
      category: string;
      status: string;
    }>;
  };
  // Phase 4 additions
  netWorthHistory?: Array<{
    date: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
  }>;
  generatedAt: string;
  advisorName?: string;
}

// ── Brand colours ───────────────────────────────────────────────────────

export const BRAND = {
  primary: [109, 40, 217] as [number, number, number], // #6d28d9 — Navigate Wealth purple
  dark: [30, 27, 75] as [number, number, number], // #1e1b4b
  text: [17, 24, 39] as [number, number, number], // gray-900
  muted: [107, 114, 128] as [number, number, number], // gray-500
  lightBg: [249, 250, 251] as [number, number, number], // gray-50
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
};

// ── Formatting helpers ──────────────────────────────────────────────────

export const fmt = (n: number): string => {
  if (isNaN(n)) return 'R 0';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const pct = (n: number): string => `${n.toFixed(1)}%`;

export const fmtDate = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const capitalize = (s: string | undefined): string => {
  if (!s) return '-';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const statusLabel = (s: string): string => {
  const map: Record<string, string> = {
    published: 'Published',
    draft: 'Draft',
    not_started: 'Not Started',
    error: 'Error',
    good: 'Adequate',
    caution: 'Review',
    gap: 'Shortfall',
    none: 'N/A',
  };
  return map[s] || capitalize(s);
};

export const priorityLabel = (p: string): string => {
  const map: Record<string, string> = {
    urgent: 'URGENT',
    attention: 'ATTENTION',
    recommended: 'RECOMMENDED',
  };
  return map[p] || p.toUpperCase();
};
