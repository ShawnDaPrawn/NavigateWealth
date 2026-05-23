/**
 * Risk Management Dashboard Page (Client Portal)
 *
 * Fetches real FNA + portfolio data for actionable insights.
 * Quick actions wired to real workflows:
 * - "Needs Analysis" → scrolls to inline FNA panel
 * - "Get a Quote" → opens the native portal quote flow
 * - "Submit Claim" → ServiceRequestModal (claim type)
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shield, Calculator, FileText, Upload } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { RiskPlanningFnaAPI } from '../admin/modules/risk-planning-fna/api';
import type { FinalRiskNeed } from '../admin/modules/risk-planning-fna/types';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';
import { PortalQuoteFlowModal } from '../portal/PortalQuoteFlowModal';
import { useServiceFnaSection } from '../portal/useServiceFnaSection';

export function RiskManagementDashboardPage() {
  const { user } = useAuth();

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const { topContent, scrollToPanel } = useServiceFnaSection({
    clientId: user?.id,
    fnaType: 'risk',
    title: 'Financial Needs Analysis',
    description: 'Start your discovery or view your published risk analysis',
  });

  // ── Real data for insights ──
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const [insights, setInsights] = useState<ServicePageInsight[]>([]);

  useEffect(() => {
    async function fetchInsights() {
      if (!user?.id) return;
      const newInsights: ServicePageInsight[] = [];

      try {
        const fna = await RiskPlanningFnaAPI.getLatestPublished(user.id);

        if (fna?.finalNeeds && fna.finalNeeds.length > 0) {
          const gaps = fna.finalNeeds.filter(
            (need: FinalRiskNeed) => need.finalRecommendedCover > 0,
          );

          if (gaps.length > 0) {
            const totalGap = gaps.reduce(
              (sum: number, n: FinalRiskNeed) => sum + n.finalRecommendedCover,
              0,
            );
            newInsights.push({
              id: 'risk-total-gap',
              title: `${gaps.length} Coverage ${gaps.length === 1 ? 'Gap' : 'Gaps'} Identified`,
              description: `Your needs analysis shows a total shortfall of ${formatCurrency(totalGap)} across ${gaps.map((g: FinalRiskNeed) => g.label).join(', ')}. Consider reviewing with your adviser.`,
              severity: totalGap > 1_000_000 ? 'high' : totalGap > 500_000 ? 'medium' : 'low',
              onClick: scrollToPanel,
            });
          }

          const riskOverview = portfolio?.financialOverview?.risk;
          if (
            riskOverview &&
            riskOverview.deathCover === 0 &&
            riskOverview.disabilityCover === 0 &&
            riskOverview.criticalIllnessCover === 0
          ) {
            newInsights.push({
              id: 'risk-no-cover',
              title: 'No Active Risk Cover',
              description:
                'You currently have no life, disability, or critical illness cover on record. Speak to your adviser to get protected.',
              severity: 'high',
            });
          }
        } else {
          newInsights.push({
            id: 'risk-no-fna',
            title: 'Complete Your Risk Assessment',
            description:
              'A Financial Needs Analysis helps identify coverage gaps and ensures your family is adequately protected. Book a review with your adviser.',
            severity: 'high',
            onClick: scrollToPanel,
          });
        }

        const riskPillar = portfolio?.financialOverview?.risk;
        if (riskPillar?.nextReview) {
          const reviewDate = new Date(riskPillar.nextReview);
          const daysUntil = Math.ceil(
            (reviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );
          if (daysUntil <= 90 && daysUntil > 0) {
            newInsights.push({
              id: 'risk-review-soon',
              title: 'Annual Review Approaching',
              description: `Your risk cover review is due in ${daysUntil} days. Regular reviews ensure your cover keeps pace with life changes.`,
              severity: 'medium',
            });
          } else if (daysUntil <= 0) {
            newInsights.push({
              id: 'risk-review-overdue',
              title: 'Risk Review Overdue',
              description: 'Your annual risk review is overdue. Contact your adviser to schedule a review and update your cover.',
              severity: 'high',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch risk insights:', error);
      }

      setInsights(newInsights);
    }

    fetchInsights();
  }, [user?.id, portfolio, scrollToPanel]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Calculate your coverage gap',
      icon: Calculator,
      onClick: scrollToPanel,
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Compare insurer quotes',
      icon: FileText,
      onClick: () => setShowQuoteModal(true),
    },
    {
      label: 'Submit Claim',
      description: 'File a new claim',
      icon: Upload,
      onClick: () => setShowClaimModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="risk_planning"
        title="Risk Management"
        description="Comprehensive insurance solutions to safeguard your family, assets, and income against unexpected events."
        icon={Shield}
        themeColor="purple"
        quickActions={quickActions}
        insights={insights}
        topContent={topContent}
      />

      <ServiceRequestModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        config={SERVICE_REQUEST_CONFIGS.claim}
        requestType="claim"
        productCategory="risk-management"
      />

      <PortalQuoteFlowModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        serviceId="risk-management"
        user={user}
      />
    </div>
  );
}

export default RiskManagementDashboardPage;
