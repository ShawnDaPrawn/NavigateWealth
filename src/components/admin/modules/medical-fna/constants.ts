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
