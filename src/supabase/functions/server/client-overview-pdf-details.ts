/**
 * Sections 3 through 9, the net worth summary/trend, and the disclaimer of
 * the client overview PDF. Bodies are moved verbatim from
 * client-overview-pdf-service.ts; the former closure cursor `y` is now ctx.y
 * and the shared layout utilities are called through ctx (see PdfContext).
 */
import type {
  AutoTableHookData,
  ClientOverviewReportData,
  JsPDFWithAutoTable,
} from './client-overview-pdf-model.ts';
import {
  autoTable,
  BRAND,
  capitalize,
  fmt,
  fmtDate,
  priorityLabel,
  statusLabel,
} from './client-overview-pdf-model.ts';
import type { PdfContext } from './client-overview-pdf-context.ts';

export function renderDetailSections(ctx: PdfContext, data: ClientOverviewReportData): void {
  const { doc, margin, contentWidth } = ctx;
  const fin = data.financials;

  // ── 3. Action Items & Recommendations ──────────────────────────────
  if (data.actionItems.length > 0) {
    ctx.sectionHeading('3. Action Items & Recommendations');

    const actionBody = data.actionItems.map((item) => [
      priorityLabel(item.priority),
      capitalize(item.category),
      item.title,
      item.detail || '',
    ]);

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 4. Portfolio Summary ───────────────────────────────────────────
  if (data.policySummary.length > 0) {
    ctx.sectionHeading('4. Portfolio Summary');

    const polBody = data.policySummary.map((p) => [
      p.category,
      p.provider,
      fmt(p.premium),
      p.coverAmount > 0 ? fmt(p.coverAmount) : '-',
      p.currentValue > 0 ? fmt(p.currentValue) : '-',
    ]);

    autoTable(doc, {
      startY: ctx.y,
      head: [['Category', 'Provider', 'Premium', 'Cover Amount', 'Market Value']],
      body: polBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      theme: 'grid',
    });
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 5. Coverage & Gap Analysis
  ctx.sectionHeading('5. Coverage & Gap Analysis');

  const gapBody = data.gapAnalysis.map((g) => [
    g.label,
    statusLabel(g.status),
    g.current,
    g.recommended,
  ]);

  autoTable(doc, {
    startY: ctx.y,
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
  ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── 6. FNA & Review Status ─────────────────────────────────────────
  ctx.sectionHeading('6. FNA & Review Status');

  const fnaBody = data.fnaStatuses.map((f) => [
    f.name,
    statusLabel(f.status),
    fmtDate(f.publishedAt || f.updatedAt),
    fmtDate(f.nextReviewDue),
  ]);

  autoTable(doc, {
    startY: ctx.y,
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
  ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;

  // ── 7. Assets ──────────────────────────────────────────────────────
  if (data.assets.length > 0) {
    ctx.sectionHeading('7. Assets');

    const assetBody = data.assets.map((a) => [a.description, fmt(a.value)]);
    assetBody.push(['TOTAL', fmt(fin.totalAssets)]);

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 8. Liabilities ────────────────────────────────────────────────
  if (data.liabilities.length > 0) {
    ctx.sectionHeading('8. Liabilities');

    const liabBody = data.liabilities.map((l) => [
      l.description,
      fmt(l.outstandingBalance),
      fmt(l.monthlyPayment),
    ]);
    liabBody.push(['TOTAL', fmt(fin.totalLiabilities), fmt(fin.totalMonthlyDebt)]);

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── 9. Dependants & Beneficiaries ─────────────────────────────────
  if (data.dependants.length > 0) {
    ctx.sectionHeading('9. Dependants & Family Members');

    const depBody = data.dependants.map((d) => [
      d.name,
      d.relationship || '-',
      fmtDate(d.dateOfBirth),
      d.isFinanciallyDependent ? 'Yes' : 'No',
    ]);

    autoTable(doc, {
      startY: ctx.y,
      head: [['Name', 'Relationship', 'Date of Birth', 'Financially Dependent']],
      body: depBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: BRAND.text },
      headStyles: { fillColor: BRAND.primary, textColor: BRAND.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: BRAND.lightBg },
      theme: 'grid',
    });
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── Net Worth Summary ─────────────────────────────────────────────
  ctx.ensureSpace(30);
  ctx.sectionHeading('Net Worth Summary');

  autoTable(doc, {
    startY: ctx.y,
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
  ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

  // ── Net Worth History (Phase 4) ───────────────────────────────────
  if (data.netWorthHistory && data.netWorthHistory.length > 0) {
    ctx.sectionHeading('Net Worth Trend');

    const histBody = data.netWorthHistory.map((h) => [
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
      const changePct =
        first.netWorth !== 0 ? ((change / Math.abs(first.netWorth)) * 100).toFixed(1) : '—';
      const direction = change >= 0 ? 'Increased' : 'Decreased';

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(change >= 0 ? BRAND.green : BRAND.red));
      doc.text(
        `Net worth ${direction.toLowerCase()} by ${fmt(Math.abs(change))} (${changePct}%) over ${data.netWorthHistory.length} snapshots.`,
        margin,
        ctx.y,
      );
      ctx.y += 5;
      doc.setTextColor(...BRAND.text);
    }

    autoTable(doc, {
      startY: ctx.y,
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
    ctx.y = (doc as unknown as JsPDFWithAutoTable).lastAutoTable.finalY + 6;
  }

  // ── Disclaimer ────────────────────────────────────────────────────
  ctx.ensureSpace(30);
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'italic');
  const disclaimer = [
    'DISCLAIMER: This report is provided for informational purposes only and does not constitute financial advice. The information contained herein is based on data provided by the client and third-party sources believed to be reliable but not independently verified. Past performance is not indicative of future results. All financial planning recommendations should be discussed with a qualified financial adviser. Navigate Wealth accepts no liability for decisions made based on this report.',
  ];
  const disclaimerLines = doc.splitTextToSize(disclaimer[0], contentWidth);
  doc.text(disclaimerLines, margin, ctx.y);
}
