/**
 * Estate Planning FNA Results View
 * Displays comprehensive estate planning analysis
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Users,
  FileText,
  Building2,
  TrendingDown,
  Shield,
} from 'lucide-react';
import type { EstatePlanningSession } from '../types';
import { EstatePlanningCalculationService } from '../utils';

interface EstatePlanningResultsViewProps {
  fna: EstatePlanningSession;
}

export function EstatePlanningResultsView({ fna: session }: EstatePlanningResultsViewProps) {
  if (!session.results) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No results available. Please run the calculation first.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { results } = session;
  const {
    deathBalanceSheet,
    liquidityAnalysis,
    structuralRisks,
    executiveSummary,
    minorChildrenAnalysis,
    businessContinuity,
  } = results;

  const formatCurrency = (amount: number) =>
    `R${EstatePlanningCalculationService.formatCurrency(amount)}`;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRiskIcon = (category: string) => {
    switch (category) {
      case 'will':
        return <FileText className="h-5 w-5" />;
      case 'guardianship':
        return <Users className="h-5 w-5" />;
      case 'liquidity':
        return <DollarSign className="h-5 w-5" />;
      case 'business':
        return <Building2 className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getLiquidityRiskColor = (risk: string) => {
    switch (risk) {
      case 'severe':
        return 'text-red-600 bg-red-50 border-red-300';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50 border-yellow-300';
      default:
        return 'text-green-600 bg-green-50 border-green-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#6d28d9]" />
            Estate Planning Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-muted-foreground mb-1">Gross Estate Value</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(executiveSummary.grossEstateValue)}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-muted-foreground mb-1">Net Estate for Heirs</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(executiveSummary.netEstateValue)}
              </p>
            </div>
          </div>

          {executiveSummary.criticalRisksCount > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">
                  {executiveSummary.criticalRisksCount} Critical Risk(s) Identified
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Key Recommendations:</h4>
            {executiveSummary.keyRecommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Death Balance Sheet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-[#6d28d9]" />
            Death Balance Sheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Assets Breakdown */}
          <div>
            <h4 className="font-medium mb-2">Estate Assets</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {deathBalanceSheet.grossEstateAssets.property > 0 && (
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>Property:</span>
                  <span className="font-medium">
                    {formatCurrency(deathBalanceSheet.grossEstateAssets.property)}
                  </span>
                </div>
              )}
              {deathBalanceSheet.grossEstateAssets.financial > 0 && (
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>Financial Assets:</span>
                  <span className="font-medium">
                    {formatCurrency(deathBalanceSheet.grossEstateAssets.financial)}
                  </span>
                </div>
              )}
              {deathBalanceSheet.grossEstateAssets.business > 0 && (
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>Business Interests:</span>
                  <span className="font-medium">
                    {formatCurrency(deathBalanceSheet.grossEstateAssets.business)}
                  </span>
                </div>
              )}
              {deathBalanceSheet.grossEstateAssets.deemedProperty > 0 && (
                <div className="flex justify-between p-2 bg-gray-50 rounded">
                  <span>Deemed Property:</span>
                  <span className="font-medium">
                    {formatCurrency(deathBalanceSheet.grossEstateAssets.deemedProperty)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Estate Duty Calculation */}
          <div>
            <h4 className="font-medium mb-2">Estate Duty Calculation</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Gross Estate:</span>
                <span className="font-medium">
                  {formatCurrency(deathBalanceSheet.estateDuty.grossEstate)}
                </span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Less: Liabilities</span>
                <span className="font-medium">
                  ({formatCurrency(deathBalanceSheet.estateDuty.lessLiabilities)})
                </span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Less: Admin Costs</span>
                <span className="font-medium">
                  ({formatCurrency(deathBalanceSheet.estateDuty.lessCosts)})
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Net Estate (before duty):</span>
                <span>{formatCurrency(deathBalanceSheet.estateDuty.netEstateBeforeDuty)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Less: Abatement</span>
                <span className="font-medium">
                  ({formatCurrency(deathBalanceSheet.estateDuty.lessAbatement)})
                </span>
              </div>
              {deathBalanceSheet.estateDuty.lessSpousalDeduction > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Less: Spousal Deduction</span>
                  <span className="font-medium">
                    ({formatCurrency(deathBalanceSheet.estateDuty.lessSpousalDeduction)})
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Estimated Estate Duty:</span>
                <span className="text-red-600">
                  {formatCurrency(deathBalanceSheet.estateDuty.estimatedEstateDuty)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liquidity Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[#6d28d9]" />
            Liquidity Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs text-muted-foreground mb-1">Liquid Assets</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(liquidityAnalysis.liquidAssets.total)}
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-muted-foreground mb-1">Semi-Liquid Assets</p>
              <p className="text-xl font-bold text-yellow-600">
                {formatCurrency(liquidityAnalysis.semiLiquidAssets.total)}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-muted-foreground mb-1">Illiquid Assets</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(liquidityAnalysis.illiquidAssets.total)}
              </p>
            </div>
          </div>

          <Separator />

          <div className={`p-4 rounded-lg border ${getLiquidityRiskColor(liquidityAnalysis.liquidityRisk)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Liquidity Status</span>
              <Badge className={getSeverityColor(liquidityAnalysis.liquidityRisk === 'severe' ? 'high' : liquidityAnalysis.liquidityRisk === 'moderate' ? 'medium' : 'low')}>
                {liquidityAnalysis.liquidityRisk.toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Required:</span>
                <p className="font-bold">{formatCurrency(liquidityAnalysis.liquidityRequired.total)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Available:</span>
                <p className="font-bold">{formatCurrency(liquidityAnalysis.liquidityAvailable)}</p>
              </div>
            </div>
            {liquidityAnalysis.liquidityShortfall > 0 && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">Shortfall:</span>
                <p className="font-bold text-lg text-red-600">
                  {formatCurrency(liquidityAnalysis.liquidityShortfall)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Liquidity Recommendations:</h4>
            {liquidityAnalysis.liquidityRecommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{rec}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Structural Risks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#6d28d9]" />
            Structural Risks & Issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {structuralRisks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p>No major structural risks identified. Estate planning appears well structured.</p>
            </div>
          ) : (
            structuralRisks.map((risk, index) => (
              <div key={index} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getRiskIcon(risk.category)}
                    <h4 className="font-medium capitalize">{risk.category.replace('_', ' ')}</h4>
                  </div>
                  <Badge className={getSeverityColor(risk.severity)}>
                    {risk.severity.toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Issue: </span>
                    {risk.issue}
                  </div>
                  <div>
                    <span className="font-medium">Impact: </span>
                    {risk.impact}
                  </div>
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <span className="font-medium text-blue-800">Recommendation: </span>
                    <span className="text-blue-700">{risk.recommendation}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Additional Analysis Sections */}
      <div className="grid grid-cols-2 gap-4">
        {/* Minor Children */}
        {minorChildrenAnalysis.hasMinorChildren && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-[#6d28d9]" />
                Minor Children
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Number of Minors: </span>
                {minorChildrenAnalysis.minorChildren.length}
              </div>
              <div>
                <span className="font-medium">Guardian Nominated: </span>
                {minorChildrenAnalysis.guardianNominated ? (
                  <Badge className="bg-green-100 text-green-800">Yes</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">No</Badge>
                )}
              </div>
              <div>
                <span className="font-medium">Capital Management: </span>
                <span className="capitalize">
                  {minorChildrenAnalysis.capitalManagementStructure.replace('_', ' ')}
                </span>
              </div>
              {minorChildrenAnalysis.recommendations.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="font-medium mb-1">Actions:</p>
                  {minorChildrenAnalysis.recommendations.slice(0, 2).map((rec, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">• {rec}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Business Continuity */}
        {businessContinuity.hasBusinessInterests && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-[#6d28d9]" />
                Business Continuity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Business Interests: </span>
                {businessContinuity.businessAssets.length}
              </div>
              <div>
                <span className="font-medium">Buy & Sell Agreement: </span>
                {businessContinuity.buyAndSellAgreements.inPlace ? (
                  <Badge className="bg-green-100 text-green-800">Yes</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">No</Badge>
                )}
              </div>
              <div>
                <span className="font-medium">Agreement Funded: </span>
                {businessContinuity.buyAndSellAgreements.funded ? (
                  <Badge className="bg-green-100 text-green-800">Yes</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800">No</Badge>
                )}
              </div>
              {businessContinuity.recommendations.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="font-medium mb-1">Actions:</p>
                  {businessContinuity.recommendations.slice(0, 2).map((rec, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">• {rec}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
