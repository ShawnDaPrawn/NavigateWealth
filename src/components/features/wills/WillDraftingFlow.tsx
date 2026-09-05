/**
 * WillDraftingFlow — Multi-step guided will drafting wizard.
 *
 * Walks a client through the key sections of a South African Last Will & Testament,
 * collects structured data across 6 steps, and persists the draft via the
 * estate-planning-fna/wills/create backend endpoint.
 *
 * Steps:
 *  1. Personal Details (pre-filled from clientDetails prop)
 *  2. Executor & Trustee Appointment
 *  3. Beneficiaries & Distribution
 *  4. Guardianship (minor children)
 *  5. Special Bequests & Wishes
 *  6. Review & Submit
 *
 * @module features/wills/WillDraftingFlow
 */

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { cn } from '../../ui/utils';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
  Check,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import {
  type Beneficiary,
  type Executor,
  type Guardian,
  type PersonalInfo,
  type SpecialBequest,
  type WillDraftingFlowProps,
  SITE_SHELL,
  STEPS,
  generateId,
  totalSharePercentage,
} from './willDrafting/model';
import { StepPersonalDetails } from './willDrafting/StepPersonalDetails';
import { StepExecutor } from './willDrafting/StepExecutor';
import { StepBeneficiaries } from './willDrafting/StepBeneficiaries';
import { StepGuardianship } from './willDrafting/StepGuardianship';
import { StepSpecificBequests } from './willDrafting/StepSpecificBequests';
import { StepReview } from './willDrafting/StepReview';

/** Matches main public layout — logo through “Get Started” (see Navigation.tsx) */

