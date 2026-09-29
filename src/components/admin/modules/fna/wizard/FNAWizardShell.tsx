/**
 * FNAWizardShell — the one frame every FNA / INA wizard renders in.
 *
 * Owns everything that must look and behave the same across the six wizards:
 * the dialog size, the "<FNA> — <client>" header, the four-step stepper, the
 * scrolling content area and the publishing overlay. A wizard supplies only
 * the body of its current step, which ends with <FNAStepNavigation />.
 */

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
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
  children,
}: FNAWizardShellProps) {
  const title = FNA_WIZARD_TITLES[fnaType];
  const scrollRef = useRef<HTMLDivElement>(null);
  const current = steps[currentStep - 1];

  // Every step starts at the top, whichever wizard it belongs to.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0 });
    else el.scrollTop = 0;
  }, [currentStep]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A publish in flight must finish; closing mid-way would orphan it.
        if (!next && !isPublishing) onClose();
      }}
    >
      <DialogContent className="!max-w-[1600px] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-semibold">
              {title}
              {clientName ? ` — ${clientName}` : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Step {currentStep} of {steps.length}: {current?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <FNAWizardStepper steps={steps} currentStep={currentStep} />

            <div className="min-h-[500px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                  <p className="text-sm">{loadingMessage}</p>
                </div>
              ) : (
                children
              )}
            </div>
          </div>

          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Step {currentStep} of {steps.length}: {current?.title}
          </div>
        </div>

        {isPublishing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <Card className="p-6 max-w-sm shadow-lg border-2">
              <div className="text-center space-y-4" role="status">
                <Loader2
                  className="h-12 w-12 animate-spin text-primary mx-auto"
                  aria-hidden="true"
                />
                <p className="font-medium text-base">Publishing {title}…</p>
                <p className="text-sm text-muted-foreground">
                  Please wait while the analysis is saved to the client record.
                </p>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
