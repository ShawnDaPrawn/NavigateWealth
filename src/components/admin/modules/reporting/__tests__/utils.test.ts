import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { createBrandedReportWorkbook, normaliseRowsForXLSX } from '../utils';

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

  it('creates a branded Navigate Wealth workbook for report exports', async () => {
    const workbook = await createBrandedReportWorkbook(
      [
        {
          Client: 'Ann Example',
          Status: 'Approved',
          Premium: 1250.5,
          CreatedDate: '2026-05-08T08:00:00.000Z',
        },
      ],
      'Client Report',
      {
        reportName: 'Client Report',
        generatedAt: new Date('2026-05-08T08:00:00.000Z'),
      },
    );

    const worksheet = workbook.getWorksheet('Client Report');
    expect(workbook.creator).toBe('Navigate Wealth');
    expect(workbook.company).toBe('Navigate Wealth');
    expect(worksheet).toBeTruthy();

    expect(worksheet?.getCell('A1').value).toBe('Navigate Wealth');
    expect(worksheet?.getCell('A2').value).toBe('Client Report');
    expect(worksheet?.getCell('A3').value).toContain('1 rows');
    expect((worksheet?.getCell('A1').fill as any)?.fgColor?.argb).toBe('FF111827');
    expect((worksheet?.getCell('A4').fill as any)?.fgColor?.argb).toBe('FF7C3AED');

    expect(worksheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 5 });
    expect(worksheet?.autoFilter).toEqual({
      from: { row: 5, column: 1 },
      to: { row: 6, column: 4 },
    });

    expect(worksheet?.getCell('A5').value).toBe('Client');
    expect(worksheet?.getCell('A5').font.bold).toBe(true);
    expect((worksheet?.getCell('A5').fill as any)?.fgColor?.argb).toBe('FF6D28D9');

    expect((worksheet?.getCell('B6').fill as any)?.fgColor?.argb).toBe('FFDCFCE7');
    expect(worksheet?.getCell('B6').font.bold).toBe(true);
    expect(worksheet?.getCell('C6').numFmt).toBe('R #,##0.00');
    expect(worksheet?.getCell('D6').value).toBeInstanceOf(Date);
  });
});
