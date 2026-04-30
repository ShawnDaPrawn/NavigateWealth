/**
 * Risk Management Dashboard Page (Client Portal)
 *
 * Fetches real FNA + portfolio data for actionable insights.
 * Quick actions wired to real workflows:
 * - "Needs Analysis" → FNA modal
 * - "Get a Quote" → navigates to /get-quote?service=risk-management
 * - "Submit Claim" → ServiceRequestModal (claim type)
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ClientFNAView } from '../client/ClientFNAView';
import { Shield, Calculator, FileText, Upload } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { RiskPlanningFnaAPI } from '../admin/modules/risk-planning-fna/api';
import type { FinalRiskNeed } from '../admin/modules/risk-planning-fna/types';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

export function RiskManagementDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [showNeedsAnalysis, setShowNeedsAnalysis] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

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
              onClick: () => setShowNeedsAnalysis(true),
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
            onClick: () => setShowNeedsAnalysis(true),
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
  }, [user?.id, portfolio]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Calculate your coverage gap',
      icon: Calculator,
      onClick: () => setShowNeedsAnalysis(true),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Compare insurer quotes',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=risk-management'),
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
                    <CardTitle>Financial Needs Analysis</CardTitle>
                    <CardDescription>View your comprehensive coverage analysis</CardDescription>
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
              <ClientFNAView clientId={user?.id || ''} fnaType="risk" />
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

      {/* Claim Submission Modal */}
      <ServiceRequestModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        config={SERVICE_REQUEST_CONFIGS.claim}
        requestType="claim"
        productCategory="risk-management"
      />
    </div>
  );
}

export default RiskManagementDashboardPage;
