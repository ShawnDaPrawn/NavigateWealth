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
 * Investment goals module (internally "investment-ina")
 *
 * The client's discretionary investment goals: the goals analysis wizard, its
 * results, and the goal status shown against linked policies. Advisers and
 * clients see it as "Goals"; the code and stored keys keep the INA name.
 */

// ==================== TYPES ====================
export * from './types';

// ==================== CONSTANTS ====================
export * from './constants';

// ==================== API ====================
export { InvestmentINAApiService } from './api';

// ==================== GOAL LINKS (policy tables) ====================
export { goalLinksByPolicyId } from './linkedGoalStatus';
export type { InvestmentGoalLink } from './linkedGoalStatus';

// ==================== COMPONENTS ====================
export const InvestmentINAWizard = lazy(() =>
  import('./components/InvestmentINAWizard').then((m) => ({ default: m.InvestmentINAWizard })),
);
export const InvestmentINAResultsView = lazy(() =>
  import('./components/InvestmentINAResultsView').then((m) => ({
    default: m.InvestmentINAResultsView,
  })),
);
