import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { toast } from 'sonner@2.0.3';
import {
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  ArrowRight,
  RotateCcw,
  PartyPopper,
  Info,
} from 'lucide-react';
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
  { header: 'Marital Status', field: 'maritalStatus', required: false, hint: 'Single, Married, Divorced, Widowed, Life Partner' },
  { header: 'Email Address', field: 'emailAddress', required: true },
  { header: 'Cellphone Number', field: 'cellphoneNumber', required: true, hint: '+27...' },
  { header: 'Alternative Email', field: 'alternativeEmail', required: false },
  { header: 'WhatsApp Number', field: 'whatsappNumber', required: false },
  { header: 'Address Line 1', field: 'residentialAddressLine1', required: false },
  { header: 'City', field: 'residentialCity', required: false },
  { header: 'Province', field: 'residentialProvince', required: false },
  { header: 'Postal Code', field: 'residentialPostalCode', required: false },
  { header: 'Country', field: 'residentialCountry', required: false, hint: 'Default: South Africa' },
  { header: 'Employment Status', field: 'employmentStatus', required: false, hint: 'employed, self-employed, unemployed, retired, student' },
  { header: 'Job Title', field: 'jobTitle', required: false },
  { header: 'Employer Name', field: 'employerName', required: false },
  { header: 'Industry', field: 'industry', required: false },
  { header: 'Gross Monthly Income', field: 'grossMonthlyIncome', required: false },
  { header: 'Financial Goals', field: 'financialGoals', required: false },
  { header: 'Existing Products', field: 'existingProducts', required: false, hint: 'Comma-separated' },
];

const MAX_BULK_IMPORT_ROWS = 50;
const MAX_BULK_IMPORT_BYTES = 1024 * 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
}

interface BulkImportTabProps {
  onSuccess: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadTemplate() {
  const headers = TEMPLATE_COLUMNS.map(c => c.header);

  const example: Record<string, string> = {
    'Title': 'Mr',
    'First Name': 'John',
    'Middle Name': '',
    'Preferred Name': 'Johnny',
    'Last Name': 'Smith',
    'Date of Birth': '1985-06-15',
    'Gender': 'Male',
    'Nationality': 'South Africa',
    'ID Type': 'sa_id',
    'ID Number': '8506155012081',
    'Tax Number': '',
    'Marital Status': 'Married',
    'Email Address': 'john.smith@example.com',
    'Cellphone Number': '+27821234567',
    'Alternative Email': '',
    'WhatsApp Number': '+27821234567',
    'Address Line 1': '12 Oak Street',
    'City': 'Pretoria',
    'Province': 'Gauteng',
    'Postal Code': '0001',
    'Country': 'South Africa',
    'Employment Status': 'employed',
    'Job Title': 'Software Engineer',
    'Employer Name': 'TechCo',
    'Industry': 'Information Technology',
    'Gross Monthly Income': 'R50,001 – R75,000',
    'Financial Goals': 'Retirement planning, investment growth',
    'Existing Products': 'Medical Aid, Retirement Annuity',
  };

  const exampleRow = headers.map(h => example[h] || '');

  const wsData = [headers, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));

  const instrData = [
    ['Column', 'Required', 'Description / Allowed Values'],
    ...TEMPLATE_COLUMNS.map(c => [c.header, c.required ? 'Yes' : 'No', c.hint || '']),
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
      reject(new Error('The spreadsheet is too large. Please upload a file smaller than 1 MB.'));
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
          reject(new Error('The spreadsheet has no data rows. Please add client data below the header row.'));
          return;
        }

        if (raw.length > MAX_BULK_IMPORT_ROWS + 1) {
          reject(new Error(`Maximum ${MAX_BULK_IMPORT_ROWS} clients per import. Please split your file.`));
          return;
        }

        const headerRow = raw[0].map(h => String(h || '').trim());
        const headerToField: Record<number, string> = {};
        TEMPLATE_COLUMNS.forEach(col => {
          const idx = headerRow.findIndex(h => h.toLowerCase() === col.header.toLowerCase());
          if (idx >= 0) headerToField[idx] = col.field;
        });

