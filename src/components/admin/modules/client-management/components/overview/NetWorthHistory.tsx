/**
 * Net Worth History — Phase 4
 *
 * Displays a historical line chart of net worth, total assets, and
 * total liabilities over time using KV snapshots. Includes a
 * "Take Snapshot" button that persists the current state.
 *
 * Guidelines §7.1 — pure data derivation for chart formatting.
 * Guidelines §8.3 — consistent colour vocabulary (green/red/purple).
 * Guidelines §8.4 — Design System components.
 * Guidelines §13  — fetch + state management in component; no TanStack
 *                    Query here to stay consistent with ClientOverviewTab's
 *                    direct fetch pattern.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import {
  TrendingUp,
  Camera,
  Loader2,
  History,
  Trash2,
  Info,
} from 'lucide-react';
import { SVGLineChart } from '../../../../../ui/svg-charts';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';
import { createClient as createSupabaseClient } from '../../../../../../utils/supabase/client';
import type { DashboardMode } from '../ClientOverviewTab';

// ── Types ───────────────────────────────────────────────────────────────

export interface NetWorthSnapshotData {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  policyCount: number;
  monthlyPremiums: number;
  retirementValue?: number;
  investmentValue?: number;
  createdAt: string;
  createdBy: string;
}

interface NetWorthHistoryProps {
  clientId: string;
  /** Current values for creating a new snapshot */
  currentTotalAssets: number;
  currentTotalLiabilities: number;
  currentNetWorth: number;
  currentPolicyCount: number;
  currentMonthlyPremiums: number;
  currentRetirementValue: number;
  currentInvestmentValue: number;
  /** Asset breakdown for snapshot storage */
  assetBreakdown?: Array<{ type: string; value: number }>;
  /** Liability breakdown for snapshot storage */
  liabilityBreakdown?: Array<{ type: string; balance: number }>;
  mode?: DashboardMode;
}

// ── Constants ───────────────────────────────────────────────────────────

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

const fmt = (n: number): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return 'R 0';
  return `R ${Number(n).toLocaleString('en-ZA')}`;
};

