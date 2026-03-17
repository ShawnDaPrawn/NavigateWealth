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
export { RetirementFNAWizard } from './components/RetirementFNAWizard';
export { RetirementFNAResultsView } from './components/RetirementFNAResultsView';
