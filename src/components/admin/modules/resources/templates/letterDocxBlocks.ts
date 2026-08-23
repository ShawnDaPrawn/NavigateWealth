/**
 * Block converters for the letter .docx export: turns each FormBlock into
 * docx Paragraphs/Tables. Moved verbatim from letterDocxExport.ts.
 */
import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import type { FormBlock } from '../builder/types';
import { htmlToParagraphs } from './letterDocxHtml';
import {
  NW_PURPLE,
  TEXT_DARK,
  TEXT_MUTED,
  TEXT_LIGHT,
  BORDER_COLOR,
  NO_BORDERS,
} from './letterDocxTheme';

export function convertBlock(
  block: FormBlock,
  fontSize: number,
  lineHeight?: number,
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  switch (block.type) {
    case 'section_header': {
      const { number, title } = block.data as { number?: string; title?: string };
      elements.push(
        new Paragraph({
          children: [
            ...(number
              ? [
                  new TextRun({
                    text: `${number} `,
                    bold: true,
                    size: (fontSize + 2) * 2,
                    color: NW_PURPLE,
                    font: 'Calibri',
                  }),
                ]
              : []),
            new TextRun({
              text: (title || '').toUpperCase(),
              bold: true,
              size: (fontSize + 2) * 2,
              color: TEXT_DARK,
              font: 'Calibri',
            }),
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
