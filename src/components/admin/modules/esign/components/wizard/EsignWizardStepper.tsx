/**
 * The progress rail shown at the top of every step of the send-for-signature
 * flow. Purely presentational — all state lives in `esignWizardSteps`.
 *
 * Two renderings of the same model:
 *   - sm and up: the full rail, one node per step with a connector between.
 *   - below sm: "Step 2 of 3 — Recipients" over a progress bar, because three
 *     labelled nodes do not fit a phone without wrapping into a mess.
 */
import { Check } from 'lucide-react';
import { cn } from '../../../../../ui/utils';
import {
  ESIGN_WIZARD_STEPS,
  ESIGN_WIZARD_STEP_COUNT,
  esignWizardProgressPercent,
  esignWizardStepNumber,
  esignWizardStepState,
  type EsignWizardStepId,
} from './esignWizardSteps';

interface EsignWizardStepperProps {
  current: EsignWizardStepId;
  className?: string;
}

export function EsignWizardStepper({ current, className }: EsignWizardStepperProps) {
  const currentStep = ESIGN_WIZARD_STEPS.find((s) => s.id === current);

  return (
    <div className={className}>
      {/* Compact rendering — phones */}
      <div className="sm:hidden space-y-2" data-testid="esign-wizard-stepper-compact">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-900">{currentStep?.label}</span>
          <span className="text-xs text-gray-500">
            Step {esignWizardStepNumber(current)} of {ESIGN_WIZARD_STEP_COUNT}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-purple-600 transition-all duration-300"
            style={{ width: `${esignWizardProgressPercent(current)}%` }}
          />
        </div>
      </div>

      {/* Full rail — sm and up */}
      <ol
        className="hidden sm:flex items-center"
        aria-label={`Send for signature — step ${esignWizardStepNumber(current)} of ${ESIGN_WIZARD_STEP_COUNT}`}
        data-testid="esign-wizard-stepper"
      >
        {ESIGN_WIZARD_STEPS.map((step, index) => {
          const state = esignWizardStepState(step.id, current);
          const Icon = step.icon;
          const isLast = index === ESIGN_WIZARD_STEP_COUNT - 1;

          return (
            <li
              key={step.id}
              className={cn('flex items-center', !isLast && 'flex-1')}
              aria-current={state === 'current' ? 'step' : undefined}
              data-step={step.id}
              data-state={state}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                    state === 'current' && 'border-purple-600 bg-purple-600 text-white shadow-sm',
                    state === 'complete' && 'border-purple-200 bg-purple-50 text-purple-700',
                    state === 'upcoming' && 'border-gray-200 bg-white text-gray-400',
                  )}
                >
                  {state === 'complete' ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 leading-tight">
                  <span
                    className={cn(
                      'block text-sm font-medium transition-colors',
                      state === 'upcoming' ? 'text-gray-400' : 'text-gray-900',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden lg:block text-xs text-gray-400">{step.hint}</span>
                </span>
              </div>

              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mx-3 h-px flex-1 rounded-full transition-colors',
                    state === 'complete' ? 'bg-purple-300' : 'bg-gray-200',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
