/**
 * Tax Planning Dashboard Page (Client Portal)
 *
 * Derives insights from portfolio tax pillar data.
 * Quick actions retained for future per-product customisation.
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { FileText, Calculator, Upload } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';
import { PortalQuoteFlowModal } from '../portal/PortalQuoteFlowModal';
import { useServiceFnaSection } from '../portal/useServiceFnaSection';

export function TaxPlanningDashboardPage() {
  const { user } = useAuth();
  const [showTaxReturnModal, setShowTaxReturnModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const { topContent, scrollToPanel } = useServiceFnaSection({
    clientId: user?.id,
    fnaType: 'tax',
    title: 'Tax Planning Analysis',
    description: 'Start your discovery or view your published tax analysis',
  });

  const { data: portfolio } = usePortfolioSummary(user?.id);
  const tax = portfolio?.financialOverview?.tax;
  const retirement = portfolio?.financialOverview?.retirement;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!tax || tax.status === 'not-assessed') {
      result.push({
        id: 'tax-no-fna',
        title: 'Get a Tax Assessment',
        description:
          'A tax planning review can identify deductions you may be missing and help optimise your effective tax rate.',
        severity: 'high',
        onClick: scrollToPanel,
      });
    }

    if (tax?.returnStatus === 'not-filed') {
      result.push({
        id: 'tax-not-filed',
        title: 'Tax Return Not Yet Filed',
        description: `Your ${tax.taxYear || new Date().getFullYear()} tax return hasn't been submitted. File before the deadline to avoid penalties.`,
        severity: 'high',
      });
    }

    if (tax?.estimatedRefund && tax.estimatedRefund > 0) {
      result.push({
        id: 'tax-refund',
        title: 'Estimated Tax Refund Available',
        description: `You may be eligible for a refund of approximately ${formatCurrency(tax.estimatedRefund)}. Ensure your return is filed to claim this.`,
        severity: 'low',
      });
    }

    if (retirement?.monthlyContribution && retirement.monthlyContribution > 0) {
      const annualRA = retirement.monthlyContribution * 12;
      const maxDeductible = 350_000;
      const headroom = maxDeductible - annualRA;
      if (headroom > 50_000) {
        result.push({
          id: 'tax-ra-headroom',
          title: 'Retirement Annuity Tax Optimisation',
          description: `You have approximately ${formatCurrency(headroom)} in unused retirement annuity tax deduction headroom (27.5% of remuneration, capped at ${formatCurrency(maxDeductible)}/year).`,
          severity: 'low',
        });
      }
    }

    const now = new Date();
    const month = now.getMonth();
    if (month === 1 || month === 7) {
      result.push({
        id: 'tax-provisional',
        title: 'Provisional Tax Due This Month',
        description:
          'Provisional taxpayers must submit payments by the end of February and August. Ensure your provisional return is filed on time.',
        severity: 'medium',
      });
    }

    return result;
  }, [tax, retirement, scrollToPanel]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Tax Analysis',
      description: 'Review tax efficiency',
      icon: Calculator,
      onClick: scrollToPanel,
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Tax practitioner services',
      icon: FileText,
      onClick: () => setShowQuoteModal(true),
    },
    {
      label: 'Submit Return',
      description: 'Upload tax documents',
      icon: Upload,
      onClick: () => setShowTaxReturnModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="tax_planning"
        title="Tax Planning"
        description="Optimise your tax position with expert planning and compliance services."
        icon={FileText}
        themeColor="indigo"
        quickActions={quickActions}
        insights={insights}
        topContent={topContent}
      />

      <ServiceRequestModal
        isOpen={showTaxReturnModal}
        onClose={() => setShowTaxReturnModal(false)}
        config={SERVICE_REQUEST_CONFIGS.tax_return}
        requestType="tax_return"
        productCategory="tax-planning"
      />

      <PortalQuoteFlowModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        serviceId="tax-planning"
        user={user}
      />
    </div>
  );
}

export default TaxPlanningDashboardPage;