export function WillDraftingFlow({ clientDetails, onComplete, onBack }: WillDraftingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // ── Step 1: Personal Details ─────────────────────────────────────
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: clientDetails.name,
    surname: clientDetails.surname,
    idNumber: '',
    dateOfBirth: '',
    maritalStatus: '',
    spouseName: '',
    address: '',
    email: clientDetails.email,
    cellphone: clientDetails.cellphone,
  });

  // ── Step 2: Executor ─────────────────────────────────────────────
  const [executor, setExecutor] = useState<Executor>({
    fullName: '',
    idNumber: '',
    relationship: '',
    cellphone: '',
    email: '',
  });
  const [alternateExecutor, setAlternateExecutor] = useState<Executor>({
    fullName: '',
    idNumber: '',
    relationship: '',
    cellphone: '',
    email: '',
  });

  // ── Step 3: Beneficiaries ────────────────────────────────────────
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    {
      id: generateId(),
      fullName: '',
      idNumber: '',
      relationship: '',
      sharePercentage: 100,
      isAlternate: false,
    },
  ]);

  // ── Step 4: Guardianship ─────────────────────────────────────────
  const [hasMinorChildren, setHasMinorChildren] = useState<boolean | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  // ── Step 5: Special Bequests ─────────────────────────────────────
  const [specialBequests, setSpecialBequests] = useState<SpecialBequest[]>([]);
  const [residualInstructions, setResidualInstructions] = useState('');
  const [funeralWishes, setFuneralWishes] = useState('');

  // ── Navigation ───────────────────────────────────────────────────
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 6));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // ── Validation ───────────────────────────────────────────────────
  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 1:
        return !!(
          personalInfo.firstName.trim() &&
          personalInfo.surname.trim() &&
          personalInfo.email.trim()
        );
      case 2:
        return !!executor.fullName.trim();
      case 3:
        return (
          beneficiaries.filter((b) => !b.isAlternate).length > 0 &&
          beneficiaries.filter((b) => !b.isAlternate).every((b) => b.fullName.trim())
        );
      case 4:
        return hasMinorChildren !== null;
      case 5:
        return true; // optional
      case 6:
        return true;
      default:
        return false;
    }
  }, [currentStep, personalInfo, executor, beneficiaries, hasMinorChildren]);

  const shareTotal = totalSharePercentage(beneficiaries);

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

      const willData = {
        personalInfo,
        executor: {
          primary: executor,
          alternate: alternateExecutor.fullName ? alternateExecutor : null,
        },
        beneficiaries,
        guardianship: {
          hasMinorChildren,
          guardians,
        },
        specialBequests,
        residualInstructions,
        funeralWishes,
        generatedAt: new Date().toISOString(),
      };

      // This public lead-generation flow must not write directly into an
      // authenticated client's estate records. Store it as a quote request;
      // advisers can move reviewed data into the protected FNA workflow.
      const response = await fetch(`${API_BASE}/quote-request/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: personalInfo.firstName,
          lastName: personalInfo.surname,
          email: personalInfo.email,
          phone: personalInfo.cellphone,
          productName: 'Last Will & Testament',
          service: 'estate-planning',
          stage: 'full',
          productDetails: { willDraft: willData },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to save will draft');
      }

      toast.success('Will draft saved successfully', {
        description:
          'Your will draft has been securely stored. A financial adviser will review it.',
      });

      setIsComplete(true);
    } catch (error) {
      console.error('Failed to save will draft:', error);
      toast.error('Failed to save will draft', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // COMPLETION VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center overflow-x-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div className={cn(SITE_SHELL)}>
          <Card className="max-w-lg mx-auto w-full shadow-lg">
            <CardContent className="pt-8 pb-6 px-4 sm:px-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Will Draft Saved</h2>
              <p className="text-sm text-gray-600 max-w-sm mx-auto">
                Your Last Will & Testament draft has been securely saved. A Navigate Wealth adviser
                will review the draft and contact you to discuss the next steps, including any legal
                attestation requirements.
              </p>
              <div className="flex items-start gap-2 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg text-left">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-gray-800">
                  <strong>Important:</strong> This is a draft only. It is not legally binding until
                  signed in the presence of two competent witnesses, as required by the Wills Act 7
                  of 1953 (South Africa).
                </p>
              </div>
              <Separator />
              <Button
                onClick={onComplete}
                className="w-full min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground touch-manipulation"
              >
                Return to Estate Planning
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP RENDERERS
  // ═══════════════════════════════════════════════════════════════════

  const updatePersonal = (field: keyof PersonalInfo, value: string) =>
    setPersonalInfo((prev) => ({ ...prev, [field]: value }));

  const updateExecutor = (
    target: 'primary' | 'alternate',
    field: keyof Executor,
    value: string,
  ) => {
    if (target === 'primary') {
      setExecutor((prev) => ({ ...prev, [field]: value }));
    } else {
      setAlternateExecutor((prev) => ({ ...prev, [field]: value }));
    }
  };

  const addBeneficiary = (isAlternate = false) => {
    setBeneficiaries((prev) => [
      ...prev,
      {
        id: generateId(),
        fullName: '',
        idNumber: '',
        relationship: '',
        sharePercentage: 0,
        isAlternate,
      },
    ]);
  };

  const updateBeneficiary = (
    id: string,
    field: keyof Beneficiary,
    value: string | number | boolean,
  ) => {
    setBeneficiaries((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBeneficiary = (id: string) => {
    setBeneficiaries((prev) => prev.filter((b) => b.id !== id));
  };

  const addGuardian = (isAlternate = false) => {
    setGuardians((prev) => [
      ...prev,
      { id: generateId(), fullName: '', relationship: '', cellphone: '', isAlternate },
    ]);
  };

  const updateGuardian = (id: string, field: keyof Guardian, value: string | boolean) => {
    setGuardians((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const removeGuardian = (id: string) => {
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  };

  const addBequest = () => {
    setSpecialBequests((prev) => [
      ...prev,
      { id: generateId(), description: '', beneficiaryName: '', conditions: '' },
    ]);
  };

  const updateBequest = (id: string, field: keyof SpecialBequest, value: string) => {
    setSpecialBequests((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBequest = (id: string) => {
    setSpecialBequests((prev) => prev.filter((b) => b.id !== id));
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div
          className={cn(
            SITE_SHELL,
            'pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 sm:pb-4 flex items-center justify-between gap-3 min-h-0',
          )}
        >
          <button
            type="button"
            onClick={currentStep === 1 ? onBack : goBack}
            aria-label={currentStep === 1 ? 'Back to Estate Planning' : 'Go to previous step'}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 active:bg-gray-100 transition-colors text-left min-w-0 min-h-[44px] px-1.5 -ml-1 rounded-md touch-manipulation max-w-[min(100%,calc(100vw-5.5rem))]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate sm:whitespace-normal">
              <span className="sm:hidden">{currentStep === 1 ? 'Back' : 'Previous'}</span>
              <span className="hidden sm:inline">
                {currentStep === 1 ? 'Back to Estate Planning' : 'Previous Step'}
              </span>
            </span>
          </button>
          <Badge
            variant="outline"
            className="text-xs px-2.5 py-0.5 shrink-0 bg-primary/10 text-primary border-primary/25"
          >
            Draft Will
          </Badge>
        </div>
      </div>

      <div
        className={cn(
          SITE_SHELL,
          'py-6 sm:py-10 space-y-6 sm:space-y-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        {/* ── Progress Stepper ──────────────────────────────────── */}
        <div className="hidden sm:block">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isDone = step.id < currentStep;
              return (
                <div className="contents" key={step.id}>
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <div
                      className={cn(
                        'flex items-center justify-center h-9 w-9 rounded-full border-2 transition-colors',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isDone
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 bg-white text-gray-400',
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-medium text-center leading-tight max-w-[72px]',
                        isActive ? 'text-primary' : isDone ? 'text-green-700' : 'text-gray-400',
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2 rounded-full',
                        step.id < currentStep ? 'bg-green-400' : 'bg-gray-200',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: compact progress + bar (desktop uses full stepper above) */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Step {currentStep} of {STEPS.length}
            </p>
            <p className="text-xs font-medium text-primary text-right leading-snug max-w-[58%]">
              {STEPS[currentStep - 1].label}
            </p>
          </div>
          <div
            className="h-2 rounded-full bg-gray-200 overflow-hidden"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={currentStep}
            aria-label={`Will draft progress, step ${currentStep} of ${STEPS.length}`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Step Header ──────────────────────────────────────── */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 break-words">
            {STEPS[currentStep - 1].label}
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* ── Step Content ─────────────────────────────────────── */}
        <Card className="shadow-sm border-gray-200/80 [&_input:not([type='hidden'])]:text-base sm:[&_input:not([type='hidden'])]:text-sm [&_textarea]:text-base sm:[&_textarea]:text-sm">
          <CardContent className="p-4 sm:p-6 space-y-5">
            {currentStep === 1 && (
              <StepPersonalDetails personalInfo={personalInfo} updatePersonal={updatePersonal} />
            )}

            {currentStep === 2 && (
              <StepExecutor
                executor={executor}
                alternateExecutor={alternateExecutor}
                updateExecutor={updateExecutor}
              />
            )}

            {currentStep === 3 && (
              <StepBeneficiaries
                beneficiaries={beneficiaries}
                shareTotal={shareTotal}
                addBeneficiary={addBeneficiary}
                updateBeneficiary={updateBeneficiary}
                removeBeneficiary={removeBeneficiary}
              />
            )}

            {currentStep === 4 && (
              <StepGuardianship
                hasMinorChildren={hasMinorChildren}
                setHasMinorChildren={setHasMinorChildren}
                guardians={guardians}
                setGuardians={setGuardians}
                addGuardian={addGuardian}
                updateGuardian={updateGuardian}
                removeGuardian={removeGuardian}
              />
            )}

            {currentStep === 5 && (
              <StepSpecificBequests
                specialBequests={specialBequests}
                addBequest={addBequest}
                updateBequest={updateBequest}
                removeBequest={removeBequest}
                residualInstructions={residualInstructions}
                setResidualInstructions={setResidualInstructions}
                funeralWishes={funeralWishes}
                setFuneralWishes={setFuneralWishes}
              />
            )}

            {currentStep === 6 && (
              <StepReview
                personalInfo={personalInfo}
                executor={executor}
                alternateExecutor={alternateExecutor}
                beneficiaries={beneficiaries}
                hasMinorChildren={hasMinorChildren}
                guardians={guardians}
                specialBequests={specialBequests}
                residualInstructions={residualInstructions}
                funeralWishes={funeralWishes}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Navigation Footer (stacked full-width on small screens for touch) ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 1 ? onBack : goBack}
            className="gap-1.5 w-full sm:w-auto min-h-11 touch-manipulation justify-center sm:justify-start"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep < 6 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!stepValid}
              className="gap-1.5 w-full sm:w-auto min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground touch-manipulation justify-center"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-1.5 w-full sm:w-auto sm:min-w-[160px] min-h-11 bg-primary hover:bg-primary/90 text-primary-foreground touch-manipulation justify-center"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Draft...
                </div>
              ) : (
                <div className="contents">
                  <FileText className="h-4 w-4" />
                  Save Will Draft
                </div>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
