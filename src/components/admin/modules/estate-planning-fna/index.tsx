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
 * Estate Planning FNA Module
 *
 * Central export point for all Estate Planning FNA functionality.
 */

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export { EstatePlanningAPI } from './api';

// ==================== COMPONENTS ====================
export const EstatePlanningFNAWizard = lazy(() =>
  import('./components/EstatePlanningFNAWizard').then((m) => ({
    default: m.EstatePlanningFNAWizard,
  })),
);
export const EstatePlanningResultsView = lazy(() =>
  import('./components/EstatePlanningResultsView').then((m) => ({
    default: m.EstatePlanningResultsView,
  })),
);
export const WillManagementView = lazy(() =>
  import('./components/WillManagementView').then((m) => ({ default: m.WillManagementView })),
);
export const WillDraftingWizard = lazy(() =>
  import('./components/WillDraftingWizard').then((m) => ({ default: m.WillDraftingWizard })),
);
export const WillPdfView = lazy(() =>
  import('./components/WillPdfView').then((m) => ({ default: m.WillPdfView })),
);
export const WillChatInterface = lazy(() =>
  import('./components/WillChatInterface').then((m) => ({ default: m.WillChatInterface })),
);

// ==================== UTILS ====================
export { EstatePlanningCalculationService } from './utils';

export const EstateDocumentsSection = lazy(() =>
  import('./components/EstateDocumentsSection').then((m) => ({
    default: m.EstateDocumentsSection,
  })),
);
