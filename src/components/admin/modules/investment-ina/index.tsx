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
 * Investment INA Module
 *
 * Central export point for all Investment Needs Analysis functionality.
 * Goal-based investment planning for Navigate Wealth Admin Portal.
 */

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export { InvestmentINAApiService } from './api';

// ==================== COMPONENTS ====================
export const InvestmentINAWizard = lazy(() =>
  import('./components/InvestmentINAWizard').then((m) => ({ default: m.InvestmentINAWizard })),
);
export const InvestmentINAResultsView = lazy(() =>
  import('./components/InvestmentINAResultsView').then((m) => ({
    default: m.InvestmentINAResultsView,
  })),
);
