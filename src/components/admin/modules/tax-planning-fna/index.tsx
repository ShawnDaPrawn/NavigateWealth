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
export { TaxDocumentsSection } from './components/TaxDocumentsSection';
