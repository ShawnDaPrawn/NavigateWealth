/**
 * integrations-spreadsheet.ts — the workbook an agent upload is judged by.
 *
 * Portfolio apply and the older integration sync both read through
 * `readSpreadsheetUpload` and match policy numbers through
 * `normalisePolicyNumber`. A sheet chosen from the wrong tab, a column named
 * like an object key, or a policy number that no longer folds the same way
 * writes the wrong policy or writes nothing. These tests pin that parsing.
 */
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  CANONICAL_TEMPLATE_SHEET_NAME,
  MAX_INTEGRATION_UPLOAD_ROWS,
  TEMPLATE_METADATA_COLUMNS,
  buildTemplateFileName,
  getTemplateRowMetadata,
  hasVisibleRowData,
  normalisePolicyNumber,
  parseSpreadsheetDateSerial,
  readSpreadsheetUpload,
  stripUnsafeSpreadsheetKeys,
} from '../integrations-spreadsheet.ts';

const UNSAFE_KEY = (key: string) =>
  ['__proto__', 'prototype', 'constructor'].includes(key.trim().toLowerCase());

function workbookBytes(sheets: Array<{ name: string; rows: unknown[][] }>): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('normalisePolicyNumber', () => {
  it('folds case, spaces, separators and zero-width characters into one key', () => {
    const same = ['EB-001', 'eb 001', 'EB/001', 'eb_001', ' EB\u200B-001\uFEFF '];
    expect(same.map(normalisePolicyNumber)).toEqual(['EB001', 'EB001', 'EB001', 'EB001', 'EB001']);
  });

  it('leaves other punctuation in place, and a missing value is empty', () => {
    expect(normalisePolicyNumber('EB.001')).toBe('EB.001');
    expect(normalisePolicyNumber(null)).toBe('');
    expect(normalisePolicyNumber(undefined)).toBe('');
  });
});

