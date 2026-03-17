/**
 * InsightsSection — Aggregated Smart Insights across all financial pillars
 *
 * Derives actionable insights from the PortfolioSummary data and displays
 * them in a prioritised grid, grouped by severity (high → medium → low).
 *
 * Guidelines refs: §7.1 (derived display state), §8.3 (status colour vocabulary)
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import {
  Lightbulb,
  AlertTriangle,
  Info,
  TrendingUp,
  Shield,
  Heart,
  PiggyBank,
  Landmark,
  FileText,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import type { PortfolioFinancialOverview } from '../api';
import { formatCurrency } from '../../../../utils/currencyFormatter';
import { RiskPlanningFnaAPI } from '../../../admin/modules/risk-planning-fna/api';
import type { FinalRiskNeed } from '../../../admin/modules/risk-planning-fna/types';

interface InsightsSectionProps {
  overview: PortfolioFinancialOverview;
  clientId: string;
  totalWealthValue?: number;
}

interface AggregatedInsight {
  id: string;
  pillar: string;
  pillarIcon: React.ElementType;
  pillarColor: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  actionLabel?: string;
  actionPath?: string;
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

const SEVERITY_STYLES = {
  high: {
    border: 'border-l-red-500',
    bg: 'bg-red-50/60',
    badge: 'bg-red-100 text-red-700 border-transparent',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    label: 'Action Required',
  },
  medium: {
    border: 'border-l-amber-400',
    bg: 'bg-amber-50/60',
    badge: 'bg-amber-100 text-amber-700 border-transparent',
    icon: Info,
    iconColor: 'text-amber-500',
    label: 'Review Recommended',
  },
  low: {
    border: 'border-l-blue-400',
    bg: 'bg-blue-50/40',
    badge: 'bg-blue-100 text-blue-700 border-transparent',
    icon: TrendingUp,
    iconColor: 'text-blue-500',
    label: 'Opportunity',
  },
} as const;

const PILLAR_CONFIG: Record<string, { icon: React.ElementType; color: string; path: string }> = {
  'Risk Management': { icon: Shield, color: 'text-purple-600', path: '/dashboard/risk-management' },
  'Medical Aid': { icon: Heart, color: 'text-rose-600', path: '/dashboard/medical-aid' },
  'Retirement': { icon: PiggyBank, color: 'text-amber-600', path: '/dashboard/retirement-planning' },
  'Investment': { icon: TrendingUp, color: 'text-green-600', path: '/dashboard/investment-management' },
  'Estate Planning': { icon: Landmark, color: 'text-purple-600', path: '/dashboard/estate-planning' },
  'Tax Planning': { icon: FileText, color: 'text-indigo-600', path: '/dashboard/tax-planning' },
  'Employee Benefits': { icon: Briefcase, color: 'text-blue-600', path: '/dashboard/employee-benefits' },
};

export function InsightsSection({ overview, clientId, totalWealthValue = 0 }: InsightsSectionProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [riskInsights, setRiskInsights] = useState<AggregatedInsight[]>([]);

  // Fetch risk FNA data for coverage gap insights
  useEffect(() => {
    async function fetchRiskFNA() {
      if (!clientId) return;
      try {
        const fna = await RiskPlanningFnaAPI.getLatestPublished(clientId);
        const insights: AggregatedInsight[] = [];

        if (fna?.finalNeeds && fna.finalNeeds.length > 0) {
          const gaps = fna.finalNeeds.filter(
            (need: FinalRiskNeed) => need.finalRecommendedCover > 0,
          );
          if (gaps.length > 0) {
            const totalGap = gaps.reduce(
              (sum: number, n: FinalRiskNeed) => sum + n.finalRecommendedCover, 0,
            );
            insights.push({
              id: 'agg-risk-gap',
              pillar: 'Risk Management',
              pillarIcon: Shield,
              pillarColor: 'text-purple-600',
              title: `${gaps.length} Coverage ${gaps.length === 1 ? 'Gap' : 'Gaps'} Identified`,
              description: `Total shortfall of ${formatCurrency(totalGap)} across ${gaps.map((g: FinalRiskNeed) => g.label).join(', ')}.`,
              severity: totalGap > 1_000_000 ? 'high' : totalGap > 500_000 ? 'medium' : 'low',
              actionLabel: 'View Risk Analysis',
              actionPath: '/dashboard/risk-management',
            });
          }
        } else {
          insights.push({
            id: 'agg-risk-no-fna',
            pillar: 'Risk Management',
            pillarIcon: Shield,
            pillarColor: 'text-purple-600',
            title: 'No Risk Assessment on File',
            description: 'Complete a Financial Needs Analysis to identify coverage gaps and ensure your family is protected.',
            severity: 'high',
            actionLabel: 'Start Assessment',
            actionPath: '/dashboard/risk-management',
          });
        }

        setRiskInsights(insights);
      } catch (e) {
        console.error('Failed to fetch risk FNA for aggregated insights:', e);
      }
    }
    fetchRiskFNA();
  }, [clientId]);

  // Derive insights from all pillars
  const allInsights = useMemo<AggregatedInsight[]>(() => {
    const insights: AggregatedInsight[] = [...riskInsights];

    // ── Medical Aid ──
    const med = overview.medicalAid;
    if (!med || med.status === 'not-assessed') {
      insights.push({
        id: 'agg-med-no-data',
        pillar: 'Medical Aid',
        pillarIcon: Heart,
        pillarColor: 'text-rose-600',
        title: 'Medical Aid Not Assessed',
        description: 'A healthcare needs analysis will identify the best scheme and plan for your family.',
        severity: 'high',
        actionLabel: 'Review Medical Aid',
        actionPath: '/dashboard/medical-aid',
      });
    } else {
      const currentMonth = new Date().getMonth();
      if (currentMonth >= 8 && currentMonth <= 11) {
        insights.push({
          id: 'agg-med-review',
          pillar: 'Medical Aid',
          pillarIcon: Heart,
          pillarColor: 'text-rose-600',
          title: 'Medical Aid Review Season',
          description: 'Benefits change from 1 January. Now is the time to compare plans.',
          severity: 'medium',
          actionLabel: 'Review Plans',
          actionPath: '/dashboard/medical-aid',
        });
      }
    }

    // ── Retirement ──
    const ret = overview.retirement;
    if (!ret || ret.status === 'not-assessed') {
      insights.push({
        id: 'agg-ret-no-data',
        pillar: 'Retirement',
        pillarIcon: PiggyBank,
        pillarColor: 'text-amber-600',
        title: 'Retirement Not Assessed',
        description: 'A retirement needs analysis will project whether your savings will meet your income needs.',
        severity: 'high',
        actionLabel: 'Start Assessment',
        actionPath: '/dashboard/retirement-planning',
      });
    } else {
      if (ret.progressToGoal > 0 && ret.progressToGoal < 60) {
        insights.push({
          id: 'agg-ret-behind',
          pillar: 'Retirement',
          pillarIcon: PiggyBank,
          pillarColor: 'text-amber-600',
          title: 'Retirement Savings Behind Target',
          description: `At ${ret.progressToGoal}% of goal. Consider increasing contributions.`,
          severity: ret.progressToGoal < 30 ? 'high' : 'medium',
          actionLabel: 'View Details',
          actionPath: '/dashboard/retirement-planning',
        });
      }
      if (ret.monthlyContribution > 0) {
        const annual = ret.monthlyContribution * 12;
        if (annual < 350_000 * 0.7) {
          insights.push({
            id: 'agg-ret-tax',
            pillar: 'Retirement',
            pillarIcon: PiggyBank,
            pillarColor: 'text-amber-600',
            title: 'Tax Deduction Headroom',
            description: `Your RA contributions are below the R350k annual limit — you may save more on tax.`,
            severity: 'low',
            actionLabel: 'View Details',
            actionPath: '/dashboard/retirement-planning',
          });
        }
      }
    }

    // ── Investment ──
    const inv = overview.investment;
    if (!inv || inv.status === 'not-assessed') {
      insights.push({
        id: 'agg-inv-no-data',
        pillar: 'Investment',
        pillarIcon: TrendingUp,
        pillarColor: 'text-green-600',
        title: 'Investment Portfolio Not Assessed',
        description: 'An investment analysis will align your portfolio with your risk profile and goals.',
        severity: 'medium',
        actionLabel: 'Start Assessment',
        actionPath: '/dashboard/investment-management',
      });
    } else {
      if (inv.totalValue > 0 && inv.goalsLinked === 0) {
        insights.push({
          id: 'agg-inv-goals',
          pillar: 'Investment',
          pillarIcon: TrendingUp,
          pillarColor: 'text-green-600',
          title: 'Investments Not Linked to Goals',
          description: 'Goal-based investing improves discipline and outcomes.',
          severity: 'medium',
          actionLabel: 'Link Goals',
          actionPath: '/dashboard/investment-management',
        });
      }
    }

    // ── Estate Planning ──
    const est = overview.estate;
    if (!est || est.status === 'not-assessed') {
      insights.push({
        id: 'agg-est-no-data',
        pillar: 'Estate Planning',
        pillarIcon: Landmark,
        pillarColor: 'text-purple-600',
        title: 'Estate Plan Not Assessed',
        description: 'Ensure your assets are protected and your family provided for.',
        severity: 'high',
        actionLabel: 'Review Estate',
        actionPath: '/dashboard/estate-planning',
      });
    } else {
      if (est.willStatus === 'not-drafted') {
        insights.push({
          id: 'agg-est-no-will',
          pillar: 'Estate Planning',
          pillarIcon: Landmark,
          pillarColor: 'text-purple-600',
          title: 'No Valid Will on Record',
          description: 'Without a Will, your estate will be distributed per the Intestate Succession Act.',
          severity: 'high',
          actionLabel: 'Draft Will',
          actionPath: '/dashboard/estate-planning',
        });
      }
      if (est.nominationStatus === 'incomplete') {
        insights.push({
          id: 'agg-est-nominations',
          pillar: 'Estate Planning',
          pillarIcon: Landmark,
          pillarColor: 'text-purple-600',
          title: 'Beneficiary Nominations Incomplete',
          description: 'Update nominations across all policies to avoid delays in claims.',
          severity: 'medium',
          actionLabel: 'Update Nominations',
          actionPath: '/dashboard/estate-planning',
        });
      }
      if (totalWealthValue > 3_500_000) {
        insights.push({
          id: 'agg-est-duty',
          pillar: 'Estate Planning',
          pillarIcon: Landmark,
          pillarColor: 'text-purple-600',
          title: 'Estate Duty Exposure',
          description: 'Your wealth exceeds the R3.5m abatement. Planning can reduce the tax burden on heirs.',
          severity: 'medium',
          actionLabel: 'View Details',
          actionPath: '/dashboard/estate-planning',
        });
      }
    }

    // ── Tax Planning ──
    const tax = overview.tax;
    if (tax?.returnStatus === 'not-filed') {
      insights.push({
        id: 'agg-tax-not-filed',
        pillar: 'Tax Planning',
        pillarIcon: FileText,
        pillarColor: 'text-indigo-600',
        title: 'Tax Return Not Filed',
        description: `Your ${tax.taxYear || new Date().getFullYear()} return hasn't been submitted. File before the deadline.`,
        severity: 'high',
        actionLabel: 'Submit Return',
        actionPath: '/dashboard/tax-planning',
      });
    }
    if (tax?.estimatedRefund && tax.estimatedRefund > 0) {
      insights.push({
        id: 'agg-tax-refund',
        pillar: 'Tax Planning',
        pillarIcon: FileText,
        pillarColor: 'text-indigo-600',
        title: `Estimated Refund: ${formatCurrency(tax.estimatedRefund)}`,
        description: 'File your return to claim your refund.',
        severity: 'low',
        actionLabel: 'View Tax',
        actionPath: '/dashboard/tax-planning',
      });
    }

    // Sort by severity
    return insights.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [overview, totalWealthValue, riskInsights]);

  if (allInsights.length === 0) return null;

  const highCount = allInsights.filter(i => i.severity === 'high').length;
  const mediumCount = allInsights.filter(i => i.severity === 'medium').length;

  const COLLAPSED_LIMIT = 4;
  const visibleInsights = expanded ? allInsights : allInsights.slice(0, COLLAPSED_LIMIT);
  const hasMore = allInsights.length > COLLAPSED_LIMIT;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <Lightbulb className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Smart Insights</h2>
            <p className="text-xs text-gray-500">
              Personalised recommendations across your financial plan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {highCount > 0 && (
            <Badge variant="outline" className="bg-red-100 text-red-700 border-transparent text-xs">
              {highCount} action{highCount > 1 ? 's' : ''} required
            </Badge>
          )}
          {mediumCount > 0 && (
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-transparent text-xs">
              {mediumCount} to review
            </Badge>
          )}
          <Badge variant="outline" className="border-gray-200 text-gray-500 text-xs">
            {allInsights.length} total
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleInsights.map((insight) => {
          const sev = SEVERITY_STYLES[insight.severity];
          const SevIcon = sev.icon;
          const PillarIcon = insight.pillarIcon;

          return (
            <div
              key={insight.id}
              className={`border-l-[3px] ${sev.border} ${sev.bg} rounded-r-lg px-4 py-3.5 transition-shadow hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <SevIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sev.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PillarIcon className={`h-3.5 w-3.5 ${insight.pillarColor} flex-shrink-0`} />
                    <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                      {insight.pillar}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 leading-tight">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                    {insight.description}
                  </p>
                  {insight.actionPath && (
                    <button
                      onClick={() => navigate(insight.actionPath!)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      {insight.actionLabel || 'View Details'}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {expanded ? (
              <div className="contents">
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                Show fewer insights
              </div>
            ) : (
              <div className="contents">
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                Show all {allInsights.length} insights
              </div>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
