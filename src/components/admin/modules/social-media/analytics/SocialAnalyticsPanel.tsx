/**
 * Social analytics — Buffer's aggregated metrics across connected channels,
 * with a period selector and a client-side CSV export. Real data only: what
 * Buffer does not report is not shown.
 */
import { forwardRef } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Skeleton } from '../../../../ui/skeleton';
import { ErrorState, StatCard, useUrlState } from '../../../layout/page';
import { useSocialAnalytics } from '../hooks/useSocialAnalytics';
import { PERIODS, analyticsToCsv, engagementTotal, formatMetric } from './analyticsModel';

const PERIOD_IDS = PERIODS.map((p) => String(p.days));

export const SocialAnalyticsPanel = forwardRef<HTMLElement>(
  function SocialAnalyticsPanel(_props, ref) {
    const [period, setPeriod] = useUrlState<string>('period', '30', PERIOD_IDS);
    const days = Number(period);
    const query = useSocialAnalytics(days);
    const summary = query.data;
    const totals = summary?.totals;

    const exportCsv = () => {
      if (!summary) return;
      const blob = new Blob([analyticsToCsv(summary)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `social-analytics-${days}-days.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Analytics exported');
    };

    return (
      <section
        ref={ref}
        tabIndex={-1}
        aria-labelledby="social-analytics-h"
        className="space-y-4 rounded-xl border border-nw-line bg-white p-4 focus:outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="social-analytics-h" className="text-base font-semibold text-nw-ink">
              Social analytics
            </h3>
            <p className="text-sm text-nw-text-3">
              Performance across all connected platforms, from Buffer
              {summary?.metricsUpdatedAt
                ? ` · updated ${new Date(summary.metricsUpdatedAt).toLocaleString('en-ZA', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 w-[160px]" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.days} value={String(p.days)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
              disabled={!summary || summary.metrics.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="analytics-loading">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : query.error ? (
          <ErrorState
            title="Buffer metrics are unavailable"
            description={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total impressions" value={formatMetric(totals?.impressions)} />
              <StatCard label="Engagements" value={formatMetric(engagementTotal(totals))} />
              <StatCard label="Link clicks" value={formatMetric(totals?.clicks)} />
              <StatCard label="Posts published" value={formatMetric(totals?.postCount)} />
            </div>
            {summary.metrics.length === 0 ? (
              <p className="rounded-lg border border-dashed border-nw-line px-4 py-8 text-center text-sm text-nw-text-3">
                Buffer has no metrics for this period yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nw-line text-left text-xs text-nw-text-3">
                      <th className="py-2 pr-3 font-medium">Metric</th>
                      <th className="py-2 pr-3 text-right font-medium">Value</th>
                      <th className="py-2 font-medium">What it counts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.metrics.map((m) => (
                      <tr key={m.type} className="border-b border-nw-line last:border-0">
                        <td className="py-2 pr-3 font-medium text-nw-ink">{m.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatMetric(m.value, m.unit)}
                        </td>
                        <td className="py-2 text-nw-text-3">{m.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>
    );
  },
);
