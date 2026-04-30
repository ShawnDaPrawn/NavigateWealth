/**
 * Medical Aid Dashboard Page (Client Portal)
 *
 * Derives insights from portfolio data (scheme, premium, dependants).
 * Quick actions retained for future per-product customisation.
 *
 * Guidelines refs: §7 (presentation), §7.1 (derived display state)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ClientFNAView } from '../client/ClientFNAView';
import { Heart, Calculator, FileText, Users } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

export function MedicalAidDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNeedsAnalysis, setShowNeedsAnalysis] = useState(false);
  const [showDependantModal, setShowDependantModal] = useState(false);

  // ── Real data for insights ──
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const medicalAid = portfolio?.financialOverview?.medicalAid;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!medicalAid || medicalAid.status === 'not-assessed') {
      result.push({
        id: 'med-no-fna',
        title: 'Complete Your Medical Aid Assessment',
        description: 'A healthcare needs analysis will help identify the best scheme and plan for your family\'s medical needs and budget.',
        severity: 'high',
        onClick: () => setShowNeedsAnalysis(true),
      });
      return result;
    }

    // Annual review reminder — medical aid benefits change every January
    const currentMonth = new Date().getMonth(); // 0-indexed
    if (currentMonth >= 8 && currentMonth <= 11) {
      // September–December is review season
      result.push({
        id: 'med-annual-review',
        title: 'Medical Aid Review Season',
        description: 'Medical scheme benefits and contributions change annually from 1 January. Now is the time to review your plan and compare alternatives.',
        severity: 'medium',
      });
    }

    // Premium insight
    if (medicalAid.monthlyPremium > 0) {
      const annualPremium = medicalAid.monthlyPremium * 12;
      result.push({
        id: 'med-premium',
        title: 'Annual Medical Expenditure',
        description: `Your annual medical aid cost is ${formatCurrency(annualPremium)}. Remember to claim the Section 6A tax credit on your tax return.`,
        severity: 'low',
      });
    }

    // Dependants
    if (medicalAid.dependants > 0) {
      result.push({
        id: 'med-dependants',
        title: `${medicalAid.dependants} Dependant${medicalAid.dependants > 1 ? 's' : ''} Covered`,
        description: 'Ensure all dependants are correctly registered. Life events (marriage, birth, turning 21/26) may require updating your membership.',
        severity: 'low',
      });
    }

    // No gap cover check
    // We can't know for sure without checking policies, so this is a general reminder
    result.push({
      id: 'med-gap-cover',
      title: 'Do You Have Gap Cover?',
      description: 'Gap cover bridges the difference between what specialists charge and what your medical aid pays. Check with your adviser if you\'re covered.',
      severity: 'low',
    });

    return result;
  }, [medicalAid]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Needs Analysis',
      description: 'Analyse your healthcare needs',
      icon: Calculator,
      onClick: () => setShowNeedsAnalysis(true),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Compare medical schemes',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=medical-aid'),
    },
    {
      label: 'Add Dependant',
      description: 'Update your beneficiaries',
      icon: Users,
      onClick: () => setShowDependantModal(true),
    },
  ];

  return (
    <div className="contents">
      <DynamicServicePageWrapper
        categoryId="medical_aid"
        title="Medical Aid"
        description="Comprehensive healthcare solutions to ensure you and your family have access to the best medical care."
        icon={Heart}
        themeColor="red"
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
                  <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <CardTitle>Medical Needs Analysis</CardTitle>
                    <CardDescription>View your comprehensive healthcare coverage analysis</CardDescription>
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
              <ClientFNAView clientId={user?.id || ''} fnaType="medical" />
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

      {/* Add Dependant Modal */}
      <ServiceRequestModal
        isOpen={showDependantModal}
        onClose={() => setShowDependantModal(false)}
        config={SERVICE_REQUEST_CONFIGS.add_dependant}
        requestType="add_dependant"
        productCategory="medical-aid"
      />
    </div>
  );
}

export default MedicalAidDashboardPage;
