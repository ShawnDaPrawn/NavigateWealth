/**
 * Overview Visualisation Charts — Phase 2
 *
 * Provides four chart components for the Client Overview tab:
 *   1. AssetAllocationChart  — donut pie of asset categories + portfolio values
 *   2. InsuranceCoverageChart — grouped bar: existing vs recommended per risk type
 *   3. CashflowWaterfallChart — waterfall: income → deductions → premiums → disposable
 *   4. ActionPriorityBar       — compact stacked bar showing action item distribution
 *
 * All charts use the existing SVG chart library at /components/ui/svg-charts.tsx.
 * No new API calls — all data is derived from existing overview tab state.
 *
 * Guidelines §7.1 — display only; data prep is done in the parent via useMemo.
 * Guidelines §8.3 — status colour vocabulary.
 * Guidelines §8.4 — Design System components for card containers.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import {
  SVGPieChart,
  SVGBarChart,
} from '../../../../../ui/svg-charts';
import type { PieSlice, BarChartSeries } from '../../../../../ui/svg-charts';
import {
  PieChart as PieChartIcon,
  ShieldCheck,
  ArrowDownUp,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type { DashboardMode } from '../ClientOverviewTab';

// ── Shared formatting ──────────────────────────────────────────────────

const ZAR = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtCurrency(v: number): string {
  return ZAR.format(v);
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R ${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1_000) return `R ${(v / 1_000).toFixed(0)}k`;
  return fmtCurrency(v);
}

// ═══════════════════════════════════════════════════════════════════════
// 1. ASSET ALLOCATION DONUT
// ═══════════════════════════════════════════════════════════════════════

/** Colour palette for asset categories — consistent with Design System */
const ASSET_COLORS: Record<string, string> = {
  property: '#6d28d9',      // brand purple
  retirement: '#16a34a',    // green-600
  investment: '#2563eb',    // blue-600
  savings: '#0891b2',       // cyan-600
  vehicle: '#d97706',       // amber-600
  business: '#7c3aed',      // violet-600
  personal: '#64748b',      // slate-500
  other: '#94a3b8',         // slate-400
};

/** Map raw asset type strings to a normalised category */
function normaliseAssetCategory(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('property') || t.includes('house') || t.includes('home') || t.includes('real estate')) return 'property';
  if (t.includes('retirement') || t.includes('pension') || t.includes('provident') || t.includes('ra')) return 'retirement';
  if (t.includes('invest') || t.includes('unit trust') || t.includes('shares') || t.includes('equity') || t.includes('etf')) return 'investment';
  if (t.includes('saving') || t.includes('cash') || t.includes('money market') || t.includes('deposit') || t.includes('bank')) return 'savings';
  if (t.includes('vehicle') || t.includes('car') || t.includes('motor')) return 'vehicle';
  if (t.includes('business') || t.includes('company') || t.includes('partnership')) return 'business';
  if (t.includes('personal') || t.includes('household') || t.includes('jewel') || t.includes('art')) return 'personal';
  return 'other';
}

const ASSET_CATEGORY_LABELS: Record<string, string> = {
  property: 'Property',
  retirement: 'Retirement Funds',
  investment: 'Investments',
  savings: 'Cash & Savings',
  vehicle: 'Vehicles',
  business: 'Business Interests',
  personal: 'Personal Assets',
  other: 'Other',
};

export interface AssetAllocationData {
  /** Profile assets from balance sheet */
  assets: Array<{ type?: string; value?: number; description?: string }>;
  /** Retirement policy current market values */
  retirementValue: number;
  /** Investment policy current market values */
  investmentValue: number;
}

