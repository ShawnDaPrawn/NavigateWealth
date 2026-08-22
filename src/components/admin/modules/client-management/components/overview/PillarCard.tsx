/**
 * PillarCard.tsx
 *
 * Pillar Card sub-component for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx.
 */

import { Card, CardContent } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import type { PillarData } from '../clientOverview/pillars';
import type { PillarHealth } from '../clientOverview/policyFields';

// ── Pillar health config ─────────────────────────────────────────────────

export const PILLAR_HEALTH_CONFIG: Record<
  PillarHealth,
  { bg: string; border: string; dot: string; dotBg: string; label: string }
> = {
  healthy: {
    bg: 'bg-white',
    border: 'border-gray-200',
    dot: 'bg-green-500',
    dotBg: 'bg-green-100',
    label: 'Healthy',
  },
  attention: {
    bg: 'bg-white',
    border: 'border-gray-200',
    dot: 'bg-amber-400',
    dotBg: 'bg-amber-100',
    label: 'Review',
  },
  critical: {
    bg: 'bg-white',
    border: 'border-gray-200',
    dot: 'bg-red-500',
    dotBg: 'bg-red-100',
    label: 'Shortfall',
  },
  'no-data': {
    bg: 'bg-white',
    border: 'border-gray-200',
    dot: 'bg-gray-300',
    dotBg: 'bg-gray-100',
    label: 'No Data',
  },
};

const PILLAR_ICON_COLORS: Record<string, string> = {
  'risk-planning': 'text-gray-500 bg-gray-100',
  'medical-aid': 'text-gray-500 bg-gray-100',
  retirement: 'text-gray-500 bg-gray-100',
  investment: 'text-gray-500 bg-gray-100',
  estate: 'text-gray-500 bg-gray-100',
};

/** Pillar card top-line strip colours — matched to HEALTH_SUB_SCORE_CONFIG */
const PILLAR_STRIP_COLORS: Record<string, string> = {
  'risk-planning': 'bg-[#6d28d9]', // brand purple  — Risk
  'medical-aid': 'bg-[#2563eb]', // blue-600      — Medical Aid
  retirement: 'bg-[#16a34a]', // green-600     — Retirement
  investment: 'bg-[#f59e0b]', // amber-500     — Investments
  estate: 'bg-[#64748b]', // slate-500     — Estate Planning
};

const FNA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  published: { label: 'FNA', color: 'text-gray-500' },
  draft: { label: 'FNA Draft', color: 'text-gray-400' },
  not_started: { label: 'No FNA', color: 'text-gray-400' },
  error: { label: 'FNA Error', color: 'text-gray-400' },
  loading: { label: '...', color: 'text-gray-300' },
};

// ── PillarCard component ─────────────────────────────────────────────────

export function PillarCard({ pillar }: { pillar: PillarData }) {
  const healthCfg = PILLAR_HEALTH_CONFIG[pillar.health];
  const PillarIcon = pillar.icon;
  const iconColor = PILLAR_ICON_COLORS[pillar.id] || 'text-gray-600 bg-gray-100';
  const stripColor = PILLAR_STRIP_COLORS[pillar.id] || 'bg-gray-300';
  const fnaLabel = pillar.fnaStatus ? FNA_STATUS_LABELS[pillar.fnaStatus] : null;

  return (
    <Card
      className={`relative overflow-hidden transition-shadow hover:shadow-md border ${healthCfg.border} flex flex-col`}
    >
      {/* Health indicator strip — colour matches sub-score breakdown */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${stripColor}`} />

      <CardContent className="pt-4 pb-3 px-4 flex-1 flex flex-col gap-0">
        {/* Header: icon + title + health badge */}
        <div className="flex items-start justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-lg ${iconColor} flex-shrink-0`}
            >
              <PillarIcon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 leading-tight truncate">
              {pillar.title}
            </h3>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4.5 flex-shrink-0 ml-1 ${healthCfg.border} ${healthCfg.bg}`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${healthCfg.dot} mr-1`} />
            {healthCfg.label}
          </Badge>
        </div>

        {/* Meta line: policy count + FNA status */}
        <p className="text-xs text-gray-400 leading-tight mb-2">
          {pillar.policyCount} {pillar.policyCount === 1 ? 'policy' : 'policies'}
          {fnaLabel && <span className={`ml-1 ${fnaLabel.color}`}>· {fnaLabel.label}</span>}
        </p>

        {/* Primary metric */}
        <div className="mb-2">
          <p className="text-base font-bold text-gray-900 leading-tight">{pillar.primaryValue}</p>
          <p className="text-xs text-gray-500 leading-tight">{pillar.primaryLabel}</p>
        </div>

        {/* Current cover — simple label : value rows */}
        <div className="space-y-1.5 flex-1">
          {pillar.metrics.map((metric) => (
            <div key={metric.label} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-gray-500 truncate min-w-0">{metric.label}</span>
              <span className={`text-xs font-medium whitespace-nowrap text-gray-700`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        {/* Fallback: no FNA notice */}
        {pillar.fnaStatus === 'not_started' && pillar.policyCount > 0 && (
          <p className="text-[11px] text-gray-400 mt-2 italic border-t border-gray-50 pt-1.5">
            Current cover shown — complete an FNA to check if it's enough
          </p>
        )}
        {pillar.fnaStatus === 'not_started' && pillar.policyCount === 0 && (
          <p className="text-[11px] text-gray-400 mt-2 italic border-t border-gray-50 pt-1.5">
            No cover on record yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
