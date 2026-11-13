/**
 * Create report (design RP 6): name, category, data source, columns and
 * export format. "New report" stays switched off until the server can store
 * a report definition (there is no create endpoint; the five reports are
 * built in), so this dialog only needs wiring.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { FormErrorBanner } from '../../../layout/page';
import type { ReportCategory } from '../types';

export interface NewReportDefinition {
  name: string;
  category: ReportCategory;
  dataSource: string;
  columns: string[];
  format: 'xlsx';
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'clients', label: 'Clients' },
  { value: 'activity', label: 'Activity' },
  { value: 'financial', label: 'Financial' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'custom', label: 'Custom' },
];

const DATA_SOURCES: { value: string; label: string; columns: string[] }[] = [
  {
    value: 'personal-clients',
    label: 'Personal clients',
    columns: ['Name', 'Email', 'Phone', 'Adviser', 'Status', 'Joined'],
  },
  {
    value: 'applications',
    label: 'Applications',
    columns: ['Applicant', 'Status', 'Adviser', 'Submitted', 'Processing time'],
  },
  {
    value: 'fna',
    label: 'Financial needs analyses',
    columns: ['Client', 'Type', 'Status', 'Adviser', 'Completed'],
  },
];

const DEFAULT_COLUMNS = ['Name', 'Email', 'Adviser', 'Joined'];

interface CreateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (definition: NewReportDefinition) => void;
  submitting?: boolean;
}

export function CreateReportDialog({
  open,
  onOpenChange,
  onCreate,
  submitting = false,
}: CreateReportDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ReportCategory>('clients');
  const [dataSource, setDataSource] = useState(DATA_SOURCES[0].value);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [errors, setErrors] = useState<{ name?: string; columns?: string }>({});

  const source = DATA_SOURCES.find((s) => s.value === dataSource) ?? DATA_SOURCES[0];
  const addable = source.columns.filter((c) => !columns.includes(c));

  const submit = () => {
    const found: { name?: string; columns?: string } = {};
    if (!name.trim()) found.name = 'Give the report a name';
    if (columns.length === 0) found.columns = 'Add at least one column';
    setErrors(found);
    if (found.name || found.columns) {
      if (found.name) document.getElementById('create-report-name')?.focus();
      return;
    }
    onCreate({ name: name.trim(), category, dataSource, columns, format: 'xlsx' });
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create report</DialogTitle>
          <DialogDescription>
            Choose what the report covers and which columns it has.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormErrorBanner count={errorCount} action="create the report" />
          <div className="space-y-2">
            <Label htmlFor="create-report-name">Report name</Label>
            <Input
              id="create-report-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'create-report-name-error' : undefined}
              className={errors.name ? 'border-red-400 focus-visible:ring-red-400' : undefined}
            />
            {errors.name && (
              <p id="create-report-name-error" className="text-xs text-red-600">
                {errors.name}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-report-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                <SelectTrigger id="create-report-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-report-source">Data source</Label>
              <Select
                value={dataSource}
                onValueChange={(v) => {
                  setDataSource(v);
                  const next = DATA_SOURCES.find((s) => s.value === v);
                  setColumns(next ? next.columns.slice(0, 4) : []);
                }}
              >
                <SelectTrigger id="create-report-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label id="create-report-columns">Columns</Label>
            <div
              role="group"
              aria-labelledby="create-report-columns"
              className="flex flex-wrap items-center gap-1.5"
            >
              {columns.map((col) => (
                <span
                  key={col}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-nw-line bg-white pr-1 pl-2.5 text-xs"
                >
                  {col}
                  <button
                    type="button"
                    aria-label={`Remove ${col}`}
                    className="rounded-full p-0.5 text-nw-text-3 hover:text-nw-ink"
                    onClick={() => setColumns(columns.filter((c) => c !== col))}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {addable.length > 0 && (
                <Select
                  value=""
                  onValueChange={(v) => {
                    setColumns([...columns, v]);
                    if (errors.columns) setErrors({ ...errors, columns: undefined });
                  }}
                >
                  <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Add column">
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    Add column
                  </SelectTrigger>
                  <SelectContent>
                    {addable.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {errors.columns && <p className="text-xs text-red-600">{errors.columns}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-report-format">Export format</Label>
            <Select value="xlsx" disabled>
              <SelectTrigger id="create-report-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Currently only Excel format is supported.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              Create report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
