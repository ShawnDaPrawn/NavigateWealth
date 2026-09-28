/**
 * Investment INA — Step 1 tabs and the check that gates "Run Calculation".
 */

import type { InvestmentINAInputs } from '../../types';
import { validateGoal } from '../../services/investmentINACalculationService';

export type INAStep1Tab = 'overview' | 'investments' | 'risk-profile' | 'goals';

export const INA_STEP1_TABS: { id: INAStep1Tab; label: string }[] = [
  { id: 'overview', label: 'Client Overview' },
  { id: 'investments', label: 'Discretionary Investments' },
  { id: 'risk-profile', label: 'Risk Profile' },
  { id: 'goals', label: 'Goals' },
];

/** The first thing stopping Step 1 from being submitted, or null. */
export function findINAStep1Problem(
  inputs: Partial<InvestmentINAInputs>,
): { tab: INAStep1Tab; message: string } | null {
  if (!inputs.currentAge || inputs.currentAge <= 0 || !inputs.dateOfBirth) {
    return { tab: 'overview', message: 'Please provide the client’s age and date of birth' };
  }
  if (!inputs.clientRiskProfile) {
    return { tab: 'risk-profile', message: 'Please select a risk profile' };
  }
  if (!inputs.goals || inputs.goals.length === 0) {
    return { tab: 'goals', message: 'Please add at least one investment goal' };
  }
  for (const goal of inputs.goals) {
    const errors = validateGoal(goal);
    if (errors.length > 0) {
      return { tab: 'goals', message: `Goal "${goal.goalName || 'Untitled'}": ${errors[0]}` };
    }
  }
  return null;
}
