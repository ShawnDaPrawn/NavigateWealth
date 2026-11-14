/**
 * Create report (design RP 6): name, category, data source, columns and
 * export format. The data sources are the built-in exports, so every saved
 * report can be run through the same export path.
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
import { REPORT_DATA_SOURCES, REPORT_SOURCES, type ReportDataSource } from '../reportSources';

export interface NewReportDefinition {
  name: string;
  category: ReportCategory;
  dataSource: ReportDataSource;
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

/** A new report starts with the source's first few columns. */
const defaultColumns = (source: ReportDataSource) => REPORT_SOURCES[source].columns.slice(0, 4);

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
  const [dataSource, setDataSource] = useState<ReportDataSource>('personal-clients');
  const [columns, setColumns] = useState<string[]>(() => defaultColumns('personal-clients'));
  const [errors, setErrors] = useState<{ name?: string; columns?: string }>({});

  const addable = REPORT_SOURCES[dataSource].columns.filter((c) => !columns.includes(c));

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
                  const next = v as ReportDataSource;
                  setDataSource(next);
                  setColumns(defaultColumns(next));
                }}
              >
                <SelectTrigger id="create-report-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_DATA_SOURCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {REPORT_SOURCES[value].label}
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
