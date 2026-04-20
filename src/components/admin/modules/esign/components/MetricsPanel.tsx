/**
 * P7.1 — Metrics dashboard panel.
 *
 * Presents the org's e-signature health at a glance. Renders:
 *   • Status counts (draft / sent / partially signed / completed /
 *     declined / expired / voided).
 *   • A four-step funnel with per-stage conversion percentages.
 *   • Time-to-sign — average + median + per-template breakdown.
 *   • Stuck envelopes (sent ≥ 7 days ago with no view) — up to 10.
 *   • A 30-day throughput sparkline.
 *
 * All data comes from `esignApi.getMetrics()`, which is firm-scoped
 * on the server. The panel owns its own loading state so it can be
 * lazy-mounted inside the dashboard tabs without blocking the
 * overview view.
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Loader2, RefreshCw, AlertTriangle, TrendingUp, Clock, Activity } from 'lucide-react';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';
import { SkeletonCardGrid, SkeletonStack } from './EsignSkeleton';

type MetricsBundle = Awaited<ReturnType<typeof esignApi.getMetrics>>;

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH === 0 ? `${days}d` : `${days}d ${remH}h`;
}

function daysLabel(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

export function MetricsPanel({ onOpenEnvelope }: { onOpenEnvelope?: (envelopeId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await esignApi.getMetrics();
      setMetrics(data);
    } catch (err) {
      logger.error('Failed to load metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const maxThroughput = useMemo(() => {
    if (!metrics) return 1;
    return Math.max(1, ...metrics.throughput30d.map((p) => p.completed));
  }, [metrics]);

  if (loading && !metrics) {
    // P8.3 — Replace the unstyled spinner with a content-shaped skeleton
    // so the perceived load time matches what's about to appear.
    return (
      <div className="space-y-6">
        <SkeletonCardGrid cards={4} />
        <SkeletonStack rows={6} />
      </div>
    );
  }
  if (error && !metrics) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
          <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
        </CardContent>
      </Card>
    );
  }
  if (!metrics) return null;

  const { statusCounts, funnel, timeToSign, stuckEnvelopes, throughput30d } = metrics;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Org metrics</h3>
          <p className="text-xs text-muted-foreground">
            Live view of firm-wide e-signature activity.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? (
            <div className="contents">
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Refreshing
            </div>
          ) : (
            <div className="contents">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </div>
          )}
        </Button>
      </div>

      {/* Status counts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-600" /> Status breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            {statusCounts.total} envelope{statusCounts.total === 1 ? '' : 's'} in total.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
            {([
              ['Draft', statusCounts.draft, 'bg-gray-100 text-gray-700'],
              ['Sent', statusCounts.sent, 'bg-blue-50 text-blue-700'],
              ['Viewed', statusCounts.viewed, 'bg-sky-50 text-sky-700'],
              ['Partial', statusCounts.partially_signed, 'bg-purple-50 text-purple-700'],
              ['Completing', statusCounts.completing ?? 0, 'bg-amber-50 text-amber-700'],
              ['Completed', statusCounts.completed, 'bg-emerald-50 text-emerald-700'],
              ['Declined', statusCounts.declined, 'bg-rose-50 text-rose-700'],
              ['Expired', statusCounts.expired, 'bg-orange-50 text-orange-700'],
              ['Voided', statusCounts.voided, 'bg-zinc-100 text-zinc-700'],
            ] as const).map(([label, count, tone]) => (
              <div key={label} className={`rounded-md p-3 ${tone}`}>
                <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
                <div className="text-lg font-semibold">{count}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" /> Signing funnel
            </CardTitle>
            <CardDescription className="text-xs">
              Sent → opened → started → completed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {([
              ['Sent', funnel.sent, null],
              ['Opened', funnel.opened, funnel.sentToOpenedPct],
              ['Started', funnel.started, funnel.openedToStartedPct],
              ['Completed', funnel.completed, funnel.startedToCompletedPct],
            ] as const).map(([label, count, conv]) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-700">{label}</div>
                <div className="flex-1">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-[width]"
                      style={{ width: `${funnel.sent ? Math.max(2, (count / funnel.sent) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                <div className="w-28 text-right text-xs text-gray-600">
                  {count}
                  {conv != null && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({conv}%)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Time to sign */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" /> Time to sign
            </CardTitle>
            <CardDescription className="text-xs">
              Measured sent → completed on {timeToSign.completedCount} envelope
              {timeToSign.completedCount === 1 ? '' : 's'}.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-purple-50 p-3">
                <div className="text-[10px] uppercase text-purple-700">Average</div>
                <div className="text-lg font-semibold text-purple-900">
                  {formatDuration(timeToSign.averageMs)}
                </div>
              </div>
              <div className="rounded-md bg-emerald-50 p-3">
                <div className="text-[10px] uppercase text-emerald-700">Median</div>
                <div className="text-lg font-semibold text-emerald-900">
                  {formatDuration(timeToSign.medianMs)}
                </div>
              </div>
            </div>
            {timeToSign.byTemplate.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Top templates
                </div>
                <ul className="space-y-1 text-xs">
                  {timeToSign.byTemplate.slice(0, 5).map((entry) => (
                    <li
                      key={entry.templateId ?? 'none'}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-gray-700">
                        {entry.templateId || '— ad-hoc —'}
                      </span>
                      <span className="text-gray-500 tabular-nums">
                        {entry.count}× · avg {formatDuration(entry.averageMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stuck envelopes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Stuck envelopes
          </CardTitle>
          <CardDescription className="text-xs">
            Sent ≥ 7 days ago but never opened — worth a nudge.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {stuckEnvelopes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No stuck envelopes right now.</p>
          ) : (
            <ul className="divide-y">
              {stuckEnvelopes.map((envelope) => (
                <li
                  key={envelope.id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {envelope.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {envelope.signer_count} signer{envelope.signer_count === 1 ? '' : 's'} · idle {daysLabel(envelope.days_since_sent)}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {daysLabel(envelope.days_since_sent)}
                  </Badge>
                  {onOpenEnvelope && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => onOpenEnvelope(envelope.id)}
                    >
                      Open
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 30-day throughput sparkline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-600" /> Completions · last 30 days
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-end gap-0.5 h-24">
            {throughput30d.map((point) => {
              const height = (point.completed / maxThroughput) * 100;
              return (
                <div
                  key={point.date}
                  title={`${point.date}: ${point.completed}`}
                  className="flex-1 bg-purple-500/70 rounded-sm min-h-[1px]"
                  style={{ height: `${Math.max(1, height)}%` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{throughput30d[0]?.date ?? ''}</span>
            <span>{throughput30d[throughput30d.length - 1]?.date ?? ''}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
