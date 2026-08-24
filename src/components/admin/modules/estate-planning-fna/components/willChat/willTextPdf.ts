/**
 * Text-based PDF export of a drafted will. jsPDF is imported dynamically so
 * the library stays out of the main bundle until an adviser downloads.
 */
import { navigateWealthPdfSaveFileName } from '../../../../../../utils/pdfPrintTitle';

// ── PDF Generator (text-based) ─────────────────────────────────────

export function generateTextPdf(willText: string, clientName: string): void {
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const PAGE_WIDTH = 210;
    const PAGE_HEIGHT = 297;
    const MARGIN_LEFT = 20;
    const MARGIN_RIGHT = 20;
    const MARGIN_TOP = 25;
    const MARGIN_BOTTOM = 25;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    const LINE_HEIGHT = 5.5;

    let currentY = MARGIN_TOP;
    let pageNum = 1;
    const documentTitle = `${clientName} Last Will & Testament`;

    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        addFooter(doc, pageNum, documentTitle);
        doc.addPage();
        pageNum++;
        currentY = MARGIN_TOP;
      }
    };

    // Header
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('NAVIGATE WEALTH', MARGIN_LEFT, 12);
    doc.text('CONFIDENTIAL', PAGE_WIDTH - MARGIN_RIGHT, 12, { align: 'right' });

    doc.setDrawColor(109, 40, 217);
    doc.setLineWidth(0.8);
    doc.line(MARGIN_LEFT, 16, PAGE_WIDTH - MARGIN_RIGHT, 16);

    // Title
    currentY = 24;
    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.text(documentTitle.toUpperCase(), PAGE_WIDTH / 2, currentY, { align: 'center' });
    currentY += 12;

    // Body
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);

    const cleanText = stripMarkdown(willText);
    const lines = doc.splitTextToSize(cleanText, CONTENT_WIDTH);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      checkPageBreak(LINE_HEIGHT);

      const isHeader = /^\d+\.\s+[A-Z]/.test(line.trim());
      if (isHeader) {
        checkPageBreak(LINE_HEIGHT * 2);
        currentY += LINE_HEIGHT * 0.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }

      doc.text(line, MARGIN_LEFT, currentY);
      currentY += LINE_HEIGHT;

      if (isHeader) {
        currentY += LINE_HEIGHT * 0.3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
      }
    }

    addFooter(doc, pageNum, documentTitle);
    doc.save(
      navigateWealthPdfSaveFileName(
        clientName.trim()
          ? `Last Will and Testament - ${clientName.trim()}`
          : 'Last Will and Testament',
      ),
    );
  });
}

function addFooter(
  doc: {
    setFontSize: (size: number) => void;
    setTextColor: (r: number, g: number, b: number) => void;
    text: (text: string, x: number, y: number, options?: Record<string, unknown>) => void;
    setDrawColor: (r: number, g: number, b: number) => void;
    setLineWidth: (width: number) => void;
    line: (x1: number, y1: number, x2: number, y2: number) => void;
  },
  pageNum: number,
  title: string,
): void {
  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN_LEFT = 20;
  const MARGIN_RIGHT = 20;

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_LEFT, PAGE_HEIGHT - 18, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 18);

  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text(title, MARGIN_LEFT, PAGE_HEIGHT - 13);
  doc.text(`Page ${pageNum}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 13, { align: 'right' });
  doc.text(
    'Prepared by Navigate Wealth. This document requires proper execution to be legally valid.',
    MARGIN_LEFT,
    PAGE_HEIGHT - 9,
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
