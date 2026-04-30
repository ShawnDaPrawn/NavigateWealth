/**
 * Employee Benefits Dashboard Page (Client Portal)
 *
 * Single-table product. Derives insights based on whether
 * any employee benefit policies exist.
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Briefcase, Calculator, FileText, Users } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

export function EmployeeBenefitsDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const [showMembersModal, setShowMembersModal] = useState(false);

  // Check if client has any employee benefit holdings
  const ebHoldings = useMemo(
    () =>
      (portfolio?.productHoldings ?? []).filter(
        (h) => h.category === 'employeeBenefits' && h.status !== 'Archived',
      ),
    [portfolio?.productHoldings],
  );

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (ebHoldings.length === 0) {
      result.push({
        id: 'eb-none',
        title: 'No Employee Benefits on Record',
        description:
          'If you\'re employed, your employer may offer group life, disability, pension, or provident fund benefits. Ask your HR department for details.',
        severity: 'low',
      });
    } else {
      // Salary multiple check — group life is typically 3–5x annual salary
      result.push({
        id: 'eb-review',
        title: 'Review Group Scheme Adequacy',
        description:
          'Group life cover is typically 3–5x annual salary. Check whether your employer\'s scheme provides sufficient cover or if you need a top-up personal policy.',
        severity: 'low',
      });

      // Nomination reminder
      result.push({
        id: 'eb-nominations',
        title: 'Check Beneficiary Nominations',
        description:
          'Ensure your group life and retirement fund beneficiary nominations are up to date. These are separate from your personal policy nominations.',
        severity: 'medium',
      });
    }

    return result;
  }, [ebHoldings]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Review your group benefits',
      icon: Calculator,
      onClick: () => console.log('Needs Analysis'),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Quote for business assurance',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=employee-benefits'),
    },
    {
      label: 'View Members',
      description: 'Manage scheme members',
      icon: Users,
      onClick: () => setShowMembersModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="employee_benefits"
        title="Employee Benefits"
        description="Comprehensive group schemes and employee benefit solutions for your business."
        icon={Briefcase}
        themeColor="blue"
        quickActions={quickActions}
        insights={insights}
      />

      {/* Members Management Modal */}
      <ServiceRequestModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        config={SERVICE_REQUEST_CONFIGS.view_members}
        requestType="view_members"
        productCategory="employee-benefits"
      />
    </div>
  );
}

export default EmployeeBenefitsDashboardPage;
