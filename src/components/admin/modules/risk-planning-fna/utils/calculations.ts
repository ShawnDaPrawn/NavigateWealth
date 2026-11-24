/**
 * Risk Planning FNA Calculation Utilities
 *
 * The engine itself lives in src/shared/fna-calculations/riskPlanning.ts so the
 * wizard and the Edge Function calculate with the same code (system version
 * 3.0.0: a capital needs analysis). This module re-exports it for the wizard.
 * All calculations are deterministic and auditable.
 */

export {
  calculateLifeCover,
  calculateDisabilityCover,
  calculateSevereIllnessCover,
  calculateIncomeProtection,
  calculateRiskAnalysis,
  presentValueOfEscalatingAnnuity,
  realRate,
  resolveRiskAssumptions,
  normaliseRiskInput,
} from '../../../../../shared/fna-calculations/riskPlanning';