export function AssetAllocationChart({
  data,
  mode = 'adviser',
}: {
  data: AssetAllocationData;
  mode?: DashboardMode;
}) {
  const isClient = mode === 'client';

  const slices = useMemo<PieSlice[]>(() => {
    // Aggregate profile assets by category
    const categoryTotals: Record<string, number> = {};
    (data.assets || []).forEach((a) => {
      const cat = normaliseAssetCategory(a.type || '');
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(a.value) || 0);
    });

    // Add policy portfolio values (if not already captured as profile assets)
    if (data.retirementValue > 0) {
      categoryTotals['retirement'] = (categoryTotals['retirement'] || 0) + data.retirementValue;
    }
    if (data.investmentValue > 0) {
      categoryTotals['investment'] = (categoryTotals['investment'] || 0) + data.investmentValue;
    }

    // Convert to pie slices — filter zero-value categories
    return Object.entries(categoryTotals)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        name: ASSET_CATEGORY_LABELS[cat] || cat,
        value: val,
        color: ASSET_COLORS[cat] || ASSET_COLORS.other,
      }));
  }, [data]);

  const totalValue = useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices]);

  if (slices.length === 0) {
    return (
      <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-[#6d28d9]/10 flex-shrink-0">
              <PieChartIcon className="h-3.5 w-3.5 text-[#6d28d9]" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
              {isClient ? 'My Asset Allocation' : 'Asset Allocation'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-xs text-gray-400">No asset data available</p>
            <p className="text-[10px] text-gray-300 mt-1">
              {isClient ? 'Asset information will appear once your profile is updated' : 'Add balance sheet data to view allocation'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-[#6d28d9]/10 flex-shrink-0">
            <PieChartIcon className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Asset Allocation' : 'Asset Allocation'}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-gray-200 text-gray-500 ml-auto">
            Total: {fmtCompact(totalValue)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5">
        <SVGPieChart
          data={slices}
          height={200}
          innerRadius={40}
          tooltipFormatter={(value, name) => `${name}: ${fmtCurrency(value)} (${((value / totalValue) * 100).toFixed(1)}%)`}
        />
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
          {slices.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-gray-500">{s.name}</span>
              <span className="text-[10px] font-medium text-gray-700">
                {((s.value / totalValue) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// 2. INSURANCE COVERAGE BAR CHART
// ═══════════════════════════════════════════════════════════════════════

export interface InsuranceCoverageItem {
  riskType: string;
  label: string;
  existing: number;
  recommended: number;
}

export function InsuranceCoverageChart({
  items,
  mode = 'adviser',
}: {
  items: InsuranceCoverageItem[];
  mode?: DashboardMode;
}) {
  const isClient = mode === 'client';

  // Build bar chart data
  const barData = useMemo(() => {
    return items
      .filter((item) => item.recommended > 0 || item.existing > 0)
      .map((item) => ({
        category: item.label,
        existing: item.existing,
        recommended: item.recommended,
      }));
  }, [items]);

  const series: BarChartSeries[] = [
    { key: 'existing', label: isClient ? 'Your Cover' : 'Existing Cover', color: '#16a34a' },
    { key: 'recommended', label: 'Recommended', color: '#d1d5db' },
  ];

  if (barData.length === 0) {
    return (
      <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-green-50 flex-shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
              {isClient ? 'My Insurance Coverage' : 'Insurance Coverage Analysis'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-xs text-gray-400">No coverage data available</p>
            <p className="text-[10px] text-gray-300 mt-1">
              {isClient ? 'Coverage analysis requires a completed Risk FNA' : 'Publish a Risk FNA to view coverage analysis'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Count shortfalls
  const shortfalls = barData.filter((d) => d.existing < d.recommended).length;

  return (
    <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-green-50 flex-shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Insurance Coverage' : 'Insurance Coverage Analysis'}
          </CardTitle>
          {shortfalls > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-200 text-red-600 ml-auto">
              {shortfalls} {shortfalls === 1 ? 'shortfall' : 'shortfalls'}
            </Badge>
          )}
          {shortfalls === 0 && barData.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-200 text-green-700 ml-auto">
              Fully covered
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-3 px-5">
        <SVGBarChart
          data={barData}
          categoryKey="category"
          series={series}
          height={220}
          yAxisFormatter={(v) => fmtCompact(v)}
          tooltipFormatter={(v) => fmtCurrency(v)}
          showLegend={true}
          showGrid={true}
        />
      </CardContent>
    </Card>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// 3. CASHFLOW WATERFALL CHART
// ═══════════════════════════════════════════════════════════════════════

export interface CashflowWaterfallData {
  grossIncome: number;
  netIncome: number;
  riskPremiums: number;
  medicalPremiums: number;
  retirementPremiums: number;
  investmentPremiums: number;
  employeePremiums: number;
  debtPayments: number;
}

/**
 * Cashflow waterfall — shows how gross income flows through
 * deductions, premiums, debt, and remaining disposable income.
 *
 * Uses a stacked bar representation rendered as custom SVG
 * (the bar chart library doesn't natively support waterfall,
 * so we use a horizontal stacked bar approach).
 */
export function CashflowWaterfallChart({
  data,
  mode = 'adviser',
}: {
  data: CashflowWaterfallData;
  mode?: DashboardMode;
}) {
  const isClient = mode === 'client';

  const segments = useMemo(() => {
    const taxDeductions = data.grossIncome - data.netIncome;
    const totalPremiums = data.riskPremiums + data.medicalPremiums +
      data.retirementPremiums + data.investmentPremiums + data.employeePremiums;
    const disposable = Math.max(0, data.netIncome - totalPremiums - data.debtPayments);

    const items = [
      { label: 'Tax & Deductions', value: taxDeductions, color: '#ef4444', type: 'outflow' as const },
      { label: 'Risk Premiums', value: data.riskPremiums, color: '#6d28d9', type: 'outflow' as const },
      { label: 'Medical Aid', value: data.medicalPremiums, color: '#f97316', type: 'outflow' as const },
      { label: 'Retirement', value: data.retirementPremiums, color: '#16a34a', type: 'outflow' as const },
      { label: 'Investments', value: data.investmentPremiums, color: '#2563eb', type: 'outflow' as const },
      { label: 'Employee Benefits', value: data.employeePremiums, color: '#7c3aed', type: 'outflow' as const },
      { label: 'Debt Payments', value: data.debtPayments, color: '#dc2626', type: 'outflow' as const },
      { label: 'Disposable', value: disposable, color: '#0ea5e9', type: 'remainder' as const },
    ].filter(s => s.value > 0);

    return items;
  }, [data]);

  const hasData = data.grossIncome > 0;

  if (!hasData) {
    return (
      <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-md bg-blue-50 flex-shrink-0">
              <ArrowDownUp className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
              {isClient ? 'My Monthly Cashflow' : 'Monthly Cashflow Breakdown'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-xs text-gray-400">No income data available</p>
            <p className="text-[10px] text-gray-300 mt-1">
              {isClient ? 'Income details will appear once your profile is updated' : 'Add income information to view cashflow'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compute disposable as percentage of gross
  const taxDeductions = data.grossIncome - data.netIncome;
  const totalPremiums = data.riskPremiums + data.medicalPremiums +
    data.retirementPremiums + data.investmentPremiums + data.employeePremiums;
  const disposable = Math.max(0, data.netIncome - totalPremiums - data.debtPayments);
  const disposableRatio = data.grossIncome > 0 ? (disposable / data.grossIncome) * 100 : 0;

  // Determine trend indicator
  const TrendIcon = disposableRatio > 30 ? TrendingUp : disposableRatio > 15 ? Minus : TrendingDown;
  const trendColor = disposableRatio > 30 ? 'text-green-600' : disposableRatio > 15 ? 'text-amber-500' : 'text-red-500';

  return (
    <Card className="border border-gray-200 rounded-lg bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-blue-50 flex-shrink-0">
            <ArrowDownUp className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Monthly Cashflow' : 'Monthly Cashflow Breakdown'}
          </CardTitle>
          <div className="flex items-center gap-1.5 ml-auto">
            <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
            <span className={`text-[11px] font-medium ${trendColor}`}>
              {disposableRatio.toFixed(0)}% disposable
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4 px-5">
        {/* Gross income header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-600">
            {isClient ? 'Monthly Income' : 'Gross Monthly Income'}
          </span>
          <span className="text-sm font-bold text-gray-900">{fmtCurrency(data.grossIncome)}</span>
        </div>

        {/* Horizontal stacked bar */}
        <div className="h-8 w-full rounded-lg overflow-hidden flex bg-gray-100">
          {segments.map((seg, i) => {
            const widthPct = (seg.value / data.grossIncome) * 100;
            if (widthPct < 0.5) return null;
            return (
              <div
                key={seg.label}
                className="h-full relative group transition-opacity hover:opacity-90"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: seg.color,
                  borderRight: i < segments.length - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined,
                }}
                title={`${seg.label}: ${fmtCurrency(seg.value)} (${widthPct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Legend grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-4">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 truncate">{seg.label}</p>
                <p className="text-xs font-semibold text-gray-800">{fmtCompact(seg.value)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom summary */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {isClient ? 'Remaining after obligations' : 'Disposable income'}
          </span>
          <span className={`text-sm font-bold ${disposable > 0 ? 'text-sky-600' : 'text-red-600'}`}>
            {fmtCurrency(disposable)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// 4. ACTION PRIORITY DISTRIBUTION BAR
// ═══════════════════════════════════════════════════════════════════════

export interface ActionDistribution {
  urgent: number;
  attention: number;
  recommended: number;
  monitoring: number;
}

/**
 * Compact horizontal stacked bar showing action item priority distribution.
 * Designed to sit inside or alongside the action items section header.
 */
export function ActionPriorityBar({
  distribution,
  mode = 'adviser',
}: {
  distribution: ActionDistribution;
  mode?: DashboardMode;
}) {
  const total = distribution.urgent + distribution.attention +
    distribution.recommended + distribution.monitoring;

  if (total === 0) return null;

  const segments = [
    { key: 'urgent', count: distribution.urgent, color: '#ef4444', label: 'Act Now' },
    { key: 'attention', count: distribution.attention, color: '#f59e0b', label: 'Worth a Look' },
    { key: 'recommended', count: distribution.recommended, color: '#2563eb', label: 'Nice to Have' },
    { key: 'monitoring', count: distribution.monitoring, color: '#64748b', label: 'Monitoring' },
  ].filter(s => s.count > 0);

  return (
    <div className="flex items-center gap-3">
      {/* Mini stacked bar */}
      <div className="h-2 w-24 rounded-full overflow-hidden flex bg-gray-100 flex-shrink-0">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="h-full"
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </div>
      {/* Dot labels */}
      <div className="flex items-center gap-2">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-[10px] text-gray-500">
              {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}