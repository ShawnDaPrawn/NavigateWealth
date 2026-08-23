/**
 * RiskQuoteWizard -- Phase 2 Risk Planning "Get a Quote" Wizard
 *
 * A 4-step mobile-first wizard collecting:
 *   Step 1: Risk Cover Requirements (covers + amounts / adviser-assist)
 *   Step 2: Personal & Financial Details (underwriting / quoting inputs)
 *   Step 3: Chronic Conditions (quick-pick chips + free text)
 *   Step 4: Review & Submit
 *
 * Outputs a structured payload for the quote engine / adviser review.
 * Persists draft progress to sessionStorage for save-and-resume.
 *
 * $7   -- Presentation layer (UI only, no business logic)
 * $5.3 -- Constants centralised below
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { ArrowRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { StepIndicator } from './wizard/StepIndicator';
import {
  WIZARD_STEPS,
  COVER_OPTIONS,
  getInitialRiskNeeds,
  getInitialPersonalDetails,
  getInitialHealthDisclosures,
  loadDraft,
  saveDraft,
  clearDraft,
  needsSpouseIncome,
  parseCurrencyToNumber,
  type RiskNeeds,
  type PersonalDetails,
  type HealthDisclosures,
} from './risk/model';
import { Step1Covers } from './risk/Step1Covers';
import { Step2Personal } from './risk/Step2Personal';
import { Step3Health } from './risk/Step3Health';
import { Step4Review } from './risk/Step4Review';

// ---- Props ---------------------------------------------------------------------

interface RiskQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
  onExit?: () => void;
}
// ---- Main wizard component ----------------------------------------------------

export function RiskQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
  onExit,
}: RiskQuoteWizardProps) {
  const navigate = useNavigate();

  // Load draft or init
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [riskNeeds, setRiskNeeds] = useState<RiskNeeds>(draft?.risk_needs ?? getInitialRiskNeeds());
  const [personalDetails, setPersonalDetails] = useState<PersonalDetails>(
    draft?.personal_details ?? getInitialPersonalDetails(),
  );
  const [healthDisclosures, setHealthDisclosures] = useState<HealthDisclosures>(
    draft?.health_disclosures ?? getInitialHealthDisclosures(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft on changes
  useEffect(() => {
    saveDraft({
      risk_needs: riskNeeds,
      personal_details: personalDetails,
      health_disclosures: healthDisclosures,
      currentStep,
    });
  }, [riskNeeds, personalDetails, healthDisclosures, currentStep]);

  // ---- Validation per step ----

  const step1Valid = useMemo(() => {
    const selected = COVER_OPTIONS.filter((c) => riskNeeds[c.id].selected);
    if (selected.length === 0) return false;
    return selected.every((c) => {
      const entry = riskNeeds[c.id];
      return entry.adviser_assist || parseCurrencyToNumber(entry.amount) > 0;
    });
  }, [riskNeeds]);

  const step2Valid = useMemo(() => {
    const d = personalDetails;
    if (!d.occupation.trim()) return false;
    if (!d.income_gross_monthly.trim()) return false;
    if (!d.income_net_monthly.trim()) return false;
    if (!d.smoker_status) return false;
    if (!d.marital_status) return false;
    if (needsSpouseIncome(d.marital_status) && !d.spouse_income_monthly.trim()) return false;
    return true;
  }, [personalDetails]);

  const step3Valid = useMemo(() => {
    return healthDisclosures.has_conditions !== null;
  }, [healthDisclosures]);

  const canProceed =
    currentStep === 1
      ? step1Valid
      : currentStep === 2
        ? step2Valid
        : currentStep === 3
          ? step3Valid
          : true;

  // ---- Navigation ----

  const goNext = useCallback(() => {
    if (currentStep < 4) setCurrentStep((s) => s + 1);
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // ---- Submit ----

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);

    try {
      // Build structured payload matching the Phase 2 spec
      const riskNeedsPayload: Record<string, unknown> = {};
      COVER_OPTIONS.forEach((c) => {
        const entry = riskNeeds[c.id];
        const base: Record<string, unknown> = {
          selected: entry.selected,
          adviser_assist: entry.adviser_assist,
        };
        if (c.isMonthly) {
          base.amount_per_month = entry.selected ? parseCurrencyToNumber(entry.amount) : null;
        } else {
          base.amount = entry.selected ? parseCurrencyToNumber(entry.amount) : null;
        }
        riskNeedsPayload[c.id] = base;
      });

      const personalPayload: Record<string, unknown> = {
        occupation: personalDetails.occupation,
        income_gross_monthly: parseCurrencyToNumber(personalDetails.income_gross_monthly),
        income_net_monthly: parseCurrencyToNumber(personalDetails.income_net_monthly),
        smoker_status: personalDetails.smoker_status,
        highest_qualification: personalDetails.highest_qualification,
        marital_status: personalDetails.marital_status,
      };
      if (needsSpouseIncome(personalDetails.marital_status)) {
        personalPayload.spouse_income_monthly = parseCurrencyToNumber(
          personalDetails.spouse_income_monthly,
        );
      }

      const healthPayload = {
        has_conditions: healthDisclosures.has_conditions,
        selected_conditions: healthDisclosures.selected_conditions,
        free_text: healthDisclosures.free_text,
      };

      const productDetails = {
        phase: 2,
        risk_needs: riskNeedsPayload,
        personal_details: personalPayload,
        health_disclosures: healthPayload,
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
            productName: 'Risk Management',
            stage: 'full',
            service: 'risk-management',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Risk quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your risk quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Risk quote network error:', error);
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
    riskNeeds,
    personalDetails,
    healthDisclosures,
    onSuccess,
  ]);

  // ---- Render ----

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Covers riskNeeds={riskNeeds} onChange={setRiskNeeds} />}
          {currentStep === 2 && (
            <Step2Personal details={personalDetails} onChange={setPersonalDetails} />
          )}
          {currentStep === 3 && (
            <Step3Health disclosures={healthDisclosures} onChange={setHealthDisclosures} />
          )}
          {currentStep === 4 && (
            <Step4Review
              riskNeeds={riskNeeds}
              personalDetails={personalDetails}
              healthDisclosures={healthDisclosures}
              firstName={firstName}
              lastName={lastName}
              email={email}
              phone={phone}
              onEdit={goToStep}
            />
          )}
        </div>

        {/* Navigation footer */}
        <div className="border-t border-gray-100 px-5 sm:px-6 py-4 bg-gray-50/50 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={
              currentStep === 1
                ? (onExit ?? (() => navigate('/get-quote/risk-management/contact')))
                : goBack
            }
            className="h-11 px-5 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Back' : 'Previous'}
          </Button>

          {currentStep < 4 ? (
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
