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
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageNumber,
  HeadingLevel,
  TabStopPosition,
  TabStopType,
  convertMillimetersToTwip,
} from 'docx';
import type { LetterMeta } from './LetterheadPdfLayout';
import { resolveRecipients, resolveSignatories } from './LetterheadPdfLayout';
import type { FormBlock } from '../builder/types';

// ============================================================================
// CONSTANTS — Colour tokens, font sizes, etc.
// ============================================================================

const NW_PURPLE = '6D28D9';
const TEXT_DARK = '111827';
const TEXT_MUTED = '6B7280';
const TEXT_LIGHT = '9CA3AF';
const BORDER_COLOR = 'E5E7EB';

/** A4 margins in mm matching the CSS layout */
const MARGIN_TOP_MM = 15;
const MARGIN_BOTTOM_MM = 10;
const MARGIN_LEFT_MM = 18;
const MARGIN_RIGHT_MM = 18;

// No-border helper for table cells
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;

// ============================================================================
// HTML PARSING — Convert rich-text HTML from text blocks to TextRun[]
// ============================================================================

/**
 * Very simple HTML-to-TextRun parser. Handles <p>, <strong>/<b>,
 * <em>/<i>, <u>, <br>, and plain text. Strips everything else.
 */
function htmlToTextRuns(html: string, baseSizePt: number): TextRun[] {
  if (!html) return [new TextRun({ text: ' ', size: baseSizePt * 2 })];

  const runs: TextRun[] = [];

  // Create a temporary DOM element to parse
  const div = document.createElement('div');
  div.innerHTML = html;

  function walk(node: Node, bold = false, italic = false, underline = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold,
            italics: italic,
            underline: underline ? {} : undefined,
            size: baseSizePt * 2, // half-points
            color: TEXT_DARK,
            font: 'Calibri',
          }),
        );
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      runs.push(new TextRun({ break: 1, size: baseSizePt * 2 }));
      return;
    }

    const nextBold = bold || tag === 'strong' || tag === 'b';
    const nextItalic = italic || tag === 'em' || tag === 'i';
    const nextUnderline = underline || tag === 'u';

    for (const child of Array.from(el.childNodes)) {
      walk(child, nextBold, nextItalic, nextUnderline);
    }
  }

  walk(div);

  return runs.length > 0
    ? runs
    : [new TextRun({ text: ' ', size: baseSizePt * 2 })];
}

/**
 * Convert an HTML string (from a text block) into an array of Paragraphs.
 * Each <p> becomes a separate Paragraph; inline formatting is preserved.
 */
function htmlToParagraphs(html: string, baseSizePt: number, lineSpacing?: number): Paragraph[] {
  if (!html) {
    return [new Paragraph({ children: [new TextRun({ text: ' ', size: baseSizePt * 2 })] })];
  }

  const div = document.createElement('div');
  div.innerHTML = html;

  const paragraphs: Paragraph[] = [];

  // Spacing in twips (1pt = 20 twips)
  const spacingAfter = 100; // ~5pt after each paragraph
  const lineRule = lineSpacing
    ? Math.round(lineSpacing * 240)
    : Math.round(1.65 * 240);

  function processNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'p') {
        const runs = htmlToTextRuns(el.innerHTML, baseSizePt);
        paragraphs.push(
          new Paragraph({
            children: runs,
            spacing: { after: spacingAfter, line: lineRule },
          }),
        );
      } else if (tag === 'ul' || tag === 'ol') {
        const items = el.querySelectorAll(':scope > li');
        items.forEach((li, idx) => {
          const runs = htmlToTextRuns(li.innerHTML, baseSizePt);
          const bullet = tag === 'ul' ? '\u2022 ' : `${idx + 1}. `;
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: bullet, size: baseSizePt * 2, font: 'Calibri', color: TEXT_DARK }),
                ...runs,
              ],
              spacing: { after: 60, line: lineRule },
              indent: { left: convertMillimetersToTwip(5) },
            }),
          );
        });
      } else if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        const level = tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        paragraphs.push(
          new Paragraph({
            heading: level,
            children: htmlToTextRuns(el.innerHTML, baseSizePt + 2),
            spacing: { before: 200, after: 100 },
          }),
        );
      } else {
        // Fallback — treat as paragraph
        for (const child of Array.from(el.childNodes)) {
          processNode(child);
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (text) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text, size: baseSizePt * 2, font: 'Calibri', color: TEXT_DARK })],
            spacing: { after: spacingAfter, line: lineRule },
          }),
        );
      }
    }
  }

  for (const child of Array.from(div.childNodes)) {
    processNode(child);
  }

  return paragraphs.length > 0
    ? paragraphs
    : [new Paragraph({ children: [new TextRun({ text: ' ', size: baseSizePt * 2 })] })];
}

// ============================================================================
// BLOCK CONVERTERS — Turn FormBlocks into docx Paragraphs/Tables
// ============================================================================

