/**
 * Step 2: System Auto-Calculation
 * 
 * Behaviour Rules:
 * - NO MANUAL EDITING IN THIS STEP
 * - Display all calculated values from Step 1 input
 * - Show formulas and assumptions used
 * - Display warnings and recommendations
 * - Navigation: Back to Step 1, Next to Step 3
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../../ui/alert';
import { CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../../../../utils/currencyFormatter';
import { RetirementFNAInputs, RetirementCalculationResults } from '../types';
import { SVGBarChart } from '../../../../ui/svg-charts';

interface Step2SystemCalculationProps {
  inputs: Partial<RetirementFNAInputs>;
  calculations: RetirementCalculationResults;
  onNext: () => void;
  onBack: () => void;
}

export function Step2SystemCalculation({ inputs, calculations, onNext, onBack }: Step2SystemCalculationProps) {
  const {
    requiredCapital,
    projectedCapital,
    capitalShortfall,
    hasShortfall,
    requiredAdditionalContribution,
    shortfallPercentage,
    targetMonthlyIncome,
    yearsInRetirement
  } = calculations;

  const chartData = [
    {
      name: 'At Retirement',
      Projected: Math.round(projectedCapital),
      Required: Math.round(requiredCapital),
    }
  ];

  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          All calculations below are system-generated based on standard actuarial assumptions. 
          You will have the opportunity to apply manual adjustments in Step 3.
        </AlertDescription>
      </Alert>

      {/* Status Banner */}
      <Alert className={hasShortfall ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
        {hasShortfall ? (
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        )}
        <div>
          <AlertTitle className={hasShortfall ? "text-yellow-900" : "text-green-900"}>
            {hasShortfall ? "Projected Shortfall Detected" : "On Track for Retirement"}
          </AlertTitle>
          <AlertDescription className={hasShortfall ? "text-yellow-800" : "text-green-800"}>
            {hasShortfall 
              ? `The client is currently projected to fall ${shortfallPercentage.toFixed(0)}% short of their required retirement capital.`
              : "The client is projected to fully meet their retirement capital goals with current savings and contributions."}
          </AlertDescription>
        </div>
      </Alert>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Target Monthly Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(targetMonthlyIncome)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Future value (at retirement)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Required Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(requiredCapital)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              To sustain income for {yearsInRetirement} years
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(projectedCapital)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From current assets + contributions
            </p>
          </CardContent>
        </Card>

        <Card className={hasShortfall ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {hasShortfall ? "Shortfall" : "Surplus"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold flex items-center gap-1 ${hasShortfall ? "text-yellow-700" : "text-green-700"}`}>
              {hasShortfall ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
              {formatCurrency(Math.abs(capitalShortfall))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              At age {inputs.retirementAge}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>System Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <p>
                Based on a retirement age of <strong>{inputs.retirementAge}</strong>, the client requires{' '}
                <strong>{formatCurrency(requiredCapital)}</strong> to maintain a living standard of{' '}
                <strong>{formatCurrency(targetMonthlyIncome)}</strong> per month.
              </p>
              <p>
                Current savings and contribution levels are projected to reach{' '}
                <strong>{formatCurrency(projectedCapital)}</strong> by retirement.
              </p>
            </div>

            {hasShortfall && (
              <Alert className="border-primary/20 bg-primary/10">
                <Info className="h-4 w-4 text-primary" />
                <div>
                  <AlertTitle className="text-sm font-semibold">Recommendation</AlertTitle>
                  <AlertDescription className="text-sm mt-1">
                    To close this gap, an additional monthly contribution of{' '}
                    <strong>{formatCurrency(requiredAdditionalContribution)}</strong> is required.
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Capital Projection Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Projection</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <SVGBarChart
              data={chartData}
              categoryKey="name"
              series={[
                { key: 'Projected', label: 'Projected Capital', color: 'var(--primary, #6d28d9)' },
                { key: 'Required', label: 'Required Capital', color: '#9ca3af' },
              ]}
              height={250}
              yAxisFormatter={(value) => `R${(value / 1000000).toFixed(1)}m`}
              tooltipFormatter={(value) => formatCurrency(value)}
              margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Next Step Preview */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <strong>Next Step:</strong> You can apply manual adjustments to assumptions (inflation rate, growth rate) 
          in Step 3 if the standard calculations need to be refined.
        </AlertDescription>
      </Alert>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Step 1
        </Button>
        <Button type="button" onClick={onNext} size="lg" className="bg-primary hover:bg-primary/90">
          Continue to Adjustments
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
