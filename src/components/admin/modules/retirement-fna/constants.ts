/**
 * Retirement FNA Constants
 * Extracted from types.ts for module structure alignment (Phase 5)
 */

// ==================== WIZARD STEPS ====================

export const WIZARD_STEPS = [
  {
    step: 1,
    title: 'Information Gathering',
    description: 'Client profile and financial position'
  },
  {
    step: 2,
    title: 'System Auto-Calculation',
    description: 'Automated retirement projections'
  },
  {
    step: 3,
    title: 'Adviser Manual Adjustment',
    description: 'Override assumptions if needed'
  },
  {
    step: 4,
    title: 'Finalise & Publish',
    description: 'Review and publish analysis'
  }
] as const;