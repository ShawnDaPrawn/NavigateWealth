/**
 * Client Overview PDF Report Generator
 *
 * Produces a branded, multi-section PDF report for a single client.
 * Uses jsPDF + jsPDF-AutoTable for professional layout with tables.
 *
 * The data is pre-computed on the frontend and sent as a typed payload
 * so that the server only handles formatting/rendering.
 */

import { jsPDF } from 'npm:jspdf';
import autoTable from 'npm:jspdf-autotable';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('pdf-service');

/**
 * Minimal type for jsPDF-AutoTable's didParseCell hook callback data.
 * The library does not export a usable type — this covers the properties
 * we read and write.
 *
 * // WORKAROUND: jsPDF-AutoTable does not export hook types (v3.x)
 */
interface AutoTableHookData {
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
interface JsPDFWithAutoTable extends jsPDF {
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

const BRAND = {
  primary: [109, 40, 217] as [number, number, number],   // #6d28d9 — Navigate Wealth purple
  dark: [30, 27, 75] as [number, number, number],         // #1e1b4b
  text: [17, 24, 39] as [number, number, number],          // gray-900
  muted: [107, 114, 128] as [number, number, number],      // gray-500
  lightBg: [249, 250, 251] as [number, number, number],    // gray-50
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
};

// ── Formatting helpers ──────────────────────────────────────────────────

const fmt = (n: number): string => {
  if (isNaN(n)) return 'R 0';
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const pct = (n: number): string => `${n.toFixed(1)}%`;

const fmtDate = (d: string | undefined): string => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const capitalize = (s: string | undefined): string => {
  if (!s) return '-';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const statusLabel = (s: string): string => {
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

const priorityLabel = (p: string): string => {
  const map: Record<string, string> = {
    urgent: 'URGENT',
    attention: 'ATTENTION',
    recommended: 'RECOMMENDED',
  };
  return map[p] || p.toUpperCase();
};

// ── PDF generator ───────────────────────────────────────────────────────

export async function generateClientOverviewPDF(
  data: ClientOverviewReportData,
): Promise<Uint8Array> {
  log.info('Generating client overview PDF', {
    client: `${data.client.firstName} ${data.client.lastName}`,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Utility: add page footer ────────────────────────────────────────
  const addFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.muted);
      doc.text(`Navigate Wealth  |  Confidential  |  Page ${i} of ${pages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      doc.text(`Generated: ${fmtDate(data.generatedAt)}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
  };

  // ── Utility: check page break ───────────────────────────────────────
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Utility: section heading ────────────────────────────────────────
  const sectionHeading = (title: string) => {
    ensureSpace(14);
    y += 4;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.primary);
    doc.text(title, margin, y);
    y += 2;
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  // ── Utility: key-value row ──────────────────────────────────────────
  const kvRow = (label: string, value: string, labelWidth = 45) => {
    ensureSpace(6);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    doc.text(label, margin, y);
    doc.setTextColor(...BRAND.text);
    doc.setFont('helvetica', 'normal');
    // Wrap value text if it's long
    const maxValWidth = contentWidth - labelWidth;
    const lines = doc.splitTextToSize(value, maxValWidth);
    doc.text(lines, margin + labelWidth, y);
    y += Math.max(lines.length * 4, 5);
  };

  // ────────────────────────────────────────────────────────────────────
  // COVER PAGE
  // ────────────────────────────────────────────────────────────────────

  // Purple header band
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageWidth, 60, 'F');

  // Title text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...BRAND.white);
  doc.text('Client Overview Report', margin, 30);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Navigate Wealth', margin, 42);

  // Client name block
  y = 80;
  doc.setFontSize(20);
  doc.setTextColor(...BRAND.dark);
  doc.setFont('helvetica', 'bold');
  const fullName = `${data.profile?.title ? data.profile.title + ' ' : ''}${data.client.firstName} ${data.client.lastName}`;
  doc.text(fullName, margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BRAND.muted);
  if (data.client.applicationNumber) {
    doc.text(`Application #: ${data.client.applicationNumber}`, margin, y);
    y += 6;
  }
  doc.text(`Status: ${capitalize(data.client.applicationStatus)}`, margin, y);
  y += 6;
  doc.text(`Client Since: ${fmtDate(data.client.createdAt)}`, margin, y);
  y += 6;
  doc.text(`Report Generated: ${fmtDate(data.generatedAt)}`, margin, y);
  y += 6;
  if (data.advisorName) {
    doc.text(`Prepared by: ${data.advisorName}`, margin, y);
    y += 6;
  }

  // Confidentiality notice
  y = pageHeight - 50;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'italic');
  const notice = 'CONFIDENTIAL — This document is prepared for the exclusive use of the named client and their financial adviser. It contains personal financial information and must not be distributed without authorisation.';
  const noticeLines = doc.splitTextToSize(notice, contentWidth);
  doc.text(noticeLines, margin, y);

  // ────────────────────────────────────────────────────────────────────
  // PAGE 2+: Report body
  // ────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  // ── 1. Client Profile ──────────────────────────────────────────────
  sectionHeading('1. Client Profile');

  const pr = data.profile;
  if (pr) {
    // Personal
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.text);
    doc.text('Personal', margin, y);
    y += 5;

    kvRow('Full Name', fullName);
    kvRow('Age', pr.age !== null ? `${pr.age} years` : '-');
    kvRow('Date of Birth', fmtDate(pr.dateOfBirth));
    kvRow('Gender', capitalize(pr.gender));
    kvRow('ID Number', pr.maskedIdNumber || '-');
    kvRow('Tax Number', pr.taxNumber || '-');
    kvRow('Nationality', pr.nationality || '-');
    kvRow('Marital Status', `${capitalize(pr.maritalStatus)}${pr.maritalRegime ? ` (${pr.maritalRegime})` : ''}`);
    kvRow('Smoker', pr.smokerStatus ? 'Yes' : 'No');

    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Contact', margin, y);
    y += 5;
    kvRow('Email', pr.email || data.client.email);
    kvRow('Phone', pr.phone || '-');
    kvRow('Address', pr.address || '-');

    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Employment', margin, y);
    y += 5;
    kvRow('Status', capitalize(pr.employmentStatus));
    if (pr.employer) kvRow('Employer', pr.employer);
    if (pr.position) kvRow('Position', pr.position);
    if (pr.industry) kvRow('Industry', pr.industry);
    kvRow('Gross Monthly Income', fmt(data.financials.grossMonthly));
    kvRow('Net Monthly Income', fmt(data.financials.netMonthly));
    if (pr.riskProfile) kvRow('Risk Profile', pr.riskProfile);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    doc.text('Profile data not available.', margin, y);
    y += 6;
  }

  // ── 2. Financial Snapshot ──────────────────────────────────────────
  sectionHeading('2. Financial Snapshot');

  const fin = data.financials;
  const kpiData = [
    ['Gross Annual Income', fmt(fin.grossAnnual)],
    ['Net Monthly Income', fmt(fin.netMonthly)],
    ['Total Premiums', `${fmt(fin.totalAllPremiums)}/month`],
    ['Premium-to-Income Ratio', pct(fin.premiumToIncomeRatio)],
    ['Total Life Cover', fmt(fin.totalLifeCover)],
    ['Severe Illness Cover', fmt(fin.totalSevereIllness)],
    ['Disability Cover', fmt(fin.totalDisability)],
    ['Retirement Value', fmt(fin.retirementCurrentValue)],
    ['Investment Value', fmt(fin.investmentCurrentValue)],
    ['Retirement Savings Rate', pct(fin.retirementSavingsRate)],
    ['Total Assets', fmt(fin.totalAssets)],
    ['Total Liabilities', fmt(fin.totalLiabilities)],
    ['Net Worth', fmt(fin.netWorth)],
    ['Monthly Debt Repayments', fmt(fin.totalMonthlyDebt)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: kpiData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: BRAND.lightBg },
    columnStyles: { 0: { cellWidth: 70 } },
    theme: 'grid',
  });
  y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── 2b. Financial Health Score ─────────────────────────────────────
  if (data.healthScore !== undefined) {
    sectionHeading('2b. Financial Health Score');

    const healthData: string[][] = [
      ['Overall Health Score', `${data.healthScore}/100`],
    ];
    if (data.healthSubScores) {
      healthData.push(
        ['Protection Score', `${data.healthSubScores.protection}/100`],
        ['Planning Score', `${data.healthSubScores.planning}/100`],
        ['Saving Score', `${data.healthSubScores.saving}/100`],
        ['Borrowing Score', `${data.healthSubScores.borrowing}/100`],
      );
    }

    autoTable(doc, {
      startY: y,
      head: [['Health Metric', 'Score']],
      body: healthData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 70 } },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.row.index === 0) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fontSize = 9;
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2c. KPI Summary ───────────────────────────────────────────────
  if (data.kpiSummary && data.kpiSummary.length > 0) {
    sectionHeading('2c. Key Performance Indicators');

    const kpiLabels: Record<string, string> = {
      net_worth: 'Net Worth',
      dti: 'Debt-to-Income Ratio',
      savings_rate: 'Savings Rate',
      emergency_fund: 'Emergency Fund',
      insurance_coverage: 'Insurance Coverage',
      retirement_progress: 'Retirement Progress',
    };

    const kpiBody = data.kpiSummary.map(k => [
      kpiLabels[k.id] || k.id,
      k.displayValue,
      statusLabel(k.status),
      k.detail || '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['KPI', 'Value', 'Status', 'Detail']],
      body: kpiBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 30 }, 2: { cellWidth: 22 } },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const val = (hookData.cell.raw as string).toLowerCase();
          if (val === 'on track' || val === 'adequate') {
            hookData.cell.styles.textColor = BRAND.green;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (val === 'review') {
            hookData.cell.styles.textColor = BRAND.amber;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (val === 'shortfall') {
            hookData.cell.styles.textColor = BRAND.red;
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2d. Cashflow Breakdown ────────────────────────────────────────
  if (data.cashflow && data.cashflow.grossIncome > 0) {
    sectionHeading('2d. Monthly Cashflow Breakdown');

    const cf = data.cashflow;
    const taxDeductions = cf.grossIncome - cf.netIncome;
    const disposable = Math.max(0, cf.netIncome - cf.totalPremiums - cf.debtPayments);
    const disposablePct = cf.grossIncome > 0 ? ((disposable / cf.grossIncome) * 100).toFixed(1) : '0';

    const cfBody = [
      ['Gross Monthly Income', fmt(cf.grossIncome), '100%'],
      ['Tax & Deductions', `(${fmt(taxDeductions)})`, pct((taxDeductions / cf.grossIncome) * 100)],
      ['Net Monthly Income', fmt(cf.netIncome), pct((cf.netIncome / cf.grossIncome) * 100)],
      ['Total Premiums', `(${fmt(cf.totalPremiums)})`, pct((cf.totalPremiums / cf.grossIncome) * 100)],
      ['Debt Payments', `(${fmt(cf.debtPayments)})`, pct((cf.debtPayments / cf.grossIncome) * 100)],
      ['Disposable Income', fmt(disposable), `${disposablePct}%`],
    ];

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Amount', '% of Gross']],
      body: cfBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 } },
      didParseCell: (hookData: AutoTableHookData) => {
        // Bold first and last rows
        if (hookData.section === 'body' && (hookData.row.index === 0 || hookData.row.index === cfBody.length - 1)) {
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Colour disposable row
        if (hookData.section === 'body' && hookData.row.index === cfBody.length - 1) {
          hookData.cell.styles.fillColor = BRAND.lightBg;
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2e. Insurance Coverage Comparison ─────────────────────────────
  if (data.insuranceCoverage && data.insuranceCoverage.length > 0) {
    sectionHeading('2e. Insurance Coverage Comparison');

    const icBody = data.insuranceCoverage.map(ic => {
      const shortfall = ic.recommended - ic.existing;
      const pctCovered = ic.recommended > 0 ? ((ic.existing / ic.recommended) * 100).toFixed(0) + '%' : '-';
      return [
        ic.label,
        fmt(ic.existing),
        fmt(ic.recommended),
        shortfall > 0 ? fmt(shortfall) : 'Adequate',
        pctCovered,
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Risk Type', 'Existing Cover', 'Recommended', 'Shortfall', 'Coverage %']],
      body: icBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const val = hookData.cell.raw as string;
          if (val === 'Adequate') {
            hookData.cell.styles.textColor = BRAND.green;
            hookData.cell.styles.fontStyle = 'bold';
          } else {
            hookData.cell.styles.textColor = BRAND.red;
          }
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2f. Asset Allocation ──────────────────────────────────────────
  if (data.assetAllocation && data.assetAllocation.length > 0) {
    sectionHeading('2f. Asset Allocation');

    const totalAssetValue = data.assetAllocation.reduce((s, a) => s + a.value, 0);
    const aaBody = data.assetAllocation.map(a => [
      a.type,
      fmt(a.value),
      totalAssetValue > 0 ? pct((a.value / totalAssetValue) * 100) : '-',
    ]);
    aaBody.push(['TOTAL', fmt(totalAssetValue), '100%']);

    autoTable(doc, {
      startY: y,
      head: [['Asset Type', 'Value', 'Allocation']],
      body: aaBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.row.index === aaBody.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2g. Policy KPIs by Category ───────────────────────────────────
  if (data.categoryKPIs && data.categoryKPIs.length > 0) {
    sectionHeading('2g. Policy Summary by Category');

    const catBody = data.categoryKPIs.map(c => [
      c.label,
      `${c.policyCount}`,
      fmt(c.monthlyPremium),
      c.headlineValue,
      c.headlineLabel,
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Policies', 'Monthly Premium', 'Key Metric', 'Description']],
      body: catBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2h. Documents Checklist ───────────────────────────────────────
  if (data.documentsChecklist && data.documentsChecklist.items.length > 0) {
    sectionHeading('2h. Documents Checklist');

    // Summary line
    const dcs = data.documentsChecklist;
    const completionPct = dcs.total > 0 ? Math.round((dcs.available / dcs.total) * 100) : 0;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.text);
    doc.text(`${dcs.available} of ${dcs.total} documents available (${completionPct}% complete)`, margin, y);
    y += 5;

    const docStatusLabel = (s: string): string => {
      const map: Record<string, string> = {
        available: 'Available',
        missing: 'Missing',
        'not-applicable': 'N/A',
      };
      return map[s] || s;
    };

    const docCatLabel = (c: string): string => {
      const map: Record<string, string> = {
        fica: 'FICA / KYC',
        income: 'Income',
        policies: 'Policy',
        fna: 'FNA Record',
      };
      return map[c] || c;
    };

    const docBody = dcs.items
      .filter(d => d.status !== 'not-applicable')
      .map(d => [
        docCatLabel(d.category),
        d.label,
        docStatusLabel(d.status),
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Document', 'Status']],
      body: docBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 30 }, 2: { cellWidth: 22 } },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const val = (hookData.cell.raw as string).toLowerCase();
          if (val === 'available') {
            hookData.cell.styles.textColor = BRAND.green;
            hookData.cell.styles.fontStyle = 'bold';
          } else if (val === 'missing') {
            hookData.cell.styles.textColor = BRAND.red;
          }
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 3. Action Items & Recommendations ──────────────────────────────
  if (data.actionItems.length > 0) {
    sectionHeading('3. Action Items & Recommendations');

    const actionBody = data.actionItems.map((item) => [
      priorityLabel(item.priority),
      capitalize(item.category),
      item.title,
      item.detail || '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Priority', 'Category', 'Action', 'Detail']],
      body: actionBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text, overflow: 'linebreak' },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 50 },
        3: { cellWidth: 'auto' },
      },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.column.index === 0) {
          const val = hookData.cell.raw as string;
          if (val === 'URGENT') {
            hookData.cell.styles.textColor = BRAND.red;
          } else if (val === 'ATTENTION') {
            hookData.cell.styles.textColor = BRAND.amber;
          } else {
            hookData.cell.styles.textColor = BRAND.green;
          }
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 4. Portfolio Summary ───────────────────────────────────────────
  if (data.policySummary.length > 0) {
    sectionHeading('4. Portfolio Summary');

    const polBody = data.policySummary.map((p) => [
      p.category,
      p.provider,
      fmt(p.premium),
      p.coverAmount > 0 ? fmt(p.coverAmount) : '-',
      p.currentValue > 0 ? fmt(p.currentValue) : '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Provider', 'Premium', 'Cover Amount', 'Market Value']],
      body: polBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 5. Coverage & Gap Analysis
  sectionHeading('5. Coverage & Gap Analysis');

  const gapBody = data.gapAnalysis.map((g) => [
    g.label,
    statusLabel(g.status),
    g.current,
    g.recommended,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Area', 'Status', 'Current', 'Recommended']],
    body: gapBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text, overflow: 'linebreak' },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 22 },
    },
    didParseCell: (hookData: AutoTableHookData) => {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const val = (hookData.cell.raw as string).toLowerCase();
        if (val === 'adequate' || val === 'good') {
          hookData.cell.styles.textColor = BRAND.green;
          hookData.cell.styles.fontStyle = 'bold';
        } else if (val === 'review' || val === 'caution') {
          hookData.cell.styles.textColor = BRAND.amber;
          hookData.cell.styles.fontStyle = 'bold';
        } else if (val === 'shortfall' || val === 'gap') {
          hookData.cell.styles.textColor = BRAND.red;
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    theme: 'grid',
  });
  y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── 6. FNA & Review Status ─────────────────────────────────────────
  sectionHeading('6. FNA & Review Status');

  const fnaBody = data.fnaStatuses.map((f) => [
    f.name,
    statusLabel(f.status),
    fmtDate(f.publishedAt || f.updatedAt),
    fmtDate(f.nextReviewDue),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Analysis', 'Status', 'Last Updated', 'Next Review Due']],
    body: fnaBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: BRAND.lightBg },
    didParseCell: (hookData: AutoTableHookData) => {
      if (hookData.section === 'body' && hookData.column.index === 1) {
        const val = (hookData.cell.raw as string).toLowerCase();
        if (val === 'published') {
          hookData.cell.styles.textColor = BRAND.green;
        } else if (val === 'draft') {
          hookData.cell.styles.textColor = BRAND.amber;
        } else if (val === 'not started') {
          hookData.cell.styles.textColor = BRAND.muted;
        }
      }
    },
    theme: 'grid',
  });
  y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── 7. Assets ──────────────────────────────────────────────────────
  if (data.assets.length > 0) {
    sectionHeading('7. Assets');

    const assetBody = data.assets.map((a) => [a.description, fmt(a.value)]);
    assetBody.push(['TOTAL', fmt(fin.totalAssets)]);

    autoTable(doc, {
      startY: y,
      head: [['Asset', 'Value']],
      body: assetBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      didParseCell: (hookData: AutoTableHookData) => {
        // Bold total row
        if (hookData.section === 'body' && hookData.row.index === assetBody.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 8. Liabilities ────────────────────────────────────────────────
  if (data.liabilities.length > 0) {
    sectionHeading('8. Liabilities');

    const liabBody = data.liabilities.map((l) => [
      l.description,
      fmt(l.outstandingBalance),
      fmt(l.monthlyPayment),
    ]);
    liabBody.push(['TOTAL', fmt(fin.totalLiabilities), fmt(fin.totalMonthlyDebt)]);

    autoTable(doc, {
      startY: y,
      head: [['Liability', 'Outstanding Balance', 'Monthly Payment']],
      body: liabBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      didParseCell: (hookData: AutoTableHookData) => {
        if (hookData.section === 'body' && hookData.row.index === liabBody.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 9. Dependants & Beneficiaries ─────────────────────────────────
  if (data.dependants.length > 0) {
    sectionHeading('9. Dependants & Family Members');

    const depBody = data.dependants.map((d) => [
      d.name,
      d.relationship || '-',
      fmtDate(d.dateOfBirth),
      d.isFinanciallyDependent ? 'Yes' : 'No',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Name', 'Relationship', 'Date of Birth', 'Financially Dependent']],
      body: depBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── Net Worth Summary ─────────────────────────────────────────────
  ensureSpace(30);
  sectionHeading('Net Worth Summary');

  autoTable(doc, {
    startY: y,
    body: [
      ['Total Assets', fmt(fin.totalAssets)],
      ['Total Liabilities', `(${fmt(fin.totalLiabilities)})`],
      ['Net Worth', fmt(fin.netWorth)],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 3, textColor: BRAND.text },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    didParseCell: (hookData: AutoTableHookData) => {
      if (hookData.section === 'body' && hookData.row.index === 2) {
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.fontSize = 10;
        hookData.cell.styles.fillColor = BRAND.lightBg;
      }
    },
    theme: 'plain',
  });
  y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

  // ── Net Worth History (Phase 4) ───────────────────────────────────
  if (data.netWorthHistory && data.netWorthHistory.length > 0) {
    sectionHeading('Net Worth Trend');

    const histBody = data.netWorthHistory.map(h => [
      fmtDate(h.date),
      fmt(h.totalAssets),
      fmt(h.totalLiabilities),
      fmt(h.netWorth),
    ]);

    // Add trend summary if multiple snapshots
    if (data.netWorthHistory.length >= 2) {
      const first = data.netWorthHistory[0];
      const last = data.netWorthHistory[data.netWorthHistory.length - 1];
      const change = last.netWorth - first.netWorth;
      const changePct = first.netWorth !== 0
        ? ((change / Math.abs(first.netWorth)) * 100).toFixed(1)
        : '—';
      const direction = change >= 0 ? 'Increased' : 'Decreased';

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(change >= 0 ? BRAND.green : BRAND.red));
      doc.text(
        `Net worth ${direction.toLowerCase()} by ${fmt(Math.abs(change))} (${changePct}%) over ${data.netWorthHistory.length} snapshots.`,
        margin, y,
      );
      y += 5;
      doc.setTextColor(...BRAND.text);
    }

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Total Assets', 'Total Liabilities', 'Net Worth']],
      body: histBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      didParseCell: (hookData: AutoTableHookData) => {
        // Colour the net worth column
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const rowIdx = hookData.row.index;
          const nw = data.netWorthHistory![rowIdx]?.netWorth ?? 0;
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.textColor = nw >= 0 ? BRAND.green : BRAND.red;
        }
      },
      theme: 'grid',
    });
    y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── Disclaimer ────────────────────────────────────────────────────
  ensureSpace(30);
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'italic');
  const disclaimer = [
    'DISCLAIMER: This report is provided for informational purposes only and does not constitute financial advice. The information contained herein is based on data provided by the client and third-party sources believed to be reliable but not independently verified. Past performance is not indicative of future results. All financial planning recommendations should be discussed with a qualified financial adviser. Navigate Wealth accepts no liability for decisions made based on this report.',
  ];
  const disclaimerLines = doc.splitTextToSize(disclaimer[0], contentWidth);
  doc.text(disclaimerLines, margin, y);

  // ── Add footers to all pages ──────────────────────────────────────
  addFooter();

  // ── Return PDF bytes ──────────────────────────────────────────────
  const output = doc.output('arraybuffer');
  log.info('PDF generated successfully', { pages: doc.getNumberOfPages() });
  return new Uint8Array(output);
}