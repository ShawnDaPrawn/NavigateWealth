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
export { InvestmentINAWizard } from './components/InvestmentINAWizard';
export { InvestmentINAResultsView } from './components/InvestmentINAResultsView';
