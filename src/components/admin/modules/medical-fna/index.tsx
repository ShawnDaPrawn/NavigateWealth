import { lazy } from 'react';

/**
 * The module owns its own code-splitting boundary.
 *
 * These are heavy component trees, and every consumer already loaded them
 * through React.lazy from outside. Doing it here instead lets callers make an
 * ordinary static import of this barrel — so they no longer reach into the
 * module's internals — while the heavy chunk still loads only when something
 * renders it. Consumers must render them inside a <Suspense>, as they already
 * did.
 */
/* eslint-disable react-refresh/only-export-components */
/**
 * Medical Aid FNA Module
 * South African Medical Aid Financial Needs Analysis - Gap Analysis Tool
 *
 * Implements deterministic, auditable calculations for:
 * - Recommended Dependents Coverage
 * - In-Hospital Cover Level (100% vs 200%)
 * - Medical Savings Account Necessity
 * - Late Joiner Penalty Assessment
 */

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export { MedicalFNAApiService } from './api';

// ==================== COMPONENTS ====================
export const MedicalFNAWizard = lazy(() =>
  import('./components/MedicalFNAWizard').then((m) => ({ default: m.MedicalFNAWizard })),
);
export const MedicalFNAResultsView = lazy(() =>
  import('./components/MedicalFNAResultsView').then((m) => ({ default: m.MedicalFNAResultsView })),
);

export const Step1InputForm = lazy(() =>
  import('./components/Step1InputForm').then((m) => ({ default: m.Step1InputForm })),
);
