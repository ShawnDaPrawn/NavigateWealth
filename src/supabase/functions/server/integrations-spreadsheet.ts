import * as XLSX from 'npm:@e965/xlsx@0.20.3';

export const CANONICAL_TEMPLATE_SHEET_NAME = 'Integration Update Template';
export const TEMPLATE_DICTIONARY_SHEET_NAME = 'Field Dictionary';
export const TEMPLATE_INSTRUCTIONS_SHEET_NAME = 'Instructions';
export const TEMPLATE_METADATA_COLUMNS = {
  templateVersion: '_NW Template Version',
  policyId: '_NW Policy ID',
  clientId: '_NW Client ID',
  providerId: '_NW Provider ID',
  categoryId: '_NW Category ID',
  normalizedPolicyNumber: '_NW Normalized Policy Number',
} as const;
export const MAX_INTEGRATION_UPLOAD_ROWS = 1000;
export const MAX_INTEGRATION_UPLOAD_BYTES = 5 * 1024 * 1024;

const UNSAFE_SPREADSHEET_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export interface IntegrationTemplateRowMetadata {
  templateVersion?: string;
  policyId?: string;
  clientId?: string;
  providerId?: string;
  categoryId?: string;
  normalizedPolicyNumber?: string;
}

type SpreadsheetWorkbook = ReturnType<typeof XLSX.utils.book_new>;
type SpreadsheetSheet = ReturnType<typeof XLSX.utils.aoa_to_sheet>;

function normaliseTemplateMetadataValue(value: unknown): string {
  return String(value || '').trim().slice(0, 240);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === '';
}

export function normalisePolicyNumber(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_/]/g, '');
}

export function isUnsafeSpreadsheetKey(value: unknown): boolean {
  return UNSAFE_SPREADSHEET_KEYS.has(String(value || '').trim().toLowerCase());
}

export function isTemplateMetadataColumn(header: unknown): boolean {
  const value = String(header || '').trim();
  return Object.values(TEMPLATE_METADATA_COLUMNS).includes(value as typeof TEMPLATE_METADATA_COLUMNS[keyof typeof TEMPLATE_METADATA_COLUMNS]);
}

export function getTemplateRowMetadata(rawData: Record<string, unknown>): IntegrationTemplateRowMetadata {
  return {
    templateVersion: normaliseTemplateMetadataValue(rawData[TEMPLATE_METADATA_COLUMNS.templateVersion]),
    policyId: normaliseTemplateMetadataValue(rawData[TEMPLATE_METADATA_COLUMNS.policyId]),
    clientId: normaliseTemplateMetadataValue(rawData[TEMPLATE_METADATA_COLUMNS.clientId]),
    providerId: normaliseTemplateMetadataValue(rawData[TEMPLATE_METADATA_COLUMNS.providerId]),
    categoryId: normaliseTemplateMetadataValue(rawData[TEMPLATE_METADATA_COLUMNS.categoryId]),
    normalizedPolicyNumber: normalisePolicyNumber(rawData[TEMPLATE_METADATA_COLUMNS.normalizedPolicyNumber]),
  };
}

export function applyTemplateRowMetadata(
  rawData: Record<string, unknown>,
  metadata: Partial<IntegrationTemplateRowMetadata>,
): Record<string, unknown> {
  return {
    ...rawData,
    [TEMPLATE_METADATA_COLUMNS.templateVersion]: normaliseTemplateMetadataValue(metadata.templateVersion),
    [TEMPLATE_METADATA_COLUMNS.policyId]: normaliseTemplateMetadataValue(metadata.policyId),
    [TEMPLATE_METADATA_COLUMNS.clientId]: normaliseTemplateMetadataValue(metadata.clientId),
    [TEMPLATE_METADATA_COLUMNS.providerId]: normaliseTemplateMetadataValue(metadata.providerId),
    [TEMPLATE_METADATA_COLUMNS.categoryId]: normaliseTemplateMetadataValue(metadata.categoryId),
    [TEMPLATE_METADATA_COLUMNS.normalizedPolicyNumber]: normalisePolicyNumber(metadata.normalizedPolicyNumber),
  };
}

