/**
 * Refund Manager overview — the Accounts → Overview tab.
 *
 * A cross-cluster dashboard: every (active) refund cluster's current-period VAT
 * position (payable or refund) in one table, filterable by when the VAT201
 * return is due, with the combined net position across the shown clusters in
 * Rand. Read-only — editing lives inside each cluster's own detail view.
 */

import { useMemo, useState } from 'react';
import { CalendarClock, Layers } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Skeleton } from '../../../../../ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import {
  useClusterDetails,
  useManyEntityTransactions,
  useRefundClusters,
} from '../hooks/useRefundClusters';
import { SubPanelHeader } from './SubPanelHeader';
import { StatCard } from '../../../../layout/page';
import {
  currentVatPeriod,
  dueDateBucket,
  formatIsoDate,
  formatZar,
  round2,
  summarizeTransactions,
  vatSubmissionDueDate,
  type DueDateBucket,
  type VatStatus,
} from '../vat';
import type { RefundTransaction } from '../types';

type DueFilter = 'all' | DueDateBucket | 'no-date';

const DUE_FILTER_OPTIONS: Array<{ value: DueFilter; label: string }> = [
  { value: 'all', label: 'All due dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'this-month', label: 'Due this month' },
  { value: 'next-month', label: 'Due next month' },
  { value: 'later', label: 'Due later' },
  { value: 'no-date', label: 'No VAT category' },
];

interface ClusterPositionRow {
  id: string;
  name: string;
  periodLabel: string | null;
  dueDate: string | null;
  entityCount: number;
  outputVat: number;
  inputVat: number;
  netVat: number;
  status: VatStatus;
}

const NET_TEXT: Record<VatStatus, string> = {
  refundable: 'text-green-700',
  payable: 'text-amber-700',
  nil: 'text-muted-foreground',
};

function netLabel(status: VatStatus): string {
  if (status === 'payable') return 'Payable to SARS';
  if (status === 'refundable') return 'Refund due';
  return 'Nil';
}

const BUCKET_BADGE: Record<DueDateBucket, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  'this-month': {
    label: 'This month',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  'next-month': { label: 'Next month', className: 'bg-sky-100 text-sky-800 hover:bg-sky-100' },
  later: { label: 'Later', className: 'bg-muted text-muted-foreground hover:bg-muted' },
};

export function RefundManagerPanel() {
  const [filter, setFilter] = useState<DueFilter>('all');

  const { data: clusters = [], isLoading: clustersLoading } = useRefundClusters();
  const activeClusters = useMemo(() => clusters.filter((c) => !c.archived), [clusters]);
  const clusterIds = useMemo(() => activeClusters.map((c) => c.id), [activeClusters]);

  const detailResults = useClusterDetails(clusterIds);

  // (clusterId, entityId) pairs across every active cluster, in detail order.
  const pairs: Array<{ clusterId: string; entityId: string }> = [];
  detailResults.forEach((result) => {
    if (!result.data) return;
    for (const entity of result.data.entities) {
      pairs.push({ clusterId: result.data.cluster.id, entityId: entity.id });
    }
  });

  const txnResults = useManyEntityTransactions(pairs);
  const txnByEntity = new Map<string, RefundTransaction[]>();
  pairs.forEach((pair, index) => {
    txnByEntity.set(pair.entityId, txnResults[index]?.data ?? []);
  });

  const loading =
    clustersLoading ||
    detailResults.some((r) => r.isLoading) ||
    txnResults.some((r) => r.isLoading);

  const rows: ClusterPositionRow[] = activeClusters.map((cluster, index) => {
    const entities = detailResults[index]?.data?.entities ?? [];
    const period = currentVatPeriod(cluster.vatPeriod, undefined, cluster.vatYearEndMonth);
    let outputVat = 0;
    let inputVat = 0;
    for (const entity of entities) {
      const summary = summarizeTransactions(txnByEntity.get(entity.id) ?? [], period);
      outputVat += summary.outputVat;
      inputVat += summary.inputVat;
    }
    outputVat = round2(outputVat);
    inputVat = round2(inputVat);
    const netVat = round2(outputVat - inputVat);
    return {
      id: cluster.id,
      name: cluster.name,
      periodLabel: period ? period.label : null,
      dueDate: period ? vatSubmissionDueDate(period) : null,
      entityCount: entities.length,
      outputVat,
      inputVat,
      netVat,
      status: netVat < 0 ? 'refundable' : netVat > 0 ? 'payable' : 'nil',
    };
  });

  // Soonest due first; clusters with no due date sink to the bottom.
  const sortedRows = [...rows].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.name.localeCompare(b.name);
  });

  const filteredRows = sortedRows.filter((row) => {
    if (filter === 'all') return true;
    if (filter === 'no-date') return !row.dueDate;
    if (!row.dueDate) return false;
    return dueDateBucket(row.dueDate) === filter;
  });

  const totalOutput = round2(filteredRows.reduce((sum, r) => sum + r.outputVat, 0));
  const totalInput = round2(filteredRows.reduce((sum, r) => sum + r.inputVat, 0));
  const netTotal = round2(totalOutput - totalInput);
  const netStatus: VatStatus = netTotal < 0 ? 'refundable' : netTotal > 0 ? 'payable' : 'nil';

  const overdueCount = rows.filter(
    (r) => r.dueDate && dueDateBucket(r.dueDate) === 'overdue',
  ).length;
  const dueThisMonthCount = rows.filter(
    (r) => r.dueDate && dueDateBucket(r.dueDate) === 'this-month',
  ).length;

  return (
    <div className="space-y-4">
      <SubPanelHeader
        icon={<Layers />}
        title="VAT overview"
        subtitle="Current-period VAT position for every active refund cluster."
        actions={
          <>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(value) => setFilter(value as DueFilter)}>
              <SelectTrigger className="w-[190px]" aria-label="Filter by due date">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DUE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={netStatus === 'refundable' ? 'Net refund due' : 'Net VAT payable'}
          value={<span className={NET_TEXT[netStatus]}>{formatZar(Math.abs(netTotal))}</span>}
          meta={netStatus === 'nil' ? 'No VAT this period' : netLabel(netStatus)}
        />
        <StatCard
          label="Clusters shown"
          value={filteredRows.length}
          meta={`of ${activeClusters.length} active`}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          meta="returns past due"
          tone={overdueCount > 0 ? 'attention' : 'default'}
        />
        <StatCard label="Due this month" value={dueThisMonthCount} meta="returns to file" />
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : activeClusters.length === 0 ? (
        <div className="border border-dashed rounded-lg p-10 text-center text-sm text-muted-foreground">
          No active refund clusters yet. Create one under Refund clusters.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cluster</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Entities</TableHead>
                <TableHead className="text-right">VAT Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No clusters match this due-date filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const bucket = row.dueDate ? dueDateBucket(row.dueDate) : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.periodLabel ?? '—'}
                      </TableCell>
                      <TableCell>
                        {row.dueDate ? (
                          <div className="flex items-center gap-2">
                            <span>{formatIsoDate(row.dueDate)}</span>
                            {bucket && (
                              <Badge className={BUCKET_BADGE[bucket].className}>
                                {BUCKET_BADGE[bucket].label}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No VAT category</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.entityCount}</TableCell>
                      <TableCell className="text-right">
                        <VatPositionCell netVat={row.netVat} status={row.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {filteredRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className={`font-semibold ${NET_TEXT[netStatus]}`}>
                    {netStatus === 'refundable'
                      ? 'Combined refund due'
                      : netStatus === 'payable'
                        ? 'Combined VAT payable'
                        : 'Combined net VAT'}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${NET_TEXT[netStatus]}`}
                  >
                    {formatZar(Math.abs(netTotal))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
    </div>
  );
}

function VatPositionCell({ netVat, status }: { netVat: number; status: VatStatus }) {
  const className =
    status === 'refundable'
      ? 'bg-green-100 text-green-800 hover:bg-green-100'
      : status === 'payable'
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
        : 'bg-muted text-muted-foreground hover:bg-muted';
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className="tabular-nums font-medium">{formatZar(Math.abs(netVat))}</span>
      <Badge className={className}>{netLabel(status)}</Badge>
    </div>
  );
}
