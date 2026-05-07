import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { normaliseRowsForXLSX } from '../utils';

describe('normaliseRowsForXLSX', () => {
  it('converts report rows into Excel-safe primitive cells', () => {
    const { rows, headers } = normaliseRowsForXLSX([
      {
        'Client\u0000 Name': ' Ann\u0007 Example ',
        Tags: ['risk', 'retirement'],
        Metadata: { consent: true },
        InvalidNumber: Number.NaN,
        DateValue: new Date('2026-05-07T10:00:00.000Z'),
      },
    ]);

    expect(headers).toEqual([
      'Client Name',
      'Tags',
      'Metadata',
      'InvalidNumber',
      'DateValue',
    ]);
    expect(rows[0]).toEqual({
      'Client Name': 'Ann Example',
      Tags: 'risk; retirement',
      Metadata: '{"consent":true}',
      InvalidNumber: '',
      DateValue: '2026-05-07T10:00:00.000Z',
    });
  });

  it('produces rows that can be written and read as a native workbook', () => {
    const { rows, headers } = normaliseRowsForXLSX([
      {
        Name: 'Test Client',
        Notes: 'Profile exists\u000B with hidden control char',
        Payload: { status: 'active' },
      },
    ]);

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporting');
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const parsed = XLSX.read(xlsxBuffer, { type: 'array' });

    expect(parsed.SheetNames).toEqual(['Reporting']);
    expect(XLSX.utils.sheet_to_json(parsed.Sheets.Reporting)).toEqual([
      {
        Name: 'Test Client',
        Notes: 'Profile exists with hidden control char',
        Payload: '{"status":"active"}',
      },
    ]);
  });
});
