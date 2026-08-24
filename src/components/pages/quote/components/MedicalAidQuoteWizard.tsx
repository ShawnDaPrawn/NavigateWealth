/**
 * Medical Aid quote wizard.
 *
 * WHAT THIS FILE IS NOW
 * ---------------------
 * It was 1,534 lines: option lists, state shapes, draft persistence, five step
 * components and the wizard itself. Each step was already a self-contained
 * function with its own props — they simply shared a file.
 *
 * What stays here is the wizard: the state the five steps read and write, the
 * navigation between them, and the submit.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '../../../ui/button';
import { ArrowRight, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { StepIndicator } from './wizard/StepIndicator';
import {
  BUDGET_BANDS,
  COVER_TYPES,
  type HealthState,
  LPJ_OPTIONS,
  MEMBERSHIP_TYPES,
  type MedicalAidHistoryState,
  type MembersState,
  NETWORK_OPTIONS,
  type PreferencesState,
  TENURE_OFF_OPTIONS,
  TENURE_ON_OPTIONS,
  WIZARD_STEPS,
  clearDraft,
  getInitialHealth,
  getInitialHistory,
  getInitialMembers,
  getInitialPreferences,
  getMainMemberAge,
  getMemberLabels,
  hasMemberAge,
  loadDraft,
  saveDraft,
} from './medicalAid/model';
import { Step1Members } from './medicalAid/Step1Members';
import { Step2Preferences } from './medicalAid/Step2Preferences';
import { Step3History } from './medicalAid/Step3History';
import { Step4Health } from './medicalAid/Step4Health';
import { Step5Review } from './medicalAid/Step5Review';

interface MedicalAidQuoteWizardProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  parentSubmissionId?: string;
  onSuccess: () => void;
}

export function MedicalAidQuoteWizard({
  firstName,
  lastName,
  email,
  phone,
  parentSubmissionId,
  onSuccess,
}: MedicalAidQuoteWizardProps) {
  // Load draft or init
  const draft = loadDraft();
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
  const [members, setMembers] = useState<MembersState>(draft?.members ?? getInitialMembers());
  const [preferences, setPreferences] = useState<PreferencesState>(
    draft?.preferences ?? getInitialPreferences(),
  );
  const [history, setHistory] = useState<MedicalAidHistoryState>(
    draft?.medical_aid_history ?? getInitialHistory(),
  );
  const [health, setHealth] = useState<HealthState>(draft?.health ?? getInitialHealth());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist draft
  useEffect(() => {
    saveDraft({
      members,
      preferences,
      medical_aid_history: history,
      health,
      currentStep,
    });
  }, [members, preferences, history, health, currentStep]);

  // Derived values
  const mainMemberAge = useMemo(() => getMainMemberAge(members.main), [members.main]);
  const memberLabels = useMemo(() => getMemberLabels(members), [members]);

  // ── Validation per step ──

  const step1Valid = useMemo(() => {
    if (!members.membership_type) return false;
    if (!hasMemberAge(members.main)) return false;
    const showSpouse =
      members.membership_type === 'main_spouse' || members.membership_type === 'family';
    if (showSpouse && !hasMemberAge(members.spouse)) return false;
    if (members.membership_type === 'family') {
      if (members.children.length === 0) return false;
      if (members.children.some((c) => !hasMemberAge(c))) return false;
    }
    return true;
  }, [members]);

  const step2Valid = useMemo(() => {
    return Boolean(
      preferences.cover_type &&
      preferences.network &&
      preferences.budget_band &&
      preferences.province,
    );
  }, [preferences]);

  const step3Valid = useMemo(() => {
    if (!history.current_status) return false;
    if (history.current_status === 'currently_on') {
      if (!history.current_scheme || !history.current_plan || !history.current_tenure_band)
        return false;
    }
    if (history.current_status === 'not_currently_on') {
      if (!history.time_without_sa_medical_aid) return false;
    }
    // LPJ validation
    const showLpj = mainMemberAge !== null && mainMemberAge >= 35;
    if (showLpj && !history.lpj_time_off_since_35) return false;
    return true;
  }, [history, mainMemberAge]);

  const step4Valid = useMemo(() => {
    if (health.has_chronic_conditions === null) return false;
    if (health.has_chronic_conditions) {
      if (health.selected_conditions.length === 0) return false;
      if (health.applies_to_members.length === 0) return false;
    }
    return true;
  }, [health]);

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
        return true; // review — always can submit
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
      // Build structured payload matching the spec
      const membersPayload: Record<string, unknown> = {
        membership_type:
          MEMBERSHIP_TYPES.find((m) => m.value === members.membership_type)?.label ??
          members.membership_type,
        main: {
          dob: members.main.dob || null,
          age: members.main.age ? parseInt(members.main.age, 10) : null,
        },
      };

      if (members.membership_type === 'main_spouse' || members.membership_type === 'family') {
        membersPayload.spouse = {
          dob: members.spouse.dob || null,
          age: members.spouse.age ? parseInt(members.spouse.age, 10) : null,
        };
      }

      if (members.membership_type === 'family') {
        membersPayload.children = members.children.map((c) => ({
          dob: c.dob || null,
          age: c.age ? parseInt(c.age, 10) : null,
        }));
      }

      const preferencesPayload = {
        cover_type:
          COVER_TYPES.find((c) => c.value === preferences.cover_type)?.label ??
          preferences.cover_type,
        network:
          NETWORK_OPTIONS.find((n) => n.value === preferences.network)?.label ??
          preferences.network,
        budget_band:
          BUDGET_BANDS.find((b) => b.value === preferences.budget_band)?.label ??
          preferences.budget_band,
        province: preferences.province,
      };

      const historyPayload: Record<string, unknown> = {
        current_status:
          history.current_status === 'currently_on'
            ? 'I am currently on a South African medical aid'
            : history.current_status === 'not_currently_on'
              ? 'I am not currently on a South African medical aid'
              : '',
      };

      if (history.current_status === 'currently_on') {
        historyPayload.current_scheme = history.current_scheme;
        historyPayload.current_plan = history.current_plan;
        historyPayload.current_tenure_band =
          TENURE_ON_OPTIONS.find((o) => o.value === history.current_tenure_band)?.label ?? null;
      } else {
        historyPayload.current_scheme = null;
        historyPayload.current_plan = null;
        historyPayload.current_tenure_band = null;
      }

      if (history.current_status === 'not_currently_on') {
        historyPayload.time_without_sa_medical_aid =
          TENURE_OFF_OPTIONS.find((o) => o.value === history.time_without_sa_medical_aid)?.label ??
          null;
      } else {
        historyPayload.time_without_sa_medical_aid = null;
      }

      const showLpj = mainMemberAge !== null && mainMemberAge >= 35;
      historyPayload.lpj_time_off_since_35 = showLpj
        ? (LPJ_OPTIONS.find((o) => o.value === history.lpj_time_off_since_35)?.label ?? null)
        : null;

      const healthPayload = {
        has_chronic_conditions: health.has_chronic_conditions,
        selected_conditions: health.selected_conditions,
        applies_to_members: health.applies_to_members,
        notes: health.notes,
      };

      const productDetails = {
        vertical: 'MedicalAid',
        phase: 2,
        members: membersPayload,
        preferences: preferencesPayload,
        medical_aid_history: historyPayload,
        health: healthPayload,
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
            productName: 'Medical Aid',
            stage: 'full',
            service: 'medical-aid',
            parentSubmissionId: parentSubmissionId ?? undefined,
            productDetails,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Medical aid quote submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      clearDraft();
      toast.success('Your medical aid quote request has been submitted!');
      onSuccess();
    } catch (error) {
      console.error('Medical aid quote network error:', error);
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
    members,
    preferences,
    history,
    health,
    mainMemberAge,
    onSuccess,
  ]);

  // ── Render ──

  return (
    <div className="space-y-6">
      <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-5 sm:p-6">
          {currentStep === 1 && <Step1Members members={members} onChange={setMembers} />}
          {currentStep === 2 && (
            <Step2Preferences preferences={preferences} onChange={setPreferences} />
          )}
          {currentStep === 3 && (
            <Step3History history={history} mainMemberAge={mainMemberAge} onChange={setHistory} />
          )}
          {currentStep === 4 && (
            <Step4Health health={health} memberLabels={memberLabels} onChange={setHealth} />
          )}
          {currentStep === 5 && (
            <Step5Review
              members={members}
              preferences={preferences}
              history={history}
              health={health}
              mainMemberAge={mainMemberAge}
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
