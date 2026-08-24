import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { ArrowRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { StepIndicator } from './wizard/StepIndicator';
import {
  WIZARD_STEPS,
  CONTRIBUTION_TYPES,
  OBJECTIVE_OPTIONS,
  TIME_HORIZON_OPTIONS,
  RISK_COMFORT_OPTIONS,
  TAX_BRACKET_OPTIONS,
  getLabelForType,
  getInitialContribution,
  getInitialObjective,
  getInitialFinancial,
  loadDraft,
  saveDraft,
  clearDraft,
  needsLumpSum,
  needsMonthly,
  parseCurrencyToNumber,
  type ContributionEntry,
  type ObjectiveState,
  type FinancialState,
} from './investment/model';
import { Step1Types } from './investment/Step1Types';
import { Step2Contributions } from './investment/Step2Contributions';
import { Step3Objective } from './investment/Step3Objective';
import { Step4Financial } from './investment/Step4Financial';
import { Step5Review } from './investment/Step5Review';

interface InvestmentQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

export function InvestmentQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: InvestmentQuoteWizardProps) {
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(draft?.selected_types ?? []);
  const [contributions, setContributions] = useState<Record<string, ContributionEntry>>(
    draft?.contributions ?? {},
  );
  const [objective, setObjective] = useState<ObjectiveState>(
    draft?.objective ?? getInitialObjective(),
  );
  const [financial, setFinancial] = useState<FinancialState>(
    draft?.financial ?? getInitialFinancial(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      selected_types: selectedTypes,
      contributions,
      objective,
      financial,
      currentStep,
    });
  }, [selectedTypes, contributions, objective, financial, currentStep]);

  // ── Validation ──

  const step1Valid = useMemo(() => selectedTypes.length > 0, [selectedTypes]);

  const step2Valid = useMemo(() => {
    // If only "not_sure" selected, no contribution details needed
    if (selectedTypes.length === 1 && selectedTypes[0] === 'not_sure') return true;

    const typesToValidate = selectedTypes.filter((t) => t !== 'not_sure');
    return typesToValidate.every((typeId) => {
      const entry = contributions[typeId];
      if (!entry || !entry.contribution_type) return false;
      if (entry.contribution_type === 'not_sure') return true;

      // Validate lump sum path
      if (needsLumpSum(entry.contribution_type)) {
        if (!entry.lump_sum_amount && !entry.lump_sum_adviser_assist) return false;
      }
      // Validate monthly path
      if (needsMonthly(entry.contribution_type)) {
        if (!entry.monthly_amount && !entry.monthly_adviser_assist) return false;
      }
      return true;
    });
  }, [selectedTypes, contributions]);

  const step3Valid = useMemo(() => {
    return Boolean(objective.primary_objective && objective.time_horizon && objective.risk_comfort);
  }, [objective]);

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

  // ── Navigation ──

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
      // Build contributions payload
      const contributionsPayload: Record<string, unknown> = {};
      selectedTypes
        .filter((t) => t !== 'not_sure')
        .forEach((typeId) => {
          const entry = contributions[typeId] || getInitialContribution();
          const ctLabel =
            CONTRIBUTION_TYPES.find((c) => c.value === entry.contribution_type)?.label ??
            entry.contribution_type;
          const data: Record<string, unknown> = {
            contribution_type: ctLabel,
            adviser_assist: entry.contribution_type === 'not_sure',
          };
          if (needsLumpSum(entry.contribution_type)) {
            data.lump_sum = entry.lump_sum_adviser_assist
              ? { adviser_assist: true }
              : { amount: parseCurrencyToNumber(entry.lump_sum_amount) };
          }
          if (needsMonthly(entry.contribution_type)) {
            data.monthly = entry.monthly_adviser_assist
              ? { adviser_assist: true }
              : { amount_per_month: parseCurrencyToNumber(entry.monthly_amount) };
          }
          contributionsPayload[typeId] = data;
        });

      const productDetails = {
        vertical: 'Investment',
        phase: 2,
        selected_types: selectedTypes.map(getLabelForType),
        contributions: contributionsPayload,
        objective: {
          primary_objective:
            OBJECTIVE_OPTIONS.find((o) => o.value === objective.primary_objective)?.label ??
            objective.primary_objective,
          time_horizon:
            TIME_HORIZON_OPTIONS.find((o) => o.value === objective.time_horizon)?.label ??
            objective.time_horizon,
          risk_comfort:
            RISK_COMFORT_OPTIONS.find((o) => o.value === objective.risk_comfort)?.label ??
            objective.risk_comfort,
        },
        financial_snapshot: {
          income_gross_monthly: parseCurrencyToNumber(financial.income_gross_monthly),
          income_net_monthly: parseCurrencyToNumber(financial.income_net_monthly),
          existing_investments: financial.existing_investments || null,
          has_retirement_annuity: financial.has_retirement_annuity,
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
            productName: 'Investment Management',
            stage: 'full',
            service: 'investment-management',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Investment quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your investment quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Investment quote network error:', error);
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
    selectedTypes,
    contributions,
    objective,
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
            <Step1Types selectedTypes={selectedTypes} onChange={setSelectedTypes} />
          )}
          {currentStep === 2 && (
            <Step2Contributions
              selectedTypes={selectedTypes}
              contributions={contributions}
              onChange={setContributions}
            />
          )}
          {currentStep === 3 && <Step3Objective objective={objective} onChange={setObjective} />}
          {currentStep === 4 && <Step4Financial financial={financial} onChange={setFinancial} />}
          {currentStep === 5 && (
            <Step5Review
              selectedTypes={selectedTypes}
              contributions={contributions}
              objective={objective}
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
