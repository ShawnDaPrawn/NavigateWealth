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
export { MedicalFNAWizard } from './components/MedicalFNAWizard';
export { MedicalFNAResultsView } from './components/MedicalFNAResultsView';
