/**
 * Estate Planning FNA Constants
 */

import { buildFNAWizardSteps } from '../fna';

/**
 * The shared four-step FNA flow with this wizard's step descriptions. Step
 * titles and order come from the fna module and are the same in every wizard.
 */
export const WIZARD_STEPS = buildFNAWizardSteps({
  1: 'Family, will and estate records',
  2: 'Death balance sheet and liquidity',
  3: 'Override cost assumptions if needed',
  4: 'Review and publish the analysis',
});

export const ESTATE_PLANNING_CONSTANTS = {
  // Current SA Estate Duty (2024/2025)
  ESTATE_DUTY_RATE: 0.2, // 20% on dutiable estate
  ESTATE_DUTY_ABATEMENT: 3500000, // R3.5 million

  // Default assumptions
  DEFAULT_EXECUTOR_FEE_PERCENTAGE: 3.5,
  DEFAULT_CONVEYANCING_FEE_PER_PROPERTY: 50000,
  DEFAULT_MASTER_FEES: 5000,
  DEFAULT_FUNERAL_COSTS: 50000,

  // CGT on death
  CGT_INCLUSION_RATE_INDIVIDUAL: 0.4,

  // Liquidity risk thresholds
  LIQUIDITY_SHORTFALL_MODERATE_THRESHOLD: 100000,
  LIQUIDITY_SHORTFALL_SEVERE_THRESHOLD: 500000,
} as const;
