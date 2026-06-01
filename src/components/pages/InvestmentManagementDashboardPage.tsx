/**
 * Investment Management Dashboard Page (Client Portal)
 *
 * Splits policies into Discretionary and Guaranteed investment tables.
 * Derives insights from portfolio FNA data.
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { TrendingUp, Calculator, FileText, PieChart } from 'lucide-react';
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
    categoryId: 'investments_voluntary',
    title: 'Discretionary Investments',
    subtitle: 'Unit trusts, tax-free savings, offshore investments, and direct shares',
    emptyMessage:
      'No discretionary investments on record. Explore investment options with your adviser.',
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
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const { topContent, scrollToPanel } = useServiceFnaSection({
    clientId: user?.id,
    fnaType: 'investment',
    title: 'Investment Needs Analysis',
    description: 'Start your discovery or view your published investment analysis',
  });

  const { data: portfolio } = usePortfolioSummary(user?.id);
  const investment = portfolio?.financialOverview?.investment;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!investment || investment.status === 'not-assessed') {
      result.push({
        id: 'inv-no-fna',
        title: 'Complete Your Investment Assessment',
        description:
          'An investment needs analysis will help align your portfolio with your risk profile and financial goals.',
        severity: 'high',
        onClick: scrollToPanel,
      });
      return result;
    }

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

    if (investment.totalValue > 0 && investment.goalsLinked === 0) {
      result.push({
        id: 'inv-no-goals',
        title: 'Link Investments to Goals',
        description:
          "Your investments aren't linked to specific financial goals. Goal-based investing improves discipline and outcomes.",
        severity: 'medium',
      });
    }

    if (investment.monthlyContribution === 0 && investment.totalValue > 0) {
      result.push({
        id: 'inv-no-contribution',
        title: 'No Regular Contributions',
        description:
          "You're not making monthly contributions. Regular investing through rand-cost averaging can improve long-term returns.",
        severity: 'low',
      });
    }

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
  }, [investment, scrollToPanel]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Determine your investment goals',
      icon: Calculator,
      onClick: scrollToPanel,
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Start a new investment',
      icon: FileText,
      onClick: () => setShowQuoteModal(true),
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
        topContent={topContent}
      />

      <ServiceRequestModal
        isOpen={showAllocationModal}
        onClose={() => setShowAllocationModal(false)}
        config={SERVICE_REQUEST_CONFIGS.view_allocation}
        requestType="view_allocation"
        productCategory="investment-management"
      />

      <PortalQuoteFlowModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        serviceId="investment-management"
        user={user}
      />
    </div>
  );
}

export default InvestmentManagementDashboardPage;
