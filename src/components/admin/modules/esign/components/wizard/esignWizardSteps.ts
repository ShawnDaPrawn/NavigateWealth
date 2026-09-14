/**
 * The canonical step model for the "send for signature" flow.
 *
 * Both entry points into the flow — the standalone E-Signature module and the
 * client drawer's E-Sign tab — used to describe their own steps inline, with
 * different labels, different orders of the same work, and different chrome.
 * This module is the single source of truth so the two read identically.
 *
 * Pure data + pure functions: the stepper's visual states are derived here so
 * they can be unit-tested without rendering.
 */
import { FileUp, PenLine, Users, type LucideIcon } from 'lucide-react';

export type EsignWizardStepId = 'upload' | 'recipients' | 'prepare';

export interface EsignWizardStep {
  id: EsignWizardStepId;
  /** Stepper label — short enough that three fit across a laptop viewport. */
  label: string;
  /** What the step is for; shown under the label on wide viewports. */
  hint: string;
  icon: LucideIcon;
}

export const ESIGN_WIZARD_STEPS: readonly EsignWizardStep[] = [
  { id: 'upload', label: 'Documents', hint: 'Choose the files', icon: FileUp },
  { id: 'recipients', label: 'Recipients', hint: 'Say who signs', icon: Users },
  { id: 'prepare', label: 'Fields & send', hint: 'Place fields, then send', icon: PenLine },
] as const;

export const ESIGN_WIZARD_STEP_COUNT = ESIGN_WIZARD_STEPS.length;

export type EsignWizardStepState = 'complete' | 'current' | 'upcoming';

function indexOf(step: EsignWizardStepId): number {
  return ESIGN_WIZARD_STEPS.findIndex((s) => s.id === step);
}

/** 1-based position, for "Step 2 of 3" copy. */
export function esignWizardStepNumber(step: EsignWizardStepId): number {
  return indexOf(step) + 1;
}

export function esignWizardStepState(
  step: EsignWizardStepId,
  current: EsignWizardStepId,
): EsignWizardStepState {
  const stepAt = indexOf(step);
  const currentAt = indexOf(current);
  if (stepAt < currentAt) return 'complete';
  if (stepAt === currentAt) return 'current';
  return 'upcoming';
}

/**
 * How far through the flow the user is, as a percentage. The current step
 * counts as half-done so the bar always moves on entering a step — a bar that
 * reads 0% on step 1 looks broken.
 */
export function esignWizardProgressPercent(current: EsignWizardStepId): number {
  const at = indexOf(current);
  if (at < 0) return 0;
  return Math.round(((at + 0.5) / ESIGN_WIZARD_STEP_COUNT) * 100);
}
