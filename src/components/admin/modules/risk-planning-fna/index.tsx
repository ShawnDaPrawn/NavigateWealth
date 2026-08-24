/**
 * Risk Planning FNA Module
 * Entry point for the Financial Needs Analysis - Risk Planning tool
 *
 * South African FAIS-compliant risk planning module
 * Implements deterministic, auditable calculations for:
 * - Life Cover (Death) – Capital Replacement Model
 * - Lump Sum Disability Cover
 * - Severe Illness Cover
 * - Temporary Income Protection
 * - Permanent Income Protection
 */

import { lazy } from 'react';

/**
 * The module owns its own code-splitting boundary.
 *
 * These two are heavy component trees — step forms, calculations, results
 * views — and every consumer already loaded them through React.lazy from
 * outside. Doing it here instead means callers make an ordinary static import
 * of this barrel (so they no longer reach into the module's internals) while
 * the heavy chunk still loads only when something renders it. Consumers must
 * render them inside a <Suspense>, as they already did.
 */
export const RiskPlanningFNAWizard = lazy(() =>
  import('./components/RiskPlanningFNAWizard').then((m) => ({
    default: m.RiskPlanningFNAWizard,
  })),
);
export const RiskPlanningFNAResultsView = lazy(() =>
  import('./components/RiskPlanningFNAResultsView').then((m) => ({
    default: m.RiskPlanningFNAResultsView,
  })),
);
export default RiskPlanningFNAWizard;

// --- public API used by other modules and by code outside admin/modules ---
export { RiskPlanningFnaAPI } from './api';
export type { FinalRiskNeed, InformationGatheringInput } from './types';

export const Step1InformationGathering = lazy(() =>
  import('./components/Step1InformationGathering').then((m) => ({
    default: m.Step1InformationGathering,
  })),
);

export const FNAManagementView = lazy(() =>
  import('./components/FNAManagementView').then((m) => ({ default: m.FNAManagementView })),
);

export const PreviousFNAsDialog = lazy(() => import('./components/PreviousFNAsDialog'));