        const rows: ParsedRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || row.every(cell => !cell && cell !== 0)) continue;

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
function StepIndicator({ number, active, complete }: { number: number; active: boolean; complete: boolean }) {
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
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;
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
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('No valid rows to import'); return; }
    if (validRows.length > MAX_BULK_IMPORT_ROWS) { toast.error(`Maximum ${MAX_BULK_IMPORT_ROWS} clients per import. Please split your file.`); return; }

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
      }>('/admin/onboarding/bulk-add', { clients: validRows.map(r => r.data) });

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =====================================================================
  // RESULTS VIEW
  // =====================================================================
  if (importResults) {
    const succeeded = importResults.filter(r => r.status === 'success').length;
    const failed = importResults.filter(r => r.status === 'failed').length;
    const skipped = importResults.filter(r => r.status === 'skipped').length;

    return (
      <div className="space-y-5">
        {/* Summary cards */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="h-7 w-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center">
              <PartyPopper className="h-3.5 w-3.5 text-[#6d28d9]" />
            </div>
            <h3 className="text-[13px] font-semibold text-gray-900">Import Complete</h3>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="p-5 text-center">
              <div className="text-3xl font-bold text-green-600">{succeeded}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">Imported</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-3xl font-bold text-red-500">{failed}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">Failed</div>
            </div>
            <div className="p-5 text-center">
              <div className="text-3xl font-bold text-amber-500">{skipped}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">Skipped (Duplicates)</div>
            </div>
          </div>
        </div>

        {/* Results table */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="max-h-60 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="w-14 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Row</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Email</TableHead>
                  <TableHead className="w-28 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">App #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importResults.map((r, i) => (
                  <TableRow key={i} className={r.status === 'failed' ? 'bg-red-50/40' : r.status === 'skipped' ? 'bg-amber-50/40' : ''}>
                    <TableCell className="text-xs text-gray-400 font-mono">{r.row}</TableCell>
                    <TableCell className="text-sm font-medium text-gray-900">{r.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{r.email}</TableCell>
                    <TableCell>
                      {r.status === 'success' && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-medium">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Success
                        </Badge>
                      )}
                      {r.status === 'failed' && (
                        <Badge variant="destructive" className="text-[10px] font-medium" title={r.error}>
                          <XCircle className="h-3 w-3 mr-1" />Failed
                        </Badge>
                      )}
                      {r.status === 'skipped' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-medium">
                          <AlertTriangle className="h-3 w-3 mr-1" />Skipped
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-[#6d28d9]">{r.applicationNumber || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={handleClear} className="px-5">
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Import More
          </Button>
          <Button onClick={onClose} className="px-6 bg-[#6d28d9] hover:bg-[#5b21b6]">
            Done
          </Button>
        </div>
      </div>
    );
  }

  // =====================================================================
  // UPLOAD FLOW
  // =====================================================================
  return (
    <div className="space-y-5">
      {/* Steps */}
      <div className="space-y-3">
        {/* Step 1 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
          <StepIndicator number={1} active={!hasFile} complete={hasFile} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Download the import template</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Pre-formatted Excel file with all supported fields. Required: <span className="font-medium text-gray-600">First Name, Last Name, Email, Cellphone</span>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Download .xlsx
          </Button>
        </div>

        {/* Step 2 */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
          <StepIndicator number={2} active={hasFile && !hasPreview} complete={hasPreview} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Upload your completed file</p>
            {fileName ? (
              <div className="flex items-center gap-2 mt-1">
                <FileSpreadsheet className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span className="text-xs font-medium text-green-700 truncate">{fileName}</span>
                {hasPreview && (
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} parsed
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                Maximum 50 clients per upload. Accepts <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">.xlsx</code> files only.
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant={hasFile ? 'outline' : 'default'}
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className={!hasFile ? 'bg-[#6d28d9] hover:bg-[#5b21b6] gap-1.5' : 'gap-1.5'}
            >
              <Upload className="h-3.5 w-3.5" />
              {hasFile ? 'Replace' : 'Upload File'}
            </Button>
            {hasFile && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="text-gray-400 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Step 3 — Preview & Import */}
        {hasPreview && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="p-4 flex items-center gap-4 border-b border-gray-100">
              <StepIndicator number={3} active={hasPreview} complete={false} />
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <p className="text-sm font-medium text-gray-900">Review &amp; import</p>
                {validCount > 0 && (
                  <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] font-medium">
                    <CheckCircle2 className="h-3 w-3 mr-1" />{validCount} valid
                  </Badge>
                )}
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] font-medium">
                    <XCircle className="h-3 w-3 mr-1" />{invalidCount} error{invalidCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>

            {/* Data preview table */}
            <div className="max-h-52 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80">
                    <TableHead className="w-14 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Row</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Phone</TableHead>
                    <TableHead className="w-20 text-[11px] font-semibold uppercase tracking-wider text-gray-500 text-center">Valid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row) => (
                    <TableRow key={row.rowNum} className={row.valid ? '' : 'bg-red-50/40'}>
                      <TableCell className="text-xs text-gray-400 font-mono">{row.rowNum}</TableCell>
                      <TableCell className="text-sm font-medium text-gray-900">
                        {row.data.firstName} {row.data.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{row.data.emailAddress}</TableCell>
                      <TableCell className="text-sm text-gray-500">{row.data.cellphoneNumber}</TableCell>
                      <TableCell className="text-center">
                        {row.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <div className="flex items-center justify-center gap-1" title={row.errors.join('; ')}>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-[10px] text-red-600 font-medium">{row.errors.length}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Validation warning */}
            {invalidCount > 0 && (
              <div className="mx-4 my-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <Info className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">
                  <strong>{invalidCount} row{invalidCount !== 1 ? 's' : ''}</strong> with validation errors will be skipped.
                  Only <strong>{validCount}</strong> valid row{validCount !== 1 ? 's' : ''} will be imported.
                </p>
              </div>
            )}

            {/* Import progress */}
            {isImporting && (
              <div className="px-4 pb-4 space-y-2">
                <Progress value={importProgress} className="h-1.5" />
                <p className="text-xs text-gray-400 text-center">Creating client accounts...</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2.5 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <Button variant="outline" onClick={onClose} disabled={isImporting} className="px-5">
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || validCount === 0}
                className="px-6 bg-[#6d28d9] hover:bg-[#5b21b6]"
              >
                {isImporting ? (
                  <div className="contents">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </div>
                ) : (
                  <div className="contents">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Import {validCount} Client{validCount !== 1 ? 's' : ''}
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Empty state footer — no file uploaded */}
      {!hasPreview && (
        <div className="flex justify-end gap-2.5 pt-1">
          <Button variant="outline" onClick={onClose} className="px-5">Cancel</Button>
        </div>
      )}
    </div>
  );
}
