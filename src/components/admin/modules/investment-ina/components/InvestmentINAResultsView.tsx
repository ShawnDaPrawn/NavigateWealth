/**
 * Investment Needs Analysis Results View
 * Displays detailed INA results with goal breakdowns
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Separator } from '../../../../ui/separator';
import { 
  Target, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  ArrowRight,
  Download,
  Edit
} from 'lucide-react';
import type { InvestmentINASession, GoalCalculationResult } from '../types';
import { InvestmentINACalculationService } from '../services/investmentINACalculationService';

interface InvestmentINAResultsViewProps {
  session: InvestmentINASession;
  onEdit?: () => void;
  onDownloadPDF?: () => void;
}

export function InvestmentINAResultsView({ 
  session, 
  onEdit, 
  onDownloadPDF 
}: InvestmentINAResultsViewProps) {
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
  const { portfolioSummary, goalResults, recommendations } = results;

  const formatCurrency = (amount: number) => 
    InvestmentINACalculationService.formatCurrency(amount);
  
  const formatPercentage = (value: number) => 
    InvestmentINACalculationService.formatPercentage(value);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'on-track':
      case 'overfunded':
        return 'default';
      case 'slight-shortfall':
        return 'secondary';
      case 'moderate-shortfall':
        return 'outline';
      case 'significant-shortfall':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getHealthBadgeColor = (health: string) => {
    switch (health) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'needs-attention':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Investment Needs Analysis Results</h2>
          <p className="text-muted-foreground">
            Version {session.version} • {session.status === 'published' ? 'Published' : 'Draft'} • 
            {' '}{new Date(session.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {onDownloadPDF && (
            <Button variant="outline" onClick={onDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Portfolio Summary
          </CardTitle>
          <CardDescription>
            Overall investment portfolio health and goal tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Health Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Portfolio Health</span>
            <Badge className={getHealthBadgeColor(portfolioSummary.overallPortfolioHealth)}>
              {portfolioSummary.overallPortfolioHealth.replace('-', ' ').toUpperCase()}
            </Badge>
          </div>

          <Separator />

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Goals</p>
              <p className="text-2xl">{portfolioSummary.totalGoals}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">On Track</p>
              <p className="text-2xl text-green-600">{portfolioSummary.goalsOnTrack}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Underfunded</p>
              <p className="text-2xl text-orange-600">{portfolioSummary.goalsUnderfunded}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Overfunded</p>
              <p className="text-2xl text-blue-600">{portfolioSummary.goalsOverfunded}</p>
            </div>
          </div>

          <Separator />

          {/* Financial Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Required Capital</span>
                <span className="text-sm">{formatCurrency(portfolioSummary.totalRequiredCapital)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Projected Capital</span>
                <span className="text-sm">{formatCurrency(portfolioSummary.totalProjectedCapital)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-sm">Total Funding Gap</span>
                <span className={`text-sm ${portfolioSummary.totalFundingGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {portfolioSummary.totalFundingGap > 0 ? '-' : '+'}{formatCurrency(Math.abs(portfolioSummary.totalFundingGap))}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Additional Monthly Required</span>
                <span className="text-sm font-semibold">
                  {formatCurrency(portfolioSummary.totalAdditionalMonthlyRequired)}/month
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Goals */}
      <div className="space-y-4">
        <h3 className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Individual Goals
        </h3>

        {goalResults.map((goal) => (
          <GoalResultCard key={goal.goalId} goal={goal} />
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Recommendations
            </CardTitle>
            <CardDescription>
              Suggested actions to meet your investment goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                <ArrowRight className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{rec.goalName}</span>
                    <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.action}</p>
                  <p className="text-sm text-muted-foreground italic mt-1">{rec.impact}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Economic Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Economic Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Long-term Inflation Rate</span>
            <span className="text-sm">{formatPercentage(results.economicAssumptions.inflationRate)}</span>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">Expected Real Returns by Risk Profile</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(results.economicAssumptions.realReturnsByProfile).map(([profile, returnRate]) => (
                <div key={profile} className="text-center p-2 bg-muted/50 rounded">
                  <p className="text-xs text-muted-foreground capitalize">{profile}</p>
                  <p className="text-sm font-medium">{formatPercentage(returnRate)}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Individual Goal Result Card Component
 */
function GoalResultCard({ goal }: { goal: GoalCalculationResult }) {
  const formatCurrency = (amount: number) => 
    InvestmentINACalculationService.formatCurrency(amount);
  
  const formatPercentage = (value: number) => 
    InvestmentINACalculationService.formatPercentage(value);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'on-track':
        return 'default';
      case 'slight-shortfall':
        return 'secondary';
      case 'moderate-shortfall':
      case 'significant-shortfall':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'on-track' || status === 'overfunded') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return <AlertCircle className="h-5 w-5 text-orange-600" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(goal.goalStatus)}
              {goal.goalName}
            </CardTitle>
            <CardDescription className="mt-1">
              {goal.statusRationale}
            </CardDescription>
          </div>
          <Badge variant={getStatusBadgeVariant(goal.goalStatus)}>
            {InvestmentINACalculationService.getGoalStatusLabel(goal.goalStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Horizon */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{goal.timeHorizon.yearsToGoal} years until {goal.timeHorizon.targetYear}</span>
          {!goal.timeHorizon.isValidTimeHorizon && (
            <Badge variant="destructive" className="ml-2">Invalid Timeline</Badge>
          )}
        </div>

        <Separator />

        {/* Funding Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Required Capital</p>
            <p className="text-lg font-semibold">{formatCurrency(goal.fundingGap.goalRequiredReal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Projected Capital</p>
            <p className="text-lg font-semibold">{formatCurrency(goal.fundingGap.projectedCapitalAtGoal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {goal.fundingGap.hasShortfall ? 'Shortfall' : 'Surplus'}
            </p>
            <p className={`text-lg font-semibold ${goal.fundingGap.hasShortfall ? 'text-red-600' : 'text-green-600'}`}>
              {goal.fundingGap.hasShortfall ? '-' : '+'}{formatCurrency(Math.abs(goal.fundingGap.gapAmount))}
            </p>
          </div>
        </div>

        {/* Funding Percentage */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Funding Progress</span>
            <span className="font-medium">{formatPercentage(goal.fundingGap.fundingPercentage / 100)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                goal.fundingGap.fundingPercentage >= 100 ? 'bg-green-600' :
                goal.fundingGap.fundingPercentage >= 90 ? 'bg-blue-600' :
                goal.fundingGap.fundingPercentage >= 70 ? 'bg-orange-600' :
                'bg-red-600'
              }`}
              style={{ width: `${Math.min(100, goal.fundingGap.fundingPercentage)}%` }}
            />
          </div>
        </div>

        {/* Projected Capital Breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Projected Capital Breakdown</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Existing Investments</span>
              <span>{formatCurrency(goal.projectedCapital.existingCapital.totalExistingFutureValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly Contributions</span>
              <span>{formatCurrency(goal.projectedCapital.monthlyContributions.futureValueOfContributions)}</span>
            </div>
            {goal.projectedCapital.totalLumpSumFutureValue > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lump Sum Contributions</span>
                <span>{formatCurrency(goal.projectedCapital.totalLumpSumFutureValue)}</span>
              </div>
            )}
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold">
              <span>Total Projected</span>
              <span>{formatCurrency(goal.projectedCapital.totalProjectedCapital)}</span>
            </div>
          </div>
        </div>

        {/* Required Actions */}
        {goal.fundingGap.hasShortfall && goal.requiredContributions.canMeetGoal && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900">Required Action to Meet Goal</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Current Monthly Contribution</span>
                <span className="font-medium text-blue-900">
                  {formatCurrency(goal.requiredContributions.currentMonthlyContribution)}/month
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Additional Monthly Required</span>
                <span className="font-medium text-blue-900">
                  +{formatCurrency(goal.requiredContributions.requiredAdditionalMonthly)}/month
                </span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold">
                <span className="text-blue-700">Recommended Total Monthly</span>
                <span className="text-blue-900">
                  {formatCurrency(goal.requiredContributions.recommendedTotalMonthly)}/month
                </span>
              </div>
            </div>
            <p className="text-xs text-blue-600 italic mt-2">
              Alternative: Invest a lump sum of {formatCurrency(goal.requiredContributions.alternativeLumpSumToday)} today
            </p>
          </div>
        )}

        {/* Investment Details */}
        {goal.projectedCapital.existingCapital.linkedInvestments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Linked Investments ({goal.projectedCapital.existingCapital.linkedInvestments.length})</p>
            <div className="space-y-1 text-sm">
              {goal.projectedCapital.existingCapital.linkedInvestments.map((inv, index) => (
                <div key={index} className="flex justify-between text-muted-foreground">
                  <span>{inv.investmentName}</span>
                  <span>{formatCurrency(inv.currentValue)} → {formatCurrency(inv.futureValue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Profile */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Risk Profile</span>
          <Badge variant="outline" className="capitalize">
            {goal.applicableRiskProfile} ({formatPercentage(goal.applicableRealReturn)} real return)
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
