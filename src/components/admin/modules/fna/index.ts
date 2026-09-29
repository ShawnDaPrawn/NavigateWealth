/**
 * FNA Module — Public API
 * Guidelines §4.3 — Single barrel file for the module.
 *
 * This is a shared library module used across multiple FNA types
 * (Risk Planning, Estate Planning, Medical, Retirement, Tax, Investment INA).
 * It provides reusable components, hooks, types, and utilities — including the
 * wizard shell, step footer and four-step flow that every FNA wizard renders in.
 */

// ── Components ──────────────────────────────────────────────────────────────
export { FNACard } from './components/FNACard';
export { FNAStatusBadge } from './components/FNAStatusBadge';
export { FNAWizardShell, FNAWizardStepper } from './wizard/FNAWizardShell';
export { FNAStepNavigation } from './wizard/FNAStepNavigation';
export { FNAAssumptionOverrides } from './wizard/FNAAssumptionOverrides';
export {
  hasAssumptionOverrides,
  isAssumptionChanged,
  isOverrideReasonValid,
  MIN_OVERRIDE_REASON_LENGTH,
} from './wizard/assumptionOverrides';
export type { FNAAssumptionRow, FNAAssumptionFormat } from './wizard/assumptionOverrides';
export { PublishFNADialog } from './PublishFNADialog';
export { ViewPublishedFNADialog } from './ViewPublishedFNADialog';

// ── Hooks ───────────────────────────────────────────────────────────────────
export { useFNAManagement } from './hooks/useFNAManagement';
export { useFNAPublish } from './wizard/useFNAPublish';

// ── Wizard flow — one definition shared by every FNA / INA wizard ───────────
export {
  FNA_WIZARD_FLOW,
  FNA_WIZARD_STEP_COUNT,
  FNA_WIZARD_NEXT_LABELS,
  FNA_WIZARD_TITLES,
  buildFNAWizardSteps,
  getFNAWizardStep,
  backLabelFor,
  resolveInitialFNAStep,
} from './wizard/fnaWizardFlow';
export type {
  FNAWizardStepNumber,
  FNAWizardStepId,
  FNAWizardFlowStep,
  FNAWizardType,
  FNAStepDescriptions,
} from './wizard/fnaWizardFlow';

// ── API ─────────────────────────────────────────────────────────────────────
export { FNAAPI } from './api';

// ── Types (re-exported for convenience — canonical source is ./types) ──────
export type {
  FNAConfig,
  FNAInputs,
  FNAResults,
  FNASession,
  FNAStatus,
  FNAWizardProps,
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
export { FNA_STATUS_CONFIG, FNA_BADGE_SIZE_CLASSES, FNA_QUERY_KEYS } from './constants';

// --- public API used by other modules and by code outside admin/modules ---
export { normalizeFnaListResponse } from './fnaListUtils';
