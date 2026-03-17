/**
 * Submission PDF Generator (Isolated Module)
 *
 * Extracted from SubmissionDetailModal to isolate the pdf-lib dependency
 * into its own dynamic chunk. This prevents pdf-lib resolution failures
 * from breaking the entire submissions module chunk.
 *
 * Uses pdf-lib with the Navigate Wealth branded template (same as
 * esign-certificates.tsx): purple header band, bordered section headings,
 * form-row layout with table borders, proper multi-page pagination,
 * and branded footer.
 *
 * This file is loaded via dynamic import:
 *   const { downloadSubmissionAsPdf } = await import('./submission-pdf-generator');
 */

import type { Submission, SubmissionType, SubmissionStatus } from '../types';
import {
  SUBMISSION_STATUS_CONFIG,
  SUBMISSION_TYPE_CONFIG,
  SOURCE_CHANNEL_LABELS,
} from '../constants';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatPayloadKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '\u2014';
    if (value.every(v => typeof v === 'string')) return value.join(', ');
    if (value.every(v => typeof v === 'object' && v !== null && ('dob' in v || 'age' in v))) {
      return value.map((child, i) => {
        const c = child as Record<string, unknown>;
        if (c.dob) {
          try {
            return `Child ${i + 1}: ${new Date(String(c.dob)).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
          } catch { return `Child ${i + 1}: ${c.dob}`; }
        }
        return `Child ${i + 1}: Age ${c.age}`;
      }).join(', ');
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** Keys to skip entirely — shown elsewhere or internal references */
const SKIP_KEYS = new Set([
  'quoteRequestId', 'contactFormId', 'consultationId', 'parentSubmissionId',
]);

function isInternalPdfKey(key: string): boolean {
  if (key === 'phase' || key === 'vertical' || key === 'metadata') return true;
  if (key.endsWith('_id') || key.endsWith('_ids')) return true;
  if (SKIP_KEYS.has(key)) return true;
  return false;
}

function flattenForPdf(obj: Record<string, unknown>, prefix = ''): Array<{ label: string; value: string; section?: string }> {
  const rows: Array<{ label: string; value: string; section?: string }> = [];

  for (const [key, value] of Object.entries(obj)) {
    if (isInternalPdfKey(key)) continue;

    const label = formatPayloadKey(key);

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (value.every((v) => typeof v === 'string')) {
        rows.push({ label, value: value.join(', '), section: prefix || undefined });
      } else if (value.every((v) => typeof v === 'object' && v !== null && ('dob' in v || 'age' in v))) {
        const childStr = value.map((child, i) => {
          const c = child as Record<string, unknown>;
          if (c.dob) {
            try {
              return `Child ${i + 1}: ${new Date(String(c.dob)).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}`;
            } catch { return `Child ${i + 1}: ${c.dob}`; }
          }
          return `Child ${i + 1}: Age ${c.age}`;
        }).join(', ');
        rows.push({ label, value: childStr, section: prefix || undefined });
      }
      continue;
    }

    if (value !== null && typeof value === 'object') {
      const vObj = value as Record<string, unknown>;
      if ('selected' in vObj && 'adviser_assist' in vObj) {
        if (vObj.selected) {
          let val = 'Amount not specified';
          if (vObj.adviser_assist) val = 'Adviser assistance requested';
          else if (vObj.amount) val = `R${Math.round(Number(vObj.amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
          else if (vObj.amount_per_month) val = `R${Math.round(Number(vObj.amount_per_month)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /month`;
          rows.push({ label, value: val, section: prefix || undefined });
        }
        continue;
      }
      rows.push(...flattenForPdf(vObj, label));
      continue;
    }

    if (value === null || value === undefined || value === '') continue;

    let displayValue = String(value);
    if (typeof value === 'boolean') displayValue = value ? 'Yes' : 'No';
    else if (typeof value === 'number' && value >= 1000) {
      displayValue = `R${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    rows.push({ label, value: displayValue, section: prefix || undefined });
  }

  return rows;
}

function flattenPayload(
  payload: Record<string, unknown>,
  skipKeys: Set<string> = SKIP_KEYS,
): Array<{
  key: string;
  label: string;
  value: string;
  group?: string;
}> {
  const result: Array<{ key: string; label: string; value: string; group?: string }> = [];

  function recurse(
    obj: Record<string, unknown>,
    keyPath: string,
    group: string | undefined,
    depth: number,
  ) {
    for (const [key, value] of Object.entries(obj)) {
      if (depth === 0 && skipKeys.has(key)) continue;

      const fullKey = keyPath ? `${keyPath}.${key}` : key;
      const label = formatPayloadKey(key);
      const effectiveGroup = group ?? (depth > 0 ? formatPayloadKey(keyPath.split('.').pop() || keyPath) : undefined);

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        depth < 3
      ) {
        const vObj = value as Record<string, unknown>;
        if ('selected' in vObj && 'adviser_assist' in vObj) {
          if (vObj.selected) {
            const coverLabel = formatPayloadKey(key);
            let coverValue = '';
            if (vObj.adviser_assist) {
              coverValue = 'Adviser assistance requested';
            } else {
              const amt = vObj.amount ?? vObj.amount_per_month ?? null;
              const suffix = vObj.amount_per_month !== undefined ? ' /month' : '';
              coverValue = amt
                ? `R${Math.round(Number(amt)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}`
                : 'Amount not specified';
            }
            result.push({ key: fullKey, label: coverLabel, value: coverValue, group: effectiveGroup });
          }
          continue;
        }

        recurse(vObj, fullKey, effectiveGroup ?? label, depth + 1);
      } else {
        result.push({ key: fullKey, label, value: formatPayloadValue(value), group: effectiveGroup });
      }
    }
  }

  recurse(payload, '', undefined, 0);
  return result;
}

interface Phase2Data {
  vertical?: string;
  phase?: number;
  [key: string]: unknown;
}

function getPhase2Data(payload: Record<string, unknown>): Phase2Data | null {
  const pd = payload.productDetails as Phase2Data | undefined;
  if (pd?.phase === 2) return pd;
  return null;
}

// ── Main PDF Generator ────────────────────────────────────────────────────────

export async function downloadSubmissionAsPdf(submission: Submission): Promise<void> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const typeCfg = SUBMISSION_TYPE_CONFIG[submission.type];
  const statusCfg = SUBMISSION_STATUS_CONFIG[submission.status];

  // ── Page constants (A4 portrait: 595 x 842 points) — matches esign template
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;       // 495pt usable width
  const HEADER_H = 65;                          // Branded header band
  const FOOTER_ZONE = 70;                       // Reserved footer space
  const FOOTER_LINE_Y = FOOTER_ZONE + 2;
  const FOOTER_TEXT_Y = FOOTER_ZONE - 15;
  const CONTENT_TOP = PAGE_H - HEADER_H - 24;
  const MIN_CONTENT_Y = FOOTER_ZONE + 15;

  // ── Brand colours (identical to esign-certificates.tsx) ────────────
  const PURPLE       = rgb(109 / 255, 40 / 255, 217 / 255);
  const PURPLE_LIGHT = rgb(139 / 255, 92 / 255, 246 / 255);
  const TEXT_COLOR   = rgb(17 / 255, 24 / 255, 39 / 255);
  const MUTED        = rgb(107 / 255, 114 / 255, 128 / 255);
  const LINE_COLOR   = rgb(0.82, 0.82, 0.82);
  const WHITE        = rgb(1, 1, 1);
  const SECTION_BG   = rgb(0.975, 0.975, 0.985);
  const TABLE_BORDER = rgb(0.85, 0.85, 0.88);
  const AMBER_BG     = rgb(254 / 255, 243 / 255, 199 / 255);
  const AMBER_BORDER = rgb(251 / 255, 191 / 255, 36 / 255);
  const AMBER_TEXT   = rgb(146 / 255, 64 / 255, 14 / 255);
  const NOTES_BG     = rgb(0.96, 0.96, 0.97);

  // ── Page management ────────────────────────────────────────────────
  type PDFPage = ReturnType<typeof pdfDoc.addPage>;
  const pages: PDFPage[] = [];
  let currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pages.push(currentPage);
  let y = CONTENT_TOP;

  // ── Text wrapping utility (from system standard) ───────────────────
  const wrapText = (text: string, fontSize: number, usedFont: typeof font, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = usedFont.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  };

  // ── Drawing primitives (from system standard) ──────────────────────

  const drawHeader = (page: PDFPage) => {
    // Purple header band
    page.drawRectangle({
      x: 0, y: PAGE_H - HEADER_H,
      width: PAGE_W, height: HEADER_H,
      color: PURPLE,
    });
    // Accent line at bottom of header
    page.drawRectangle({
      x: 0, y: PAGE_H - HEADER_H,
      width: PAGE_W, height: 2,
      color: PURPLE_LIGHT,
    });
    page.drawText('Navigate Wealth', {
      x: MARGIN, y: PAGE_H - 28,
      size: 16, font: boldFont, color: WHITE,
    });
    // Subtitle — dynamic based on submission type
    page.drawText(`${typeCfg.label} — Submission Report`, {
      x: MARGIN, y: PAGE_H - 48,
      size: 10, font, color: rgb(0.88, 0.88, 0.95),
    });
    // FSP number
    page.drawText('FSP 54606', {
      x: MARGIN, y: PAGE_H - 60,
      size: 7, font, color: rgb(0.75, 0.75, 0.85),
    });
    // Date on the right
    const dateStr = formatDate(submission.submittedAt);
    page.drawText(dateStr, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(dateStr, 8),
      y: PAGE_H - 28,
      size: 8, font, color: rgb(0.8, 0.8, 0.9),
    });
  };

  const drawFooter = (page: PDFPage, pageNum: number, totalPages: number) => {
    page.drawLine({
      start: { x: MARGIN, y: FOOTER_LINE_Y },
      end: { x: PAGE_W - MARGIN, y: FOOTER_LINE_Y },
      thickness: 0.5, color: LINE_COLOR,
    });
    page.drawText(
      'Navigate Wealth  |  FSP 54606  |  info@navigatewealth.co  |  (+27) 12-667-2505',
      { x: MARGIN, y: FOOTER_TEXT_Y, size: 6.5, font: italicFont, color: MUTED }
    );
    page.drawText(
      'First Floor, Milestone Place, Block A, 25 Sovereign Dr, Route 21 Business Park, Irene, 0157',
      { x: MARGIN, y: FOOTER_TEXT_Y - 10, size: 6, font: italicFont, color: MUTED }
    );
    const pageText = `Page ${pageNum} of ${totalPages}`;
    page.drawText(pageText, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageText, 7),
      y: FOOTER_TEXT_Y,
      size: 7, font, color: MUTED,
    });
  };

  const ensureSpace = (needed: number): number => {
    if (y - needed < MIN_CONTENT_Y) {
      currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pages.push(currentPage);
      drawHeader(currentPage);
      y = CONTENT_TOP;
    }
    return y;
  };

  const sectionHeading = (title: string) => {
    const headingH = 26;
    y = ensureSpace(headingH + 10);
    y -= 6;

    currentPage.drawRectangle({
      x: MARGIN, y: y - headingH + 8,
      width: CONTENT_W, height: headingH,
      color: PURPLE,
      borderColor: PURPLE,
      borderWidth: 0,
    });
    currentPage.drawText(title, {
      x: MARGIN + 10, y: y - headingH + 16,
      size: 9.5, font: boldFont, color: WHITE,
    });
    y -= headingH + 4;
  };

  const formRow = (
    label: string,
    value: string,
    options?: { isLast?: boolean; labelWidth?: number; valueBold?: boolean }
  ) => {
    const labelW = options?.labelWidth ?? 140;
    const valueMaxW = CONTENT_W - labelW - 25;
    const valueFont = options?.valueBold ? boldFont : font;
    const valueLines = wrapText(value || '\u2014', 8.5, valueFont, valueMaxW);
    const rowH = Math.max(18, valueLines.length * 12 + 6);

    y = ensureSpace(rowH + 2);

    // Row background
    currentPage.drawRectangle({
      x: MARGIN, y: y - rowH + 4,
      width: CONTENT_W, height: rowH,
      color: SECTION_BG,
    });

    // Left & right borders
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN, y: y - rowH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });
    currentPage.drawLine({
      start: { x: MARGIN + CONTENT_W, y: y + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });

    // Bottom border
    currentPage.drawLine({
      start: { x: MARGIN, y: y - rowH + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.5, color: options?.isLast ? TABLE_BORDER : LINE_COLOR,
    });

    // Label
    currentPage.drawText(label, {
      x: MARGIN + 10, y: y - 6,
      size: 8, font: boldFont, color: MUTED,
    });

    // Value (potentially multi-line)
    valueLines.forEach((line, i) => {
      currentPage.drawText(line, {
        x: MARGIN + labelW + 10, y: y - 6 - (i * 12),
        size: 8.5, font: valueFont, color: TEXT_COLOR,
      });
    });

    y -= rowH;
  };

  // ── Draw header on first page ──────────────────────────────────────
  drawHeader(currentPage);

  // ── TITLE ROW — submitter name + status ────────────────────────────
  y = ensureSpace(40);
  const submitterName = submission.submitterName || 'Unknown';
  currentPage.drawText(submitterName, {
    x: MARGIN, y,
    size: 14, font: boldFont, color: TEXT_COLOR,
  });
  const statusLabel = `Status: ${statusCfg.label}`;
  currentPage.drawText(statusLabel, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(statusLabel, 9),
    y: y + 2,
    size: 9, font, color: MUTED,
  });
  y -= 24;

  // ── CONTACT DETAILS section ────────────────────────────────────────
  sectionHeading('CONTACT DETAILS');
  if (submission.submitterName) formRow('Name', submission.submitterName, { valueBold: true });
  if (submission.submitterEmail) formRow('Email', submission.submitterEmail);
  const phone = submission.payload.phone as string | undefined;
  if (phone) formRow('Phone', phone);
  formRow('Source', SOURCE_CHANNEL_LABELS[submission.sourceChannel] ?? submission.sourceChannel);
  formRow('Submitted', formatDate(submission.submittedAt));
  formRow('Submission ID', submission.id, { isLast: true });

  y -= 16;

  // ── SUBMISSION DETAILS section ─────────────────────────────────────
  sectionHeading('SUBMISSION DETAILS');

  const payload = submission.payload;
  const phase2Data = getPhase2Data(payload);

  if (phase2Data) {
    // Phase 2 structured data
    if (payload.productName) {
      formRow('Service', String(payload.productName), { valueBold: true });
    }
    if (payload.stage) {
      const stageLabel = payload.stage === 'full' ? 'Full Quote Request' : 'Initial Enquiry';
      formRow('Stage', stageLabel);
    }

    const pdfRows = flattenForPdf(phase2Data);
    let currentSection: string | undefined;
    let isLastInGroup = false;

    pdfRows.forEach((row, idx) => {
      if (row.section && row.section !== currentSection) {
        currentSection = row.section;
        // Sub-section heading: a muted row with section name
        y = ensureSpace(22);
        y -= 2;
        const subH = 20;
        currentPage.drawRectangle({
          x: MARGIN, y: y - subH + 4,
          width: CONTENT_W, height: subH,
          color: rgb(0.94, 0.94, 0.96),
        });
        currentPage.drawLine({
          start: { x: MARGIN, y: y + 4 },
          end: { x: MARGIN + CONTENT_W, y: y + 4 },
          thickness: 0.5, color: TABLE_BORDER,
        });
        currentPage.drawLine({
          start: { x: MARGIN, y: y - subH + 4 },
          end: { x: MARGIN + CONTENT_W, y: y - subH + 4 },
          thickness: 0.5, color: TABLE_BORDER,
        });
        currentPage.drawLine({
          start: { x: MARGIN, y: y + 4 },
          end: { x: MARGIN, y: y - subH + 4 },
          thickness: 0.5, color: TABLE_BORDER,
        });
        currentPage.drawLine({
          start: { x: MARGIN + CONTENT_W, y: y + 4 },
          end: { x: MARGIN + CONTENT_W, y: y - subH + 4 },
          thickness: 0.5, color: TABLE_BORDER,
        });
        currentPage.drawText(row.section.toUpperCase(), {
          x: MARGIN + 10, y: y - subH + 12,
          size: 7.5, font: boldFont, color: MUTED,
        });
        y -= subH;
      }

      // Determine if this is the last row (or last in this section)
      const nextRow = pdfRows[idx + 1];
      isLastInGroup = !nextRow || (nextRow.section !== currentSection);

      formRow(row.label, row.value, { isLast: isLastInGroup });
    });
  } else {
    // Legacy / generic payload
    const topEntries = flattenPayload(payload);
    if (topEntries.length === 0) {
      y = ensureSpace(20);
      currentPage.drawText('No submission fields recorded.', {
        x: MARGIN, y,
        size: 9, font: italicFont, color: MUTED,
      });
      y -= 18;
    } else {
      let currentGroup: string | undefined;
      topEntries.forEach((entry, idx) => {
        if (entry.group && entry.group !== currentGroup) {
          currentGroup = entry.group;
          // Sub-section heading
          y = ensureSpace(22);
          y -= 2;
          const subH = 20;
          currentPage.drawRectangle({
            x: MARGIN, y: y - subH + 4,
            width: CONTENT_W, height: subH,
            color: rgb(0.94, 0.94, 0.96),
          });
          currentPage.drawLine({
            start: { x: MARGIN, y: y + 4 },
            end: { x: MARGIN + CONTENT_W, y: y + 4 },
            thickness: 0.5, color: TABLE_BORDER,
          });
          currentPage.drawLine({
            start: { x: MARGIN, y: y - subH + 4 },
            end: { x: MARGIN + CONTENT_W, y: y - subH + 4 },
            thickness: 0.5, color: TABLE_BORDER,
          });
          currentPage.drawLine({
            start: { x: MARGIN, y: y + 4 },
            end: { x: MARGIN, y: y - subH + 4 },
            thickness: 0.5, color: TABLE_BORDER,
          });
          currentPage.drawLine({
            start: { x: MARGIN + CONTENT_W, y: y + 4 },
            end: { x: MARGIN + CONTENT_W, y: y - subH + 4 },
            thickness: 0.5, color: TABLE_BORDER,
          });
          currentPage.drawText(entry.group.toUpperCase(), {
            x: MARGIN + 10, y: y - subH + 12,
            size: 7.5, font: boldFont, color: MUTED,
          });
          y -= subH;
        }
        const nextEntry = topEntries[idx + 1];
        const isLast = !nextEntry || (nextEntry.group !== currentGroup);
        formRow(entry.label, entry.value, { isLast });
      });
    }
  }

  // ── INTERNAL NOTES section ─────────────────────────────────────────
  if (submission.notes) {
    y -= 16;
    sectionHeading('INTERNAL NOTES');

    const noteLines = wrapText(submission.notes, 8.5, font, CONTENT_W - 30);
    const notesH = noteLines.length * 13 + 14;
    y = ensureSpace(notesH + 4);

    // Notes box with left accent bar
    currentPage.drawRectangle({
      x: MARGIN, y: y - notesH + 4,
      width: CONTENT_W, height: notesH,
      color: NOTES_BG,
    });
    currentPage.drawRectangle({
      x: MARGIN, y: y - notesH + 4,
      width: 3, height: notesH,
      color: PURPLE,
    });
    // Border
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: MARGIN + CONTENT_W, y: y + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });
    currentPage.drawLine({
      start: { x: MARGIN, y: y - notesH + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - notesH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });
    currentPage.drawLine({
      start: { x: MARGIN + CONTENT_W, y: y + 4 },
      end: { x: MARGIN + CONTENT_W, y: y - notesH + 4 },
      thickness: 0.5, color: TABLE_BORDER,
    });

    noteLines.forEach((line, i) => {
      currentPage.drawText(line, {
        x: MARGIN + 14, y: y - 6 - (i * 13),
        size: 8.5, font, color: TEXT_COLOR,
      });
    });
    y -= notesH;
  }

  // ── ACTION REQUIRED BANNER ─────────────────────────────────────────
  y -= 16;
  const bannerH = 28;
  y = ensureSpace(bannerH + 8);

  currentPage.drawRectangle({
    x: MARGIN, y: y - bannerH + 4,
    width: CONTENT_W, height: bannerH,
    color: AMBER_BG,
    borderColor: AMBER_BORDER,
    borderWidth: 0.5,
  });
  currentPage.drawText('Action Required: Please respond to this enquiry within 24 hours.', {
    x: MARGIN + 14, y: y - bannerH + 14,
    size: 8.5, font: boldFont, color: AMBER_TEXT,
  });

  // ── Draw footers on all pages ──────────────────────────────────────
  const totalPages = pages.length;
  pages.forEach((page, idx) => {
    drawFooter(page, idx + 1, totalPages);
  });

  // ── Save and trigger download ──────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeSubmitter = (submission.submitterName || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeType = typeCfg.shortLabel;
  a.download = `Navigate_Wealth_${safeType}_${safeSubmitter}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
