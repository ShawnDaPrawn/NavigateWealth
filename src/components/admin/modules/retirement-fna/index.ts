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
/**
 * Retirement FNA Module
 *
 * Financial Needs Analysis for Retirement Planning.
 * Allows advisers to calculate retirement capital needs, project savings,
 * and generate reports for clients.
 */

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export * from './api';

// ==================== UTILS ====================
export * from './utils/calculation-engine';

// ==================== COMPONENTS ====================
export const RetirementFNAWizard = lazy(() =>
  import('./components/RetirementFNAWizard').then((m) => ({ default: m.RetirementFNAWizard })),
);
export const RetirementFNAResultsView = lazy(() =>
  import('./components/RetirementFNAResultsView').then((m) => ({
    default: m.RetirementFNAResultsView,
  })),
);

export const Step1InputForm = lazy(() =>
  import('./components/Step1InputForm').then((m) => ({ default: m.Step1InputForm })),
);
