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
import { FNA_WIZARD_NEXT_LABELS, backLabelFor, type FNAWizardStepNumber } from './fnaWizardFlow';

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

  return (
    <div className="flex items-center justify-between gap-4 pt-6 border-t">
      {onBack && backLabel ? (
        <Button type="button" variant="outline" onClick={onBack} disabled={isBusy}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}

      <div className="flex items-center gap-2">
        {secondaryActions}
        <Button
          type={nextType}
          onClick={onNext}
          size="lg"
          disabled={nextDisabled || isBusy}
          className={isFinal ? 'bg-green-600 hover:bg-green-700 text-white' : undefined}
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
