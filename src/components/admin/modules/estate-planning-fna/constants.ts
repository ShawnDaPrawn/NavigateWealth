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
  // SA Estate Duty (Estate Duty Act, 2026/2027)
  ESTATE_DUTY_RATE: 0.2, // 20% on the first R30m of the dutiable amount
  ESTATE_DUTY_UPPER_RATE: 0.25, // 25% on the dutiable amount above R30m
  ESTATE_DUTY_UPPER_RATE_THRESHOLD: 30_000_000,
  ESTATE_DUTY_ABATEMENT: 3500000, // R3.5 million (s4A)
  /** The most a predeceased spouse's unused s4A abatement can add. */
  MAX_PORTED_ABATEMENT: 3_500_000,

  // Default assumptions
  /** Executor's tariff, excluding VAT. VAT is added on top. */
  DEFAULT_EXECUTOR_FEE_PERCENTAGE: 3.5,
  VAT_RATE: 0.15,
  DEFAULT_CONVEYANCING_FEE_PER_PROPERTY: 50000,
  DEFAULT_MASTER_FEES: 5000,
  DEFAULT_FUNERAL_COSTS: 50000,

  // CGT on death (Eighth Schedule, 2026/2027)
  CGT_INCLUSION_RATE_INDIVIDUAL: 0.4,
  /** Annual exclusion in the year of death (para 5(2)). */
  CGT_DEATH_EXCLUSION: 440_000,
  /** Primary residence exclusion (para 45), apportioned by interest held. */
  CGT_PRIMARY_RESIDENCE_EXCLUSION: 3_000_000,
  /** Marginal rate applied to the taxable gain in the final return. */
  DEFAULT_CGT_MARGINAL_RATE: 0.45,

  // Liquidity risk thresholds. Any shortfall is at least moderate.
  LIQUIDITY_SHORTFALL_SEVERE_THRESHOLD: 500000,
  /** A shortfall above this share of the liquidity required is severe. */
  LIQUIDITY_SHORTFALL_SEVERE_RATIO: 0.25,
} as const;
