/**
 * Shared drawing context for the client overview PDF: the page geometry, the
 * mutable vertical cursor, and the four layout utilities every section
 * renderer shares. These were closures inside generateClientOverviewPDF —
 * moved verbatim; the cursor `y` is now the ctx.y property and the report's
 * generation date is passed in instead of read off the payload.
 */
import type { jsPDF } from 'npm:jspdf';
import { BRAND, fmtDate } from './client-overview-pdf-model.ts';

export interface PdfContext {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
  /** Mutable vertical cursor threading through all sections. */
  y: number;
  addFooter: () => void;
  ensureSpace: (needed: number) => void;
  sectionHeading: (title: string) => void;
  kvRow: (label: string, value: string, labelWidth?: number) => void;
}

export function createPdfContext(doc: jsPDF, generatedAt: string): PdfContext {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ── Utility: add page footer ────────────────────────────────────────
  const addFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.muted);
      doc.text(
        `Navigate Wealth  |  Confidential  |  Page ${i} of ${pages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' },
      );
      doc.text(`Generated: ${fmtDate(generatedAt)}`, pageWidth - margin, pageHeight - 8, {
        align: 'right',
      });
    }
  };

  // ── Utility: check page break ───────────────────────────────────────
  const ensureSpace = (needed: number) => {
    if (ctx.y + needed > pageHeight - 20) {
      doc.addPage();
      ctx.y = margin;
    }
  };

  // ── Utility: section heading ────────────────────────────────────────
  const sectionHeading = (title: string) => {
    ensureSpace(14);
    ctx.y += 4;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.primary);
    doc.text(title, margin, ctx.y);
    ctx.y += 2;
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, ctx.y, margin + contentWidth, ctx.y);
    ctx.y += 6;
  };

  // ── Utility: key-value row ──────────────────────────────────────────
  const kvRow = (label: string, value: string, labelWidth = 45) => {
    ensureSpace(6);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.muted);
    doc.text(label, margin, ctx.y);
    doc.setTextColor(...BRAND.text);
    doc.setFont('helvetica', 'normal');
    // Wrap value text if it's long
    const maxValWidth = contentWidth - labelWidth;
    const lines = doc.splitTextToSize(value, maxValWidth);
    doc.text(lines, margin + labelWidth, ctx.y);
    ctx.y += Math.max(lines.length * 4, 5);
  };

  const ctx: PdfContext = {
    doc,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    y: margin,
    addFooter,
    ensureSpace,
    sectionHeading,
    kvRow,
  };
  return ctx;
}
