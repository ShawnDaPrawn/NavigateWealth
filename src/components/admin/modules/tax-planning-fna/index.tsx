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
 * Tax Planning Module
 *
 * Central export point for Tax Planning functionality.
 * The Tax Planning FNA wizard has been removed. This module now provides:
 * - Tax policy management (via PolicyCategoryTab)
 * - Tax Documents History (ad-hoc document uploads)
 */

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export { TaxPlanningFnaAPI } from './api';

// ==================== COMPONENTS ====================
export const TaxDocumentsSection = lazy(() =>
  import('./components/TaxDocumentsSection').then((m) => ({ default: m.TaxDocumentsSection })),
);

export const TaxPlanningFNAWizard = lazy(() =>
  import('./components/TaxPlanningFNAWizard').then((m) => ({ default: m.TaxPlanningFNAWizard })),
);
export const TaxPlanningResultsView = lazy(() =>
  import('./components/TaxPlanningResultsView').then((m) => ({
    default: m.TaxPlanningResultsView,
  })),
);

export const Step1InputForm = lazy(() =>
  import('./components/Step1InputForm').then((m) => ({ default: m.Step1InputForm })),
);
