/**
 * PortfolioGrid — the portfolio book as a table, one row per client policy.
 *
 * Laid out for a wide book in a narrow panel:
 * - One scroll container for both axes, so the header stays put while rows
 *   scroll and the horizontal scrollbar sits at the bottom of the visible
 *   area rather than under the last row.
 * - Client is pinned on the left. Last Updated and Policy Print are pinned on
 *   the right once the container is wide enough to spare the room
 *   (`@3xl/portfolio`), so the two columns an adviser checks first never
 *   scroll out of view; the product fields scroll between them.
 * - `border-separate` rather than collapsed borders: a collapsed border belongs
 *   to the table, so it stays behind when a pinned cell scrolls over it.
 * - Every header sorts; empty cells sort last in either direction.
 */
import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FileText,
  KeyRound,
  Loader2,
  Lock,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import type {
  PortfolioColumn,
  PortfolioRow,
  PortfolioTable,
} from '@/shared/integrations/portfolio-table';
import {
  CLIENT_SORT_KEY,
  UPDATED_SORT_KEY,
  describeSyncSource,
  formatPortfolioDate,
  formatPortfolioDateTime,
  formatPortfolioValue,
  isNumericColumn,
  type PortfolioSort,
} from './portfolioFormat';

interface PortfolioGridProps {
  table: PortfolioTable;
  /** The rows to show, already searched and sorted. */
  rows: PortfolioRow[];
  sort: PortfolioSort;
  onSort: (key: string) => void;
  openingPrintFor: string | null;
  onOpenPrint: (row: PortfolioRow) => void;
}

const HEAD =
  'sticky top-0 z-20 h-10 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-gray-500';
const CELL =
  'h-11 whitespace-nowrap border-b border-gray-100 bg-white px-3 align-middle text-sm text-gray-700 transition-colors group-hover:bg-gray-50 group-last:border-b-0';

/** Client: always pinned, with an edge shadow while fields scroll beneath it. */
const PIN_LEFT =
  'sticky left-0 border-r border-gray-200 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.15)]';
/**
 * Last Updated sits immediately left of Policy Print, so its offset is the
 * print column's width — the two literals below must stay equal.
 */
const PIN_RIGHT_UPDATED =
  '@3xl/portfolio:sticky @3xl/portfolio:right-[9.5rem] @3xl/portfolio:border-l @3xl/portfolio:border-gray-200 @3xl/portfolio:shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]';
const PIN_RIGHT_PRINT =
  'w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem] @3xl/portfolio:sticky @3xl/portfolio:right-0';

function ariaSort(sort: PortfolioSort, key: string): React.AriaAttributes['aria-sort'] {
  if (sort.key !== key) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

function SortButton({
  label,
  sortKey,
  sort,
  onSort,
  alignRight = false,
  children,
}: {
  label: string;
  sortKey: string;
  sort: PortfolioSort;
  onSort: (key: string) => void;
  alignRight?: boolean;
  children?: React.ReactNode;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm text-[11px] font-semibold uppercase tracking-wider hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
        active ? 'text-gray-900' : 'text-gray-500',
        alignRight && 'flex-row-reverse',
      )}
    >
      <span>{label}</span>
      {children}
      <Icon className={cn('h-3 w-3 shrink-0', !active && 'text-gray-300')} aria-hidden="true" />
    </button>
  );
}

