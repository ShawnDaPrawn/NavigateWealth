import * as XLSX from 'xlsx';
import { Report, ReportRun } from './types';
import { reportingApi } from './api';

/**
 * Sanitise a string for use as an Excel sheet name.
 * Strips characters forbidden by the OOXML spec: : \ / ? * [ ]
 * and trims to the 31-character limit.
 */
function sanitiseSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, '').substring(0, 31) || 'Report';
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
 * Generate a native .xlsx workbook from an array of flat row objects
 * and trigger a browser download.
 *
 * Returns a Blob URL that can be reused for subsequent downloads.
 */
function generateAndDownloadXLSX(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string
): string {
  // Build worksheet from JSON rows — SheetJS places each key into its own column
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns based on header + content width (best-effort)
  const headers = Object.keys(rows[0] || {});
  const colWidths = headers.map((header) => {
    // Start with header length
    let maxLen = header.length;
    // Sample first 50 rows for width estimation
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const cellVal = rows[i][header];
      const cellLen = cellVal != null ? String(cellVal).length : 0;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    // Cap at a reasonable width and add padding
    return { wch: Math.min(maxLen + 2, 60) };
  });
  ws['!cols'] = colWidths;

  // Create workbook and append the sheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Write to ArrayBuffer
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Create Blob with correct MIME type for native Excel
  const blob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);

  // Trigger download
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
export function redownloadReport(runId: string): boolean {
  const cached = reportDataCache.get(runId);
  if (!cached) return false;

  // Re-generate the file from cached rows (blob URLs can expire)
  try {
    // Revoke old URL to prevent memory leaks
    URL.revokeObjectURL(cached.blobUrl);

    const newUrl = generateAndDownloadXLSX(cached.rows, cached.sheetName, cached.filename);
    cached.blobUrl = newUrl;
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a report by fetching real data from the server,
 * generating a native .xlsx file, and triggering a browser download.
 */
export async function executeReport(
  report: Report,
  runId: string,
  callbacks: ReportCallbacks
): Promise<void> {
  try {
    // Step 1: Signal start
    callbacks.onProgress(runId, 10);

    // Step 2: Fetch data from server
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

    // Step 3: Generate native .xlsx and download
    callbacks.onProgress(runId, 80);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${report.id}_${timestamp}.xlsx`;
    const sheetName = sanitiseSheetName(report.name);

    const blobUrl = generateAndDownloadXLSX(data, sheetName, filename);

    // Cache rows for re-download
    reportDataCache.set(runId, { rows: data, sheetName, filename, blobUrl });

    // Step 4: Complete
    callbacks.onProgress(runId, 100);
    callbacks.onComplete(runId, filename);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during report generation';
    console.error('[Report] Generation failed:', message);
    callbacks.onError(runId, message);
  }
}