export function stripTemplateMetadataColumns(rawData: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rawData || {}).filter(([key]) => !isTemplateMetadataColumn(key) && !isUnsafeSpreadsheetKey(key)),
  );
}

export function stripUnsafeSpreadsheetKeys(rawData: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rawData || {}).filter(([key]) => !isUnsafeSpreadsheetKey(key)),
  );
}

export function hasVisibleRowData(rawData: Record<string, unknown>, headers: string[]): boolean {
  const visibleHeaders = headers.filter((header) => !isTemplateMetadataColumn(header));
  if (visibleHeaders.some((header) => !isBlank(rawData[header]))) return true;
  const metadata = getTemplateRowMetadata(rawData);
  return Boolean(metadata.policyId || metadata.clientId || metadata.normalizedPolicyNumber);
}

export function serialiseTemplateCellValue(value: unknown): unknown {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

export function buildTemplateFileName(providerName: string, categoryLabel: string): string {
  const parts = [providerName || 'Provider', categoryLabel, 'Integration Template']
    .map((part) => String(part || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return `${parts.join(' - ')}.xlsx`;
}

export function createSpreadsheetWorkbook(): SpreadsheetWorkbook {
  return XLSX.utils.book_new();
}

export function appendSpreadsheetRowsSheet(
  workbook: SpreadsheetWorkbook,
  rows: unknown[][],
  sheetName: string,
): void {
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
}

export function appendSpreadsheetSheet(
  workbook: SpreadsheetWorkbook,
  sheet: SpreadsheetSheet,
  sheetName: string,
): void {
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

export function rowsToSpreadsheetSheet(rows: unknown[][]): SpreadsheetSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

export function jsonRowsToSpreadsheetSheet(
  rows: Record<string, unknown>[],
  options?: { header?: string[] },
): SpreadsheetSheet {
  return XLSX.utils.json_to_sheet(rows, options);
}

export function encodeSpreadsheetRange(range: {
  s: { r: number; c: number };
  e: { r: number; c: number };
}): string {
  return XLSX.utils.encode_range(range);
}

export function writeSpreadsheetWorkbook(workbook: SpreadsheetWorkbook): ArrayBuffer {
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function parseSpreadsheetDateSerial(raw: number): { y: number; m: number; d: number } | null {
  return XLSX.SSF.parse_date_code(raw) || null;
}

export function readSpreadsheetUpload(buffer: ArrayBuffer): {
  headers: string[];
  rawRows: Record<string, unknown>[];
  previewRows: Record<string, unknown>[];
} {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', sheetRows: MAX_INTEGRATION_UPLOAD_ROWS + 2 });
  const dataSheetName = workbook.SheetNames.includes(CANONICAL_TEMPLATE_SHEET_NAME)
    ? CANONICAL_TEMPLATE_SHEET_NAME
    : workbook.SheetNames.includes('Provider Data')
      ? 'Provider Data'
      : workbook.SheetNames[0];
  const sheet = workbook.Sheets[dataSheetName];

  if (!dataSheetName || !sheet) {
    throw new Error('File does not contain a readable worksheet');
  }

  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

  if (jsonData.length === 0) {
    throw new Error('File is empty');
  }

  if (jsonData.length > MAX_INTEGRATION_UPLOAD_ROWS + 1) {
    throw new Error(`Spreadsheet has too many rows. Maximum ${MAX_INTEGRATION_UPLOAD_ROWS} policy rows are allowed per upload.`);
  }

  const headers = ((jsonData[0] || []) as unknown[])
    .map((header) => String(header || '').trim())
    .filter((header) => header && !isUnsafeSpreadsheetKey(header));
  const rawRows = (XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[])
    .map((row) => stripUnsafeSpreadsheetKeys(row))
    .filter((row) => hasVisibleRowData(row, headers));
  const previewRows = rawRows.map((row) => stripTemplateMetadataColumns(row));

  return {
    headers,
    rawRows,
    previewRows,
  };
}