export function PortfolioGrid({
  table,
  rows,
  sort,
  onSort,
  openingPrintFor,
  onOpenPrint,
}: PortfolioGridProps) {
  const describeLastUpdate = (row: PortfolioRow) =>
    row.lastSync
      ? `Last automated update: ${describeSyncSource(row.lastSync.source)}, ${formatPortfolioDateTime(
          row.lastSync.publishedAt,
        )}`
      : 'No automated update on record';

  const renderValue = (row: PortfolioRow, column: PortfolioColumn) => {
    const text = formatPortfolioValue(column, row.values[column.id]);
    if (column.type === 'long_text' && text !== '—') {
      return (
        <span className="block max-w-[16rem] truncate" title={text}>
          {text}
        </span>
      );
    }
    return text;
  };

  return (
    <div
      role="region"
      aria-label={`${table.providerName} ${table.categoryLabel} portfolio`}
      tabIndex={0}
      className="@container/portfolio max-h-[60vh] overflow-auto rounded-lg border border-gray-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
    >
      <table className="w-full min-w-max border-separate border-spacing-0">
        <caption className="sr-only">
          {table.providerName} {table.categoryLabel} policies, one row per client policy
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(HEAD, PIN_LEFT, 'z-30')}
              aria-sort={ariaSort(sort, CLIENT_SORT_KEY)}
            >
              <SortButton label="Client" sortKey={CLIENT_SORT_KEY} sort={sort} onSort={onSort} />
            </th>
            {table.columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(HEAD, isNumericColumn(column) && 'text-right')}
                aria-sort={ariaSort(sort, column.id)}
              >
                <SortButton
                  label={column.name}
                  sortKey={column.id}
                  sort={sort}
                  onSort={onSort}
                  alignRight={isNumericColumn(column)}
                >
                  {column.isPolicyNumber && (
                    <span
                      className="inline-flex text-purple-600"
                      title="Match key: an uploaded row is matched to its policy by client name and this number"
                    >
                      <KeyRound className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">(match key)</span>
                    </span>
                  )}
                </SortButton>
              </th>
            ))}
            <th
              scope="col"
              className={cn(HEAD, PIN_RIGHT_UPDATED, '@3xl/portfolio:z-30')}
              aria-sort={ariaSort(sort, UPDATED_SORT_KEY)}
            >
              <SortButton
                label="Last Updated"
                sortKey={UPDATED_SORT_KEY}
                sort={sort}
                onSort={onSort}
              />
            </th>
            <th scope="col" className={cn(HEAD, PIN_RIGHT_PRINT, '@3xl/portfolio:z-30')}>
              Policy Print
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.policyId} className="group">
              <th
                scope="row"
                className={cn(CELL, PIN_LEFT, 'z-10 text-left font-medium text-gray-900')}
              >
                <span className="block max-w-[13rem] truncate" title={row.clientName}>
                  {row.clientName}
                </span>
              </th>
              {table.columns.map((column) => {
                const locked = row.lockedFields.includes(column.id);
                return (
                  <td
                    key={column.id}
                    className={cn(
                      CELL,
                      isNumericColumn(column) && 'text-right tabular-nums',
                      column.isPolicyNumber && 'font-medium text-gray-900',
                    )}
                    title={
                      locked ? `${column.name} is locked against automated updates` : undefined
                    }
                  >
                    {locked && (
                      <Lock
                        className="mr-1 inline h-3 w-3 align-[-1px] text-gray-400"
                        aria-label="Locked"
                      />
                    )}
                    {renderValue(row, column)}
                  </td>
                );
              })}
              <td
                className={cn(CELL, PIN_RIGHT_UPDATED, 'tabular-nums @3xl/portfolio:z-10')}
                title={describeLastUpdate(row)}
              >
                {formatPortfolioDateTime(row.updatedAt)}
              </td>
              <td className={cn(CELL, PIN_RIGHT_PRINT, '@3xl/portfolio:z-10')}>
                {row.policyPrint ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs font-medium"
                    disabled={openingPrintFor === row.policyId}
                    onClick={() => onOpenPrint(row)}
                    // Starts with the visible date, so a voice-control user
                    // can say what they see (WCAG 2.5.3, label in name).
                    aria-label={`${formatPortfolioDate(
                      row.policyPrint.uploadDate,
                    )}: open the policy print for ${row.clientName} (${
                      row.policyNumber || 'no policy number'
                    })`}
                    title={`${row.policyPrint.fileName} · uploaded ${formatPortfolioDateTime(
                      row.policyPrint.uploadDate,
                    )}`}
                  >
                    {openingPrintFor === row.policyId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                    )}
                    {formatPortfolioDate(row.policyPrint.uploadDate)}
                  </Button>
                ) : (
                  <span className="text-xs text-gray-400">None on file</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
