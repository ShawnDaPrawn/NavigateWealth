import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../../../../ui/button';
import { Tabs } from '../../../../ui/tabs';
import { SegmentedList, SegmentedTrigger, useUrlState } from '../../../layout/page';
import { Progress } from '../../../../ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Trash2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Checkbox } from '../../../../ui/checkbox';
import { api } from '../../../../../utils/api/client';

// ---------------------------------------------------------------------------
// Template column definitions
// ---------------------------------------------------------------------------
const TEMPLATE_COLUMNS = [
  { header: 'Title', field: 'title', required: false, hint: 'Mr, Mrs, Ms, Miss, Dr, Prof' },
  { header: 'First Name', field: 'firstName', required: true },
  { header: 'Middle Name', field: 'middleName', required: false },
  { header: 'Preferred Name', field: 'preferredName', required: false },
  { header: 'Last Name', field: 'lastName', required: true },
  { header: 'Date of Birth', field: 'dateOfBirth', required: false, hint: 'YYYY-MM-DD' },
  { header: 'Gender', field: 'gender', required: false, hint: 'Male, Female, Other' },
  { header: 'Nationality', field: 'nationality', required: false, hint: 'Default: South Africa' },
  { header: 'ID Type', field: 'idType', required: false, hint: 'sa_id or passport' },
  { header: 'ID Number', field: 'idNumber', required: false },
  { header: 'Tax Number', field: 'taxNumber', required: false },
  {
    header: 'Marital Status',
    field: 'maritalStatus',
    required: false,
    hint: 'Single, Married, Divorced, Widowed, Life Partner',
  },
  { header: 'Email Address', field: 'emailAddress', required: true },
  { header: 'Cellphone Number', field: 'cellphoneNumber', required: true, hint: '+27...' },
  { header: 'Alternative Email', field: 'alternativeEmail', required: false },
  { header: 'WhatsApp Number', field: 'whatsappNumber', required: false },
  { header: 'Address Line 1', field: 'residentialAddressLine1', required: false },
  { header: 'City', field: 'residentialCity', required: false },
  { header: 'Province', field: 'residentialProvince', required: false },
  { header: 'Postal Code', field: 'residentialPostalCode', required: false },
  {
    header: 'Country',
    field: 'residentialCountry',
    required: false,
    hint: 'Default: South Africa',
  },
  {
    header: 'Employment Status',
    field: 'employmentStatus',
    required: false,
    hint: 'employed, self-employed, unemployed, retired, student',
  },
  { header: 'Job Title', field: 'jobTitle', required: false },
  { header: 'Employer Name', field: 'employerName', required: false },
  { header: 'Industry', field: 'industry', required: false },
  { header: 'Gross Monthly Income', field: 'grossMonthlyIncome', required: false },
  { header: 'Financial Goals', field: 'financialGoals', required: false },
  {
    header: 'Existing Products',
    field: 'existingProducts',
    required: false,
    hint: 'Comma-separated',
  },
];

const MAX_BULK_IMPORT_ROWS = 10_000;
const MAX_BULK_IMPORT_FILE_MB = 20;
const MAX_BULK_IMPORT_BYTES = MAX_BULK_IMPORT_FILE_MB * 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
const ROWS_VIEWS = ['all', 'fix'] as const;
type RowsView = (typeof ROWS_VIEWS)[number];

