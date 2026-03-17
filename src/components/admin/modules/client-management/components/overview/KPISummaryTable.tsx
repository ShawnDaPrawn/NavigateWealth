/**
 * KPI Summary Table — Monthly Financial Summary
 *
 * Displays key financial metrics with current value, target/benchmark,
 * and colour-coded status (spec §54 — Monthly Summary Table).
 *
 * Each KPI is config-driven via KPI_DEFINITIONS (§5.3).
 * Status derivation uses pure utility functions from utils.ts (§7.1).
 *
 * Guidelines §8.3 — Status colour vocabulary: green/amber/red/gray.
 * Guidelines §8.4 — Uses Design System components (Card, Badge, Table).
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import {
  Scale,
  TrendingDown,
  PiggyBank,
  Shield,
  ShieldCheck,
  Target,
  BarChart3,
} from 'lucide-react';
import { KPI_DEFINITIONS, KPI_STATUS_CONFIG } from '../../constants';
import type { KPIStatus } from '../../constants';
import type { DashboardMode } from '../ClientOverviewTab';

// ── Types ───────────────────────────────────────────────────────────────

export interface KPIValue {
  id: string;
  /** Formatted display value (e.g., "R 1,050,000", "32.0%", "4.2 months") */
  displayValue: string;
  /** Raw numeric for sorting/comparison */
  rawValue: number | null;
  /** Derived status */
  status: KPIStatus;
  /** Optional detail text (e.g., "▲ +5% YoY") */
  detail?: string;
}

interface KPISummaryTableProps {
  kpis: KPIValue[];
  mode?: DashboardMode;
}

// ── Icon resolver ────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  'scale': Scale,
  'trending-down': TrendingDown,
  'piggy-bank': PiggyBank,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'target': Target,
};

function resolveIcon(slug: string): React.ElementType {
  return ICON_MAP[slug] || BarChart3;
}

// ── Component ───────────────────────────────────────────────────────────

export function KPISummaryTable({ kpis, mode = 'adviser' }: KPISummaryTableProps) {
  const isClient = mode === 'client';

  // Build enriched rows by joining KPI definitions with computed values
  const rows = KPI_DEFINITIONS.map((def) => {
    const kpi = kpis.find((k) => k.id === def.id);
    return {
      def,
      value: kpi || {
        id: def.id,
        displayValue: '—',
        rawValue: null,
        status: 'no-data' as KPIStatus,
      },
    };
  });

  // Count statuses for header summary
  const goodCount = rows.filter((r) => r.value.status === 'good').length;
  const cautionCount = rows.filter((r) => r.value.status === 'caution').length;
  const gapCount = rows.filter((r) => r.value.status === 'gap').length;

  return (
    <Card className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <CardHeader className="px-5 py-3.5 bg-gray-50/40 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-md bg-[#6d28d9]/10 flex-shrink-0">
            <BarChart3 className="h-3.5 w-3.5 text-[#6d28d9]" />
          </div>
          <CardTitle className="text-sm font-semibold text-gray-800 !leading-none">
            {isClient ? 'My Financial Snapshot' : 'Financial Health Indicators'}
          </CardTitle>

          {/* Status summary dots */}
          <div className="flex items-center gap-3 ml-auto">
            {goodCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-green-700">{goodCount}</span>
              </div>
            )}
            {cautionCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-xs text-amber-700">{cautionCount}</span>
              </div>
            )}
            {gapCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs text-red-700">{gapCount}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/60">
                <TableHead className="text-xs font-semibold text-gray-600 pl-5 w-[200px]">
                  Indicator
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">
                  Where You Are
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">
                  Where You Should Be
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-center pr-5 w-[120px]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ def, value }) => {
                const statusCfg = KPI_STATUS_CONFIG[value.status];
                const Icon = resolveIcon(def.iconSlug);

                return (
                  <TableRow
                    key={def.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Metric */}
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-gray-100 flex-shrink-0">
                          <Icon className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {def.label}
                          </p>
                          <p className="text-xs text-gray-400 truncate leading-tight">
                            {isClient ? def.description : def.description}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Current Value */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span
                          className={`text-sm font-bold ${
                            value.status === 'good'
                              ? 'text-gray-900'
                              : value.status === 'caution'
                              ? 'text-amber-700'
                              : value.status === 'gap'
                              ? 'text-red-700'
                              : 'text-gray-400'
                          }`}
                        >
                          {value.displayValue}
                        </span>
                        {value.detail && (
                          <span className={`text-xs mt-0.5 ${statusCfg.textClass}`}>
                            {value.detail}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Target */}
                    <TableCell>
                      <span className="text-xs text-gray-500">
                        {def.targetText}
                      </span>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="text-center pr-5">
                      <Badge
                        variant="outline"
                        className={`text-xs px-2 py-0.5 border ${statusCfg.badgeClass}`}
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass} mr-1.5`}
                        />
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}