/**
 * RetirementQuoteWizard -- Phase 2 Retirement Planning "Get a Quote" Wizard
 *
 * A strict 4-step wizard + Review & Submit:
 *   Step 1: Which Retirement Product? (RA, Provident Preservation, Pension Preservation, Not Sure)
 *   Step 2: Contribution / Transfer Structure (context-dependent on product)
 *   Step 3: Retirement Timeline Context (planned age, current age, existing fund membership)
 *   Step 4: Basic Financial Snapshot (income, savings, tax bracket)
 *   Step 5: Review & Submit
 *
 * Hard rules:
 * - No projections, no tax calculations, no retirement gap analysis
 * - Intention + contribution capture only
 * - Do not mix preservation fund logic with RA contribution logic
 * - Adviser-assist never blocks progression
 *
 * §7  — Presentation layer (UI only, no business logic)
 * §5.3 — Constants centralised below
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { ArrowRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { StepIndicator } from './wizard/StepIndicator';
import {
  type FinancialState,
  type NotSureState,
  PRODUCT_OPTIONS,
  type PreservationState,
  type RAContributionState,
  RA_CONTRIBUTION_TYPES,
  TAX_BRACKET_OPTIONS,
  type TimelineState,
  WIZARD_STEPS,
  clearDraft,
  getInitialFinancial,
  getInitialNotSure,
  getInitialPreservation,
  getInitialRA,
  getInitialTimeline,
  loadDraft,
  needsLumpSum,
  needsMonthly,
  parseCurrencyToNumber,
  saveDraft,
} from './retirement/model';
import { Step1Product } from './retirement/Step1Product';
import { Step2Funding } from './retirement/Step2Funding';
import { Step3Timeline } from './retirement/Step3Timeline';
import { Step4Financial } from './retirement/Step4Financial';
import { Step5Review } from './retirement/Step5Review';

interface RetirementQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

export function RetirementQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: RetirementQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedProduct, setSelectedProduct] = useState(draft?.selected_product ?? '');
  const [raContribution, setRAContribution] = useState<RAContributionState>(
    draft?.ra_contribution ?? getInitialRA(),
  );
  const [preservation, setPreservation] = useState<PreservationState>(
    draft?.preservation ?? getInitialPreservation(),
  );
  const [notSureContext, setNotSureContext] = useState<NotSureState>(
    draft?.not_sure_context ?? getInitialNotSure(),
  );
  const [timeline, setTimeline] = useState<TimelineState>(draft?.timeline ?? getInitialTimeline());
  const [financial, setFinancial] = useState<FinancialState>(
    draft?.financial ?? getInitialFinancial(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      selected_product: selectedProduct,
      ra_contribution: raContribution,
      preservation,
      not_sure_context: notSureContext,
      timeline,
      financial,
      currentStep,
    });
  }, [
    selectedProduct,
    raContribution,
    preservation,
    notSureContext,
    timeline,
    financial,
    currentStep,
  ]);

  // ── Validation ──

  const step1Valid = useMemo(() => Boolean(selectedProduct), [selectedProduct]);

  const step2Valid = useMemo(() => {
    if (selectedProduct === 'ra') {
      if (!raContribution.contribution_type) return false;
      if (raContribution.contribution_type === 'not_sure') return true;
      if (needsMonthly(raContribution.contribution_type)) {
        if (!raContribution.monthly_amount && !raContribution.monthly_adviser_assist) return false;
      }
      if (needsLumpSum(raContribution.contribution_type)) {
        if (!raContribution.lump_sum_amount && !raContribution.lump_sum_adviser_assist)
          return false;
      }
      return true;
    }
    if (
      selectedProduct === 'provident_preservation' ||
      selectedProduct === 'pension_preservation'
    ) {
      if (preservation.is_transferring === null) return false;
      // Transfer amount is optional but encouraged — allow proceed
      return true;
    }
    if (selectedProduct === 'not_sure') {
      return (
        notSureContext.currently_employed !== null &&
        notSureContext.leaving_employer_fund !== null &&
        notSureContext.want_monthly_contributions !== ''
      );
    }
    return false;
  }, [selectedProduct, raContribution, preservation, notSureContext]);

  const step3Valid = useMemo(() => {
    return Boolean(timeline.current_age && timeline.planned_retirement_age);
  }, [timeline]);

  const step4Valid = useMemo(() => {
    return Boolean(financial.income_gross_monthly && financial.income_net_monthly);
  }, [financial]);

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return step1Valid;
      case 2:
        return step2Valid;
      case 3:
        return step3Valid;
      case 4:
        return step4Valid;
      case 5:
        return true;
      default:
        return false;
    }
  }, [currentStep, step1Valid, step2Valid, step3Valid, step4Valid]);

  const goNext = useCallback(() => {
    if (currentStep < 5) setCurrentStep((s) => s + 1);
  }, [currentStep]);
  const goBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);
  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // ── Submit ──

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const productLabel =
        PRODUCT_OPTIONS.find((p) => p.id === selectedProduct)?.label ?? selectedProduct;

      // Build funding payload based on product
      let fundingPayload: Record<string, unknown> = {};
      if (selectedProduct === 'ra') {
        const ctLabel =
          RA_CONTRIBUTION_TYPES.find((c) => c.value === raContribution.contribution_type)?.label ??
          raContribution.contribution_type;
        fundingPayload = {
          contribution_type: ctLabel,
          adviser_assist: raContribution.contribution_type === 'not_sure',
        };
        if (needsMonthly(raContribution.contribution_type)) {
          fundingPayload.monthly = raContribution.monthly_adviser_assist
            ? { adviser_assist: true }
            : { amount_per_month: parseCurrencyToNumber(raContribution.monthly_amount) };
        }
        if (needsLumpSum(raContribution.contribution_type)) {
          fundingPayload.lump_sum = raContribution.lump_sum_adviser_assist
            ? { adviser_assist: true }
            : { amount: parseCurrencyToNumber(raContribution.lump_sum_amount) };
        }
      } else if (
        selectedProduct === 'provident_preservation' ||
        selectedProduct === 'pension_preservation'
      ) {
        fundingPayload = {
          is_transferring: preservation.is_transferring,
          transfer_amount: preservation.transfer_not_sure
            ? null
            : parseCurrencyToNumber(preservation.transfer_amount) || null,
          transfer_not_sure: preservation.transfer_not_sure,
        };
      } else if (selectedProduct === 'not_sure') {
        fundingPayload = {
          currently_employed: notSureContext.currently_employed,
          leaving_employer_fund: notSureContext.leaving_employer_fund,
          want_monthly_contributions: notSureContext.want_monthly_contributions,
        };
      }

      const productDetails = {
        vertical: 'Retirement',
        phase: 2,
        selected_product: productLabel,
        selected_product_id: selectedProduct,
        funding: fundingPayload,
        timeline: {
          current_age: parseInt(timeline.current_age, 10) || null,
          planned_retirement_age: parseInt(timeline.planned_retirement_age, 10) || null,
          member_of_retirement_fund: timeline.member_of_retirement_fund,
          fund_details: timeline.fund_details || null,
        },
        financial_snapshot: {
          income_gross_monthly: parseCurrencyToNumber(financial.income_gross_monthly),
          income_net_monthly: parseCurrencyToNumber(financial.income_net_monthly),
          current_retirement_savings:
            parseCurrencyToNumber(financial.current_retirement_savings) || null,
          tax_bracket:
            TAX_BRACKET_OPTIONS.find((o) => o.value === financial.tax_bracket)?.label ?? null,
        },
        metadata: {
          source: 'NavigateWealthApp',
          submitted_at: new Date().toISOString(),
          status: 'submitted',
        },
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            productName: 'Retirement Planning',
            stage: 'full',
            service: 'retirement-planning',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Retirement quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your retirement planning quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Retirement quote network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firstName,
    lastName,
    email,
    phone,
    parentSubmissionId,
    selectedProduct,
    raContribution,
    preservation,
    notSureContext,
    timeline,
    financial,
    onSuccess,
  ]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && (
            <Step1Product selected={selectedProduct} onChange={setSelectedProduct} />
          )}
          {currentStep === 2 && (
            <Step2Funding
              selectedProduct={selectedProduct}
              raContribution={raContribution}
              preservation={preservation}
              notSureContext={notSureContext}
              onChangeRA={setRAContribution}
              onChangePreservation={setPreservation}
              onChangeNotSure={setNotSureContext}
            />
          )}
          {currentStep === 3 && <Step3Timeline timeline={timeline} onChange={setTimeline} />}
          {currentStep === 4 && <Step4Financial financial={financial} onChange={setFinancial} />}
          {currentStep === 5 && (
            <Step5Review
              selectedProduct={selectedProduct}
              raContribution={raContribution}
              preservation={preservation}
              notSureContext={notSureContext}
              timeline={timeline}
              financial={financial}
              onEditStep={goToStep}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-t border-gray-100 bg-gray-50/50">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1}
            className="h-11 px-5"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="h-11 px-6 font-semibold"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-11 px-6 font-semibold"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="contents">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Quote Request
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
