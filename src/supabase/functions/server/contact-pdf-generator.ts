/**
 * Contact Details PDF Generator
 *
 * Produces a base64-encoded PDF attachment using Navigate Wealth
 * branding that matches the BasePdfLayout visual language.
 *
 * Uses raw PDF 1.4 primitives — no external libraries required.
 * The output is suitable for SendGrid attachment (`content` field).
 */

import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('contact-pdf');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escape special PDF text characters */
function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '');
}

/** Encode a JS string as a Uint8Array of Latin-1 bytes */
function encode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContactPdfData {
  formType: 'contact' | 'consultation' | 'quote';
  /** Displayed as PDF title */
  title: string;
  submittedAt: string;
  fields: { label: string; value: string }[];
  /** Optional long-form message (e.g. "Additional notes") */
  message?: string;
}

// ── PDF Generation ───────────────────────────────────────────────────────────

/**
 * Build a branded PDF (base64-encoded) from structured contact data.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │  NAVIGATE WEALTH              form type badge │
 *   │  ─────────────────────────────────────────── │
 *   │  Title                                        │
 *   │  Submitted: dd MMM yyyy HH:mm                 │
 *   │                                               │
 *   │  ┌─ Contact Details ────────────────────────┐ │
 *   │  │  Label: Value                            │ │
 *   │  │  ...                                     │ │
 *   │  └──────────────────────────────────────────┘ │
 *   │                                               │
 *   │  ┌─ Message ────────────────────────────────┐ │
 *   │  │  (if present)                            │ │
 *   │  └──────────────────────────────────────────┘ │
 *   │                                               │
 *   │  footer: Navigate Wealth · FSP 54606│
 *   └──────────────────────────────────────────────┘
 */