const fmtDate = (d: string): string => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `R ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};

// ── Date range filter presets ───────────────────────────────────────

type DateRange = '3m' | '6m' | '1y' | '2y' | 'all';

const DATE_RANGE_PRESETS: Array<{ value: DateRange; label: string }> = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
  { value: 'all', label: 'All' },
];

function getDateRangeStart(range: DateRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  switch (range) {
    case '3m': now.setMonth(now.getMonth() - 3); break;
    case '6m': now.setMonth(now.getMonth() - 6); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
    case '2y': now.setFullYear(now.getFullYear() - 2); break;
  }
  return now;
}

// ── Component ───────────────────────────────────────────────────────────

export function NetWorthHistory({
  clientId,
  currentTotalAssets,
  currentTotalLiabilities,
  currentNetWorth,
  currentPolicyCount,
  currentMonthlyPremiums,
  currentRetirementValue,
  currentInvestmentValue,
  assetBreakdown,
  liabilityBreakdown,
  mode = 'adviser',
}: NetWorthHistoryProps) {
  const isClient = mode === 'client';

  const [snapshots, setSnapshots] = useState<NetWorthSnapshotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // ── Auth helper ───────────────────────────────────────────────────

  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || publicAnonKey;
    } catch {
      return publicAnonKey;
    }
  }, []);

  // ── Fetch snapshots ───────────────────────────────────────────────

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${API_BASE}/net-worth-snapshots/${clientId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.snapshots)) {
        setSnapshots(data.snapshots);
      }
    } catch (err) {
      console.error('Error fetching net worth snapshots:', err);
      setError('Unable to load historical data.');
    } finally {
      setLoading(false);
    }
  }, [clientId, getAuthToken]);

  useEffect(() => {
    fetchSnapshots().catch(() => { /* handled internally */ });
  }, [fetchSnapshots]);

  // ── Create snapshot ───────────────────────────────────────────────

  const handleSnapshot = useCallback(async () => {
    setSnapshotting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAuthToken();
      const res = await fetch(
        `${API_BASE}/net-worth-snapshots/${clientId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            totalAssets: currentTotalAssets,
            totalLiabilities: currentTotalLiabilities,
            netWorth: currentNetWorth,
            policyCount: currentPolicyCount,
            monthlyPremiums: currentMonthlyPremiums,
            retirementValue: currentRetirementValue,
            investmentValue: currentInvestmentValue,
            assetBreakdown,
            liabilityBreakdown,
          }),
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server returned ${res.status}`);
      }
      setSuccessMsg('Snapshot saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      // Re-fetch to get updated list
      await fetchSnapshots();
    } catch (err) {
      console.error('Error creating net worth snapshot:', err);
      setError('Unable to save snapshot. Please try again.');
    } finally {
      setSnapshotting(false);
    }
  }, [
    clientId, currentTotalAssets, currentTotalLiabilities, currentNetWorth,
    currentPolicyCount, currentMonthlyPremiums, currentRetirementValue,
    currentInvestmentValue, assetBreakdown, liabilityBreakdown,
    getAuthToken, fetchSnapshots,
  ]);

  // ── Chart data ────────────────────────────────────────────────────

  const filteredSnapshots = useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    if (!rangeStart) return snapshots;
    const startStr = rangeStart.toISOString().slice(0, 10);
    return snapshots.filter(s => s.date >= startStr);
  }, [snapshots, dateRange]);

  const chartData = useMemo(() => {
    if (filteredSnapshots.length === 0) return [];
    return filteredSnapshots.map(s => ({
      date: fmtDate(s.date),
      rawDate: s.date,
      totalAssets: s.totalAssets,
      totalLiabilities: s.totalLiabilities,
      netWorth: s.netWorth,
    }));
  }, [filteredSnapshots]);

  const chartSeries = useMemo(() => [
    { key: 'netWorth', label: 'Net Worth', color: '#6d28d9', strokeWidth: 2.5 },
    { key: 'totalAssets', label: 'Assets', color: '#16a34a', strokeWidth: 1.5 },
    { key: 'totalLiabilities', label: 'Liabilities', color: '#dc2626', strokeWidth: 1.5 },
  ], []);

  // ── Trend calculation ─────────────────────────────────────────────

  const trend = useMemo(() => {
    if (filteredSnapshots.length < 2) return null;
    const first = filteredSnapshots[0];
    const last = filteredSnapshots[filteredSnapshots.length - 1];
    const change = last.netWorth - first.netWorth;
    const changePct = first.netWorth !== 0
      ? ((change / Math.abs(first.netWorth)) * 100).toFixed(1)
      : '—';
    return {
      change,
      changePct,
      isPositive: change >= 0,
      periodStart: first.date,
      periodEnd: last.date,
    };
  }, [filteredSnapshots]);

  // ── Today already captured? ───────────────────────────────────────

  const todayKey = new Date().toISOString().slice(0, 10);
  const hasTodaySnapshot = snapshots.some(s => s.date === todayKey);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-[#6d28d9]/10 flex-shrink-0">
            <History className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Net Worth Trend' : 'Net Worth History'}
          </CardTitle>
          {snapshots.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-500">
              {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {trend && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 ml-auto mr-2 ${
                trend.isPositive
                  ? 'border-green-200 text-green-700'
                  : 'border-red-200 text-red-600'
              }`}
            >
              {trend.isPositive ? '+' : ''}{fmtCompact(trend.change)} ({trend.changePct}%)
            </Badge>
          )}
          {!isClient && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 ml-auto print:hidden"
              onClick={handleSnapshot}
              disabled={snapshotting}
              title={hasTodaySnapshot ? "Update today's snapshot" : 'Take a snapshot of current net worth'}
            >
              {snapshotting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              {hasTodaySnapshot ? 'Update Snapshot' : 'Take Snapshot'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5">
        {/* Success message */}
        {successMsg && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-green-700">{successMsg}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
            <Info className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-600">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400 ml-2">Loading history...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <History className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">
              {isClient ? 'No history available yet' : 'No snapshots recorded'}
            </p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
              {isClient
                ? 'Your adviser will periodically record your net worth to track changes over time.'
                : 'Take your first snapshot to begin tracking this client\'s net worth over time. Snapshots capture assets, liabilities, and portfolio values.'}
            </p>
            {!isClient && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleSnapshot}
                disabled={snapshotting}
              >
                {snapshotting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
                Take First Snapshot
              </Button>
            )}
          </div>
        ) : (
          <div className="contents">
            {/* Line chart */}
            {chartData.length >= 2 ? (
              <div className="contents">
                {/* Date range filter */}
                {snapshots.length > 3 && (
                  <div className="flex items-center gap-1 mb-3 print:hidden">
                    <span className="text-[10px] text-gray-400 mr-1.5">Period:</span>
                    {DATE_RANGE_PRESETS.map(preset => (
                      <button
                        key={preset.value}
                        onClick={() => setDateRange(preset.value)}
                        className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                          dateRange === preset.value
                            ? 'bg-[#6d28d9] text-white border-[#6d28d9]'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    {dateRange !== 'all' && filteredSnapshots.length !== snapshots.length && (
                      <span className="text-[10px] text-gray-400 ml-1.5">
                        Showing {filteredSnapshots.length} of {snapshots.length}
                      </span>
                    )}
                  </div>
                )}
                <SVGLineChart
                  data={chartData}
                  categoryKey="date"
                  series={chartSeries}
                  height={220}
                  yAxisFormatter={fmtCompact}
                  tooltipFormatter={fmt}
                  showGrid
                />
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50/50 rounded-lg mb-3">
                <TrendingUp className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-1">
                  {isClient
                    ? 'One data point recorded so far'
                    : 'At least 2 snapshots needed for trend chart'}
                </p>
                <p className="text-[11px] text-gray-400">
                  Current: <span className={`font-medium ${currentNetWorth >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(currentNetWorth)}</span>
                  {' · '}First snapshot: {fmtDate(snapshots[0].date)}
                </p>
              </div>
            )}

            {/* Summary table of snapshots */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
                  Snapshot History
                </span>
                {trend && (
                  <span className="text-[10px] text-gray-400">
                    {fmtDate(trend.periodStart)} — {fmtDate(trend.periodEnd)}
                  </span>
                )}
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {[...snapshots].reverse().map((s) => (
                  <SnapshotRow key={s.date} snapshot={s} />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Snapshot Row ─────────────────────────────────────────────────────────

function SnapshotRow({ snapshot }: { snapshot: NetWorthSnapshotData }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-gray-50/70 hover:bg-gray-100/60 transition-colors">
      <span className="text-[11px] text-gray-500 w-[90px] flex-shrink-0">
        {fmtDate(snapshot.date)}
      </span>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="text-[10px] text-green-600">
          A: {fmtCompact(snapshot.totalAssets)}
        </span>
        <span className="text-[10px] text-red-500">
          L: {fmtCompact(snapshot.totalLiabilities)}
        </span>
        <span className={`text-[11px] font-semibold ${
          snapshot.netWorth >= 0 ? 'text-[#6d28d9]' : 'text-orange-600'
        }`}>
          NW: {fmtCompact(snapshot.netWorth)}
        </span>
      </div>
      <span className="text-[10px] text-gray-400 flex-shrink-0">
        {snapshot.policyCount} pol · {fmtCompact(snapshot.monthlyPremiums)}/m
      </span>
    </div>
  );
}