function convertBlock(block: FormBlock, fontSize: number, lineHeight?: number): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lineRule = lineHeight ? Math.round(lineHeight * 240) : Math.round(1.65 * 240);

  switch (block.type) {
    case 'section_header': {
      const { number, title } = block.data as { number?: string; title?: string };
      elements.push(
        new Paragraph({
          children: [
            ...(number
              ? [new TextRun({ text: `${number} `, bold: true, size: (fontSize + 2) * 2, color: NW_PURPLE, font: 'Calibri' })]
              : []),
            new TextRun({ text: (title || '').toUpperCase(), bold: true, size: (fontSize + 2) * 2, color: TEXT_DARK, font: 'Calibri' }),
          ],
          spacing: { before: 300, after: 150 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 },
          },
        }),
      );
      break;
    }

    case 'text': {
      const content = (block.data as { content?: string }).content || '';
      elements.push(...htmlToParagraphs(content, fontSize, lineHeight));
      break;
    }

    case 'field_grid': {
      const { columns = 2, fields = [] } = block.data as {
        columns?: number;
        fields?: { label?: string; value?: string }[];
      };
      // Render as a two-column table of label: value pairs
      const rows: TableRow[] = [];
      for (let i = 0; i < fields.length; i += columns) {
        const cells: TableCell[] = [];
        for (let j = 0; j < columns; j++) {
          const field = fields[i + j];
          cells.push(
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: field ? `${field.label || ''}: ` : '',
                      bold: true,
                      size: fontSize * 2,
                      font: 'Calibri',
                      color: TEXT_MUTED,
                    }),
                    new TextRun({
                      text: field?.value || '______________________',
                      size: fontSize * 2,
                      font: 'Calibri',
                      color: TEXT_DARK,
                    }),
                  ],
                  spacing: { after: 60 },
                }),
              ],
              borders: NO_BORDERS,
              width: { size: Math.floor(100 / columns), type: WidthType.PERCENTAGE },
            }),
          );
        }
        rows.push(new TableRow({ children: cells }));
      }
      if (rows.length > 0) {
        elements.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
        elements.push(new Paragraph({ spacing: { after: 100 } }));
      }
      break;
    }

    case 'table': {
      const {
        hasColumnHeaders,
        columnHeaders = [],
        rows: tableRows = [],
      } = block.data as {
        hasColumnHeaders?: boolean;
        hasRowHeaders?: boolean;
        columnHeaders?: string[];
        rowHeaders?: string[];
        rows?: { id: string; cells: { type: string; value?: string }[] }[];
      };

      const docxRows: TableRow[] = [];

      if (hasColumnHeaders && columnHeaders.length > 0) {
        docxRows.push(
          new TableRow({
            tableHeader: true,
            children: columnHeaders.map(
              (header) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: header,
                          bold: true,
                          size: fontSize * 2,
                          font: 'Calibri',
                          color: TEXT_DARK,
                        }),
                      ],
                    }),
                  ],
                  shading: { fill: 'F3F4F6' },
                }),
            ),
          }),
        );
      }

      tableRows.forEach((row) => {
        docxRows.push(
          new TableRow({
            children: row.cells.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell.value || '',
                          size: fontSize * 2,
                          font: 'Calibri',
                          color: TEXT_DARK,
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
        );
      });

      if (docxRows.length > 0) {
        elements.push(
          new Table({
            rows: docxRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
        elements.push(new Paragraph({ spacing: { after: 150 } }));
      }
      break;
    }

    case 'signature': {
      const { signatories = [], showDate = true } = block.data as {
        signatories?: { label?: string; key?: string }[];
        showDate?: boolean;
      };
      elements.push(new Paragraph({ spacing: { before: 400 } }));

      signatories.forEach((sig) => {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '_'.repeat(40),
                size: fontSize * 2,
                font: 'Calibri',
                color: TEXT_MUTED,
              }),
            ],
            spacing: { before: 300, after: 40 },
          }),
        );
        if (sig.label) {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: sig.label,
                  size: (fontSize - 1) * 2,
                  font: 'Calibri',
                  color: TEXT_MUTED,
                }),
              ],
              spacing: { after: showDate ? 40 : 100 },
            }),
          );
        }
        if (showDate) {
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Date: _____________________',
                  size: (fontSize - 1) * 2,
                  font: 'Calibri',
                  color: TEXT_MUTED,
                }),
              ],
              spacing: { after: 100 },
            }),
          );
        }
      });
      break;
    }

    case 'fine_print': {
      const content = (block.data as { content?: string }).content || '';
      const paras = htmlToParagraphs(content, Math.max(fontSize - 2, 7), lineHeight);
      paras.forEach((p) => {
        // Override text color to muted
        elements.push(p);
      });
      break;
    }

    case 'spacer': {
      elements.push(new Paragraph({ spacing: { before: 200, after: 200 } }));
      break;
    }

    case 'page_break': {
      elements.push(new Paragraph({ pageBreakBefore: true }));
      break;
    }

    case 'instructional_callout': {
      const content = (block.data as { content?: string }).content || '';
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: content,
              italics: true,
              size: fontSize * 2,
              font: 'Calibri',
              color: TEXT_MUTED,
            }),
          ],
          spacing: { before: 100, after: 100 },
          indent: { left: convertMillimetersToTwip(3) },
          border: {
            left: { style: BorderStyle.SINGLE, size: 3, color: NW_PURPLE, space: 8 },
          },
        }),
      );
      break;
    }

    default: {
      // For unsupported block types, render a placeholder
      const blockLabel = block.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${blockLabel}]`,
              italics: true,
              size: fontSize * 2,
              font: 'Calibri',
              color: TEXT_LIGHT,
            }),
          ],
          spacing: { after: 100 },
        }),
      );
    }
  }

  return elements;
}

// ============================================================================
// LETTERHEAD HEADER — Two-column company header using a table
// ============================================================================

function buildLetterheadHeader(): Header {
  const headerTable = new Table({
    rows: [
      new TableRow({
        children: [
          // Left column — Brand
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Navigate ', bold: true, size: 44, font: 'Calibri', color: TEXT_DARK }),
                  new TextRun({ text: 'Wealth', bold: true, size: 44, font: 'Calibri', color: NW_PURPLE }),
                ],
                spacing: { after: 40 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Independent Financial Advisory Services',
                    size: 18,
                    font: 'Calibri',
                    color: TEXT_MUTED,
                  }),
                ],
                spacing: { after: 30 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Authorised Financial Services Provider \u2014 FSP 54606',
                    size: 16,
                    font: 'Calibri',
                    color: TEXT_MUTED,
                  }),
                ],
              }),
            ],
            borders: NO_BORDERS,
            width: { size: 55, type: WidthType.PERCENTAGE },
            verticalAlign: 'top' as any,
          }),

          // Right column — Contact
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Wealthfront (Pty) Ltd', bold: true, size: 17, font: 'Calibri', color: TEXT_DARK }),
                ],
                spacing: { after: 20 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 't/a Navigate Wealth', size: 17, font: 'Calibri', color: '4B5563' }),
                ],
                spacing: { after: 20 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Route 21 Corporate Park', size: 17, font: 'Calibri', color: '4B5563' }),
                ],
                spacing: { after: 10 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: '25 Sovereign Drive, Milestone Place A', size: 17, font: 'Calibri', color: '4B5563' }),
                ],
                spacing: { after: 10 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Centurion, 0178', size: 17, font: 'Calibri', color: '4B5563' }),
                ],
                spacing: { after: 30 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Tel: (012) 667 2505', size: 17, font: 'Calibri', color: '4B5563' }),
                ],
                spacing: { after: 10 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Email: info@navigatewealth.co', size: 17, font: 'Calibri', color: '4B5563' }),
                ],
              }),
            ],
            borders: NO_BORDERS,
            width: { size: 45, type: WidthType.PERCENTAGE },
            verticalAlign: 'top' as any,
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Purple divider line after header table
  const divider = new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 3, color: NW_PURPLE, space: 4 },
    },
    spacing: { after: 0 },
  });

  return new Header({
    children: [headerTable, divider],
  });
}

// ============================================================================
// FOOTER — Company registration info + page number
// ============================================================================

function buildLetterFooter(): Footer {
  const divider = new Paragraph({
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 4 },
    },
    spacing: { before: 0, after: 40 },
  });

  const line1 = new Paragraph({
    children: [
      new TextRun({
        text: 'Wealthfront (Pty) Ltd',
        bold: true,
        size: 15,
        font: 'Calibri',
        color: TEXT_MUTED,
      }),
      new TextRun({
        text: ' trading as Navigate Wealth is an Authorised Financial Services Provider \u2013 FSP 54606. Registration Number: 2024/071953/07.',
        size: 15,
        font: 'Calibri',
        color: TEXT_LIGHT,
      }),
    ],
    spacing: { after: 20 },
  });

  const line2 = new Paragraph({
    children: [
      new TextRun({
        text: 'Route 21 Corporate Park, 25 Sovereign Drive, Milestone Place A, Centurion, 0178. Tel: (012) 667 2505 | Email: info@navigatewealth.co',
        size: 15,
        font: 'Calibri',
        color: TEXT_LIGHT,
      }),
      new TextRun({ text: '\t', size: 15 }),
      new TextRun({
        text: 'Page ',
        bold: true,
        size: 15,
        font: 'Calibri',
        color: TEXT_MUTED,
      }),
      new TextRun({
        children: [PageNumber.CURRENT],
        bold: true,
        size: 15,
        font: 'Calibri',
        color: TEXT_MUTED,
      }),
    ],
    spacing: { after: 0 },
    tabStops: [
      {
        type: TabStopType.RIGHT,
        position: TabStopPosition.MAX,
      },
    ],
  });

  return new Footer({
    children: [divider, line1, line2],
  });
}

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