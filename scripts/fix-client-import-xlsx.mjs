/**
 * Split a populated client-import workbook into import-ready rows
 * vs rows missing required Email Address / Cellphone Number (bulk importer rules).
 *
 * Usage: node scripts/fix-client-import-xlsx.mjs <src.xlsx> [dest.xlsx]
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const hdrCols = [
  ['Title', 'title'],
  ['First Name', 'firstName'],
  ['Middle Name', 'middleName'],
  ['Preferred Name', 'preferredName'],
  ['Last Name', 'lastName'],
  ['Date of Birth', 'dateOfBirth'],
  ['Gender', 'gender'],
  ['Nationality', 'nationality'],
  ['ID Type', 'idType'],
  ['ID Number', 'idNumber'],
  ['Tax Number', 'taxNumber'],
  ['Marital Status', 'maritalStatus'],
  ['Email Address', 'emailAddress'],
  ['Cellphone Number', 'cellphoneNumber'],
  ['Alternative Email', 'alternativeEmail'],
  ['WhatsApp Number', 'whatsappNumber'],
  ['Address Line 1', 'residentialAddressLine1'],
  ['City', 'residentialCity'],
  ['Province', 'residentialProvince'],
  ['Postal Code', 'residentialPostalCode'],
  ['Country', 'residentialCountry'],
  ['Employment Status', 'employmentStatus'],
  ['Job Title', 'jobTitle'],
  ['Employer Name', 'employerName'],
  ['Industry', 'industry'],
  ['Gross Monthly Income', 'grossMonthlyIncome'],
  ['Financial Goals', 'financialGoals'],
  ['Existing Products', 'existingProducts'],
];

function buildHeaderFieldMap(headerRow) {
  /** @type {Record<number,string>} */
  const headerToField = {};
  hdrCols.forEach(([col, field]) => {
    const idx = headerRow.findIndex((x) => x.toLowerCase() === col.toLowerCase());
    if (idx >= 0) headerToField[idx] = field;
  });
  return headerToField;
}

function rowToData(row, headerToField) {
  /** @type {Record<string,string>} */
  const rowData = {};
  Object.entries(headerToField).forEach(([idxStr, field]) => {
    const cellVal = row[parseInt(idxStr, 10)];
    rowData[field] = cellVal != null ? String(cellVal).trim() : '';
  });
  return rowData;
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationErrors(rd) {
  const err = [];
  if (!rd.firstName) err.push('First name is required');
  if (!rd.lastName) err.push('Last name is required');
  if (!rd.emailAddress) err.push('Email address is required');
  if (rd.emailAddress && !emailRe.test(rd.emailAddress)) err.push('Invalid email format');
  if (!rd.cellphoneNumber) err.push('Cellphone number is required');
  return err;
}

async function main() {
  const src = process.argv[2];
  let out = process.argv[3];

  if (!src) {
    console.error('Usage: node scripts/fix-client-import-xlsx.mjs <src.xlsx> [dest.xlsx]');
    process.exit(1);
  }

  out =
    out ||
    src.replace(/\.xlsx$/i, '_IMPORT_READY.xlsx');

  const absoluteSrc = path.resolve(src);
  const buf = fs.readFileSync(absoluteSrc);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const raw = XLSX.utils.sheet_to_json(wb.Sheets['Client Data'], {
    header: 1,
    defval: null,
  });

  const headerRow = raw[0].map((/** @type {unknown} */ h) => String(h || '').trim());

  const headerToField = buildHeaderFieldMap(headerRow);
  const missingTpl = hdrCols.filter(
    ([hdr]) =>
      headerRow.findIndex((x) => x.toLowerCase() === hdr.toLowerCase()) < 0,
  ).map(([h]) => h);
  if (missingTpl.length) {
    console.error('Unexpected: template headers missing from sheet:', missingTpl.join(', '));
    process.exit(1);
  }

  const good = [headerRow.slice()];
  /** @type {unknown[][]} */
  const needs = [['Spreadsheet row (original)', 'Issue(s)', ...headerRow]];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c) => !c && c !== 0)) continue;

    const rd = rowToData(row, headerToField);
    const errs = validationErrors(rd);
    if (!errs.length) {
      good.push(
        headerRow.map((_, colIdx) =>
          row[colIdx] != null && row[colIdx] !== '' ? row[colIdx] : null,
        ),
      );
    } else {
      needs.push([
        String(i + 1),
        errs.join('; '),
        ...headerRow.map((_, colIdx) =>
          row[colIdx] != null && row[colIdx] !== '' ? row[colIdx] : null,
        ),
      ]);
    }
  }

  const outWb = XLSX.utils.book_new();

  const wsGood = XLSX.utils.aoa_to_sheet(good);
  /** @type {Record<number, number>} */
  const maxColWidth = {};
  good.forEach((r) =>
    r.forEach((cell, ci) => {
      const len = Math.min(60, String(cell ?? '').length);
      maxColWidth[ci] = Math.max(maxColWidth[ci] || 12, Math.max(len + 2, 12));
    }),
  );
  wsGood['!cols'] = headerRow.map((_, i) => ({ wch: maxColWidth[i] || 18 }));
  XLSX.utils.book_append_sheet(outWb, wsGood, 'Client Data');

  if (wb.Sheets['Instructions']) {
    XLSX.utils.book_append_sheet(outWb, wb.Sheets['Instructions'], 'Instructions');
  }

  const wsNeeds = XLSX.utils.aoa_to_sheet(needs);
  wsNeeds['!cols'] = needs[0].map((_h, ci) =>
    ci === 0 ? { wch: 14 } : ci === 1 ? { wch: 54 } : { wch: 22 },
  );
  XLSX.utils.book_append_sheet(outWb, wsNeeds, 'Needs contact fields');

  const absOut = path.resolve(out);
  const outBuf = XLSX.write(outWb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(absOut, outBuf);
  console.log('Written:', absOut);
  console.log(`Client Data: ${good.length - 1} row(s) ready to import (+ header)`);
  console.log(`${needs.length - 1} row(s) saved on "Needs contact fields" — add Email / Cellphone, then paste back or merge.`);

  process.exit(0);
}

await main();
