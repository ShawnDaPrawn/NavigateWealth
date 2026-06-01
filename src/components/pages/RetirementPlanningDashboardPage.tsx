/**
 * Retirement Planning Dashboard Page (Client Portal)
 *
 * Splits policies into Pre-Retirement and Post-Retirement tables.
 * Derives insights from portfolio FNA data.
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PiggyBank, Calculator, FileText, TrendingUp } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import {
  DynamicServicePageWrapper,
  type SubCategoryConfig,
} from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';
import { PortalQuoteFlowModal } from '../portal/PortalQuoteFlowModal';
import { useServiceFnaSection } from '../portal/useServiceFnaSection';

const SUB_CATEGORIES: SubCategoryConfig[] = [
  {
    categoryId: 'retirement_pre',
    title: 'Pre-Retirement Products',
    subtitle: 'Retirement annuities, pension funds, provident funds, and preservation funds',
    emptyMessage:
      'No pre-retirement products on record. Speak to your adviser about starting a retirement annuity.',
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
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const { topContent, scrollToPanel } = useServiceFnaSection({
    clientId: user?.id,
    fnaType: 'retirement',
    title: 'Retirement Planning Analysis',
    description: 'Start your discovery or view your published retirement analysis',
  });

  const { data: portfolio } = usePortfolioSummary(user?.id);
  const retirement = portfolio?.financialOverview?.retirement;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!retirement || retirement.status === 'not-assessed') {
      result.push({
        id: 'ret-no-fna',
        title: 'Complete Your Retirement Assessment',
        description:
          'A retirement needs analysis will project whether your current savings and contributions will meet your retirement income needs.',
        severity: 'high',
        onClick: scrollToPanel,
      });
      return result;
    }

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

    if (retirement.monthlyContribution > 0) {
      const annualContribution = retirement.monthlyContribution * 12;
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
  }, [retirement, scrollToPanel]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Project your retirement income',
      icon: Calculator,
      onClick: scrollToPanel,
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Compare retirement annuities',
      icon: FileText,
      onClick: () => setShowQuoteModal(true),
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
        topContent={topContent}
      />

      <ServiceRequestModal
        isOpen={showContributionModal}
        onClose={() => setShowContributionModal(false)}
        config={SERVICE_REQUEST_CONFIGS.contribution_change}
        requestType="contribution_change"
        productCategory="retirement-planning"
      />

      <PortalQuoteFlowModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        serviceId="retirement-planning"
        user={user}
      />
    </div>
  );
}

export default RetirementPlanningDashboardPage;
