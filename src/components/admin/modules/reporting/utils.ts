import { Report, ReportRun } from './types';
import { reportingApi } from './api';

type SpreadsheetCellValue = string | number | boolean | null;
type ExcelWorkbook = import('exceljs').Workbook;
type ExcelWorksheet = import('exceljs').Worksheet;
type ExcelCell = import('exceljs').Cell;

interface BrandedWorkbookOptions {
  reportName: string;
  generatedAt?: Date;
}

const ILLEGAL_XML_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const REPORT_HEADER_ROW = 5;
const REPORT_DATA_START_ROW = REPORT_HEADER_ROW + 1;
const BRAND = {
  navy: '111827',
  purple: '7C3AED',
  purpleDark: '6D28D9',
  slateText: '334155',
  slateMuted: '64748B',
  slateBorder: 'CBD5E1',
  slateBand: 'F8FAFC',
  white: 'FFFFFF',
  greenText: '166534',
  greenFill: 'DCFCE7',
  amberText: '92400E',
  amberFill: 'FEF3C7',
  redText: '991B1B',
  redFill: 'FEE2E2',
  blueText: '1D4ED8',
  blueFill: 'DBEAFE',
};

/**
 * Sanitise a string for use as an Excel sheet name.
 * Strips characters forbidden by the OOXML spec: : \ / ? * [ ]
 * and trims to the 31-character limit.
 */
function sanitiseSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || 'Report';
}

function sanitiseCellText(value: string): string {
  return value.replace(ILLEGAL_XML_CONTROL_CHARS, '').trim();
}

function normaliseCellValue(value: unknown): SpreadsheetCellValue {
  if (value == null) return '';

  if (typeof value === 'string') {
    return sanitiseCellText(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '';
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normaliseCellValue(item))
      .filter((item) => item !== '')
      .join('; ');
  }

  if (typeof value === 'object') {
    try {
      return sanitiseCellText(JSON.stringify(value));
    } catch {
      return '';
    }
  }

  return '';
}

export function normaliseRowsForXLSX(
  rows: Record<string, unknown>[]
): { rows: Record<string, SpreadsheetCellValue>[]; headers: string[] } {
  const headers: string[] = [];
  const headerSet = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const header = sanitiseCellText(key) || 'Column';
      if (!headerSet.has(header)) {
        headerSet.add(header);
        headers.push(header);
      }
    }
  }

  const normalisedRows = rows.map((row) => {
    const normalised: Record<string, SpreadsheetCellValue> = {};

    for (const [key, value] of Object.entries(row)) {
      const header = sanitiseCellText(key) || 'Column';
      normalised[header] = normaliseCellValue(value);
    }

    return normalised;
  });

  return { rows: normalisedRows, headers };
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function argb(hex: string): string {
  return `FF${hex}`;
}

function isLikelyDateHeader(header: string): boolean {
  return /(date|created|updated|started|completed|submitted|reviewed|generated)/i.test(header);
}

function isLikelyCurrencyHeader(header: string): boolean {
  return /(amount|value|premium|revenue|aum|commission|fee|total|balance|income|salary)/i.test(header);
}

function isLikelyStatusHeader(header: string): boolean {
  return /(status|state|stage|consent|active|completed|approved|outcome)/i.test(header);
}

function toExcelCellValue(header: string, value: SpreadsheetCellValue): SpreadsheetCellValue | Date {
  if (typeof value !== 'string' || !value) return value;

  if (isLikelyDateHeader(header)) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return new Date(timestamp);
  }

  return value;
}

function statusPalette(value: unknown): { fill: string; text: string } | null {
  const text = String(value || '').toLowerCase();

  if (/\b(approved|complete|completed|active|success|yes|valid|signed)\b/.test(text)) {
    return { fill: BRAND.greenFill, text: BRAND.greenText };
  }

  if (/\b(pending|submitted|review|waiting|draft|in progress|running)\b/.test(text)) {
    return { fill: BRAND.amberFill, text: BRAND.amberText };
  }

  if (/\b(failed|rejected|declined|inactive|error|expired|no)\b/.test(text)) {
    return { fill: BRAND.redFill, text: BRAND.redText };
  }

  if (/\b(new|open|created|received)\b/.test(text)) {
    return { fill: BRAND.blueFill, text: BRAND.blueText };
  }

  return null;
}

