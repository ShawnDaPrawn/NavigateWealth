/**
 * The FNA wizard flow — one definition for every FNA / INA wizard.
 *
 * Every analysis (Risk, Medical, Retirement, Tax, Investment INA, Estate) runs
 * the same four steps in the same order:
 *
 *   1. Information Gathering    — client data, prefilled from the client keys
 *   2. System Auto-Calculation  — formula-driven, no edits
 *   3. Adviser Manual Adjustment — overrides, each with a recorded reason
 *   4. Finalise & Publish
 *
 * Steps may not be skipped, and all prior data flows forward. The step titles,
 * their order and the navigation labels live here so they cannot drift apart
 * between wizards again; a wizard may only supply its own one-line step
 * descriptions.
 */

import type { FNAConfig } from '../types';

export type FNAWizardStepNumber = 1 | 2 | 3 | 4;

export type FNAWizardStepId = 'information' | 'calculation' | 'adjustment' | 'finalise';

export interface FNAWizardFlowStep {
  step: FNAWizardStepNumber;
  id: FNAWizardStepId;
  title: string;
  /** Used in "Back to …" labels. */
  shortTitle: string;
  description: string;
}

export const FNA_WIZARD_FLOW: readonly FNAWizardFlowStep[] = [
  {
    step: 1,
    id: 'information',
    title: 'Information Gathering',
    shortTitle: 'Information',
    description: 'Confirm client information from the client record',
  },
  {
    step: 2,
    id: 'calculation',
    title: 'System Auto-Calculation',
    shortTitle: 'Calculation',
    description: 'Review the formula-driven results',
  },
  {
    step: 3,
    id: 'adjustment',
    title: 'Adviser Manual Adjustment',
    shortTitle: 'Adjustments',
    description: 'Apply overrides with a recorded reason',
  },
  {
    step: 4,
    id: 'finalise',
    title: 'Finalise & Publish',
    shortTitle: 'Finalise',
    description: 'Review and publish the analysis',
  },
] as const;

export const FNA_WIZARD_STEP_COUNT = FNA_WIZARD_FLOW.length;

/** Primary footer action of each step. Identical in every wizard. */
export const FNA_WIZARD_NEXT_LABELS: Record<FNAWizardStepNumber, string> = {
  1: 'Run Calculation',
  2: 'Continue to Adjustments',
  3: 'Continue to Finalise',
  4: 'Publish FNA',
};

/** Dialog title of each wizard, keyed by the FNA registry type. */
export const FNA_WIZARD_TITLES = {
  risk: 'Risk Planning FNA',
  medical: 'Medical Aid FNA',
  retirement: 'Retirement Planning FNA',
  tax: 'Tax Planning FNA',
  investment: 'Investment Needs Analysis',
  estate: 'Estate Planning FNA',
} as const satisfies Record<FNAConfig['type'], string>;

export type FNAWizardType = keyof typeof FNA_WIZARD_TITLES;

export type FNAStepDescriptions = Partial<Record<FNAWizardStepNumber, string>>;

/**
 * The flow with a wizard's own step descriptions. Titles and order are fixed.
 */
export function buildFNAWizardSteps(descriptions: FNAStepDescriptions = {}): FNAWizardFlowStep[] {
  return FNA_WIZARD_FLOW.map((step) => ({
    ...step,
    description: descriptions[step.step] ?? step.description,
  }));
}

export function getFNAWizardStep(step: FNAWizardStepNumber): FNAWizardFlowStep {
  return FNA_WIZARD_FLOW[step - 1];
}

export function backLabelFor(step: FNAWizardStepNumber): string | null {
  if (step === 1) return null;
  return `Back to ${getFNAWizardStep((step - 1) as FNAWizardStepNumber).shortTitle}`;
}

/**
 * Where a wizard opens.
 *
 * A wizard can only open past Step 1 when it has something to calculate from:
 * an accepted client intake. It then opens on Step 2 with the calculation
 * already run. Steps 3 and 4 depend on work done in the wizard itself, so a
 * request to open there is treated as a request for Step 2. Without intake
 * data every wizard opens on Step 1.
 */
export function resolveInitialFNAStep(
  startAtStep: number | undefined,
  intakePrefill: Record<string, unknown> | undefined,
): FNAWizardStepNumber {
  const hasIntake = !!intakePrefill && Object.keys(intakePrefill).length > 0;
  return hasIntake && typeof startAtStep === 'number' && startAtStep >= 2 ? 2 : 1;
}
