/**
 * Cluster-level SARS submission pack download: pick one of the recent VAT
 * periods (derived from the cluster's category) and download a ZIP containing
 * a full pack per entity.
 */

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { useDownloadClusterSubmissionPack } from '../hooks/useRefundClusters';
import { recentVatPeriods } from '../vat';
import type { RefundCluster } from '../types';

export function ClusterPackButton({ cluster }: { cluster: RefundCluster }) {
  const [offset, setOffset] = useState(0);
  const download = useDownloadClusterSubmissionPack();
  const periods = useMemo(
    () => recentVatPeriods(cluster.vatPeriod, 6, undefined, cluster.vatYearEndMonth),
    [cluster.vatPeriod, cluster.vatYearEndMonth],
  );
  const period = periods[offset] ?? null;
  if (periods.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Select value={String(offset)} onValueChange={(v) => setOffset(Number(v))}>
        <SelectTrigger className="h-8 w-auto min-w-[170px] text-xs" aria-label="Pack VAT period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periods.map((p, i) => (
            <SelectItem key={p.start} value={String(i)}>
              {i === 0 ? 'Current' : i === 1 ? 'Previous' : `${i} periods ago`} · {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={!period || download.isPending}
        onClick={() =>
          period &&
          download.mutate({
            clusterId: cluster.id,
            periodStart: period.start,
            periodEnd: period.end,
            periodLabel: `${period.label} (Category ${cluster.vatPeriod || '—'})`,
          })
        }
      >
        <Download className="h-4 w-4 mr-1" />
        {download.isPending ? 'Generating…' : 'Submission Packs'}
      </Button>
    </div>
  );
}
