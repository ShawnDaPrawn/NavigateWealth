/**
 * Tax Planning Dashboard Page (Client Portal)
 *
 * Derives insights from portfolio tax pillar data.
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
import { FileText, Calculator, Upload } from 'lucide-react';
import type { ServicePageAction, ServicePageInsight } from '../layout/ServicePageLayout';
import { DynamicServicePageWrapper } from '../layout/DynamicServicePageWrapper';
import { usePortfolioSummary } from './portfolio/hooks';
import { formatCurrency } from '../../utils/currencyFormatter';
import { ServiceRequestModal, SERVICE_REQUEST_CONFIGS } from '../modals/ServiceRequestModal';

export function TaxPlanningDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showTaxAnalysis, setShowTaxAnalysis] = useState(false);
  const [showTaxReturnModal, setShowTaxReturnModal] = useState(false);

  // ── Real data for insights ──
  const { data: portfolio } = usePortfolioSummary(user?.id);
  const tax = portfolio?.financialOverview?.tax;
  const retirement = portfolio?.financialOverview?.retirement;

  const insights = useMemo<ServicePageInsight[]>(() => {
    const result: ServicePageInsight[] = [];

    if (!tax || tax.status === 'not-assessed') {
      result.push({
        id: 'tax-no-fna',
        title: 'Get a Tax Assessment',
        description: 'A tax planning review can identify deductions you may be missing and help optimise your effective tax rate.',
        severity: 'high',
        onClick: () => setShowTaxAnalysis(true),
      });
    }

    // Filing status
    if (tax?.returnStatus === 'not-filed') {
      result.push({
        id: 'tax-not-filed',
        title: 'Tax Return Not Yet Filed',
        description: `Your ${tax.taxYear || new Date().getFullYear()} tax return hasn't been submitted. File before the deadline to avoid penalties.`,
        severity: 'high',
      });
    }

    // Refund notification
    if (tax?.estimatedRefund && tax.estimatedRefund > 0) {
      result.push({
        id: 'tax-refund',
        title: 'Estimated Tax Refund Available',
        description: `You may be eligible for a refund of approximately ${formatCurrency(tax.estimatedRefund)}. Ensure your return is filed to claim this.`,
        severity: 'low',
      });
    }

    // Retirement contribution headroom for tax
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

    // Filing deadline awareness
    const now = new Date();
    const month = now.getMonth();
    // SARS provisional tax: Feb and Aug deadlines
    if (month === 1 || month === 7) {
      result.push({
        id: 'tax-provisional',
        title: 'Provisional Tax Due This Month',
        description: 'Provisional taxpayers must submit payments by the end of February and August. Ensure your provisional return is filed on time.',
        severity: 'medium',
      });
    }

    return result;
  }, [tax, retirement]);

  const quickActions: ServicePageAction[] = [
    {
      label: 'Tax Analysis',
      description: 'Review tax efficiency',
      icon: Calculator,
      onClick: () => setShowTaxAnalysis(true),
      primary: true,
    },
    {
      label: 'Get a Quote',
      description: 'Tax practitioner services',
      icon: FileText,
      onClick: () => navigate('/get-quote?service=tax-planning'),
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
      />

      {/* Tax Analysis Modal */}
      {showTaxAnalysis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto border-gray-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle>Tax Planning Analysis</CardTitle>
                    <CardDescription>View your comprehensive tax planning analysis</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTaxAnalysis(false)}
                  className="h-8 w-8 p-0 rounded-full hover:bg-gray-100"
                >
                  <span className="sr-only">Close</span>×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6 bg-gray-50/30">
              <ClientFNAView clientId={user?.id || ''} fnaType="tax" />
              <div className="mt-8 flex justify-end">
                <Button
                  onClick={() => setShowTaxAnalysis(false)}
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Close Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax Return Modal */}
      <ServiceRequestModal
        isOpen={showTaxReturnModal}
        onClose={() => setShowTaxReturnModal(false)}
        config={SERVICE_REQUEST_CONFIGS.tax_return}
        requestType="tax_return"
        productCategory="tax-planning"
      />
    </div>
  );
}