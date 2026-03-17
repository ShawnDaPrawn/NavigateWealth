/**
 * Investment Management Dashboard Page (Client Portal)
 *
 * Splits policies into Discretionary and Guaranteed investment tables.
 * Derives insights from portfolio FNA data.
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ClientFNAView } from '../client/ClientFNAView';
import { TrendingUp, Calculator, FileText, PieChart } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper, type SubCategoryConfig } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

const SUB_CATEGORIES: SubCategoryConfig[] = [
  {
    categoryId: 'investments_voluntary',
    title: 'Discretionary Investments',
    subtitle: 'Unit trusts, tax-free savings, offshore investments, and direct shares',
    emptyMessage: 'No discretionary investments on record. Explore investment options with your adviser.',
  },
  {
    categoryId: 'investments_guaranteed',
    title: 'Guaranteed Investments',
    subtitle: 'Endowments, guaranteed plans, and fixed deposits',
    emptyMessage: 'No guaranteed investments on record.',
  },
];

export function InvestmentManagementDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNeedsAnalysis, setShowNeedsAnalysis] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);

  // ── Real data for insights ──
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const investment = portfolio?.financialOverview?.investment;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!investment || investment.status === 'not-assessed') {
      result.push({
        id: 'inv-no-fna',
        title: 'Complete Your Investment Assessment',
        description: 'An investment needs analysis will help align your portfolio with your risk profile and financial goals.',
        severity: 'high',
        onClick: () => setShowNeedsAnalysis(true),
      });
      return result;
    }

    // Portfolio performance
    if (investment.performance && investment.performance !== 'N/A') {
      const perf = parseFloat(investment.performance);
      if (!isNaN(perf)) {
        if (perf < 0) {
          result.push({
            id: 'inv-negative-perf',
            title: 'Portfolio Under Pressure',
            description: `Your portfolio has returned ${perf.toFixed(1)}% recently. Market downturns are normal — speak to your adviser before making changes.`,
            severity: 'medium',
          });
        } else if (perf > 15) {
          result.push({
            id: 'inv-strong-perf',
            title: 'Strong Portfolio Performance',
            description: `Your portfolio is up ${perf.toFixed(1)}%. Consider rebalancing to lock in gains and maintain your target allocation.`,
            severity: 'low',
          });
        }
      }
    }

    // Diversification check
    if (investment.totalValue > 0 && investment.goalsLinked === 0) {
      result.push({
        id: 'inv-no-goals',
        title: 'Link Investments to Goals',
        description: 'Your investments aren\'t linked to specific financial goals. Goal-based investing improves discipline and outcomes.',
        severity: 'medium',
      });
    }

    // Contribution check
    if (investment.monthlyContribution === 0 && investment.totalValue > 0) {
      result.push({
        id: 'inv-no-contribution',
        title: 'No Regular Contributions',
        description: 'You\'re not making monthly contributions. Regular investing through rand-cost averaging can improve long-term returns.',
        severity: 'low',
      });
    }

    // Review reminder
    if (investment.nextReview) {
      const daysUntil = Math.ceil(
        (new Date(investment.nextReview).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 90 && daysUntil > 0) {
        result.push({
          id: 'inv-review-due',
          title: 'Portfolio Review Approaching',
          description: `Your investment review is due in ${daysUntil} days. Regular reviews ensure your portfolio stays aligned with your goals and risk tolerance.`,
          severity: 'medium',
        });
      }
    }

    return result;
  }, [investment]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Determine your investment goals',
      icon: Calculator,
      onClick: () => setShowNeedsAnalysis(true),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Start a new investment',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=investment-management'),
    },
    {
      label: 'View Allocation',
      description: 'Analyse your asset spread',
      icon: PieChart,
      onClick: () => setShowAllocationModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="investments"
        title="Investment Management"
        description="Grow and protect your wealth with diversified investment strategies tailored to your goals."
        icon={TrendingUp}
        themeColor="green"
        quickActions={quickActions}
        insights={insights}
        subCategories={SUB_CATEGORIES}
      />

      {/* Needs Analysis Modal */}
      {showNeedsAnalysis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto border-gray-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>Investment Needs Analysis</CardTitle>
                    <CardDescription>View your comprehensive investment strategy analysis</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNeedsAnalysis(false)}
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                >
                  <span className="sr-only">Close</span>×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6 bg-gray-50/30">
              <ClientFNAView clientId={user?.id || ''} fnaType="investment" />
              <div className="mt-8 flex justify-end">
                <Button
                  onClick={() => setShowNeedsAnalysis(false)}
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Close Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Allocation Report Modal */}
      <ServiceRequestModal
        isOpen={showAllocationModal}
        onClose={() => setShowAllocationModal(false)}
        config={SERVICE_REQUEST_CONFIGS.view_allocation}
        requestType="view_allocation"
        productCategory="investment-management"
      />
    </div>
  );
}