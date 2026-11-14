/**
 * CompleteOnBehalfPage
 *
 * A full page (design system: long forms are pages) for an admin to complete
 * a client's application on their behalf, with step progress.
 * Reuses the existing onboarding step components (Step1Personal through
 * Step5Terms) with mode='admin' to track the completedBy audit field.
 *
 * SS7  -- No business logic in UI; uses useOnboarding hook
 * SS12.3 -- completedBy audit field for compliance
 */

import { useCallback } from 'react';
import { BackLink } from '../../../layout/page/FilterControls';
import { ErrorState } from '../../../layout/page';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Progress } from '../../../../ui/progress';
import { Skeleton } from '../../../../ui/skeleton';
import { ChevronLeft, ChevronRight, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { toast } from 'sonner';
import { useOnboarding } from '../../../../features/onboarding/hooks/useOnboarding';
import { Step1Personal } from '../../../../features/onboarding/components/Step1Personal';
import { Step2Contact } from '../../../../features/onboarding/components/Step2Contact';
import { Step3Employment } from '../../../../features/onboarding/components/Step3Employment';
import { Step4Services } from '../../../../features/onboarding/components/Step4Services';
import { Step5Terms } from '../../../../features/onboarding/components/Step5Terms';
import type { Application } from '../types';

// -- Types --------------------------------------------------------------------

interface CompleteOnBehalfPageProps {
  application: Application;
  /** Leaves the page; "Back to …" names where. */
  onClose: () => void;
  backLabel?: string;
  onComplete: () => void;
  adminUserId: string;
}

// -- Step icon mapping --------------------------------------------------------

const STEP_LABELS = ['Personal', 'Contact', 'Employment', 'Services', 'Terms'];

// -- Component ----------------------------------------------------------------

export function CompleteOnBehalfPage({
  application,
  onClose,
  backLabel = 'applications',
  onComplete,
  adminUserId,
}: CompleteOnBehalfPageProps) {
  const {
    currentStep,
    totalSteps,
    data,
    isLoading,
    isInitialLoad,
    loadError,
    retryLoad,
    validationErrors,
    progress,
    updateData,
    goToNextStep,
    goToPreviousStep,
    submit,
  } = useOnboarding({
    mode: 'admin',
    targetUserId: application.user_id,
    adminUserId,
  });

  const handleSubmit = useCallback(async () => {
    const result = await submit();
    if (result.success) {
      toast.success('Application submitted on behalf of client');
      onComplete();
      onClose();
    } else {
      toast.error(result.error || 'Failed to submit application');
    }
  }, [submit, onComplete, onClose]);

  const renderStep = () => {
    const stepProps = { data, updateData, errors: validationErrors };
    switch (currentStep) {
      case 1:
        return <Step1Personal {...stepProps} />;
      case 2:
        return <Step2Contact {...stepProps} />;
      case 3:
        return <Step3Employment {...stepProps} />;
      case 4:
        return <Step4Services {...stepProps} />;
      case 5:
        return <Step5Terms {...stepProps} />;
      default:
        return null;
    }
  };

  const clientName =
    application.user_name ||
    `${application.application_data?.firstName || ''} ${application.application_data?.lastName || ''}`.trim() ||
    'Client';

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 p-6 lg:p-8">
      <BackLink label={`Back to ${backLabel.toLowerCase()}`} onClick={onClose} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-[26px] leading-tight font-semibold tracking-tight text-nw-ink">
            Complete application for {clientName}
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-xs text-amber-800"
            >
              Admin mode
            </Badge>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-nw-text-3">
            Fill in the form on the applicant&apos;s behalf, e.g. from a meeting or a paper form. It
            is submitted as if they did it
            {application.application_number ? ` (${application.application_number})` : ''}.
          </p>
        </div>
      </div>

      {/* Step progress */}
      <ol aria-label="Steps" className="flex flex-wrap items-center gap-2">
        {STEP_LABELS.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                  isActive && 'bg-nw-violet-50 text-nw-violet-600 ring-1 ring-nw-violet/40',
                  isDone && 'bg-green-50 text-green-700',
                  !isActive && !isDone && 'bg-gray-100 text-nw-text-3',
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <span className="tabular-nums">{stepNum}</span>
                )}
                {label}
              </span>
              {idx < STEP_LABELS.length - 1 && (
                <span
                  className={cn('h-px w-4', isDone ? 'bg-green-300' : 'bg-gray-200')}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      <Progress value={progress} className="h-1" />

      <div className="rounded-xl border border-nw-line bg-white p-6">
        {validationErrors.length > 0 && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500"
                aria-hidden="true"
              />
              <div className="text-sm text-red-700">
                <p className="font-semibold">
                  Fix {validationErrors.length} {validationErrors.length === 1 ? 'field' : 'fields'}{' '}
                  to continue.
                </p>
                {validationErrors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
            </div>
          </div>
        )}
        {loadError ? (
          <ErrorState
            title="Unable to load the application"
            description="The saved application could not be loaded, so nothing can be changed yet. Nothing was overwritten."
            onRetry={retryLoad}
            details={loadError}
          />
        ) : isInitialLoad ? (
          <div role="status" aria-label="Loading the application" className="space-y-4">
            <span className="sr-only">Loading the application…</span>
            <Skeleton className="h-6 w-56" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          renderStep()
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-nw-text-3">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={currentStep === 1 || isLoading || !!loadError}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Button>
          {currentStep < totalSteps ? (
            <Button onClick={goToNextStep} disabled={isLoading || isInitialLoad || !!loadError}>
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={() => void handleSubmit()} disabled={isLoading || !!loadError}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Submit on behalf
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