describe('stripUnsafeSpreadsheetKeys', () => {
  it('drops object-key column names and keeps the policy cells', () => {
    const row = Object.create(null) as Record<string, unknown>;
    row['Cover Amount'] = 10;
    row['__proto__'] = { polluted: true };
    row['Constructor'] = 'c';
    row[' prototype '] = 'p';
    expect(stripUnsafeSpreadsheetKeys(row)).toEqual({ 'Cover Amount': 10 });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe('readSpreadsheetUpload', () => {
  it('reads the preferred sheet ahead of the canonical template sheet', () => {
    const bytes = workbookBytes([
      {
        name: CANONICAL_TEMPLATE_SHEET_NAME,
        rows: [['Policy Number'], ['FROM-TEMPLATE']],
      },
      { name: 'Portfolio', rows: [['Cover Amount'], [42]] },
    ]);

    expect(readSpreadsheetUpload(bytes, { preferredSheets: ['Portfolio'] })).toMatchObject({
      headers: ['Cover Amount'],
      rawRows: [{ 'Cover Amount': 42 }],
    });
  });

  it('uses the canonical sheet, then Provider Data, then the first sheet', () => {
    const canonical = workbookBytes([
      { name: 'Portfolio', rows: [['Cover Amount'], [1]] },
      { name: CANONICAL_TEMPLATE_SHEET_NAME, rows: [['Policy Number'], ['EB-1']] },
    ]);
    expect(readSpreadsheetUpload(canonical).rawRows).toEqual([{ 'Policy Number': 'EB-1' }]);

    const providerData = workbookBytes([
      { name: 'Notes', rows: [['Ignore'], ['x']] },
      { name: 'Provider Data', rows: [['Policy Number'], ['EB-9']] },
    ]);
    expect(readSpreadsheetUpload(providerData).rawRows).toEqual([{ 'Policy Number': 'EB-9' }]);

    const first = workbookBytes([{ name: 'Custom', rows: [['Policy Number'], ['EB-3']] }]);
    expect(readSpreadsheetUpload(first).rawRows).toEqual([{ 'Policy Number': 'EB-3' }]);

    const missingPreferred = workbookBytes([
      { name: CANONICAL_TEMPLATE_SHEET_NAME, rows: [['Policy Number'], ['EB-4']] },
    ]);
    expect(
      readSpreadsheetUpload(missingPreferred, { preferredSheets: ['Portfolio'] }).rawRows,
    ).toEqual([{ 'Policy Number': 'EB-4' }]);
  });

  it('drops unsafe column names from the headers and from the row objects', () => {
    const bytes = workbookBytes([
      {
        name: 'Portfolio',
        rows: [
          ['Cover Amount', '__proto__', 'constructor', 'prototype', '__PROTO__', ' Prototype '],
          [10, 'p', 'c', 'x', 'y', 'z'],
        ],
      },
    ]);
    const parsed = readSpreadsheetUpload(bytes);

    expect(parsed.headers.filter(UNSAFE_KEY)).toEqual([]);
    expect(parsed.headers).toContain('Cover Amount');
    for (const row of [...parsed.rawRows, ...parsed.previewRows]) {
      expect(Object.keys(row).filter(UNSAFE_KEY)).toEqual([]);
    }
    expect(parsed.rawRows[0]['Cover Amount']).toBe(10);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('keeps a row that only has hidden ids, and drops a blank one from the preview', () => {
    const bytes = workbookBytes([
      {
        name: 'Portfolio',
        rows: [
          ['Cover Amount', TEMPLATE_METADATA_COLUMNS.policyId, TEMPLATE_METADATA_COLUMNS.clientId],
          ['', '', ''],
          ['', 'pol-1', ''],
          [15, '', 'c1'],
        ],
      },
    ]);
    const parsed = readSpreadsheetUpload(bytes);

    expect(parsed.rawRows).toEqual([
      {
        'Cover Amount': '',
        [TEMPLATE_METADATA_COLUMNS.policyId]: 'pol-1',
        [TEMPLATE_METADATA_COLUMNS.clientId]: '',
      },
      {
        'Cover Amount': 15,
        [TEMPLATE_METADATA_COLUMNS.policyId]: '',
        [TEMPLATE_METADATA_COLUMNS.clientId]: 'c1',
      },
    ]);
    expect(parsed.previewRows).toEqual([{ 'Cover Amount': '' }, { 'Cover Amount': 15 }]);
  });

  it('accepts 1000 policy rows and refuses the next one', () => {
    const header = ['Policy Number'];
    const within = workbookBytes([
      {
        name: 'Portfolio',
        rows: [header, ...Array.from({ length: MAX_INTEGRATION_UPLOAD_ROWS }, (_, i) => [`P${i}`])],
      },
    ]);
    expect(readSpreadsheetUpload(within).rawRows).toHaveLength(MAX_INTEGRATION_UPLOAD_ROWS);

    const over = workbookBytes([
      {
        name: 'Portfolio',
        rows: [
          header,
          ...Array.from({ length: MAX_INTEGRATION_UPLOAD_ROWS + 1 }, (_, i) => [`P${i}`]),
        ],
      },
    ]);
    expect(() => readSpreadsheetUpload(over)).toThrow(/too many rows/i);
  });

  it('refuses a worksheet with nothing in it', () => {
    const bytes = workbookBytes([{ name: 'Portfolio', rows: [] }]);
    expect(() => readSpreadsheetUpload(bytes)).toThrow('File is empty');
  });
});

describe('template metadata and download names', () => {
  it('treats a hidden policy id as a real row, and a version stamp alone as blank', () => {
    const headers = ['Cover Amount', TEMPLATE_METADATA_COLUMNS.policyId];
    expect(
      hasVisibleRowData(
        { 'Cover Amount': '', [TEMPLATE_METADATA_COLUMNS.policyId]: 'pol-1' },
        headers,
      ),
    ).toBe(true);
    expect(
      hasVisibleRowData(
        { 'Cover Amount': '  ', [TEMPLATE_METADATA_COLUMNS.templateVersion]: 'v1' },
        ['Cover Amount', TEMPLATE_METADATA_COLUMNS.templateVersion],
      ),
    ).toBe(false);
  });

  it('trims hidden ids to the column width and folds the stored policy number', () => {
    const meta = getTemplateRowMetadata({
      [TEMPLATE_METADATA_COLUMNS.policyId]: `  ${'a'.repeat(300)}  `,
      [TEMPLATE_METADATA_COLUMNS.normalizedPolicyNumber]: 'eb-001',
    });
    expect(meta.policyId).toHaveLength(240);
    expect(meta.normalizedPolicyNumber).toBe('EB001');
  });

  it('strips characters a download filename cannot carry', () => {
    expect(buildTemplateFileName('Allan/Gray: "Life"', 'Cover*?<', 'Portfolio')).toBe(
      'Allan Gray Life - Cover - Portfolio.xlsx',
    );
    expect(buildTemplateFileName('', '', 'Portfolio')).toBe('Provider - Portfolio.xlsx');
  });
});

describe('parseSpreadsheetDateSerial', () => {
  it('reads the Excel serial for 1 January 2023, and rejects a serial with no day', () => {
    expect(parseSpreadsheetDateSerial(44927)).toMatchObject({ y: 2023, m: 1, d: 1 });
    expect(parseSpreadsheetDateSerial(-1)).toBeNull();
  });
});
