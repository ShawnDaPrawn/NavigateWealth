/**
 * Retirement FNA Calculation Engine (adviser wizard entry point)
 *
 * A thin adapter over the shared engine in src/shared/fna-calculations, which
 * the Edge Function's /calculate route also uses — so the Step 2 preview and
 * the stored, published results come from the same formulas.
 */

import {
  RETIREMENT_DEFAULT_ASSUMPTIONS,
  calculateRetirement,
  retirementInputProblem,
} from '../../../../../shared/fna-calculations/retirement';
import type {
  RetirementFNAInputs,
  RetirementFNAAdjustments,
  RetirementCalculationResults,
} from '../types';

export {
  RETIREMENT_DRAWDOWN,
  RETIREMENT_S11F,
  RetirementCalculationError,
} from '../../../../../shared/fna-calculations/retirement';

export const DEFAULT_RETIREMENT_ASSUMPTIONS = RETIREMENT_DEFAULT_ASSUMPTIONS;

/** Why these inputs cannot be calculated (e.g. no age), or null. */
export function getRetirementInputProblem(inputs: Partial<RetirementFNAInputs>): string | null {
  return retirementInputProblem(inputs);
}

/**
 * Calculates the full Retirement FNA from inputs + adviser adjustments.
 * Throws RetirementCalculationError when the client's age is missing.
 */
export function calculateRetirementFNA(
  inputs: Partial<RetirementFNAInputs>,
  adjustments: RetirementFNAAdjustments = {},
): RetirementCalculationResults {
  return calculateRetirement(inputs, adjustments);
}
