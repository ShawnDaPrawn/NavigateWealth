/**
 * FNAWizardShell — the one frame every FNA / INA wizard renders in.
 *
 * Owns everything that must look and behave the same across the six wizards.
 * The wizard is a full page (not a pop-up): "‹ <category>" back link, the FNA
 * name as the page title with "<client> · Draft" under it, the four-step
 * progress, the step body and the publishing overlay. It also extends the
 * top-bar breadcrumb with "<FNA> / <step>". A wizard supplies only
 * the body of its current step, which ends with <FNAStepNavigation />.
 */

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react';
import { Card } from '../../../../ui/card';
import { PageHeader } from '../../../layout/page';
import { useAppendBreadcrumb } from '../../../layout/page';
import {
  FNA_WIZARD_TITLES,
  type FNAWizardFlowStep,
  type FNAWizardStepNumber,
  type FNAWizardType,
} from './fnaWizardFlow';

interface FNAWizardShellProps {
  open: boolean;
  onClose: () => void;
  fnaType: FNAWizardType;
  clientName?: string;
  steps: readonly FNAWizardFlowStep[];
  currentStep: FNAWizardStepNumber;
  /** Shows a spinner in place of the step body (e.g. while client data loads). */
  loading?: boolean;
  loadingMessage?: string;
  isPublishing?: boolean;
  /** "‹ <back>" text; defaults to the policy category the wizard belongs to. */
  backLabel?: string;
  /** Shown after the client name under the title ("Elsa van Wyk · Draft"). */
  statusLabel?: string;
  /** Page-header actions (e.g. Save progress). */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function FNAWizardStepper({
  steps,
  currentStep,
}: {
  steps: readonly FNAWizardFlowStep[];
  currentStep: FNAWizardStepNumber;
}) {
  return (
    <div className="relative">
      <div className="absolute top-5 left-0 w-full h-0.5 bg-muted -z-10" aria-hidden="true" />
      <ol className="flex justify-between items-start" aria-label="Wizard steps">
        {steps.map((step) => {
          const isActive = currentStep === step.step;
          const isCompleted = currentStep > step.step;

          return (
            <li
              key={step.step}
              className="flex flex-col items-center bg-background px-2"
              aria-current={isActive ? 'step' : undefined}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isActive || isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground text-muted-foreground bg-background'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <span className="font-medium text-sm">{step.step}</span>
                )}
              </div>
              <div className="mt-2 text-center max-w-[180px]">
                <p
                  className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Where "‹ Back" goes from each wizard: the policy category it was opened from. */
const FNA_BACK_LABELS: Record<FNAWizardType, string> = {
  risk: 'Risk planning',
  medical: 'Medical aid',
  retirement: 'Retirement planning',
  tax: 'Tax planning',
  investment: 'Investments',
  estate: 'Estate planning',
};

export function FNAWizardShell({
  open,
  onClose,
  fnaType,
  clientName,
  steps,
  currentStep,
  loading = false,
  loadingMessage = 'Loading client data…',
  isPublishing = false,
  backLabel,
  statusLabel = 'Draft',
  headerActions,
  children,
}: FNAWizardShellProps) {
  const title = FNA_WIZARD_TITLES[fnaType];
  const topRef = useRef<HTMLDivElement>(null);
  const current = steps[currentStep - 1];
  const back = backLabel ?? FNA_BACK_LABELS[fnaType];

  useAppendBreadcrumb([{ label: title }, ...(current ? [{ label: current.title }] : [])], open);

  // Every step starts at the top, whichever wizard it belongs to.
  useEffect(() => {
    const el = topRef.current;
    if (!el || typeof el.scrollIntoView !== 'function') return;
    el.scrollIntoView({ block: 'start' });
  }, [currentStep]);

  if (!open) return null;

  return (
    <div
      ref={topRef}
      className="relative flex flex-col gap-5"
      aria-busy={isPublishing || undefined}
    >
      <button
        type="button"
        onClick={() => {
          // A publish in flight must finish; leaving mid-way would orphan it.
          if (!isPublishing) onClose();
        }}
        disabled={isPublishing}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60 disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {back}
      </button>

      <PageHeader
        title={title}
        description={[clientName, statusLabel].filter(Boolean).join(' · ')}
        actions={headerActions}
      />

      <FNAWizardStepper steps={steps} currentStep={currentStep} />

      <div className="min-h-[500px] rounded-xl border border-nw-line bg-white p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm">{loadingMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Step {currentStep} of {steps.length}: {current?.title}
      </div>

      {isPublishing && (
        <div className="absolute inset-0 z-[100] flex items-start justify-center bg-background/80 pt-40 backdrop-blur-sm">
          <Card className="max-w-sm border-2 p-6 shadow-lg">
            <div className="space-y-4 text-center" role="status">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" aria-hidden="true" />
              <p className="text-base font-medium">Publishing {title}…</p>
              <p className="text-sm text-muted-foreground">
                Please wait while the analysis is saved to the client record.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
