/**
 * Step 4: Finalise & Publish
 * 
 * Behaviour Rules:
 * - Lock calculations and generate final FNA output
 * - Display all final recommended values
 * - Show compliance disclaimers if applicable
 * - Allow publish to generate RoA-ready output
 * - Generate PDF export if needed
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { Alert, AlertDescription } from '../../../../ui/alert';
import { CheckCircle2, AlertTriangle, ArrowLeft, Save, FileText, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { formatCurrency } from '../../../../../utils/currencyFormatter';
import { RetirementFNAInputs, RetirementCalculationResults, RetirementFNAAdjustments } from '../types';

interface Step4FinaliseProps {
  inputs: RetirementFNAInputs;
  calculations: RetirementCalculationResults;
  adjustments: RetirementFNAAdjustments;
  onPublish: () => void;
  onBack: () => void;
}

export function Step4Finalise({ 
  inputs, 
  calculations, 
  adjustments, 
  onPublish, 
  onBack 
}: Step4FinaliseProps) {
  const {
    requiredCapital,
    projectedCapital,
    capitalShortfall,
    hasShortfall,
    requiredAdditionalContribution,
    totalRecommendedContribution,
    targetMonthlyIncome,
    yearsInRetirement
  } = calculations;

  const effectiveRetirementAge = adjustments.retirementAge || inputs.retirementAge;
  const effectiveYearsInRetirement = adjustments.yearsInRetirement || yearsInRetirement;

  return (
    <div className="space-y-8">
      {/* Status Alert */}
      <Alert className={hasShortfall ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
        {hasShortfall ? (
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        )}
        <div>
          <AlertDescription className={hasShortfall ? "text-yellow-900 font-semibold" : "text-green-900 font-semibold"}>
            {hasShortfall 
              ? "Retirement Shortfall Identified - Action Required" 
              : "Client is On Track to Meet Retirement Goals"}
          </AlertDescription>
        </div>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Summary Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Retirement Plan Summary</CardTitle>
                <CardDescription className="mt-2">
                  Final calculated values incorporating all adjustments
                </CardDescription>
              </div>
              <Badge 
                variant={hasShortfall ? "destructive" : "default"}
                className={hasShortfall ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
              >
                {hasShortfall ? "Shortfall" : "On Track"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Target Monthly Income</p>
                <p className="text-2xl font-bold">{formatCurrency(targetMonthlyIncome)}</p>
                <p className="text-xs text-muted-foreground">Future value (at retirement)</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Required Capital</p>
                <p className="text-2xl font-bold">{formatCurrency(requiredCapital)}</p>
                <p className="text-xs text-muted-foreground">At age {effectiveRetirementAge}</p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Projected Capital</p>
                <p className="text-2xl font-bold">{formatCurrency(projectedCapital)}</p>
                <p className="text-xs text-muted-foreground">From current savings + contributions</p>
              </div>
              <div className={`p-4 rounded-lg ${hasShortfall ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                <p className="text-sm text-muted-foreground mb-1">
                  {hasShortfall ? "Capital Shortfall" : "Capital Surplus"}
                </p>
                <p className={`text-2xl font-bold flex items-center gap-1 ${hasShortfall ? 'text-yellow-700' : 'text-green-700'}`}>
                  {hasShortfall ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                  {formatCurrency(Math.abs(capitalShortfall))}
                </p>
                <p className="text-xs text-muted-foreground">Difference at retirement</p>
              </div>
            </div>

            <Separator />

            {/* Recommendation */}
            <div>
              <h4 className="font-semibold mb-3">Final Recommendation</h4>
              {hasShortfall ? (
                <Card className="border-yellow-200 bg-yellow-50/50">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <p className="text-sm">
                        Based on the analysis, the client requires an <strong>additional monthly contribution</strong> to meet their retirement goals:
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-primary">
                          {formatCurrency(requiredAdditionalContribution)}
                        </span>
                        <span className="text-muted-foreground">per month</span>
                      </div>
                      <Separator />
                      <div className="text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Current Monthly Contribution:</span>
                          <span className="font-medium">{formatCurrency(inputs.currentMonthlyContribution || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Required Additional:</span>
                          <span className="font-medium">{formatCurrency(requiredAdditionalContribution)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-base font-semibold text-foreground">
                          <span>Total Recommended:</span>
                          <span>{formatCurrency(totalRecommendedContribution)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="font-semibold text-green-900">Client's Plan is On Track</p>
                        <p className="text-sm text-green-800">
                          Current savings and contribution levels are projected to meet or exceed the required retirement capital. 
                          The client is well-positioned to achieve their retirement income goals.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Adviser Notes */}
            {adjustments.adviserNotes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Adviser Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {adjustments.adviserNotes}
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Assumptions Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Assumptions Used</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Client Profile</p>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Age:</span>
                  <span className="font-medium">{inputs.currentAge}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retirement Age:</span>
                  <span className="font-medium">{effectiveRetirementAge}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Years to Retirement:</span>
                  <span className="font-medium">{effectiveRetirementAge - inputs.currentAge}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Years in Retirement:</span>
                  <span className="font-medium">{effectiveYearsInRetirement}</span>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-muted-foreground">Economic Assumptions</p>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inflation (CPI):</span>
                  <span className="font-medium">{((adjustments.inflationRate || 0.06) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pre-Ret Growth:</span>
                  <span className="font-medium">{((adjustments.preRetirementReturn || 0.10) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Post-Ret Growth:</span>
                  <span className="font-medium">{((adjustments.postRetirementReturn || 0.08) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Replacement Ratio:</span>
                  <span className="font-medium">{((adjustments.replacementRatio || 0.75) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          This analysis is based on standard actuarial assumptions and current legislation. 
          Actual results may vary based on market conditions, legislative changes, and individual circumstances.
        </AlertDescription>
      </Alert>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Step 3
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled>
            <FileText className="mr-2 h-4 w-4" />
            Preview PDF
          </Button>
          <Button 
            type="button" 
            onClick={onPublish} 
            size="lg"
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="mr-2 h-4 w-4" />
            Publish & Close
          </Button>
        </div>
      </div>
    </div>
  );
}