interface ParsedRow {
  rowNum: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

interface ImportResult {
  row: number;
  email: string;
  name: string;
  status: 'success' | 'failed' | 'skipped';
  applicationNumber?: string;
  error?: string;
  /** Present when the row was created against a derived sign-in alias. */
  signInEmail?: string;
}

interface BulkImportTabProps {
  onSuccess: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadTemplate() {
  const headers = TEMPLATE_COLUMNS.map((c) => c.header);

  const example: Record<string, string> = {
    Title: 'Mr',
    'First Name': 'John',
    'Middle Name': '',
    'Preferred Name': 'Johnny',
    'Last Name': 'Smith',
    'Date of Birth': '1985-06-15',
    Gender: 'Male',
    Nationality: 'South Africa',
    'ID Type': 'sa_id',
    'ID Number': '8506155012081',
    'Tax Number': '',
    'Marital Status': 'Married',
    'Email Address': 'john.smith@example.com',
    'Cellphone Number': '+27821234567',
    'Alternative Email': '',
    'WhatsApp Number': '+27821234567',
    'Address Line 1': '12 Oak Street',
    City: 'Pretoria',
    Province: 'Gauteng',
    'Postal Code': '0001',
    Country: 'South Africa',
    'Employment Status': 'employed',
    'Job Title': 'Software Engineer',
    'Employer Name': 'TechCo',
    Industry: 'Information Technology',
    'Gross Monthly Income': 'R50,001 – R75,000',
    'Financial Goals': 'Retirement planning, investment growth',
    'Existing Products': 'Medical Aid, Retirement Annuity',
  };

  const exampleRow = headers.map((h) => example[h] || '');

  const wsData = [headers, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  const instrData = [
    ['Column', 'Required', 'Description / Allowed Values'],
    ...TEMPLATE_COLUMNS.map((c) => [c.header, c.required ? 'Yes' : 'No', c.hint || '']),
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
  wsInstr['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Client Data');
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'navigate_wealth_client_import_template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BULK_IMPORT_BYTES) {
      reject(
        new Error(
          `The spreadsheet is too large. Please upload a file smaller than ${MAX_BULK_IMPORT_FILE_MB} MB.`,
        ),
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', sheetRows: MAX_BULK_IMPORT_ROWS + 2 });

        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

        if (raw.length < 2) {
          reject(
            new Error(
              'The spreadsheet has no data rows. Please add client data below the header row.',
            ),
          );
          return;
        }

        if (raw.length > MAX_BULK_IMPORT_ROWS + 1) {
          reject(
            new Error(
              `Maximum ${MAX_BULK_IMPORT_ROWS} clients per import. Please split your file.`,
            ),
          );
          return;
        }

        const headerRow = raw[0].map((h) => String(h || '').trim());
        const headerToField: Record<number, string> = {};
        TEMPLATE_COLUMNS.forEach((col) => {
          const idx = headerRow.findIndex((h) => h.toLowerCase() === col.header.toLowerCase());
          if (idx >= 0) headerToField[idx] = col.field;
        });

        const rows: ParsedRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || row.every((cell) => !cell && (cell as unknown) !== 0)) continue;

          const rowData: Record<string, string> = {};
          Object.entries(headerToField).forEach(([idxStr, field]) => {
            const cellVal = row[parseInt(idxStr)];
            rowData[field] = cellVal != null ? String(cellVal).trim() : '';
          });

          const errors: string[] = [];
          if (!rowData.firstName) errors.push('First name is required');
          if (!rowData.lastName) errors.push('Last name is required');
          if (!rowData.emailAddress) errors.push('Email address is required');
          if (rowData.emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rowData.emailAddress)) {
            errors.push('Invalid email format');
          }
          if (!rowData.cellphoneNumber) errors.push('Cellphone number is required');

          rows.push({ rowNum: i + 1, data: rowData, errors, valid: errors.length === 0 });
        }

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------
function StepIndicator({
  number,
  active,
  complete,
}: {
  number: number;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
        complete
          ? 'bg-green-100 text-green-700'
          : active
            ? 'bg-[#6d28d9] text-white'
            : 'bg-gray-100 text-gray-400'
      }`}
    >
      {complete ? <CheckCircle2 className="h-4 w-4" /> : number}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function BulkImportTab({ onSuccess, onClose }: BulkImportTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  /**
   * A household book routinely lists two people on one inbox. Off by default,
   * because silently linking duplicates would also swallow the ordinary mistake
   * of importing the same client twice.
   */
  const [linkDuplicateEmails, setLinkDuplicateEmails] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);
  const [rowsView, setRowsView] = useUrlState<RowsView>('rows', 'all', ROWS_VIEWS);

  const handleDownloadTemplate = () => {
    downloadTemplate();
    setTemplateDownloaded(true);
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;
  const hasFile = !!fileName;
  const hasPreview = parsedRows.length > 0;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx)');
      return;
    }

    setFileName(file.name);
    setImportResults(null);
    try {
      const rows = await parseExcel(file);
      setParsedRows(rows);
      if (rows.length === 0) {
        toast.error('No data rows found in the spreadsheet');
      } else {
        toast.success(`Parsed ${rows.length} row(s) from ${file.name}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse Excel file');
      setParsedRows([]);
    }
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    if (validRows.length > MAX_BULK_IMPORT_ROWS) {
      toast.error(`Maximum ${MAX_BULK_IMPORT_ROWS} clients per import. Please split your file.`);
      return;
    }

    setIsImporting(true);
    setImportProgress(10);

    try {
      setImportProgress(30);
      const result = await api.post<{
        success: boolean;
        total: number;
        succeeded: number;
        failed: number;
        results: ImportResult[];
      }>('/admin/onboarding/bulk-add', {
        clients: validRows.map((r) => r.data),
        linkDuplicateEmails,
      });

      setImportProgress(100);
      setImportResults(result.results || []);

      if (result.succeeded > 0) {
        toast.success(`Successfully imported ${result.succeeded} of ${result.total} clients`);
        onSuccess();
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} client(s) failed to import`);
      }
    } catch (error: unknown) {
      console.error('Bulk import error:', error);
      toast.error(error instanceof Error ? error.message : 'Bulk import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setParsedRows([]);
    setFileName('');
    setImportResults(null);
    setRowsView('all');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =====================================================================
  // RESULTS VIEW
  // =====================================================================
  if (importResults) {
    const succeeded = importResults.filter((r) => r.status === 'success').length;
    const failed = importResults.filter((r) => r.status === 'failed').length;
    const skipped = importResults.filter((r) => r.status === 'skipped').length;

    return (
      <div className="space-y-5">
        <section className="rounded-xl border border-nw-line bg-white" aria-label="Import complete">
          <div className="flex items-center gap-2.5 border-b border-nw-line-2 px-5 py-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            <div>
              <h3 className="text-[15px] font-semibold text-nw-ink">Import complete</h3>
              <p className="text-sm text-nw-text-3">
                {succeeded} {succeeded === 1 ? 'client' : 'clients'} added
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-nw-line-2">
            <ResultFigure label="Imported" value={succeeded} className="text-green-700" />
            <ResultFigure label="Failed" value={failed} className="text-red-700" />
            <ResultFigure
              label="Skipped (duplicates)"
              value={skipped}
              className="text-nw-amber-700"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-nw-line-2 px-5 py-3">
            <p className="text-sm text-nw-text-3">
              Download the results to see each row’s outcome.
            </p>
            <Button variant="outline" size="sm" onClick={() => downloadResults(importResults)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download .xlsx
            </Button>
          </div>
        </section>

        <div className="overflow-hidden rounded-xl border border-nw-line bg-white">
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Application</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importResults.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs text-nw-text-3">{r.row}</TableCell>
                    <TableCell className="text-sm font-medium text-nw-ink">{r.name}</TableCell>
                    <TableCell className="text-sm text-nw-text-2">{r.email}</TableCell>
                    <TableCell className="text-sm">
                      {r.status === 'success' && <span className="text-green-700">Imported</span>}
                      {r.status === 'failed' && (
                        <span className="text-red-700">{r.error || 'Failed'}</span>
                      )}
                      {r.status === 'skipped' && (
                        <span className="text-nw-amber-700">
                          {r.error || 'Skipped — email already in use'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-nw-violet-600">
                      {r.applicationNumber || '—'}
                      {r.signInEmail && (
                        <span
                          className="block text-[10px] font-normal text-nw-text-3"
                          title={`Signs in as ${r.signInEmail}; mail goes to ${r.email}`}
                        >
                          linked: {r.signInEmail}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <Button variant="outline" onClick={handleClear}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Import more
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  // =====================================================================
  // UPLOAD FLOW: template → upload → check and import
  // =====================================================================
  const step = hasPreview ? 3 : hasFile ? 2 : templateDownloaded ? 2 : 1;
  const visibleRows = rowsView === 'fix' ? parsedRows.filter((r) => !r.valid) : parsedRows;

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap items-center gap-3" aria-label="Import steps">
        {[
          { n: 1, label: 'Download template', done: templateDownloaded || hasFile },
          { n: 2, label: 'Upload completed file', done: hasPreview },
          { n: 3, label: 'Check and import', done: false },
        ].map((s, i) => (
          <li key={s.n} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-8 bg-nw-line" aria-hidden="true" />}
            <span
              className="flex items-center gap-2 text-sm"
              aria-current={step === s.n ? 'step' : undefined}
            >
              <StepIndicator number={s.n} active={step === s.n} complete={s.done} />
              <span className={step === s.n ? 'font-medium text-nw-ink' : 'text-nw-text-2'}>
                {s.label}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {!hasPreview && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-nw-line bg-white p-5">
            <h3 className="text-[15px] font-semibold text-nw-ink">1. Download the template</h3>
            <p className="mt-1 text-sm text-nw-text-3">
              Pre-formatted Excel file with all supported fields. Required: first name, last name,
              email and cellphone.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleDownloadTemplate}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download template
            </Button>
          </section>
          <section className="rounded-xl border border-nw-line bg-white p-5">
            <h3 className="text-[15px] font-semibold text-nw-ink">2. Upload the completed file</h3>
            {fileName ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-green-700">
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                {fileName}
              </p>
            ) : (
              <p className="mt-1 text-sm text-nw-text-3">
                Up to {MAX_BULK_IMPORT_ROWS.toLocaleString()} clients per upload, .xlsx files only.
              </p>
            )}
            <Button size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {hasFile ? 'Replace file' : 'Upload file'}
            </Button>
          </section>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        aria-label="Spreadsheet to import"
        onChange={handleFileChange}
      />

      {hasPreview && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <section className="overflow-hidden rounded-xl border border-nw-line bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-nw-line-2 px-4 py-3">
              <FileSpreadsheet className="h-4 w-4 text-green-700" aria-hidden="true" />
              <span className="text-sm font-medium text-nw-ink">{fileName}</span>
              <span className="text-sm text-green-700">{validCount} ready</span>
              {invalidCount > 0 && (
                <span className="text-sm text-red-700">{invalidCount} need fixing</span>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  Replace file
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isImporting}
                  aria-label="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="px-4 pt-3">
              <Tabs value={rowsView} onValueChange={(v) => setRowsView(v as RowsView)}>
                <SegmentedList aria-label="Rows">
                  <SegmentedTrigger value="all">All · {parsedRows.length}</SegmentedTrigger>
                  <SegmentedTrigger value="fix">Need fixing · {invalidCount}</SegmentedTrigger>
                </SegmentedList>
              </Tabs>
            </div>
            <div className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID number</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-sm text-nw-text-3">
                        No rows need fixing.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map((row) => (
                      <TableRow key={row.rowNum}>
                        <TableCell className="font-mono text-xs text-nw-text-3">
                          {row.rowNum}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-nw-ink">
                          {row.data.firstName} {row.data.lastName}
                        </TableCell>
                        <TableCell className="text-sm text-nw-text-2">
                          {row.data.emailAddress || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-nw-text-2">
                          {maskId(row.data.idNumber)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.valid ? (
                            <span className="text-green-700">Ready</span>
                          ) : (
                            <span className="text-red-700">{row.errors.join('; ')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {invalidCount > 0 && (
              <p className="border-t border-nw-line-2 px-4 py-3 text-sm text-nw-text-3">
                Rows that need fixing are skipped. Fix them in the file and import again.
              </p>
            )}
            <div className="flex items-start gap-2.5 border-t border-nw-line-2 px-4 py-3">
              <Checkbox
                id="link-duplicate-emails"
                checked={linkDuplicateEmails}
                onCheckedChange={(v) => setLinkDuplicateEmails(v === true)}
                disabled={isImporting}
                className="mt-0.5"
              />
              <label htmlFor="link-duplicate-emails" className="cursor-pointer text-sm">
                <span className="font-medium text-nw-ink">
                  Link rows that share an existing email
                </span>
                <span className="block text-nw-text-3">
                  Adds the person as a second client on that mailbox with a sign-in alias, instead
                  of skipping the row. Leave this off if the file may list the same client twice.
                </span>
              </label>
            </div>
          </section>

          <aside className="h-fit rounded-xl border border-nw-line bg-white p-4 text-sm">
            <h3 className="font-semibold text-nw-ink">Before you import</h3>
            <p className="mt-1 text-nw-text-3">
              Every row needs a first name, last name, email address and cellphone number. Rows with
              errors are skipped; the rest import in one go.
            </p>
            <Button variant="link" className="mt-2 h-auto p-0" onClick={handleDownloadTemplate}>
              Download the template again
            </Button>
          </aside>
        </div>
      )}

      {isImporting && (
        <div className="space-y-2" role="status">
          <Progress value={importProgress} className="h-1.5" />
          <p className="text-center text-xs text-nw-text-3">Creating client accounts…</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-nw-line pt-4">
        {hasPreview && (
          <span className="mr-auto text-sm text-nw-text-3">
            {validCount} of {parsedRows.length} rows will be imported
          </span>
        )}
        <Button variant="outline" onClick={onClose} disabled={isImporting}>
          Cancel
        </Button>
        {hasPreview && (
          <Button onClick={handleImport} disabled={isImporting || validCount === 0}>
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            )}
            {isImporting
              ? 'Importing…'
              : `Import ${validCount} ${validCount === 1 ? 'client' : 'clients'}`}
          </Button>
        )}
      </div>
    </div>
  );
}

function ResultFigure({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="p-5 text-center">
      <div className={`text-3xl font-semibold tabular-nums ${className}`}>{value}</div>
      <div className="mt-1 text-xs text-nw-text-3">{label}</div>
    </div>
  );
}

/** "900118••••84" — the middle of an ID number is never shown in a preview. */
function maskId(id?: string): string {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return `${id.slice(0, 6)}••••${id.slice(-2)}`;
}

/** Each row's outcome as a spreadsheet, so staff can fix and re-import failures. */
function downloadResults(results: ImportResult[]) {
  const rows = results.map((r) => ({
    Row: r.row,
    Name: r.name,
    Email: r.email,
    Result: r.status === 'success' ? 'Imported' : r.status === 'failed' ? 'Failed' : 'Skipped',
    Reason: r.error ?? '',
    'Application number': r.applicationNumber ?? '',
    'Sign-in email': r.signInEmail ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import results');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'navigate_wealth_client_import_results.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success('Results downloaded');
}
