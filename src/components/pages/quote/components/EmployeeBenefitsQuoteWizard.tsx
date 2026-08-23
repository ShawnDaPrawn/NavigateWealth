/**
 * EmployeeBenefitsQuoteWizard — Phase 2 Employee Benefits "Get a Quote" Wizard
 *
 * Audience: Employer / Business Owner
 * Purpose: Capture high-level requirements for an Employee Benefits proposal.
 *
 * 4-step wizard + Review & Submit:
 *   Step 1: Business Details (company name, industry, employee count, province)
 *   Step 2: Benefit Type Selection (risk, retirement, both, not sure)
 *   Step 3: Budget & Contribution Structure
 *   Step 4: Workforce Profile (high-level)
 *   Step 5: Review & Submit
 *
 * Hard rules:
 * - No actuarial modelling, no underwriting detail, no member-level data
 * - No employee personal data, no medical details, no payroll files
 * - No premium calculations
 * - Employer-focused, high-level only
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
  WIZARD_STEPS,
  AGE_BAND_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
  COMPULSORY_OPTIONS,
  CONTRIBUTION_STRUCTURE_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  WORKFORCE_TYPE_OPTIONS,
  getInitialBusiness,
  getInitialBudget,
  getInitialWorkforce,
  loadDraft,
  saveDraft,
  clearDraft,
  parseCurrencyToNumber,
  type BusinessState,
  type BudgetState,
  type WorkforceState,
} from './employeeBenefits/model';
import { Step1Business } from './employeeBenefits/Step1Business';
import { Step2BenefitType } from './employeeBenefits/Step2BenefitType';
import { Step3Budget } from './employeeBenefits/Step3Budget';
import { Step4Workforce } from './employeeBenefits/Step4Workforce';
import { Step5Review } from './employeeBenefits/Step5Review';

// ── Props ───────────────────────────────────────────────────────────────────────

interface EmployeeBenefitsQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}
// ── Main wizard component ───────────────────────────────────────────────────────

export function EmployeeBenefitsQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: EmployeeBenefitsQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [business, setBusiness] = useState<BusinessState>(draft?.business ?? getInitialBusiness());
  const [benefitType, setBenefitType] = useState(draft?.benefit_type ?? '');
  const [budget, setBudget] = useState<BudgetState>(draft?.budget ?? getInitialBudget());
  const [workforce, setWorkforce] = useState<WorkforceState>(
    draft?.workforce ?? getInitialWorkforce(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      business,
      benefit_type: benefitType,
      budget,
      workforce,
      currentStep,
    });
  }, [business, benefitType, budget, workforce, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => {
    return Boolean(
      business.company_name.trim() &&
      business.industry_sector &&
      business.employee_count &&
      business.province,
    );
  }, [business]);

  const step2Valid = useMemo(() => Boolean(benefitType), [benefitType]);

  const step3Valid = useMemo(() => {
    const hasBudget = budget.budget_adviser_assist || Boolean(budget.monthly_budget);
    return (
      hasBudget && Boolean(budget.contribution_structure) && Boolean(budget.compulsory_for_all)
    );
  }, [budget]);

  const step4Valid = useMemo(() => {
    return Boolean(
      workforce.average_age_band &&
      workforce.workforce_type &&
      workforce.has_existing_benefits !== null,
    );
  }, [workforce]);

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
      const benefitLabel =
        BENEFIT_TYPE_OPTIONS.find((b) => b.id === benefitType)?.label ?? benefitType;
      const contribLabel =
        CONTRIBUTION_STRUCTURE_OPTIONS.find((c) => c.value === budget.contribution_structure)
          ?.label ?? budget.contribution_structure;
      const compulsoryLabel =
        COMPULSORY_OPTIONS.find((c) => c.value === budget.compulsory_for_all)?.label ??
        budget.compulsory_for_all;
      const ageBandLabel =
        AGE_BAND_OPTIONS.find((a) => a.value === workforce.average_age_band)?.label ??
        workforce.average_age_band;
      const workforceTypeLabel =
        WORKFORCE_TYPE_OPTIONS.find((w) => w.value === workforce.workforce_type)?.label ??
        workforce.workforce_type;
      const empCountLabel =
        EMPLOYEE_COUNT_OPTIONS.find((e) => e.value === business.employee_count)?.label ??
        business.employee_count;

      const productDetails = {
        vertical: 'EmployeeBenefits',
        phase: 2,
        business: {
          company_name: business.company_name.trim(),
          trading_name: business.trading_name.trim() || null,
          industry_sector: business.industry_sector,
          employee_count: empCountLabel,
          employee_count_id: business.employee_count,
          province: business.province,
        },
        benefit_type: benefitLabel,
        benefit_type_id: benefitType,
        budget: {
          monthly_budget: budget.budget_adviser_assist
            ? null
            : parseCurrencyToNumber(budget.monthly_budget),
          budget_adviser_assist: budget.budget_adviser_assist,
          contribution_structure: contribLabel,
          contribution_structure_id: budget.contribution_structure,
          compulsory_for_all: compulsoryLabel,
          compulsory_for_all_id: budget.compulsory_for_all,
        },
        workforce: {
          average_age_band: ageBandLabel,
          average_age_band_id: workforce.average_age_band,
          workforce_type: workforceTypeLabel,
          workforce_type_id: workforce.workforce_type,
          has_existing_benefits: workforce.has_existing_benefits,
          existing_benefits_description: workforce.existing_benefits_description.trim() || null,
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
            productName: 'Employee Benefits',
            stage: 'full',
            service: 'employee-benefits',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        console.error('Employee benefits quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your employee benefits quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Employee benefits quote network error:', error);
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
    business,
    benefitType,
    budget,
    workforce,
    onSuccess,
  ]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Business business={business} onChange={setBusiness} />}
          {currentStep === 2 && (
            <Step2BenefitType selected={benefitType} onChange={setBenefitType} />
          )}
          {currentStep === 3 && <Step3Budget budget={budget} onChange={setBudget} />}
          {currentStep === 4 && <Step4Workforce workforce={workforce} onChange={setWorkforce} />}
          {currentStep === 5 && (
            <Step5Review
              business={business}
              benefitType={benefitType}
              budget={budget}
              workforce={workforce}
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
