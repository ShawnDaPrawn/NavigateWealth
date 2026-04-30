/**
 * Estate Planning Dashboard Page (Client Portal)
 *
 * Derives insights from portfolio estate pillar data
 * (will status, trust status, nomination completeness).
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ClientFNAView } from '../client/ClientFNAView';
import { Landmark, Calculator, FileText, Scroll } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

export function EstatePlanningDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNeedsAnalysis, setShowNeedsAnalysis] = useState(false);
  const [showWillReviewModal, setShowWillReviewModal] = useState(false);

  // ── Real data for insights ──
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const estate = portfolio?.financialOverview?.estate;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!estate || estate.status === 'not-assessed') {
      result.push({
        id: 'est-no-fna',
        title: 'Complete Your Estate Assessment',
        description: 'An estate planning analysis ensures your assets are protected, your family is provided for, and estate duty exposure is minimised.',
        severity: 'high',
        onClick: () => setShowNeedsAnalysis(true),
      });
      return result;
    }

    // Will status
    if (estate.willStatus === 'not-drafted') {
      result.push({
        id: 'est-no-will',
        title: 'Will Not Yet Drafted',
        description: 'Dying without a valid Will means your estate will be distributed according to the Intestate Succession Act, which may not reflect your wishes.',
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

    // Trust status
    if (estate.trustStatus === 'not-established') {
      result.push({
        id: 'est-no-trust',
        title: 'Consider a Trust',
        description: 'A trust can protect assets for minor children, reduce estate duty, and provide continuity. Discuss with your adviser whether a trust is appropriate.',
        severity: 'low',
      });
    }

    // Nomination status
    if (estate.nominationStatus === 'incomplete') {
      result.push({
        id: 'est-nominations',
        title: 'Beneficiary Nominations Incomplete',
        description: 'Ensure all your policies (life insurance, retirement, investments) have up-to-date beneficiary nominations to avoid delays in claims.',
        severity: 'medium',
      });
    }

    // Estate duty awareness
    const totalWealth = portfolio?.clientData?.totalWealthValue || 0;
    if (totalWealth > 3_500_000) {
      result.push({
        id: 'est-duty-exposure',
        title: 'Estate Duty Exposure',
        description: 'Your total wealth exceeds the R3.5 million estate duty abatement. Proper planning can reduce the tax burden on your heirs.',
        severity: 'medium',
      });
    }

    return result;
  }, [estate, portfolio?.clientData?.totalWealthValue]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Estate liquidity calculation',
      icon: Calculator,
      onClick: () => setShowNeedsAnalysis(true),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Will drafting & trusts',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=estate-planning'),
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
      />

      {/* Needs Analysis Modal */}
      {showNeedsAnalysis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto border-gray-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Estate Planning Analysis</CardTitle>
                    <CardDescription>View your comprehensive estate planning analysis</CardDescription>
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
              <ClientFNAView clientId={user?.id || ''} fnaType="estate" />
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

      {/* Will Review Modal */}
      <ServiceRequestModal
        isOpen={showWillReviewModal}
        onClose={() => setShowWillReviewModal(false)}
        config={SERVICE_REQUEST_CONFIGS.will_review}
        requestType="will_review"
        productCategory="estate-planning"
      />
    </div>
  );
}

export default EstatePlanningDashboardPage;