export function generateContactPdf(data: ContactPdfData): string {
  try {
    const pageWidth = 595.28; // A4 width in points (210mm)
    const pageHeight = 841.89; // A4 height in points (297mm)
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;

    // --- Build page content stream -------------------------------------------
    let y = pageHeight - margin; // Start from top

    let stream = '';

    // Background
    stream += `1 1 1 rg\n`;
    stream += `0 0 ${pageWidth} ${pageHeight} re f\n`;

    // ── Header band ──────────────────────────────────────────────────────────
    const headerHeight = 60;
    const headerY = pageHeight - margin - headerHeight;
    // Purple header background
    stream += `0.427 0.157 0.851 rg\n`; // #6d28d9
    stream += `${margin} ${headerY} ${contentWidth} ${headerHeight} re f\n`;

    // Company name (white, bold)
    stream += `BT\n`;
    stream += `1 1 1 rg\n`;
    stream += `/F2 18 Tf\n`;
    stream += `${margin + 20} ${headerY + 22} Td\n`;
    stream += `(NAVIGATE WEALTH) Tj\n`;
    stream += `ET\n`;

    // Form type badge (right-aligned)
    const badgeLabels: Record<string, string> = {
      contact: 'CONTACT ENQUIRY',
      consultation: 'CONSULTATION REQUEST',
      quote: 'QUOTE REQUEST',
    };
    const badgeText = badgeLabels[data.formType] || 'ENQUIRY';
    stream += `BT\n`;
    stream += `1 1 1 rg\n`;
    stream += `/F1 9 Tf\n`;
    stream += `${pageWidth - margin - 160} ${headerY + 25} Td\n`;
    stream += `(${pdfEscape(badgeText)}) Tj\n`;
    stream += `ET\n`;

    y = headerY - 30;

    // ── Title ────────────────────────────────────────────────────────────────
    stream += `BT\n`;
    stream += `0.067 0.094 0.153 rg\n`; // #111827
    stream += `/F2 16 Tf\n`;
    stream += `${margin} ${y} Td\n`;
    stream += `(${pdfEscape(data.title)}) Tj\n`;
    stream += `ET\n`;
    y -= 20;

    // Submitted timestamp
    const formattedDate = formatTimestamp(data.submittedAt);
    stream += `BT\n`;
    stream += `0.42 0.45 0.50 rg\n`; // #6b7280
    stream += `/F1 10 Tf\n`;
    stream += `${margin} ${y} Td\n`;
    stream += `(Submitted: ${pdfEscape(formattedDate)}) Tj\n`;
    stream += `ET\n`;
    y -= 15;

    // Divider line
    stream += `0.898 0.906 0.922 RG\n`; // #e5e7eb
    stream += `1 w\n`;
    stream += `${margin} ${y} m ${pageWidth - margin} ${y} l S\n`;
    y -= 25;

    // ── Contact Details section ──────────────────────────────────────────────
    // Section header
    stream += `BT\n`;
    stream += `0.427 0.157 0.851 rg\n`; // purple
    stream += `/F2 12 Tf\n`;
    stream += `${margin} ${y} Td\n`;
    stream += `(Contact Details) Tj\n`;
    stream += `ET\n`;
    y -= 8;

    // Purple underline for section
    stream += `0.427 0.157 0.851 RG\n`;
    stream += `1.5 w\n`;
    stream += `${margin} ${y} m ${margin + 120} ${y} l S\n`;
    y -= 20;

    // Detail rows
    const rowHeight = 28;
    const labelX = margin + 10;
    const valueX = margin + 160;

    // Background box for details — calculate height with word-wrapping
    const maxValueChars = 50;
    let totalDetailRows = 0;
    const fieldWrapped: { label: string; lines: string[] }[] = [];
    for (const field of data.fields) {
      const lines = wrapValue(field.value, maxValueChars);
      fieldWrapped.push({ label: field.label, lines });
      totalDetailRows += Math.max(lines.length, 1);
    }

    const detailsHeight = totalDetailRows * rowHeight + 10;

    // Clamp to available space to prevent overflow off page
    const availableSpace = y - (margin + 140); // leave room for message/banner/footer
    const clampedHeight = Math.min(detailsHeight, availableSpace);

    stream += `0.976 0.98 0.984 rg\n`; // #f9fafb
    stream += `${margin} ${y - clampedHeight + 15} ${contentWidth} ${clampedHeight} re f\n`;
    // Border
    stream += `0.898 0.906 0.922 RG\n`;
    stream += `0.5 w\n`;
    stream += `${margin} ${y - clampedHeight + 15} ${contentWidth} ${clampedHeight} re S\n`;

    for (const field of fieldWrapped) {
      // Check if we've run out of space
      if (y < margin + 140) break;

      stream += `BT\n`;
      stream += `0.42 0.45 0.50 rg\n`; // muted for label
      stream += `/F2 10 Tf\n`;
      stream += `${labelX} ${y} Td\n`;
      stream += `(${pdfEscape(field.label)}:) Tj\n`;
      stream += `ET\n`;

      // Render each wrapped line of the value
      for (let i = 0; i < field.lines.length; i++) {
        stream += `BT\n`;
        stream += `0.067 0.094 0.153 rg\n`; // dark for value
        stream += `/F1 10 Tf\n`;
        stream += `${valueX} ${y} Td\n`;
        stream += `(${pdfEscape(field.lines[i])}) Tj\n`;
        stream += `ET\n`;
        if (i < field.lines.length - 1) y -= 14; // tighter line spacing for wraps
      }

      y -= rowHeight;
    }

    y -= 15;

    // ── Message section (if present) ─────────────────────────────────────────
    if (data.message && data.message.trim()) {
      stream += `BT\n`;
      stream += `0.427 0.157 0.851 rg\n`;
      stream += `/F2 12 Tf\n`;
      stream += `${margin} ${y} Td\n`;
      stream += `(Message) Tj\n`;
      stream += `ET\n`;
      y -= 8;

      stream += `0.427 0.157 0.851 RG\n`;
      stream += `1.5 w\n`;
      stream += `${margin} ${y} m ${margin + 60} ${y} l S\n`;
      y -= 18;

      // Word-wrap the message into lines
      const lines = wordWrap(data.message.trim(), 80);
      const msgHeight = lines.length * 16 + 20;

      // Background
      stream += `0.976 0.98 0.984 rg\n`;
      stream += `${margin} ${y - msgHeight + 15} ${contentWidth} ${msgHeight} re f\n`;
      // Left purple border
      stream += `0.427 0.157 0.851 RG\n`;
      stream += `2 w\n`;
      stream += `${margin} ${y - msgHeight + 15} m ${margin} ${y + 15} l S\n`;

      for (const line of lines) {
        stream += `BT\n`;
        stream += `0.067 0.094 0.153 rg\n`;
        stream += `/F1 10 Tf\n`;
        stream += `${margin + 12} ${y} Td\n`;
        stream += `(${pdfEscape(line)}) Tj\n`;
        stream += `ET\n`;
        y -= 16;
      }
      y -= 20;
    }

    // ── Action Required banner ───────────────────────────────────────────────
    y -= 10;
    const bannerHeight = 40;
    // Amber background
    stream += `0.996 0.953 0.78 rg\n`; // #fef3c7
    stream += `${margin} ${y - bannerHeight + 15} ${contentWidth} ${bannerHeight} re f\n`;
    // Amber border
    stream += `0.984 0.749 0.141 RG\n`; // #fbbf24
    stream += `0.5 w\n`;
    stream += `${margin} ${y - bannerHeight + 15} ${contentWidth} ${bannerHeight} re S\n`;

    stream += `BT\n`;
    stream += `0.573 0.251 0.055 rg\n`; // #92400e
    stream += `/F2 10 Tf\n`;
    stream += `${margin + 15} ${y - 5} Td\n`;
    stream += `(Action Required: Please respond to this enquiry within 24 hours.) Tj\n`;
    stream += `ET\n`;

    y -= bannerHeight + 20;

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = margin + 20;
    // Divider
    stream += `0.898 0.906 0.922 RG\n`;
    stream += `0.5 w\n`;
    stream += `${margin} ${footerY + 15} m ${pageWidth - margin} ${footerY + 15} l S\n`;

    stream += `BT\n`;
    stream += `0.42 0.45 0.50 rg\n`;
    stream += `/F1 8 Tf\n`;
    stream += `${margin} ${footerY} Td\n`;
    stream += `(Navigate Wealth  |  FSP 54606  |  info@navigatewealth.co  |  \\(+27\\) 12-667-2505) Tj\n`;
    stream += `ET\n`;

    stream += `BT\n`;
    stream += `0.42 0.45 0.50 rg\n`;
    stream += `/F1 7 Tf\n`;
    stream += `${margin} ${footerY - 14} Td\n`;
    stream += `(First Floor, Milestone Place, Block A, 25 Sovereign Dr, Route 21 Business Park, Irene, 0157) Tj\n`;
    stream += `ET\n`;

    // --- Assemble PDF objects ------------------------------------------------
    const objects: string[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    function addObject(content: string): number {
      const objNum = objects.length + 1;
      const obj = `${objNum} 0 obj\n${content}\nendobj\n`;
      offsets.push(currentOffset);
      currentOffset += encode(obj).length;
      objects.push(obj);
      return objNum;
    }

    // Object 1: Catalog
    addObject(`<< /Type /Catalog /Pages 2 0 R >>`);

    // Object 2: Pages
    addObject(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);

    // Object 3: Page
    addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`
    );

    // Object 4: Content stream
    const streamBytes = encode(stream);
    addObject(
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`
    );

    // Object 5: Font (Helvetica)
    addObject(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
    );

    // Object 6: Font (Helvetica-Bold)
    addObject(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`
    );

    // --- Build final PDF bytes -----------------------------------------------
    const header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
    const body = objects.join('');
    const xrefOffset = encode(header).length + encode(body).length;

    let xref = `xref\n0 ${objects.length + 1}\n`;
    xref += `0000000000 65535 f \n`;

    let runningOffset = encode(header).length;
    for (const obj of objects) {
      xref += `${String(runningOffset).padStart(10, '0')} 00000 n \n`;
      runningOffset += encode(obj).length;
    }

    const trailer =
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    const fullPdf = header + body + xref + trailer;

    // Base64 encode for SendGrid attachment
    const bytes = encode(fullPdf);
    const base64 = btoa(String.fromCharCode(...bytes));

    log.info('PDF generated successfully', {
      formType: data.formType,
      fieldCount: data.fields.length,
      sizeBytes: bytes.length,
    });

    return base64;
  } catch (error) {
    log.error('Failed to generate contact PDF:', error);
    throw error;
  }
}

// ── Utility functions ────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function wordWrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 > maxChars) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }

  return lines;
}

function wrapValue(value: string, maxChars: number): string[] {
  const lines: string[] = [];
  const words = value.split(/\s+/);
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxChars) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines;
}