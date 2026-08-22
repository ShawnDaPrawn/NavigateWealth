/**
 * The step indicator every quote wizard renders above its form.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * All seven quote wizards defined their own `StepIndicator`, and once each
 * one's `steps` array was set aside, the seven bodies were byte-identical —
 * roughly 350 lines of literal duplication, the same circles, the same
 * connecting rules, the same three-way active/completed/pending colouring.
 *
 * Only the steps differ, so only the steps are a prop. The body below is the
 * one that was in all seven, moved unchanged.
 *
 * `__tests__/quoteWizards.stepIndicator.test.tsx` checks that each wizard still
 * renders its OWN labels — including that no two wizards end up showing the
 * same stepper, which is the failure a shared component invites.
 */
import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WizardStep {
  num: number;
  label: string;
  icon: LucideIcon;
}

interface StepIndicatorProps {
  currentStep: number;
  steps: WizardStep[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full mb-6">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const IconComp = step.icon;
        return (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div
                className={`flex-1 h-0.5 mx-1 sm:mx-2 transition-colors ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isActive
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <IconComp className="h-4 w-4" />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
