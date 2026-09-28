import { describe, expect, it } from 'vitest';
import {
  FNA_WIZARD_FLOW,
  FNA_WIZARD_NEXT_LABELS,
  FNA_WIZARD_TITLES,
  backLabelFor,
  buildFNAWizardSteps,
  resolveInitialFNAStep,
} from '../fnaWizardFlow';

describe('FNA wizard flow', () => {
  it('is the same four steps, in order, for every wizard', () => {
    expect(FNA_WIZARD_FLOW.map((s) => s.title)).toEqual([
      'Information Gathering',
      'System Auto-Calculation',
      'Adviser Manual Adjustment',
      'Finalise & Publish',
    ]);
    expect(FNA_WIZARD_FLOW.map((s) => s.step)).toEqual([1, 2, 3, 4]);
  });

  it('lets a wizard change only the step descriptions', () => {
    const steps = buildFNAWizardSteps({ 2: 'Custom calculation text' });
    expect(steps.map((s) => s.title)).toEqual(FNA_WIZARD_FLOW.map((s) => s.title));
    expect(steps[1].description).toBe('Custom calculation text');
    expect(steps[0].description).toBe(FNA_WIZARD_FLOW[0].description);
  });

  it('labels navigation identically everywhere', () => {
    expect(FNA_WIZARD_NEXT_LABELS[1]).toBe('Run Calculation');
    expect(FNA_WIZARD_NEXT_LABELS[4]).toBe('Publish FNA');
    expect(backLabelFor(1)).toBeNull();
    expect(backLabelFor(2)).toBe('Back to Information');
    expect(backLabelFor(3)).toBe('Back to Calculation');
    expect(backLabelFor(4)).toBe('Back to Adjustments');
  });

  it('has a title for every FNA registry type', () => {
    expect(Object.keys(FNA_WIZARD_TITLES).sort()).toEqual(
      ['estate', 'investment', 'medical', 'retirement', 'risk', 'tax'].sort(),
    );
  });

  describe('resolveInitialFNAStep', () => {
    const intake = { currentAge: 40 };

    it('opens on Step 1 without intake data, whatever step was asked for', () => {
      expect(resolveInitialFNAStep(undefined, undefined)).toBe(1);
      expect(resolveInitialFNAStep(2, undefined)).toBe(1);
      expect(resolveInitialFNAStep(3, {})).toBe(1);
    });

    it('opens on Step 2 for an accepted intake', () => {
      expect(resolveInitialFNAStep(2, intake)).toBe(2);
    });

    it('never opens past Step 2 — adjustments are made in the wizard', () => {
      expect(resolveInitialFNAStep(4, intake)).toBe(2);
    });

    it('opens on Step 1 when an intake is only being edited', () => {
      expect(resolveInitialFNAStep(1, intake)).toBe(1);
      expect(resolveInitialFNAStep(undefined, intake)).toBe(1);
    });
  });
});
