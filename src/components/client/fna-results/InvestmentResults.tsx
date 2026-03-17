/**
 * Client-Side Investment INA Results Display
 * Read-only view of published Goal-Based Investment Needs Analysis
 * 
 * Data source: /supabase/functions/server/investment-ina-routes.tsx
 * Backend stores inputs with: currentAge, clientRiskProfile, discretionaryInvestments,
 * totalDiscretionaryCapitalCurrent, totalDiscretionaryMonthlyContributions, goals,
 * longTermInflationRate, expectedRealReturns
 * Results use: portfolioSummary, goalResults, recommendations, economicAssumptions
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { 
  DollarSign, 
  Target,
  TrendingUp,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Info,
  PieChart,
  BarChart3,
  Calendar
} from 'lucide-react';
import { InvestmentINA, formatCurrency } from '../../../services/fna-api';

interface InvestmentResultsProps {
  fna: InvestmentINA;
}

export function InvestmentResults({ fna }: InvestmentResultsProps) {
  const { results, inputs } = fna;

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      conservative: 'bg-green-600',
      moderate: 'bg-yellow-600',
      balanced: 'bg-blue-600',
      growth: 'bg-orange-600',
      aggressive: 'bg-red-600',
    };
    return colors[(risk || '').toLowerCase()] || 'bg-gray-600';
  };

  const getHealthColor = (health: string) => {
    const colors: Record<string, string> = {
      'excellent': 'bg-green-600',
      'good': 'bg-blue-600',
      'needs-attention': 'bg-orange-600',
      'critical': 'bg-red-600',
    };
    return colors[health] || 'bg-gray-600';
  };

  // Safely access nested data
  const portfolioSummary = results?.portfolioSummary;
  const goalResults = results?.goalResults || [];
  const recommendations = results?.recommendations || [];
  const economicAssumptions = results?.economicAssumptions;

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-purple-600">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 mb-2">Investment Needs Analysis Summary</h3>
              <p className="text-sm text-gray-700 mb-4">
                Goal-based investment strategy analysis with portfolio recommendations tailored to your 
                financial goals, risk tolerance, and investment time horizon.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <p className="text-xs text-gray-600 mb-1">Investment Goals</p>
                  <p className="text-gray-900">{inputs?.goals?.length || 0}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <p className="text-xs text-gray-600 mb-1">Risk Profile</p>
                  <p className="text-gray-900 capitalize">{inputs?.clientRiskProfile || 'Not set'}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <p className="text-xs text-gray-600 mb-1">Current Capital</p>
                  <p className="text-gray-900">{formatCurrency(inputs?.totalDiscretionaryCapitalCurrent || 0)}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-100">
                  <p className="text-xs text-gray-600 mb-1">Monthly Contributions</p>
                  <p className="text-gray-900">{formatCurrency(inputs?.totalDiscretionaryMonthlyContributions || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Summary */}
      {portfolioSummary && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-600">
                  <PieChart className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">Portfolio Overview</CardTitle>
              </div>
              <Badge className={`${getHealthColor(portfolioSummary.overallPortfolioHealth)} capitalize`}>
                {portfolioSummary.overallPortfolioHealth.replace(/-/g, ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-600 mb-1">Total Goals</p>
                <p className="text-lg text-gray-900">{portfolioSummary.totalGoals}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-gray-600 mb-1">On Track</p>
                <p className="text-lg text-green-700">{portfolioSummary.goalsOnTrack}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs text-gray-600 mb-1">Underfunded</p>
                <p className="text-lg text-red-700">{portfolioSummary.goalsUnderfunded}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <p className="text-xs text-gray-600 mb-1">Overfunded</p>
                <p className="text-lg text-purple-700">{portfolioSummary.goalsOverfunded}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-600 mb-1">Total Required Capital</p>
                <p className="text-xl text-gray-900">{formatCurrency(portfolioSummary.totalRequiredCapital)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-xs text-gray-600 mb-1">Total Projected Capital</p>
                <p className="text-xl text-gray-900">{formatCurrency(portfolioSummary.totalProjectedCapital)}</p>
              </div>
              {portfolioSummary.totalFundingGap > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-xs text-gray-600 mb-1">Total Funding Gap</p>
                  <p className="text-xl text-red-700">{formatCurrency(portfolioSummary.totalFundingGap)}</p>
                </div>
              )}
            </div>

            {portfolioSummary.totalAdditionalMonthlyRequired > 0 && (
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 mb-1">
                      <strong>Additional Monthly Contribution Needed</strong>
                    </p>
                    <p className="text-2xl text-orange-700">
                      {formatCurrency(portfolioSummary.totalAdditionalMonthlyRequired)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      To close all funding gaps across your investment goals
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Investment Portfolio */}
      {inputs?.discretionaryInvestments && inputs.discretionaryInvestments.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Current Discretionary Investments</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inputs.discretionaryInvestments.map((investment) => (
                <div key={investment.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{investment.productName}</p>
                      {investment.provider && (
                        <p className="text-xs text-gray-600">{investment.provider}</p>
                      )}
                    </div>
                    <p className="text-sm text-gray-900">{formatCurrency(investment.currentValue)}</p>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Monthly: {formatCurrency(investment.monthlyContribution)}</span>
                    {investment.riskCategory && (
                      <Badge variant="outline" className="capitalize text-xs">{investment.riskCategory}</Badge>
                    )}
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center pt-2">
                <p className="text-sm text-gray-700"><strong>Total Portfolio Value</strong></p>
                <p className="text-lg text-gray-900">
                  {formatCurrency(inputs.totalDiscretionaryCapitalCurrent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal-Based Analysis */}
      {goalResults.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-600">
                <Target className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Goal-Based Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {goalResults.map((goal: { goalId?: string; goalName?: string; goalStatus?: string; fundingGap?: { fundingPercentage?: number; shortfall?: number }; requiredMonthly?: number; targetAmount?: number; timeHorizon?: number; [key: string]: unknown }, index: number) => {
              const isOnTrack = goal.goalStatus === 'on-track';
              const fundingPct = goal.fundingGap?.fundingPercentage || 0;
              
              return (
                <div key={goal.goalId || index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm text-gray-900 mb-1">
                        {goal.goalName || `Goal ${index + 1}`}
                      </h4>
                      {goal.goalType && (
                        <p className="text-xs text-gray-600 capitalize">{goal.goalType.replace(/_/g, ' ')}</p>
                      )}
                    </div>
                    <Badge 
                      variant={isOnTrack ? 'default' : 'destructive'} 
                      className="gap-1 capitalize"
                    >
                      {isOnTrack ? (
                        <div className="contents">
                          <CheckCircle className="h-3 w-3" />
                          On Track
                        </div>
                      ) : (
                        <div className="contents">
                          <AlertCircle className="h-3 w-3" />
                          {(goal.goalStatus || 'shortfall').replace(/-/g, ' ')}
                        </div>
                      )}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {goal.fundingGap?.goalRequiredReal !== undefined && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Target Amount</p>
                        <p className="text-sm text-gray-900">{formatCurrency(goal.fundingGap.goalRequiredReal)}</p>
                      </div>
                    )}
                    {goal.projectedCapital?.totalProjectedCapital !== undefined && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Projected Capital</p>
                        <p className="text-sm text-gray-900">{formatCurrency(goal.projectedCapital.totalProjectedCapital)}</p>
                      </div>
                    )}
                    {goal.timeHorizon?.yearsToGoal !== undefined && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Time Horizon</p>
                        <p className="text-sm text-gray-900">{goal.timeHorizon.yearsToGoal} years</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Funding Level</p>
                      <p className={`text-sm ${fundingPct >= 100 ? 'text-green-700' : 'text-red-700'}`}>
                        {Math.round(fundingPct)}%
                      </p>
                    </div>
                  </div>

                  {/* Funding progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className={`h-2 rounded-full ${fundingPct >= 100 ? 'bg-green-600' : fundingPct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, fundingPct)}%` }}
                    />
                  </div>

                  {goal.fundingGap?.hasShortfall && goal.requiredContributions && (
                    <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-200">
                      <p className="text-xs text-gray-900">
                        <strong>Action Required:</strong>{' '}
                        {goal.requiredContributions.canMeetGoal 
                          ? `Increase monthly contribution by ${formatCurrency(goal.requiredContributions.requiredAdditionalMonthly)} to meet this goal`
                          : 'Consider extending timeline or increasing initial capital'
                        }
                      </p>
                      {goal.requiredContributions.alternativeLumpSumToday > 0 && (
                        <p className="text-xs text-gray-600 mt-1">
                          Alternative: Lump sum of {formatCurrency(goal.requiredContributions.alternativeLumpSumToday)} today
                        </p>
                      )}
                    </div>
                  )}

                  {goal.statusRationale && (
                    <p className="text-xs text-gray-600 mt-2">{goal.statusRationale}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Investment Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 mb-1">
                      <strong>{rec.goalName}</strong>
                    </p>
                    <p className="text-xs text-gray-700 mb-2">{rec.action}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize text-xs">{rec.priority} priority</Badge>
                    </div>
                    {rec.impact && (
                      <p className="text-xs text-gray-600 mt-1">{rec.impact}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Economic Assumptions */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Planning Assumptions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Risk Profile</p>
              <p className="text-lg text-gray-900 capitalize">{inputs?.clientRiskProfile || 'N/A'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Long-Term Inflation Rate</p>
              <p className="text-lg text-gray-900">
                {((economicAssumptions?.inflationRate || inputs?.longTermInflationRate || 0) * 100).toFixed(1)}% p.a.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Expected Real Return</p>
              <p className="text-lg text-gray-900">
                {((inputs?.expectedRealReturns?.[inputs?.clientRiskProfile || 'balanced'] || 0) * 100).toFixed(1)}% p.a.
              </p>
              <p className="text-xs text-gray-600 mt-1">Based on {inputs?.clientRiskProfile} profile</p>
            </div>
          </div>

          {/* Real Returns by Risk Profile */}
          {inputs?.expectedRealReturns && (
            <div className="contents">
              <Separator />
              <div>
                <p className="text-xs text-gray-700 mb-2"><strong>Real Return Assumptions by Risk Profile:</strong></p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(inputs.expectedRealReturns).map(([profile, rate]) => (
                    <div 
                      key={profile} 
                      className={`p-2 rounded-lg border text-center ${
                        profile === inputs.clientRiskProfile 
                          ? 'bg-purple-50 border-purple-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <p className="text-xs text-gray-600 capitalize">{profile}</p>
                      <p className="text-sm text-gray-900">{((rate as number) * 100).toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* No Results Available */}
      {!results && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-amber-900">
                Investment analysis calculations have not yet been completed. 
                Contact your financial adviser for a detailed assessment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Notes */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="mb-2">
                <strong>Important Notes:</strong>
              </p>
              <ul className="space-y-1 text-xs">
                <li>- Investment returns are projections based on real (inflation-adjusted) returns and are not guaranteed.</li>
                <li>- Goal funding analysis assumes consistent contributions and stable economic conditions.</li>
                <li>- Diversification across asset classes helps manage risk but does not guarantee profits or prevent losses.</li>
                <li>- Consider tax implications of different investment vehicles and account types.</li>
                <li>- Regular reviews (at least annually) are recommended to stay on track toward your goals.</li>
                <li>- Consult your financial adviser before implementing any investment strategy changes.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}