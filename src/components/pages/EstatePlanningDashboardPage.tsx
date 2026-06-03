/**
 * Estate Planning Dashboard Page (Client Portal)
 *
 * Derives insights from portfolio estate pillar data
 * (will status, trust status, nomination completeness).
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Landmark, Calculator, FileText, Scroll } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';
import { PortalQuoteFlowModal } from '../portal/PortalQuoteFlowModal';
import { useServiceFnaSection } from '../portal/useServiceFnaSection';

export function EstatePlanningDashboardPage() {
  const { user } = useAuth();
  const [showWillReviewModal, setShowWillReviewModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const { topContent, scrollToPanel } = useServiceFnaSection({
    clientId: user?.id,
    fnaType: 'estate',
    title: 'Estate Planning Analysis',
    description: 'Start your discovery or view your published estate analysis',
  });

  const { data: portfolio } = usePortfolioSummary(user?.id);
  const estate = portfolio?.financialOverview?.estate;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!estate || estate.status === 'not-assessed') {
      result.push({
        id: 'est-no-fna',
        title: 'Complete Your Estate Assessment',
        description:
          'An estate planning analysis ensures your assets are protected, your family is provided for, and estate duty exposure is minimised.',
        severity: 'high',
        onClick: scrollToPanel,
      });
      return result;
    }

    if (estate.willStatus === 'not-drafted') {
      result.push({
        id: 'est-no-will',
        title: 'Will Not Yet Drafted',
        description:
          'Dying without a valid Will means your estate will be distributed according to the Intestate Succession Act, which may not reflect your wishes.',
        severity: 'high',
      });
    } else if (estate.lastUpdated) {
      const lastUpdate = new Date(estate.lastUpdated);
      const yearsSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsSince > 3) {
        result.push({
          id: 'est-will-old',
          title: 'Will May Be Outdated',
          description: `Your estate documents were last updated ${Math.floor(yearsSince)} years ago. It's recommended to review your Will every 3–5 years or after major life events.`,
          severity: 'medium',
        });
      }
    }

    if (estate.trustStatus === 'not-established') {
      result.push({
        id: 'est-no-trust',
        title: 'Consider a Trust',
        description:
          'A trust can protect assets for minor children, reduce estate duty, and provide continuity. Discuss with your adviser whether a trust is appropriate.',
        severity: 'low',
      });
    }

    if (estate.nominationStatus === 'incomplete') {
      result.push({
        id: 'est-nominations',
        title: 'Beneficiary Nominations Incomplete',
        description:
          'Ensure all your policies (life insurance, retirement, investments) have up-to-date beneficiary nominations to avoid delays in claims.',
        severity: 'medium',
      });
    }

    const totalWealth = portfolio?.clientData?.totalWealthValue || 0;
    if (totalWealth > 3_500_000) {
      result.push({
        id: 'est-duty-exposure',
        title: 'Estate Duty Exposure',
        description:
          'Your total wealth exceeds the R3.5 million estate duty abatement. Proper planning can reduce the tax burden on your heirs.',
        severity: 'medium',
      });
    }

    return result;
  }, [estate, portfolio?.clientData?.totalWealthValue, scrollToPanel]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Estate liquidity calculation',
      icon: Calculator,
      onClick: scrollToPanel,
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Will drafting & trusts',
      icon: FileText,
      onClick: () => setShowQuoteModal(true),
    },
    {
      label: 'View Will',
      description: 'Review or update your Will',
      icon: Scroll,
      onClick: () => setShowWillReviewModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="estate_planning"
        title="Estate Planning"
        description="Preserve your legacy with comprehensive estate planning, wills, and trusts."
        icon={Landmark}
        themeColor="purple"
        quickActions={quickActions}
        insights={insights}
        topContent={topContent}
      />

      <ServiceRequestModal
        isOpen={showWillReviewModal}
        onClose={() => setShowWillReviewModal(false)}
        config={SERVICE_REQUEST_CONFIGS.will_review}
        requestType="will_review"
        productCategory="estate-planning"
      />

      <PortalQuoteFlowModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        serviceId="estate-planning"
        user={user}
      />
    </div>
  );
}

export default EstatePlanningDashboardPage;
