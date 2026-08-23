/**
 * Letterhead header and compliance footer for the letter .docx export.
 * Moved verbatim from letterDocxExport.ts.
 */
import {
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
  TabStopPosition,
  TabStopType,
} from 'docx';
import {
  NW_PURPLE,
  TEXT_DARK,
  TEXT_MUTED,
  TEXT_LIGHT,
  BORDER_COLOR,
  NO_BORDERS,
} from './letterDocxTheme';

// ============================================================================
// LETTERHEAD HEADER — Two-column company header using a table
// ============================================================================

export function buildLetterheadHeader(): Header {
  const headerTable = new Table({
    rows: [
      new TableRow({
        children: [
          // Left column — Brand
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Navigate ',
                    bold: true,
                    size: 44,
                    font: 'Calibri',
                    color: TEXT_DARK,
                  }),
                  new TextRun({
                    text: 'Wealth',
                    bold: true,
                    size: 44,
                    font: 'Calibri',
                    color: NW_PURPLE,
                  }),
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
                  new TextRun({
                    text: 'Wealthfront (Pty) Ltd',
                    bold: true,
                    size: 17,
                    font: 'Calibri',
                    color: TEXT_DARK,
                  }),
                ],
                spacing: { after: 20 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 't/a Navigate Wealth',
                    size: 17,
                    font: 'Calibri',
                    color: '4B5563',
                  }),
                ],
                spacing: { after: 20 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Route 21 Corporate Park',
                    size: 17,
                    font: 'Calibri',
                    color: '4B5563',
                  }),
                ],
                spacing: { after: 10 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: '25 Sovereign Drive, Milestone Place A',
                    size: 17,
                    font: 'Calibri',
                    color: '4B5563',
                  }),
                ],
                spacing: { after: 10 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Centurion, 0178',
                    size: 17,
                    font: 'Calibri',
                    color: '4B5563',
                  }),
                ],
                spacing: { after: 30 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Tel: (012) 667 2505',
                    size: 17,
                    font: 'Calibri',
                    color: '4B5563',
                  }),
                ],
                spacing: { after: 10 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Email: info@navigatewealth.co',
                    size: 17,
                    font: 'Calibri',
                    color: '4B5563',
                  }),
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

export function buildLetterFooter(): Footer {
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
