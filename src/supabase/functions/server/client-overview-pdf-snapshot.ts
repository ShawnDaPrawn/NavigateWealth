/**
 * Sections 2 through 2h (financial snapshot, health score, KPIs, cashflow,
 * insurance coverage, asset allocation, category KPIs, documents checklist)
 * of the client overview PDF. Bodies are moved verbatim from
 * client-overview-pdf-service.ts; the former closure cursor `y` is now ctx.y
 * and the shared layout utilities are called through ctx (see PdfContext).
 */
import type {
  AutoTableHookData,
  ClientOverviewReportData,
  JsPDFWithAutoTable,
} from './client-overview-pdf-model.ts';
import { autoTable, BRAND, fmt, pct, statusLabel } from './client-overview-pdf-model.ts';
import type { PdfContext } from './client-overview-pdf-context.ts';

export function renderSnapshotSections(ctx: PdfContext, data: ClientOverviewReportData): void {
  const { doc, margin } = ctx;

  // ── 2. Financial Snapshot ──────────────────────────────────────────
  ctx.sectionHeading('2. Financial Snapshot');

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
    startY: ctx.y,
    head: [['Metric', 'Value']],
    body: kpiData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
    headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: BRAND.lightBg },
    columnStyles: { 0: { cellWidth: 70 } },
    theme: 'grid',
  });
  ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── 2b. Financial Health Score ─────────────────────────────────────
  if (data.healthScore !== undefined) {
    ctx.sectionHeading('2b. Financial Health Score');

    const healthData: string[][] = [['Overall Health Score', `${data.healthScore}/100`]];
    if (data.healthSubScores) {
      healthData.push(
        ['Protection Score', `${data.healthSubScores.protection}/100`],
        ['Planning Score', `${data.healthSubScores.planning}/100`],
        ['Saving Score', `${data.healthSubScores.saving}/100`],
        ['Borrowing Score', `${data.healthSubScores.borrowing}/100`],
      );
    }

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2c. KPI Summary ───────────────────────────────────────────────
  if (data.kpiSummary && data.kpiSummary.length > 0) {
    ctx.sectionHeading('2c. Key Performance Indicators');

    const kpiLabels: Record<string, string> = {
      net_worth: 'Net Worth',
      dti: 'Debt-to-Income Ratio',
      savings_rate: 'Savings Rate',
      emergency_fund: 'Emergency Fund',
      insurance_coverage: 'Insurance Coverage',
      retirement_progress: 'Retirement Progress',
    };

    const kpiBody = data.kpiSummary.map((k) => [
      kpiLabels[k.id] || k.id,
      k.displayValue,
      statusLabel(k.status),
      k.detail || '',
    ]);

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2d. Cashflow Breakdown ────────────────────────────────────────
  if (data.cashflow && data.cashflow.grossIncome > 0) {
    ctx.sectionHeading('2d. Monthly Cashflow Breakdown');

    const cf = data.cashflow;
    const taxDeductions = cf.grossIncome - cf.netIncome;
    const disposable = Math.max(0, cf.netIncome - cf.totalPremiums - cf.debtPayments);
    const disposablePct =
      cf.grossIncome > 0 ? ((disposable / cf.grossIncome) * 100).toFixed(1) : '0';

    const cfBody = [
      ['Gross Monthly Income', fmt(cf.grossIncome), '100%'],
      ['Tax & Deductions', `(${fmt(taxDeductions)})`, pct((taxDeductions / cf.grossIncome) * 100)],
      ['Net Monthly Income', fmt(cf.netIncome), pct((cf.netIncome / cf.grossIncome) * 100)],
      [
        'Total Premiums',
        `(${fmt(cf.totalPremiums)})`,
        pct((cf.totalPremiums / cf.grossIncome) * 100),
      ],
      ['Debt Payments', `(${fmt(cf.debtPayments)})`, pct((cf.debtPayments / cf.grossIncome) * 100)],
      ['Disposable Income', fmt(disposable), `${disposablePct}%`],
    ];

    autoTable(doc, {
      startY: ctx.y,
      head: [['Item', 'Amount', '% of Gross']],
      body: cfBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 60 } },
      didParseCell: (hookData: AutoTableHookData) => {
        // Bold first and last rows
        if (
          hookData.section === 'body' &&
          (hookData.row.index === 0 || hookData.row.index === cfBody.length - 1)
        ) {
          hookData.cell.styles.fontStyle = 'bold';
        }
        // Colour disposable row
        if (hookData.section === 'body' && hookData.row.index === cfBody.length - 1) {
          hookData.cell.styles.fillColor = BRAND.lightBg;
        }
      },
      theme: 'grid',
    });
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2e. Insurance Coverage Comparison ─────────────────────────────
  if (data.insuranceCoverage && data.insuranceCoverage.length > 0) {
    ctx.sectionHeading('2e. Insurance Coverage Comparison');

    const icBody = data.insuranceCoverage.map((ic) => {
      const shortfall = ic.recommended - ic.existing;
      const pctCovered =
        ic.recommended > 0 ? ((ic.existing / ic.recommended) * 100).toFixed(0) + '%' : '-';
      return [
        ic.label,
        fmt(ic.existing),
        fmt(ic.recommended),
        shortfall > 0 ? fmt(shortfall) : 'Adequate',
        pctCovered,
      ];
    });

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2f. Asset Allocation ──────────────────────────────────────────
  if (data.assetAllocation && data.assetAllocation.length > 0) {
    ctx.sectionHeading('2f. Asset Allocation');

    const totalAssetValue = data.assetAllocation.reduce((s, a) => s + a.value, 0);
    const aaBody = data.assetAllocation.map((a) => [
      a.type,
      fmt(a.value),
      totalAssetValue > 0 ? pct((a.value / totalAssetValue) * 100) : '-',
    ]);
    aaBody.push(['TOTAL', fmt(totalAssetValue), '100%']);

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2g. Policy KPIs by Category ───────────────────────────────────
  if (data.categoryKPIs && data.categoryKPIs.length > 0) {
    ctx.sectionHeading('2g. Policy Summary by Category');

    const catBody = data.categoryKPIs.map((c) => [
      c.label,
      `${c.policyCount}`,
      fmt(c.monthlyPremium),
      c.headlineValue,
      c.headlineLabel,
    ]);

    autoTable(doc, {
      startY: ctx.y,
      head: [['Category', 'Policies', 'Monthly Premium', 'Key Metric', 'Description']],
      body: catBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      theme: 'grid',
    });
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 2h. Documents Checklist ───────────────────────────────────────
  if (data.documentsChecklist && data.documentsChecklist.items.length > 0) {
    ctx.sectionHeading('2h. Documents Checklist');

    // Summary line
    const dcs = data.documentsChecklist;
    const completionPct = dcs.total > 0 ? Math.round((dcs.available / dcs.total) * 100) : 0;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.text);
    doc.text(
      `${dcs.available} of ${dcs.total} documents available (${completionPct}% complete)`,
      margin,
      ctx.y,
    );
    ctx.y += 5;

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
      .filter((d) => d.status !== 'not-applicable')
      .map((d) => [docCatLabel(d.category), d.label, docStatusLabel(d.status)]);

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }
}
