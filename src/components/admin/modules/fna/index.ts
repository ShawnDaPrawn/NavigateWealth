/**
 * FNA Module — Public API
 * Guidelines §4.3 — Single barrel file for the module.
 *
 * This is a shared library module used across multiple FNA types
 * (Risk Planning, Estate Planning, Medical, Tax, Investment INA).
 * It provides reusable components, hooks, types, and utilities.
 */

// ── Components ──────────────────────────────────────────────────────────────
export { FNACard } from './components/FNACard';
export { FNAStatusBadge } from './components/FNAStatusBadge';
export { FNAResultsView } from './FNAResultsView';
export { FNAWizard } from './FNAWizard';
export { FNAWizardLayout } from './FNAWizardLayout';
export type { FNAWizardStepConfig } from './FNAWizardLayout';
export { PublishFNADialog } from './PublishFNADialog';
export { ViewPublishedFNADialog } from './ViewPublishedFNADialog';

// ── Hooks ───────────────────────────────────────────────────────────────────
export { useFNAManagement } from './hooks/useFNAManagement';

// ── API ─────────────────────────────────────────────────────────────────────
export { FNAAPI } from './api';

// ── Types (re-exported for convenience — canonical source is ./types) ──────
export type {
  FNAInputs,
  FNAResults,
  FNASession,
  FNAStatus,
  FNAWizardStep,
  FNAWizardState,
  FNADependant,
  FNALiability,
  FNAAssets,
  FNAExistingCover,
  FNAAssumptions,
  FNAOverrides,
  LifeCoverBreakdown,
  SevereIllnessBreakdown,
  CapitalDisabilityBreakdown,
  IncomeProtectionBreakdown,
} from './types';

// ── Constants ───────────────────────────────────────────────────────────────
export {
  FNA_STATUS_CONFIG,
  FNA_BADGE_SIZE_CLASSES,
  FNA_WIZARD_STEPS,
  FNA_WIZARD_STEP_LABELS,
  FNA_QUERY_KEYS,
} from './constants';
