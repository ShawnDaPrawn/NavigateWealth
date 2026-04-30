/**
 * Retirement Planning Dashboard Page (Client Portal)
 *
 * Splits policies into Pre-Retirement and Post-Retirement tables.
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
import { PiggyBank, Calculator, FileText, TrendingUp } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper, type SubCategoryConfig } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

const SUB_CATEGORIES: SubCategoryConfig[] = [
  {
    categoryId: 'retirement_pre',
    title: 'Pre-Retirement Products',
    subtitle: 'Retirement annuities, pension funds, provident funds, and preservation funds',
    emptyMessage: 'No pre-retirement products on record. Speak to your adviser about starting a retirement annuity.',
  },
  {
    categoryId: 'retirement_post',
    title: 'Post-Retirement Products',
    subtitle: 'Living annuities and life annuities providing retirement income',
    emptyMessage: 'No post-retirement products on record.',
  },
];

export function RetirementPlanningDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNeedsAnalysis, setShowNeedsAnalysis] = useState(false);
  const [showContributionModal, setShowContributionModal] = useState(false);

  // ── Real data for insights ──
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const retirement = portfolio?.financialOverview?.retirement;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!retirement || retirement.status === 'not-assessed') {
      result.push({
        id: 'ret-no-fna',
        title: 'Complete Your Retirement Assessment',
        description: 'A retirement needs analysis will project whether your current savings and contributions will meet your retirement income needs.',
        severity: 'high',
        onClick: () => setShowNeedsAnalysis(true),
      });
      return result;
    }

    // Progress to goal
    if (retirement.progressToGoal > 0 && retirement.progressToGoal < 60) {
      result.push({
        id: 'ret-behind-target',
        title: 'Retirement Savings Behind Target',
        description: `You're currently at ${retirement.progressToGoal}% of your retirement goal. Consider increasing your monthly contribution to close the gap.`,
        severity: retirement.progressToGoal < 30 ? 'high' : 'medium',
      });
    } else if (retirement.progressToGoal >= 60 && retirement.progressToGoal < 90) {
      result.push({
        id: 'ret-on-track',
        title: 'Good Progress Toward Retirement',
        description: `You're ${retirement.progressToGoal}% of the way to your retirement goal. Maintain your current contributions to stay on track.`,
        severity: 'low',
      });
    }

    // Tax benefit maximisation
    if (retirement.monthlyContribution > 0) {
      const annualContribution = retirement.monthlyContribution * 12;
      // Section 11F allows up to 27.5% of remuneration or R350,000 per year
      const maxDeductible = 350_000;
      if (annualContribution < maxDeductible * 0.7) {
        result.push({
          id: 'ret-tax-headroom',
          title: 'Tax Deduction Headroom Available',
          description: `Your annual contribution of ${formatCurrency(annualContribution)} is well below the ${formatCurrency(maxDeductible)} annual tax deduction limit. You may benefit from increasing contributions.`,
          severity: 'low',
        });
      }
    }

    // Next review
    if (retirement.nextReview) {
      const daysUntil = Math.ceil(
        (new Date(retirement.nextReview).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil <= 90 && daysUntil > 0) {
        result.push({
          id: 'ret-review-due',
          title: 'Annual Retirement Review Due Soon',
          description: `Your retirement planning review is due in ${daysUntil} days. Market changes and life events may have impacted your projections.`,
          severity: 'medium',
        });
      }
    }

    return result;
  }, [retirement]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Project your retirement income',
      icon: Calculator,
      onClick: () => setShowNeedsAnalysis(true),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Compare retirement annuities',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=retirement-planning'),
    },
    {
      label: 'Boost Contribution',
      description: 'Increase your monthly savings',
      icon: TrendingUp,
      onClick: () => setShowContributionModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="retirement_planning"
        title="Retirement Planning"
        description="Secure your golden years with tailored retirement solutions and investment strategies."
        icon={PiggyBank}
        themeColor="orange"
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
                  <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Retirement Planning Analysis</CardTitle>
                    <CardDescription>View your comprehensive retirement planning analysis</CardDescription>
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
              <ClientFNAView clientId={user?.id || ''} fnaType="retirement" />
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

      {/* Contribution Change Modal */}
      <ServiceRequestModal
        isOpen={showContributionModal}
        onClose={() => setShowContributionModal(false)}
        config={SERVICE_REQUEST_CONFIGS.contribution_change}
        requestType="contribution_change"
        productCategory="retirement-planning"
      />
    </div>
  );
}

export default RetirementPlanningDashboardPage;
