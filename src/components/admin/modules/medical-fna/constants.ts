/**
 * Medical FNA Constants
 * Extracted from types.ts for module structure alignment (Phase 5)
 */

import { buildFNAWizardSteps } from '../fna';

// ==================== WIZARD STEPS ====================

/**
 * The shared four-step FNA flow with this wizard's step descriptions. Step
 * titles and order come from the fna module and are the same in every wizard.
 */
export const WIZARD_STEPS = buildFNAWizardSteps({
  1: 'Collect household and utilisation data',
  2: 'Review automated medical aid recommendations',
  3: 'Apply overrides if needed',
  4: 'Review and publish the FNA',
});

// ==================== CALCULATION CONSTANTS ====================

/**
 * MSA trigger: annual day-to-day spend per beneficiary above which a savings
 * account is recommended. Roughly a GP visit, a script and an eye or dental
 * check per person per year — below it, self-funding is usually cheaper than
 * paying for an MSA inside the premium.
 */
export const MSA_DAY_TO_DAY_THRESHOLD_PER_BENEFICIARY = 3000;

/** Premium above this share of net monthly income is flagged as a strain. */
export const PREMIUM_AFFORDABILITY_GUIDELINE = 0.1;

/**
 * Late Joiner Penalty bands — Regulation 13 of the Medical Schemes Act.
 * `minYears` is the minimum number of penalty years for the band.
 */
export const LJP_BANDS = [
  { minYears: 25, band: '75%' },
  { minYears: 15, band: '50%' },
  { minYears: 5, band: '25%' },
  { minYears: 1, band: '5%' },
] as const;

/** Age after which the Late Joiner Penalty can apply. */
export const LJP_AGE_THRESHOLD = 35;
