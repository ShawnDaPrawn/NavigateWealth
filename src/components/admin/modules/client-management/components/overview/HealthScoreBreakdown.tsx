/**
 * Health Score Sub-Score Breakdown
 *
 * Displays the 5 sub-categories of the Financial Health Score,
 * aligned 1:1 with the strategic pillar cards:
 * Risk, Medical Aid, Retirement, Investments, Estate Planning
 * — each as a labelled progress bar with colour-coded status.
 *
 * Guidelines §7.1 — display logic only; computation is in utils.ts.
 * Guidelines §8.3 — uses the status colour vocabulary.
 */

import React from 'react';
import { HEALTH_SUB_SCORE_CONFIG } from '../../constants';
import type { HealthSubScores } from '../../utils';
import type { DashboardMode } from '../ClientOverviewTab';

interface HealthScoreBreakdownProps {
  subScores: HealthSubScores;
  mode?: DashboardMode;
}

/** Map score to bar colour class */
function scoreBarColor(score: number, hasData: boolean): string {
  if (!hasData) return 'bg-gray-200';
  if (score >= 75) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-400';
  if (score >= 25) return 'bg-orange-400';
  return 'bg-gray-300';
}

const SUB_SCORE_ORDER: Array<keyof typeof HEALTH_SUB_SCORE_CONFIG> = [
  'risk',
  'medicalAid',
  'retirement',
  'investments',
  'estatePlanning',
];

export function HealthScoreBreakdown({ subScores, mode = 'adviser' }: HealthScoreBreakdownProps) {
  const isClient = mode === 'client';

  return (
    <div className="space-y-2.5 w-full">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {isClient ? 'Score Breakdown' : 'Sub-Score Breakdown'}
      </p>
      {SUB_SCORE_ORDER.map((key) => {
        const cfg = HEALTH_SUB_SCORE_CONFIG[key];
        const score = subScores[key];
        const hasData = subScores.hasData[key];

        return (
          <div key={key} className="flex items-center gap-3">
            {/* Label */}
            <div className="w-[76px] flex-shrink-0">
              <span className={`text-xs font-medium ${cfg.textClass}`}>
                {cfg.label}
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${scoreBarColor(score, hasData)}`}
                style={{ width: `${hasData ? Math.max(score, 2) : 0}%` }}
              />
            </div>

            {/* Score / label */}
            <div className="w-[52px] flex-shrink-0 text-right">
              {hasData ? (
                <span className="text-xs font-semibold text-gray-700">{score}%</span>
              ) : (
                <span className="text-xs text-gray-400">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}