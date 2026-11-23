/**
 * FNAStepNavigation — the footer every FNA wizard step ends with.
 *
 * Back on the left ("Back to <previous step>"), the step's primary action on
 * the right, labelled from the shared flow. Wizard-specific extras (Export PDF,
 * Save progress) sit beside the primary action through `secondaryActions`.
 *
 * Step 1 forms are also reused by the client intake portal, which is the only
 * caller that may relabel the primary action (`nextLabel`).
 */

import React from 'react';
import { ArrowLeft, ArrowRight, Loader2, Send } from 'lucide-react';
import { Button } from '../../../../ui/button';
import {
  FNA_WIZARD_NEXT_LABELS,
  FNA_WIZARD_STEP_COUNT,
  backLabelFor,
  type FNAWizardStepNumber,
} from './fnaWizardFlow';

interface FNAStepNavigationProps {
  step: FNAWizardStepNumber;
  onBack?: () => void;
  /** Omit when `nextType` is "submit" and the enclosing form handles it. */
  onNext?: () => void;
  nextType?: 'button' | 'submit';
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Disables every action and shows a spinner on the primary one. */
  isBusy?: boolean;
  secondaryActions?: React.ReactNode;
}

export function FNAStepNavigation({
  step,
  onBack,
  onNext,
  nextType = 'button',
  nextLabel,
  nextDisabled = false,
  isBusy = false,
  secondaryActions,
}: FNAStepNavigationProps) {
  const backLabel = backLabelFor(step);
  const isFinal = step === 4;
  const label = nextLabel ?? FNA_WIZARD_NEXT_LABELS[step];

  // Sticks to the bottom of the window while the step scrolls, so the way on
  // is always in reach. On a phone the actions stack full width, primary on top.
  return (
    <div className="sticky bottom-0 z-10 -mb-px flex flex-col-reverse gap-2 border-t border-nw-line bg-white/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {onBack && backLabel ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isBusy}
          className="max-sm:h-11 max-sm:w-full"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Button>
      ) : (
        <span className="hidden text-[13px] text-nw-muted sm:inline">
          Step {step} of {FNA_WIZARD_STEP_COUNT}
        </span>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center [&>button]:max-sm:h-11 [&>button]:max-sm:w-full">
        {secondaryActions}
        <Button
          type={nextType}
          onClick={onNext}
          size="lg"
          disabled={nextDisabled || isBusy}
          className="max-sm:h-11 max-sm:w-full"
        >
          {isBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : isFinal ? (
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          ) : null}
          {label}
          {!isFinal && <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}
