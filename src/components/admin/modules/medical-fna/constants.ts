/**
 * Medical FNA Constants
 * Extracted from types.ts for module structure alignment (Phase 5)
 */

// ==================== WIZARD STEPS ====================

export const WIZARD_STEPS = [
  { step: 1, title: 'Information Gathering', description: 'Collect household and utilisation data' },
  { step: 2, title: 'System Auto-Calculation', description: 'Review automated medical aid recommendations' },
  { step: 3, title: 'Adviser Manual Adjustment', description: 'Apply overrides if needed' },
  { step: 4, title: 'Finalise & Publish', description: 'Review and publish the FNA' },
] as const;