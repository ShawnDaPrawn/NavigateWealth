/**
 * letterDocxExport.ts
 *
 * Generates a downloadable .docx Word document that preserves the Navigate
 * Wealth company letterhead (header), body content from letter blocks,
 * closing/signatory section, and compliance footer.
 *
 * Uses the `docx` npm package for document generation and `file-saver` for
 * the browser download trigger.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  BorderStyle,
  convertMillimetersToTwip,
} from 'docx';
import type { LetterMeta } from './LetterheadPdfLayout';
import { resolveRecipients, resolveSignatories } from './LetterheadPdfLayout';
import type { FormBlock } from '../builder/types';

import { convertBlock } from './letterDocxBlocks';
import { buildLetterheadHeader, buildLetterFooter } from './letterDocxChrome';
import {
  TEXT_DARK,
  TEXT_MUTED,
  BORDER_COLOR,
  MARGIN_TOP_MM,
  MARGIN_BOTTOM_MM,
  MARGIN_LEFT_MM,
  MARGIN_RIGHT_MM,
} from './letterDocxTheme';

// ============================================================================
// DATE FORMATTING
// ============================================================================

function formatLetterDate(dateStr?: string): string {
  if (dateStr) return dateStr;
  return new Date().toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export async function exportLetterAsDocx(
  blocks: FormBlock[],
  meta: LetterMeta,
  fileName?: string,
): Promise<void> {
  const fontSize = meta.fontSize || 10;
  const lineHeight = meta.lineHeight || 1.65;
  const recipients = resolveRecipients(meta);
  const signatories = resolveSignatories(meta);

  // --- Build body content ---
  const bodyChildren: (Paragraph | Table)[] = [];

  // Date
  bodyChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: formatLetterDate(meta.date),
          size: fontSize * 2,
          font: 'Calibri',
          color: TEXT_DARK,
        }),
      ],
      spacing: { after: 200 },
    }),
  );

  // Recipients
  if (recipients.length > 0) {
    recipients.forEach((recipient, idx) => {
      if (recipient.name) {
        bodyChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: recipient.name,
                bold: true,
                size: fontSize * 2,
                font: 'Calibri',
                color: TEXT_DARK,
              }),
            ],
            spacing: { after: 20 },
          }),
        );
      }
      if (recipient.title) {
        bodyChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: recipient.title,
                size: fontSize * 2,
                font: 'Calibri',
                color: TEXT_DARK,
              }),
            ],
            spacing: { after: 20 },
          }),
        );
      }
      if (recipient.company) {
        bodyChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: recipient.company,
                size: fontSize * 2,
                font: 'Calibri',
                color: TEXT_DARK,
              }),
            ],
            spacing: { after: 20 },
          }),
        );
      }
      if (recipient.address) {
        const addressLines = recipient.address.split('\n');
        addressLines.forEach((line) => {
          bodyChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: fontSize * 2,
                  font: 'Calibri',
                  color: TEXT_DARK,
                }),
              ],
              spacing: { after: 20 },
            }),
          );
        });
      }
      // Spacing between recipients
      if (idx < recipients.length - 1) {
        bodyChildren.push(new Paragraph({ spacing: { after: 100 } }));
      }
    });
    bodyChildren.push(new Paragraph({ spacing: { after: 150 } }));
  }

  // Reference / Subject
  if (meta.reference || meta.subject) {
    const runs: TextRun[] = [];
    if (meta.reference) {
      runs.push(
        new TextRun({
          text: 'Ref: ',
          bold: true,
          size: fontSize * 2,
          font: 'Calibri',
          color: TEXT_MUTED,
        }),
        new TextRun({
          text: meta.reference,
          bold: true,
          size: (fontSize + 0.5) * 2,
          font: 'Calibri',
          color: TEXT_DARK,
        }),
      );
      if (meta.subject) {
        runs.push(
          new TextRun({
            text: ' \u2014 ',
            size: (fontSize + 0.5) * 2,
            font: 'Calibri',
            color: TEXT_DARK,
          }),
        );
      }
    }
    if (meta.subject) {
      runs.push(
        new TextRun({
          text: 'RE: ',
          bold: true,
          size: fontSize * 2,
          font: 'Calibri',
          color: TEXT_MUTED,
        }),
        new TextRun({
          text: meta.subject,
          bold: true,
          size: (fontSize + 0.5) * 2,
          font: 'Calibri',
          color: TEXT_DARK,
        }),
      );
    }
    bodyChildren.push(
      new Paragraph({
        children: runs,
        spacing: { after: 150 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 },
        },
      }),
    );
  }

  // Body blocks
  blocks.forEach((block) => {
    if (block.type === 'page_break') {
      bodyChildren.push(new Paragraph({ pageBreakBefore: true }));
    } else {
      bodyChildren.push(...convertBlock(block, fontSize, lineHeight));
    }
  });

  // Closing
  if (meta.closing || signatories.length > 0) {
    bodyChildren.push(new Paragraph({ spacing: { before: 300 } }));

    if (meta.closing) {
      bodyChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${meta.closing},`,
              size: fontSize * 2,
              font: 'Calibri',
              color: TEXT_DARK,
            }),
          ],
          spacing: { after: 100 },
        }),
      );
    }

    // Signatories
    signatories.forEach((signatory) => {
      bodyChildren.push(new Paragraph({ spacing: { before: 500 } }));
      // Signature line
      bodyChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '_'.repeat(35),
              size: fontSize * 2,
              font: 'Calibri',
              color: TEXT_DARK,
            }),
          ],
          spacing: { after: 40 },
        }),
      );
      if (signatory.name) {
        bodyChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: signatory.name,
                bold: true,
                size: fontSize * 2,
                font: 'Calibri',
                color: TEXT_DARK,
              }),
            ],
            spacing: { after: 20 },
          }),
        );
      }
      if (signatory.title) {
        bodyChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${signatory.title} \u2014 Navigate Wealth`,
                size: (fontSize - 1) * 2,
                font: 'Calibri',
                color: TEXT_MUTED,
              }),
            ],
            spacing: { after: 40 },
          }),
        );
      }
    });
  }

  // --- Assemble Document ---
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: fontSize * 2,
            color: TEXT_DARK,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(MARGIN_TOP_MM),
              bottom: convertMillimetersToTwip(MARGIN_BOTTOM_MM),
              left: convertMillimetersToTwip(MARGIN_LEFT_MM),
              right: convertMillimetersToTwip(MARGIN_RIGHT_MM),
            },
          },
        },
        headers: {
          default: buildLetterheadHeader(),
        },
        footers: {
          default: buildLetterFooter(),
        },
        children: bodyChildren,
      },
    ],
  });

  // --- Generate and download ---
  const blob = await Packer.toBlob(doc);
  const safeName = (fileName || 'Navigate_Wealth_Letter')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_');
  saveAs(blob, `${safeName}.docx`);
}

// ============================================================================
// BROWSER DOWNLOAD HELPER — replaces file-saver
// ============================================================================

function saveAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
