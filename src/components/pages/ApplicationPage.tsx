/**
 * Application Page — Multi-step onboarding form
 *
 * Enhanced to match Navigate Wealth's website design language:
 *   - Dark branded header with progress indication
 *   - Clean card-based form with purple accents
 *   - Polished step navigation sidebar
 *
 * Guidelines refs: §7 (presentation layer), §8.3 (UI standards),
 * §8.4 (AI builder — use react-router not react-router-dom)
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Check,
  ChevronRight,
  Loader2,
  Save,
  Shield,
  Award,
  TrendingUp,
  RotateCcw,
  X,
} from 'lucide-react';

import {
  useOnboarding,
  STEPS,
  Step1Personal,
  Step2Contact,
  Step3Employment,
  Step4Services,
  Step5Terms,
} from '../modules/onboarding';

const TRUST_POINTS = [
  { icon: Shield, label: 'FSCA Regulated' },
  { icon: Award, label: 'POPIA Compliant' },
  { icon: TrendingUp, label: 'Auto-Saved Progress' },
];

export function ApplicationPage() {
  const navigate = useNavigate();
  const {
    currentStep,
    totalSteps,
    data,
    isLoading,
    isInitialLoad,
    validationErrors,
    updateData,
    goToNextStep,
    goToPreviousStep,
    submit,
    progress,
    saveStatus,
    lastSavedAt,
  } = useOnboarding();

  // Track whether user is resuming from a saved step
  const [resumeInfo, setResumeInfo] = React.useState<{ step: number; stepTitle: string } | null>(null);
  const [showResumeBanner, setShowResumeBanner] = React.useState(false);
  const resumeTracked = React.useRef(false);

  // Detect resume: once initial load completes, if currentStep > 1 it means saved progress was restored
  React.useEffect(() => {
    if (!isInitialLoad && !resumeTracked.current) {
      resumeTracked.current = true;
      if (currentStep > 1) {
        setResumeInfo({ step: currentStep, stepTitle: STEPS[currentStep - 1].title });
        setShowResumeBanner(true);
      }
    }
  }, [isInitialLoad, currentStep]);

  // Auto-dismiss resume banner after 8 seconds
  React.useEffect(() => {
    if (!showResumeBanner) return;
    const timer = setTimeout(() => setShowResumeBanner(false), 8000);
    return () => clearTimeout(timer);
  }, [showResumeBanner]);

  const handleNext = () => goToNextStep();
  const handlePrevious = () => goToPreviousStep();

  const handleSubmit = async () => {
    const result = await submit();
    if (result.success) {
      navigate('/dashboard/pending', { replace: true });
    }
  };

  // Calculate field-level progress for current step
  const getStepCompletionCount = (stepNumber: number): number => {
    switch (stepNumber) {
      case 1: {
        let count = 0;
        if (data.title) count++;
        if (data.firstName.trim()) count++;
        if (data.lastName.trim()) count++;
        if (data.dateOfBirth) count++;
        if (data.gender) count++;
        if (data.nationality) count++;
        if (data.idType) count++;
        if (data.idNumber.trim()) count++;
        if (data.maritalStatus) count++;
        return count;
      }
      case 2: {
        let count = 0;
        if (data.emailAddress.trim()) count++;
        if (data.cellphoneNumber.trim()) count++;
        if (data.residentialAddressLine1.trim()) count++;
        if (data.residentialCity.trim()) count++;
        if (data.residentialProvince.trim()) count++;
        if (data.residentialPostalCode.trim()) count++;
        if (data.residentialCountry.trim()) count++;
        return count;
      }
      case 3: {
        let count = 0;
        if (data.employmentStatus) count++;
        if (data.jobTitle.trim() || data.selfEmployedDescription.trim()) count++;
        if (data.industry || data.selfEmployedIndustry) count++;
        return count;
      }
      case 4: {
        let count = 0;
        if (data.accountReasons.length > 0) count++;
        if (data.urgency) count++;
        return count;
      }
      case 5: {
        let count = 0;
        if (data.termsAccepted) count++;
        if (data.popiaConsent) count++;
        if (data.disclosureAcknowledged) count++;
        if (data.faisAcknowledged) count++;
        if (data.signatureFullName.trim()) count++;
        return count;
      }
      default:
        return 0;
    }
  };

  const requiredCounts: Record<number, number> = { 1: 9, 2: 7, 3: 3, 4: 2, 5: 5 };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Dark Branded Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[#1a1e36]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e36] via-[#252a47] to-[#1a1e36]" />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-white">Client Application</h1>
              <p className="text-gray-400 text-sm mt-1">
                Step {currentStep} of {totalSteps} — {STEPS[currentStep - 1].title}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-1.5 text-xs ${
                  saveStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                ) : saveStatus === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                ) : (
                  <Save
                    className={`h-3.5 w-3.5 ${
                      lastSavedAt ? 'text-green-400' : 'text-gray-500'
                    }`}
                  />
                )}
                <span>
                  {saveStatus === 'saving'
                    ? 'Saving...'
                    : saveStatus === 'error'
                    ? 'Save failed — retrying'
                    : lastSavedAt
                    ? `Saved ${lastSavedAt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Auto-save enabled'}
                </span>
              </div>
              <Badge className="bg-white/10 border border-white/10 text-white text-xs hover:bg-white/10">
                {Math.round(progress)}% Complete
              </Badge>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center gap-5 mt-4 pt-3 border-t border-white/5">
            {TRUST_POINTS.map((point) => (
              <div key={point.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <point.icon className="h-3 w-3 text-purple-400/70" />
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Resume Banner — shown when returning to a saved application ── */}
      {showResumeBanner && resumeInfo && (
        <div className="bg-gradient-to-r from-[#6d28d9]/10 via-purple-50 to-[#6d28d9]/10 border-b border-purple-200/60">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
            <div className="flex items-center justify-between py-2.5 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center shrink-0">
                  <RotateCcw className="h-3.5 w-3.5 text-[#6d28d9]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    Welcome back — resuming from Step {resumeInfo.step} of {totalSteps}
                  </p>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    Your progress on <span className="font-medium text-gray-700">{resumeInfo.stepTitle}</span> has been restored.
                    {resumeInfo.step > 1 && (
                      <span> Steps 1–{resumeInfo.step - 1} are complete.</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResumeBanner(false)}
                className="shrink-0 h-7 w-7 rounded-lg hover:bg-[#6d28d9]/10 flex items-center justify-center transition-colors text-gray-400 hover:text-gray-600"
                aria-label="Dismiss resume banner"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-8 lg:py-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Left Sidebar: Steps Navigation (Desktop) ─────────── */}
          <div className="hidden lg:block lg:w-72 flex-shrink-0">
            <div className="sticky top-8 space-y-4">
              <Card className="overflow-hidden shadow-sm border-gray-200/80">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Application Steps</h3>
                </div>
                <div className="p-2 space-y-0.5">
                  {STEPS.map((step) => {
                    const Icon = step.icon;
                    const isCompleted = currentStep > step.number;
                    const isCurrent = currentStep === step.number;
                    const completionCount = getStepCompletionCount(step.number);
                    const totalRequired = requiredCounts[step.number] || 1;
                    const stepProgress = Math.min(100, Math.round((completionCount / totalRequired) * 100));

                    return (
                      <div
                        key={step.number}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isCurrent
                            ? 'bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] text-white shadow-md shadow-purple-200/50'
                            : isCompleted
                            ? 'bg-green-50/80 text-green-700'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                            isCurrent
                              ? 'bg-white/20'
                              : isCompleted
                              ? 'bg-green-100'
                              : 'bg-gray-100'
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Icon className={`h-4 w-4 ${isCurrent ? 'text-white' : 'text-gray-400'}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium leading-tight ${isCurrent ? 'text-white' : ''}`}>
                            {step.title}
                          </div>
                          {isCurrent && (
                            <div className="mt-1.5">
                              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-white/80 rounded-full transition-all duration-500"
                                  style={{ width: `${stepProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {isCompleted && (
                            <div className="text-xs text-green-600 mt-0.5">Complete</div>
                          )}
                          {!isCurrent && !isCompleted && (
                            <div className="text-xs text-gray-400 mt-0.5">Step {step.number}</div>
                          )}
                        </div>
                        {isCurrent && <ChevronRight className="h-4 w-4 text-white/60 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                {/* Progress Summary */}
                <div className="p-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">Overall Progress</span>
                    <span className="text-xs font-bold text-[#6d28d9]">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </Card>

              {/* Help Card */}
              <Card className="p-4 shadow-sm border-gray-200/80 bg-gradient-to-br from-purple-50/50 to-white">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-700">Need help?</span>
                  {' '}Your progress is automatically saved. You can close this page and return at any time to continue where you left off.
                </p>
              </Card>
            </div>
          </div>

          {/* ── Mobile Steps Progress ─────────────────────────────── */}
          <div className="lg:hidden">
            <Card className="p-4 shadow-sm mb-6 border-gray-200/80">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Step {currentStep} of {totalSteps}</div>
                  <div className="text-xs text-gray-500">{STEPS[currentStep - 1].title}</div>
                </div>
                <Badge className="bg-[#6d28d9] hover:bg-[#6d28d9] text-xs px-2.5">{Math.round(progress)}%</Badge>
              </div>
              <Progress value={progress} className="h-1.5" />
              <div className="flex justify-between mt-3">
                {STEPS.map((step) => {
                  const isCompleted = currentStep > step.number;
                  const isCurrent = currentStep === step.number;
                  return (
                    <div
                      key={step.number}
                      className={`flex flex-col items-center gap-1 ${
                        isCurrent
                          ? 'text-[#6d28d9]'
                          : isCompleted
                          ? 'text-green-600'
                          : 'text-gray-300'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        isCurrent ? 'bg-[#6d28d9]/10' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}>
                        {isCompleted ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <span className="text-[10px] font-bold">{step.number}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── Main Content Area ─────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert className="mb-6 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="font-semibold mb-1.5 text-sm">Please correct the following:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Form Card */}
            <Card className="shadow-lg border-gray-200/80 overflow-hidden">
              {/* Step Header */}
              <div className="border-b border-gray-100 bg-gradient-to-r from-white via-white to-purple-50/30 p-6 lg:p-8">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#6d28d9] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-purple-200/40">
                    {React.createElement(STEPS[currentStep - 1].icon, { className: 'h-6 w-6 text-white' })}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{STEPS[currentStep - 1].title} Information</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{STEPS[currentStep - 1].subtitle}</p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 lg:p-8">
                <div className="animate-in fade-in duration-300">
                  {currentStep === 1 && <Step1Personal data={data} updateData={updateData} errors={validationErrors} />}
                  {currentStep === 2 && <Step2Contact data={data} updateData={updateData} errors={validationErrors} />}
                  {currentStep === 3 && <Step3Employment data={data} updateData={updateData} errors={validationErrors} />}
                  {currentStep === 4 && <Step4Services data={data} updateData={updateData} errors={validationErrors} />}
                  {currentStep === 5 && <Step5Terms data={data} updateData={updateData} errors={validationErrors} />}
                </div>

                {/* Navigation Buttons */}
                <div className="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1 || isLoading}
                    className="h-11 px-6"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-3">
                    {/* Mobile auto-save indicator */}
                    <div className={`sm:hidden flex items-center gap-1.5 text-xs ${
                      saveStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {saveStatus === 'saving' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : saveStatus === 'error' ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      <span>{saveStatus === 'saving' ? 'Saving' : saveStatus === 'error' ? 'Error' : 'Saved'}</span>
                    </div>

                    {currentStep < totalSteps ? (
                      <Button
                        onClick={handleNext}
                        className="h-11 px-8 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] shadow-sm shadow-purple-200/30"
                      >
                        Continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="h-11 px-8 bg-green-600 hover:bg-green-700 shadow-sm"
                      >
                        {isLoading ? (
                          <div className="contents">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </div>
                        ) : (
                          <div className="contents">
                            Submit Application
                            <CheckCircle className="ml-2 h-4 w-4" />
                          </div>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationPage;
