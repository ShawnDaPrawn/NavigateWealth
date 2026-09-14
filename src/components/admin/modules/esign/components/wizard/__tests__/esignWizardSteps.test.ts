/**
 * The step model is what keeps the two entry points into the
 * send-for-signature flow telling the user the same story. Pin the ordering
 * and the derived states here so a relabel or a reorder cannot quietly change
 * what "Step 2 of 3" means in one place and not the other.
 */
import { describe, expect, it } from 'vitest';

import {
  ESIGN_WIZARD_STEPS,
  ESIGN_WIZARD_STEP_COUNT,
  esignWizardProgressPercent,
  esignWizardStepNumber,
  esignWizardStepState,
} from '../esignWizardSteps';

describe('esignWizardSteps', () => {
  it('runs documents → recipients → fields', () => {
    expect(ESIGN_WIZARD_STEPS.map((s) => s.id)).toEqual(['upload', 'recipients', 'prepare']);
    expect(ESIGN_WIZARD_STEP_COUNT).toBe(3);
  });

  it('numbers steps from one', () => {
    expect(esignWizardStepNumber('upload')).toBe(1);
    expect(esignWizardStepNumber('recipients')).toBe(2);
    expect(esignWizardStepNumber('prepare')).toBe(3);
  });

  it('marks earlier steps complete, the current step current, and later steps upcoming', () => {
    expect(esignWizardStepState('upload', 'recipients')).toBe('complete');
    expect(esignWizardStepState('recipients', 'recipients')).toBe('current');
    expect(esignWizardStepState('prepare', 'recipients')).toBe('upcoming');
  });

  it('moves the progress bar on every step, including the first', () => {
    const first = esignWizardProgressPercent('upload');
    const second = esignWizardProgressPercent('recipients');
    const third = esignWizardProgressPercent('prepare');

    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(third).toBeLessThanOrEqual(100);
  });
});
