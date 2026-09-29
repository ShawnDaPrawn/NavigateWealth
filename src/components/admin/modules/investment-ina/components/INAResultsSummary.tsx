/**
 * Investment INA — results summary shared by Step 2 (system) and Step 4 (final).
 */

import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import type { InvestmentINAResults } from '../types';
import { formatCurrency, getGoalStatusLabel } from '../services/investmentINACalculationService';

const HEALTH_LABELS: Record<
  InvestmentINAResults['portfolioSummary']['overallPortfolioHealth'],
  string
> = {
  excellent: 'Excellent',
  good: 'Good',
  'needs-attention': 'Needs attention',
  critical: 'Critical',
};

export function INAResultsSummary({
  results,
  title,
  description,
}: {
  results: InvestmentINAResults;
  title: string;
  description: string;
}) {
  const { portfolioSummary, goalResults } = results;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Portfolio Health</p>
            <p className="text-lg font-semibold">
              {HEALTH_LABELS[portfolioSummary.overallPortfolioHealth] ??
                portfolioSummary.overallPortfolioHealth}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Goals On Track</p>
            <p className="text-lg font-semibold">
              {portfolioSummary.goalsOnTrack} / {portfolioSummary.totalGoals}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Funding Gap</p>
            <p
              className={`text-lg font-semibold ${
                portfolioSummary.totalFundingGap > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(portfolioSummary.totalFundingGap)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Additional Monthly Required</p>
            <p className="text-lg font-semibold">
              {formatCurrency(portfolioSummary.totalAdditionalMonthlyRequired)}/mo
            </p>
          </div>
        </div>

        {goalResults.length > 0 && (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Goal</th>
                  <th className="text-left font-medium px-4 py-2">Status</th>
                  <th className="text-right font-medium px-4 py-2">Required</th>
                  <th className="text-right font-medium px-4 py-2">Projected</th>
                  <th className="text-right font-medium px-4 py-2">Gap</th>
                  <th className="text-right font-medium px-4 py-2">Extra / month</th>
                </tr>
              </thead>
              <tbody>
                {goalResults.map((goal) => (
                  <tr key={goal.goalId} className="border-t">
                    <td className="px-4 py-2 font-medium">{goal.goalName}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{getGoalStatusLabel(goal.goalStatus)}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(goal.fundingGap.goalRequiredReal)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(goal.fundingGap.projectedCapitalAtGoal)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums ${
                        goal.fundingGap.hasShortfall ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(goal.fundingGap.gapAmount)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(goal.requiredContributions.requiredAdditionalMonthly)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
