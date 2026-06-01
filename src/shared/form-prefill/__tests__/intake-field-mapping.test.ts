import { describe, expect, it } from 'vitest';
import { normalizeIntakeToWizard } from '../intake-field-mapping';

describe('normalizeIntakeToWizard', () => {
  it('passes through full risk Step 1 payloads unchanged', () => {
    const inputs = {
      grossMonthlyIncome: 45000,
      dependants: [
        { id: '1', relationship: 'Child', dependencyTerm: 10, monthlyEducationCost: 2000 },
      ],
    };
    expect(normalizeIntakeToWizard('risk', inputs)).toEqual(inputs);
  });

  it('passes through full investment Step 1 payloads with goals array', () => {
    const inputs = {
      goals: [{ goalName: 'Education', targetAmountToday: 500000 }],
      clientRiskProfile: 'moderate',
    };
    expect(normalizeIntakeToWizard('investment', inputs)).toEqual(inputs);
  });

  it('passes through full estate Step 1 payloads with willInfo', () => {
    const inputs = {
      familyInfo: { fullName: 'Jane Doe', maritalStatus: 'married' },
      willInfo: { hasValidWill: true },
    };
    expect(normalizeIntakeToWizard('estate', inputs)).toEqual(inputs);
  });
});
