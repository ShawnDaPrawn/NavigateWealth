/**
 * PortfolioUploadReport — what an uploaded portfolio sheet would change (the
 * preview), or did change (after Apply).
 *
 * Nothing is written while this shows a preview; Apply re-sends the same file
 * with `mode=apply`. Outcome counts that are zero are left out, so a clean
 * sheet reads as "3 rows · 3 will update" rather than a grid of zeros.
 */
import { CheckCircle2, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { Card } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import type {
  PortfolioApplyReport,
  PortfolioColumn,
  PortfolioRowStatus,
} from '@/shared/integrations/portfolio-table';
import { formatPortfolioValue, pluralise } from './portfolioFormat';

interface PortfolioUploadReportProps {
  report: PortfolioApplyReport;
  fileName: string | null;
  /** The book's columns, so changed values are shown the way the table shows them. */
  columns: PortfolioColumn[];
  canApply: boolean;
  isApplying: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

const STATUS_LABELS: Record<PortfolioRowStatus, string> = {
  updated: 'Updated',
  unchanged: 'Unchanged',
  unmatched: 'Unmatched',
  client_mismatch: 'Client mismatch',
  duplicate: 'Duplicate',
  invalid: 'Invalid',
  failed: 'Failed',
};

const TONES = {
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
  good: 'border-green-200 bg-green-50 text-green-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  bad: 'border-red-200 bg-red-50 text-red-800',
} as const;

const STATUS_TONES: Record<PortfolioRowStatus, keyof typeof TONES> = {
  updated: 'good',
  unchanged: 'neutral',
  unmatched: 'warn',
  client_mismatch: 'bad',
  duplicate: 'warn',
  invalid: 'bad',
  failed: 'bad',
};

const HEAD =
  'sticky top-0 z-10 h-9 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-gray-500';
const CELL = 'border-b border-gray-100 px-3 py-2.5 align-top text-sm text-gray-700';

export function PortfolioUploadReport({
  report,
  fileName,
  columns,
  canApply,
  isApplying,
  onApply,
  onDismiss,
}: PortfolioUploadReportProps) {
  const { summary } = report;
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const showChange = (fieldId: string, value: unknown) => {
    const column = columnById.get(fieldId);
    if (column) return formatPortfolioValue(column, value);
    return value === null || value === undefined || value === '' ? '—' : String(value);
  };

  const counters: Array<{
    label: string;
    value: number;
    tone: keyof typeof TONES;
    always?: boolean;
  }> = [
    { label: 'rows', value: summary.rows, tone: 'neutral', always: true },
    {
      label: report.dryRun ? 'will update' : 'updated',
      value: summary.updated,
      tone: 'good',
      always: true,
    },
    { label: 'unchanged', value: summary.unchanged, tone: 'neutral' },
    { label: 'unmatched', value: summary.unmatched, tone: 'warn' },
    { label: 'client mismatch', value: summary.clientMismatch, tone: 'bad' },
    { label: 'duplicate', value: summary.duplicate, tone: 'warn' },
    { label: 'invalid', value: summary.invalid, tone: 'bad' },
    { label: 'failed', value: summary.failed, tone: 'bad' },
  ];

  return (
    <Card className={cn('gap-0', report.dryRun ? 'border-purple-200' : 'border-green-200')}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              report.dryRun ? 'bg-purple-50' : 'bg-green-50',
            )}
          >
            {report.dryRun ? (
              <FileSpreadsheet className="h-5 w-5 text-purple-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-semibold text-gray-900">
              {report.dryRun ? `Preview: ${fileName || 'uploaded sheet'}` : 'Spreadsheet applied'}
            </h4>
            <p className="mt-0.5 text-sm text-gray-500">
              {report.dryRun
                ? 'Nothing has been saved yet. Check each row below, then apply the updates.'
                : `${pluralise(summary.updated, 'policy', 'policies')} updated across ${pluralise(
                    summary.clientsTouched,
                    'client',
                    'clients',
                  )}.`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss report">
          <X className="h-4 w-4 text-gray-400" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 px-6 pt-4">
        {counters
          .filter((counter) => counter.always || counter.value > 0)
          .map((counter) => (
            <span
              key={counter.label}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                TONES[counter.tone],
              )}
            >
              <span className="font-semibold tabular-nums">{counter.value}</span>
              <span>{counter.label}</span>
            </span>
          ))}
      </div>

      {report.warnings.length > 0 && (
        <ul className="mx-6 mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {report.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="px-6 pt-4 pb-6">
        <div className="max-h-[40vh] overflow-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className={cn(HEAD, 'w-14')}>
                  Row
                </th>
                <th scope="col" className={cn(HEAD, 'min-w-[12rem]')}>
                  Client
                </th>
                <th scope="col" className={HEAD}>
                  Policy Number
                </th>
                <th scope="col" className={HEAD}>
                  Outcome
                </th>
                <th scope="col" className={cn(HEAD, 'min-w-[18rem]')}>
                  Changes
                </th>
                <th scope="col" className={HEAD}>
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((outcome) => {
                const notes = [...outcome.errors, ...outcome.warnings];
                return (
                  <tr key={`${outcome.rowNumber}-${outcome.policyNumber}`}>
                    <td className={cn(CELL, 'tabular-nums text-gray-500')}>{outcome.rowNumber}</td>
                    <td className={CELL}>
                      <span className="font-medium text-gray-900">{outcome.clientName || '—'}</span>
                      {outcome.matchedClientName && outcome.status === 'client_mismatch' && (
                        <span className="mt-0.5 block text-xs text-gray-500">
                          On record: {outcome.matchedClientName}
                        </span>
                      )}
                    </td>
                    <td className={cn(CELL, 'whitespace-nowrap')}>{outcome.policyNumber || '—'}</td>
                    <td className={CELL}>
                      <Badge
                        variant="outline"
                        className={cn(
                          'whitespace-nowrap text-[11px]',
                          TONES[STATUS_TONES[outcome.status]],
                        )}
                      >
                        {STATUS_LABELS[outcome.status]}
                      </Badge>
                    </td>
                    <td className={CELL}>
                      {outcome.changes.length > 0 ? (
                        <ul className="space-y-1">
                          {outcome.changes.map((change) => (
                            <li
                              key={change.fieldId}
                              className="whitespace-nowrap text-xs leading-5"
                            >
                              <span className="font-medium text-gray-900">{change.fieldName}</span>{' '}
                              <span className="text-gray-500 line-through decoration-gray-300">
                                {showChange(change.fieldId, change.oldValue)}
                              </span>{' '}
                              <span aria-hidden="true" className="text-gray-400">
                                &rarr;
                              </span>
                              <span className="sr-only">changes to</span>{' '}
                              <span className="font-medium text-gray-900">
                                {showChange(change.fieldId, change.newValue)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-400">No changes</span>
                      )}
                    </td>
                    <td className={CELL}>
                      {notes.length > 0 ? (
                        <ul className="max-w-sm space-y-1 text-xs leading-5 text-amber-800">
                          {notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {report.dryRun && (
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={!canApply || summary.updated === 0 || isApplying}
            onClick={onApply}
          >
            {isApplying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {summary.updated > 0
              ? `Apply ${pluralise(summary.updated, 'update', 'updates')}`
              : 'Nothing to apply'}
          </Button>
        </div>
      )}
    </Card>
  );
}