function applyThinBorder(cell: ExcelCell, color = BRAND.slateBorder): void {
  cell.border = {
    top: { style: 'thin', color: { argb: argb(color) } },
    left: { style: 'thin', color: { argb: argb(color) } },
    bottom: { style: 'thin', color: { argb: argb(color) } },
    right: { style: 'thin', color: { argb: argb(color) } },
  };
}

function styleReportWorksheet(
  worksheet: ExcelWorksheet,
  headers: string[],
  rows: Record<string, SpreadsheetCellValue>[],
  options: Required<BrandedWorkbookOptions>,
): void {
  const columnCount = Math.max(headers.length, 1);
  const lastDataRow = REPORT_HEADER_ROW + rows.length;

  worksheet.properties.defaultRowHeight = 22;
  worksheet.views = [{ state: 'frozen', ySplit: REPORT_HEADER_ROW }];
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  worksheet.mergeCells(1, 1, 1, columnCount);
  worksheet.mergeCells(2, 1, 2, columnCount);
  worksheet.mergeCells(3, 1, 3, columnCount);
  worksheet.mergeCells(4, 1, 4, columnCount);

  const brandCell = worksheet.getCell(1, 1);
  brandCell.value = 'Navigate Wealth';
  brandCell.font = { bold: true, color: { argb: argb(BRAND.white) }, size: 18 };
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left' };

  const titleCell = worksheet.getCell(2, 1);
  titleCell.value = options.reportName;
  titleCell.font = { bold: true, color: { argb: argb(BRAND.navy) }, size: 14 };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.white) } };

  const metaCell = worksheet.getCell(3, 1);
  metaCell.value = `Generated ${formatGeneratedAt(options.generatedAt)} | ${rows.length} rows | Reporting module`;
  metaCell.font = { color: { argb: argb(BRAND.slateMuted) }, size: 10 };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.white) } };

  const accentCell = worksheet.getCell(4, 1);
  accentCell.value = '';
  accentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.purple) } };

  [1, 2, 3, 4].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.height = rowNumber === 1 ? 30 : rowNumber === 4 ? 6 : 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (rowNumber === 4) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.purple) } };
      }
    });
  });

  const headerRow = worksheet.getRow(REPORT_HEADER_ROW);
  headerRow.height = 26;
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: argb(BRAND.white) }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.purpleDark) } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    applyThinBorder(cell, BRAND.purpleDark);
  });

  rows.forEach((rowData, rowIndex) => {
    const row = worksheet.getRow(REPORT_DATA_START_ROW + rowIndex);
    row.height = 22;

    headers.forEach((header, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      const value = toExcelCellValue(header, rowData[header]);
      cell.value = value;
      cell.alignment = { vertical: 'top', horizontal: typeof value === 'number' ? 'right' : 'left', wrapText: true };
      cell.font = { color: { argb: argb(BRAND.slateText) }, size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(rowIndex % 2 === 0 ? BRAND.white : BRAND.slateBand) },
      };
      applyThinBorder(cell);

      if (value instanceof Date) {
        cell.numFmt = 'dd mmm yyyy';
      } else if (typeof value === 'number' && isLikelyCurrencyHeader(header)) {
        cell.numFmt = 'R #,##0.00';
      }

      if (isLikelyStatusHeader(header)) {
        const palette = statusPalette(value);
        if (palette) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(palette.fill) } };
          cell.font = { bold: true, color: { argb: argb(palette.text) }, size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }
      }
    });
  });

  const footerRowNumber = Math.max(lastDataRow + 2, REPORT_DATA_START_ROW + 1);
  worksheet.mergeCells(footerRowNumber, 1, footerRowNumber, columnCount);
  const footerCell = worksheet.getCell(footerRowNumber, 1);
  footerCell.value = 'Navigate Wealth confidential report - generated for internal advisory use.';
  footerCell.font = { italic: true, color: { argb: argb(BRAND.slateMuted) }, size: 9 };
  footerCell.alignment = { horizontal: 'left' };

  worksheet.autoFilter = {
    from: { row: REPORT_HEADER_ROW, column: 1 },
    to: { row: Math.max(REPORT_HEADER_ROW, lastDataRow), column: columnCount },
  };

  headers.forEach((header, index) => {
    let maxLen = header.length;
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const cellVal = rows[i][header];
      const cellLen = cellVal != null ? String(cellVal).length : 0;
      if (cellLen > maxLen) maxLen = cellLen;
    }

    worksheet.getColumn(index + 1).width = Math.min(Math.max(maxLen + 3, 14), 42);
  });
}

