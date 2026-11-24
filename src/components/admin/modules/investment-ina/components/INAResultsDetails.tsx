/**
 * Investment INA — the parts of a result beyond the goal table: affordability
 * and the priority-ordered funding view, risk-profile suitability warnings,
 * and the assumptions the numbers rest on. Each renders nothing for results
 * calculated before these existed, so older stored INAs still open.
 */

import { AlertTriangle } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import type {
  GoalCalculationResult,
  INAPriorityFundingStatus,
  InvestmentINAResults,
  PortfolioSummary,
} from '../types';
import { formatCurrency } from '../services/investmentINACalculationService';

const FUNDING_STATUS_LABELS: Record<INAPriorityFundingStatus, string> = {
  'fully-funded': 'Fully funded',
  'partially-funded': 'Partly funded',
  'not-funded': 'Not funded',
  'horizon-passed': 'Target date passed',
  'not-assessed': 'Not assessed',
};

const INCOME_BASIS_LABELS = { gross: 'gross', net: 'net', none: '' } as const;

export function INAAffordabilityPanel({ summary }: { summary: PortfolioSummary }) {
  const { affordability, priorityFunding } = summary;
  if (!affordability) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Affordability and funding priority</h4>
      {affordability.affordableMonthly === null ? (
        <p className="text-sm text-muted-foreground">{affordability.warningMessage}</p>
      ) : (
        <div
          className={`rounded-lg border p-3 text-sm ${
            affordability.isAffordable
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p>
            The goals need {formatCurrency(affordability.totalRecommendedMonthly)} a month,{' '}
            {affordability.percentageOfIncome.toFixed(1)}% of{' '}
            {INCOME_BASIS_LABELS[affordability.incomeBasis]} monthly income (
            {formatCurrency(affordability.monthlyIncome)}). Guideline: up to{' '}
            {affordability.limitPercent}% ({formatCurrency(affordability.affordableMonthly)}).
          </p>
          {!affordability.isAffordable && (
            <p className="mt-1 font-medium">
              Above the guideline — the goals below are funded in priority order.
            </p>
          )}
        </div>
      )}

      {priorityFunding && priorityFunding.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Goal (priority order)</th>
                <th className="text-left font-medium px-4 py-2">Priority</th>
                <th className="text-right font-medium px-4 py-2">Needs / month</th>
                <th className="text-right font-medium px-4 py-2">Affordable / month</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-right font-medium px-4 py-2">Funded at that</th>
              </tr>
            </thead>
            <tbody>
              {priorityFunding.map((row) => (
                <tr key={row.goalId} className="border-t">
                  <td className="px-4 py-2 font-medium">{row.goalName}</td>
                  <td className="px-4 py-2 capitalize">{row.priorityLevel}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(row.requiredMonthly)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(row.allocatedMonthly)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={row.fundingStatus === 'fully-funded' ? 'outline' : 'secondary'}>
                      {FUNDING_STATUS_LABELS[row.fundingStatus] ?? row.fundingStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {Math.round(row.projectedFundingPercentage)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function INAGoalWarnings({ goalResults }: { goalResults: GoalCalculationResult[] }) {
  const flagged = goalResults.filter((g) => g.suitabilityWarning || g.riskProfileNote);
  if (flagged.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Risk profile suitability</h4>
      <ul className="space-y-2">
        {flagged.map((goal) => (
          <li
            key={goal.goalId}
            className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <span className="font-medium">{goal.goalName}:</span>{' '}
              {goal.suitabilityWarning ?? goal.riskProfileNote}
              {goal.suitabilityWarning && goal.riskProfileNote && (
                <span className="block mt-1">{goal.riskProfileNote}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function INAAssumptionsList({ results }: { results: InvestmentINAResults }) {
  if (!results.assumptions || results.assumptions.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Basis of the calculation</h4>
      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
        {results.assumptions.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
