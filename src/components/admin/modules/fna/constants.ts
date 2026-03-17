/**
 * FNA Module Constants
 * Centralized labels, mappings, and configuration for FNA features
 *
 * Guidelines §5.3 — All non-trivial constants must be centralised and typed.
 */

import type { FNAStatus, FNAWizardStep } from './types';

// ============================================================================
// Status Badge Configuration
// ============================================================================

/**
 * Status indicator config for FNA sessions.
 * Guidelines §5.3 / §8.3 — Config-driven status indicators.
 */
export const FNA_STATUS_CONFIG = {
  published: {
    label: 'Published',
    iconSlug: 'check-circle',
    badgeClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  archived: {
    label: 'Archived',
    iconSlug: 'archive',
    badgeClass: 'bg-gray-600 hover:bg-gray-700 text-white',
  },
  draft: {
    label: 'Draft',
    iconSlug: 'file-edit',
    badgeClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
} as const satisfies Record<FNAStatus, { label: string; iconSlug: string; badgeClass: string }>;

/**
 * Size class mappings for FNA status badges
 */
export const FNA_BADGE_SIZE_CLASSES = {
  sm: { text: 'text-xs px-2 py-0.5', icon: 'h-3 w-3' },
  md: { text: 'text-sm px-2.5 py-1', icon: 'h-3.5 w-3.5' },
  lg: { text: 'text-base px-3 py-1.5', icon: 'h-4 w-4' },
} as const;

// ============================================================================
// Wizard Step Labels
// ============================================================================

/**
 * Ordered list of wizard steps for the core Risk Planning FNA wizard
 */
export const FNA_WIZARD_STEPS: FNAWizardStep[] = [
  'personal',
  'income',
  'liabilities',
  'assets',
  'existing-cover',
  'assumptions',
  'review',
];

/**
 * Human-readable labels for FNA wizard steps
 */
export const FNA_WIZARD_STEP_LABELS: Record<FNAWizardStep, string> = {
  personal: 'Personal & Household',
  income: 'Income & Expenses',
  liabilities: 'Liabilities',
  assets: 'Assets',
  'existing-cover': 'Existing Cover',
  assumptions: 'Assumptions',
  review: 'Review & Calculate',
} as const;

// ============================================================================
// Query Keys — Re-exported from central registry
// ============================================================================

/**
 * Centralised query key factory for FNA data.
 * Canonical source: /utils/queryKeys.ts
 */
export { fnaKeys as FNA_QUERY_KEYS } from '../../../../utils/queryKeys';