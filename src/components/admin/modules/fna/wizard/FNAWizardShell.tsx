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
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
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

/**
 * The four steps as one compact row: number, title and state, joined by a
 * hairline. On a phone it collapses to "Step n of 4 · <title>" over a
 * four-part progress bar, so it never wraps into a wall of boxes.
 */
export function FNAWizardStepper({
  steps,
  currentStep,
}: {
  steps: readonly FNAWizardFlowStep[];
  currentStep: FNAWizardStepNumber;
}) {
  const current = steps[currentStep - 1];

  return (
    <div className="rounded-lg border border-nw-line bg-white px-4 py-3 sm:px-5">
      {/* Phone heading. The live region in the shell announces the step, so this is
          visual only, and one text node so the step title is not in the page twice. */}
      <p className="mb-2 text-sm font-semibold text-nw-ink sm:hidden" aria-hidden="true">
        {`Step ${currentStep} of ${steps.length} · ${current?.title ?? ''}`}
      </p>
      <ol
        className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3"
        aria-label="Wizard steps"
      >
        {steps.map((step, index) => {
          const isActive = currentStep === step.step;
          const isCompleted = currentStep > step.step;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.step}
              className={`min-w-0 sm:flex sm:items-center sm:gap-2.5 ${
                isLast ? 'sm:flex-[0_1_auto]' : 'sm:flex-[1_1_200px]'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              {/* Phone: one segment of the progress bar. */}
              <span
                className={`block h-1 rounded-full sm:hidden ${
                  isActive || isCompleted ? 'bg-nw-violet' : 'bg-nw-paper-2'
                }`}
                aria-hidden="true"
              />
              <span
                className={`hidden h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold sm:inline-flex ${
                  isActive
                    ? 'bg-nw-violet text-white'
                    : isCompleted
                      ? 'border-[1.5px] border-nw-violet bg-white text-nw-violet'
                      : 'border-[1.5px] border-nw-control-border bg-white text-nw-muted'
                }`}
                aria-hidden="true"
              >
                {isCompleted ? <Check className="h-4 w-4" strokeWidth={2.25} /> : step.step}
              </span>
              <span className="flex min-w-0 flex-col max-sm:sr-only">
                <span
                  className={`truncate text-sm ${
                    isActive ? 'font-semibold text-nw-ink' : 'font-medium text-nw-text'
                  }`}
                >
                  {step.title}
                </span>
                <span
                  className={`truncate text-xs leading-4 ${
                    isActive ? 'font-medium text-nw-violet' : 'text-nw-muted'
                  }`}
                >
                  {isActive ? 'In progress' : isCompleted ? 'Done' : step.description}
                </span>
              </span>
              {!isLast && (
                <span
                  className="hidden h-px min-w-3 flex-1 bg-nw-line-strong sm:block"
                  aria-hidden="true"
                />
              )}
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

      <div className="rounded-lg border border-nw-line bg-white p-4 sm:p-6">
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
