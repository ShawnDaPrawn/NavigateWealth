import { describe, expect, it } from 'vitest';
import { normalizeIntakeToWizard } from '../intake-field-mapping';

describe('normalizeIntakeToWizard', () => {
  it('passes through full risk Step 1 payloads unchanged', () => {
    const inputs = {
      grossMonthlyIncome: 45000,
      dependants: [{ id: '1', relationship: 'Child', dependencyTerm: 10, monthlyEducationCost: 2000 }],
    };
    expect(normalizeIntakeToWizard('risk', inputs)).toEqual(inputs);
  });
});