export async function createBrandedReportWorkbook(
  rows: Record<string, unknown>[],
  sheetName: string,
  options: BrandedWorkbookOptions,
): Promise<ExcelWorkbook> {
  const ExcelJS = await import('exceljs');
  const { rows: normalisedRows, headers } = normaliseRowsForXLSX(rows);
  const workbook = new ExcelJS.Workbook();
  const generatedAt = options.generatedAt || new Date();
  const reportName = sanitiseCellText(options.reportName || sheetName || 'Report') || 'Report';
  const worksheet = workbook.addWorksheet(sanitiseSheetName(sheetName), {
    properties: { tabColor: { argb: argb(BRAND.purple) } },
  });

  workbook.creator = 'Navigate Wealth';
  workbook.lastModifiedBy = 'Navigate Wealth';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.subject = reportName;
  workbook.title = reportName;
  workbook.company = 'Navigate Wealth';

  styleReportWorksheet(worksheet, headers.length > 0 ? headers : ['No data'], normalisedRows, {
    reportName,
    generatedAt,
  });

  return workbook;
}

/**
 * Creates a new report run instance
 */
export function createReportRun(report: Report): ReportRun {
  return {
    id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    reportId: report.id,
    parameters: { ...report.parameters },
    status: 'Running',
    progress: 0,
    startedAt: new Date().toISOString()
  };
}

interface ReportCallbacks {
  onProgress: (runId: string, progress: number) => void;
  onComplete: (runId: string, outputFile: string) => void;
  onError: (runId: string, error: string) => void;
}

/**
 * Generate a branded .xlsx workbook from an array of flat row objects
 * and trigger a browser download.
 *
 * Returns a Blob URL that can be reused for subsequent downloads.
 */
async function generateAndDownloadXLSX(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string,
  reportName = sheetName,
): Promise<string> {
  const workbook = await createBrandedReportWorkbook(rows, sheetName, { reportName });
  const xlsxBuffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([xlsxBuffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return url;
}

/**
 * In-memory cache for report data so the Download button can re-download
 * without hitting the server again.
 */
const reportDataCache = new Map<
  string,
  { rows: Record<string, unknown>[]; sheetName: string; filename: string; blobUrl: string }
>();

/**
 * Re-trigger download for a previously generated report.
 * Returns true if the download was triggered, false if no cached data exists.
 */
export async function redownloadReport(runId: string): Promise<boolean> {
  const cached = reportDataCache.get(runId);
  if (!cached) return false;

  try {
    URL.revokeObjectURL(cached.blobUrl);

    const newUrl = await generateAndDownloadXLSX(cached.rows, cached.sheetName, cached.filename);
    cached.blobUrl = newUrl;
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a report by fetching real data from the server,
 * generating a branded .xlsx file, and triggering a browser download.
 */
export async function executeReport(
  report: Report,
  runId: string,
  callbacks: ReportCallbacks
): Promise<void> {
  try {
    callbacks.onProgress(runId, 10);

    callbacks.onProgress(runId, 20);
    const data = (await reportingApi.getReportData(report)) as Record<string, unknown>[];
    callbacks.onProgress(runId, 60);

    if (!Array.isArray(data) || data.length === 0) {
      callbacks.onError(
        runId,
        'No client data found. Approve some applications first to populate client profiles.'
      );
      return;
    }

    callbacks.onProgress(runId, 80);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${report.id}_${timestamp}.xlsx`;
    const sheetName = sanitiseSheetName(report.name);

    const blobUrl = await generateAndDownloadXLSX(data, sheetName, filename, report.name);

    reportDataCache.set(runId, { rows: data, sheetName, filename, blobUrl });

    callbacks.onProgress(runId, 100);
    callbacks.onComplete(runId, filename);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during report generation';
    console.error('[Report] Generation failed:', message);
    callbacks.onError(runId, message);
  }
}
