/**
 * Client-Side Retirement FNA Results Display
 * Read-only view of published Retirement Planning Analysis
 * 
 * Data source: /supabase/functions/server/retirement-fna-routes.tsx
 * Uses "inputs" and "results" fields from the stored session
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { 
  TrendingUp, 
  Calendar,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle,
  Info,
  PiggyBank,
  BarChart3,
  TrendingDown
} from 'lucide-react';
import { RetirementFNA, formatCurrency } from '../../../services/fna-api';

interface RetirementResultsProps {
  fna: RetirementFNA;
}

export function RetirementResults({ fna }: RetirementResultsProps) {
  const { results, inputs } = fna;

  // Guard against missing results
  if (!results) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-900">Retirement calculation results are not yet available for this analysis.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Derive values from actual data shape
  const currentAge = inputs.currentAge || 0;
  const retirementAge = inputs.intendedRetirementAge || inputs.retirementAge || 65;
  const yearsToRetirement = results.yearsToRetirement;
  const currentSavings = inputs.currentRetirementSavings || inputs.totalCurrentRetirementCapital || 0;
  const monthlyContribution = inputs.currentMonthlyContribution || inputs.totalMonthlyContribution || 0;

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-600">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 mb-2">Retirement Planning Analysis Summary</h3>
              <p className="text-sm text-gray-700 mb-4">
                Comprehensive projection of your retirement savings and income based on your current contributions 
                and economic assumptions.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-gray-600 mb-1">Current Age</p>
                  <p className="text-gray-900">{currentAge} years</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-gray-600 mb-1">Retirement Age</p>
                  <p className="text-gray-900">{retirementAge} years</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-gray-600 mb-1">Years to Go</p>
                  <p className="text-gray-900">{yearsToRetirement} years</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-gray-600 mb-1">Current Savings</p>
                  <p className="text-gray-900">{formatCurrency(currentSavings)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retirement Capital Projection */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600">
                <PiggyBank className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-base">Retirement Capital Analysis</CardTitle>
            </div>
            {results.hasShortfall ? (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Shortfall ({results.shortfallPercentage.toFixed(0)}%)
              </Badge>
            ) : (
              <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                <CheckCircle className="h-3 w-3" />
                On Track
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-gray-600 mb-1">Required Capital at Retirement</p>
              <p className="text-xl text-gray-900">
                {formatCurrency(results.requiredCapital)}
              </p>
              <p className="text-xs text-gray-600 mt-1">To sustain {results.yearsInRetirement} years of income</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-gray-600 mb-1">Projected Capital at Retirement</p>
              <p className="text-xl text-gray-900">
                {formatCurrency(results.projectedCapital)}
              </p>
              <p className="text-xs text-gray-600 mt-1">Based on current savings and contributions</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-gray-600 mb-1">Target Monthly Income</p>
              <p className="text-xl text-gray-900">
                {formatCurrency(results.targetMonthlyIncome)}
              </p>
              <p className="text-xs text-gray-600 mt-1">In future value terms</p>
            </div>
          </div>

          {results.hasShortfall && (
            <div className="contents">
              <Separator />
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 mb-1">
                      <strong>Capital Shortfall Identified</strong>
                    </p>
                    <p className="text-xs text-gray-600 mb-2">
                      Based on current savings and contributions, there is a projected shortfall of{' '}
                      <strong className="text-red-700">{formatCurrency(results.capitalShortfall)}</strong> at retirement
                      ({results.shortfallPercentage.toFixed(1)}% of required capital).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Contributions & Recommendations */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Savings Strategy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Current Retirement Capital</p>
              <p className="text-lg text-gray-900">{formatCurrency(currentSavings)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Current Monthly Contribution</p>
              <p className="text-lg text-gray-900">{formatCurrency(monthlyContribution)}</p>
            </div>
          </div>

          {results.requiredAdditionalContribution > 0 && (
            <div className="contents">
              <Separator />
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 mb-1">
                      <strong>Recommended Total Monthly Contribution</strong>
                    </p>
                    <p className="text-2xl text-green-700 mb-2">
                      {formatCurrency(results.totalRecommendedContribution)}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      Additional monthly contribution needed:{' '}
                      <strong className="text-green-700">
                        {formatCurrency(results.requiredAdditionalContribution)}
                      </strong>
                    </p>
                    <p className="text-xs text-gray-600">
                      This represents {results.percentageOfIncome.toFixed(1)}% of your gross monthly income.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planning Assumptions */}
      <Card className="border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-base">Planning Assumptions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-indigo-600" />
                <p className="text-xs text-gray-600">Pre-Retirement Return</p>
              </div>
              <p className="text-lg text-gray-900">{(results.realGrowthRate * 100).toFixed(1)}% p.a.</p>
              <p className="text-xs text-gray-600 mt-1">Nominal growth rate</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <p className="text-xs text-gray-600">Salary Escalation</p>
              </div>
              <p className="text-lg text-gray-900">{(results.realSalaryGrowth * 100).toFixed(1)}% p.a.</p>
              <p className="text-xs text-gray-600 mt-1">Expected annual increase</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-green-600" />
                <p className="text-xs text-gray-600">Years in Retirement</p>
              </div>
              <p className="text-lg text-gray-900">{results.yearsInRetirement} years</p>
              <p className="text-xs text-gray-600 mt-1">Post-retirement horizon</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <li>- Projections are based on assumed investment returns and inflation rates, which may vary.</li>
                <li>- Actual retirement outcomes depend on market performance, contribution consistency, and life events.</li>
                <li>- Regular reviews (annually) are recommended to stay on track toward your retirement goals.</li>
                <li>- Consider tax implications of retirement withdrawals and annuity income.</li>
                <li>- Consult your financial adviser before making significant changes to your retirement strategy.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}