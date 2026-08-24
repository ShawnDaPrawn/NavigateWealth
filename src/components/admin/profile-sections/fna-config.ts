/**
 * FNA Configuration
 * Central configuration for all FNA types to eliminate duplication.
 *
 * API services are imported eagerly (lightweight). Each FNA module lazy-loads
 * its own Wizard and ResultsView behind its barrel, so the heavy component
 * trees still load only when the user opens a wizard or views results.
 */

// API services are lightweight (no JSX, no component trees) — safe to import eagerly
import { RiskPlanningFnaAPI } from '../modules/risk-planning-fna';
import { MedicalFNAApiService } from '../modules/medical-fna';
import { RetirementFnaAPI } from '../modules/retirement-fna';
import { EstatePlanningAPI as EstatePlanningApiService } from '../modules/estate-planning-fna';
import { InvestmentINAApiService } from '../modules/investment-ina';
import { TaxPlanningFnaAPI } from '../modules/tax-planning-fna';

// The registry's entry shape is owned by the shared FNA module that consumes it.
import type { FNAConfig } from '../modules/fna';

// ==================== WIZARD / RESULTS COMPONENTS ====================
// Each module lazy-loads its own heavy tree behind its barrel, so these are
// ordinary imports here and the chunks still load on demand.
import { EstatePlanningFNAWizard as LazyEstatePlanningFNAWizard } from '../modules/estate-planning-fna';
import { EstatePlanningResultsView as LazyEstatePlanningResultsView } from '../modules/estate-planning-fna';
import { InvestmentINAResultsView as LazyInvestmentINAResultsView } from '../modules/investment-ina';
import { InvestmentINAWizard as LazyInvestmentINAWizard } from '../modules/investment-ina';
import { MedicalFNAResultsView as LazyMedicalFNAResultsView } from '../modules/medical-fna';
import { MedicalFNAWizard as LazyMedicalFNAWizard } from '../modules/medical-fna';
import { RetirementFNAResultsView as LazyRetirementFNAResultsView } from '../modules/retirement-fna';
import { RetirementFNAWizard as LazyRetirementFNAWizard } from '../modules/retirement-fna';
import { RiskPlanningFNAResultsView as LazyRiskPlanningFNAResultsView } from '../modules/risk-planning-fna';
import { RiskPlanningFNAWizard as LazyRiskPlanningFNAWizard } from '../modules/risk-planning-fna';
import { TaxPlanningFNAWizard as LazyTaxPlanningFNAWizard } from '../modules/tax-planning-fna';
import { TaxPlanningResultsView as LazyTaxPlanningResultsView } from '../modules/tax-planning-fna';

// The registry is a dynamic dispatch table: each module's concrete session /
// result type is erased to a generic Record so consumers can share one config
// shape (they spread props into the components and index into the results,
// e.g. `fnaData.results`). These helpers coerce each module's typed API promise
// to that generic shape at this single boundary.
const asRecordOrNull = <T>(p: Promise<T | null>): Promise<Record<string, unknown> | null> =>
  p as unknown as Promise<Record<string, unknown> | null>;
const asRecord = <T>(p: Promise<T>): Promise<Record<string, unknown>> =>
  p as unknown as Promise<Record<string, unknown>>;

/**
 * The registry conforms to the contract the shared FNA module publishes, so
 * the type lives there and is re-exported here for the existing consumers of
 * this file.
 */
export type { FNAConfig };

// ==================== CONFIG REGISTRY ====================

export const FNA_CONFIGS: Record<string, FNAConfig> = {
  'risk-planning': {
    type: 'risk',
    name: 'Risk Planning FNA',
    Wizard: LazyRiskPlanningFNAWizard,
    ResultsView: LazyRiskPlanningFNAResultsView,
    getLatestPublished: (clientId) =>
      asRecordOrNull(RiskPlanningFnaAPI.getLatestPublished(clientId)),
    deleteFNA: (fnaId) => RiskPlanningFnaAPI.delete(fnaId),
    publishFNA: (fnaId) => asRecord(RiskPlanningFnaAPI.publish(fnaId)),
    unpublishFNA: (fnaId) => asRecord(RiskPlanningFnaAPI.unpublish(fnaId)),
    wizardProps: {
      onCompleteKey: 'onFNAComplete',
    },
    resultsPropsKey: 'fna',
  },

  'medical-aid': {
    type: 'medical',
    name: 'Medical FNA',
    Wizard: LazyMedicalFNAWizard,
    ResultsView: LazyMedicalFNAResultsView,
    getLatestPublished: (clientId) =>
      MedicalFNAApiService.getLatestPublished(clientId) as unknown as Promise<Record<
        string,
        unknown
      > | null>,
    deleteFNA: (fnaId) => MedicalFNAApiService.deleteMedicalFNA(fnaId),
    publishFNA: (fnaId) =>
      MedicalFNAApiService.publishMedicalFNA(fnaId) as unknown as Promise<Record<string, unknown>>,
    unpublishFNA: (fnaId) =>
      MedicalFNAApiService.unpublishMedicalFNA(fnaId) as unknown as Promise<
        Record<string, unknown>
      >,
    wizardProps: {
      onCompleteKey: 'onFNAComplete',
    },
    resultsPropsKey: 'results',
  },

  retirement: {
    type: 'retirement',
    name: 'Retirement FNA',
    Wizard: LazyRetirementFNAWizard,
    ResultsView: LazyRetirementFNAResultsView,
    getLatestPublished: (clientId) => asRecordOrNull(RetirementFnaAPI.getLatestPublished(clientId)),
    deleteFNA: (fnaId) => RetirementFnaAPI.delete(fnaId),
    publishFNA: (fnaId) => asRecord(RetirementFnaAPI.publish(fnaId)),
    unpublishFNA: (fnaId) => asRecord(RetirementFnaAPI.unpublish(fnaId)),
    wizardProps: {
      onCompleteKey: 'onFNAComplete',
    },
    resultsPropsKey: 'fna',
  },

  'estate-planning': {
    type: 'estate',
    name: 'Estate Planning FNA',
    Wizard: LazyEstatePlanningFNAWizard,
    ResultsView: LazyEstatePlanningResultsView,
    getLatestPublished: (clientId) =>
      asRecordOrNull(EstatePlanningApiService.getLatestPublished(clientId)),
    deleteFNA: (sessionId) => EstatePlanningApiService.deleteSession(sessionId),
    publishFNA: (sessionId) => asRecord(EstatePlanningApiService.publishSession(sessionId)),
    unpublishFNA: (sessionId) => asRecord(EstatePlanningApiService.unpublishSession(sessionId)),
    wizardProps: {
      onCompleteKey: 'onFNAComplete',
    },
    resultsPropsKey: 'fna',
  },

  investments: {
    type: 'investment',
    name: 'Investment INA',
    Wizard: LazyInvestmentINAWizard,
    ResultsView: LazyInvestmentINAResultsView,
    getLatestPublished: (clientId) =>
      asRecordOrNull(InvestmentINAApiService.getLatestPublished(clientId)),
    deleteFNA: (sessionId) => InvestmentINAApiService.deleteSession(sessionId),
    publishFNA: (sessionId) => asRecord(InvestmentINAApiService.publishSession(sessionId)),
    unpublishFNA: (sessionId) => asRecord(InvestmentINAApiService.unpublishSession(sessionId)),
    wizardProps: {
      onCompleteKey: 'onComplete',
    },
    resultsPropsKey: 'session',
  },

  'tax-planning': {
    type: 'tax',
    name: 'Tax Planning FNA',
    Wizard: LazyTaxPlanningFNAWizard,
    ResultsView: LazyTaxPlanningResultsView,
    getLatestPublished: (clientId) =>
      asRecordOrNull(TaxPlanningFnaAPI.getLatestPublished(clientId)),
    deleteFNA: async () => {
      /* tax sessions managed via saveSession */
    },
    publishFNA: async (sessionId) => {
      await TaxPlanningFnaAPI.publishSession(sessionId);
      return {};
    },
    unpublishFNA: async (sessionId) => {
      await TaxPlanningFnaAPI.unpublishSession(sessionId);
      return {};
    },
    wizardProps: {
      onCompleteKey: 'onFNAComplete',
    },
    resultsPropsKey: 'fna',
  },
};

/**
 * Check if a category supports FNA
 */
export function hasFNASupport(categorySubtabId: string): boolean {
  return categorySubtabId in FNA_CONFIGS;
}

/**
 * Get FNA config for a category
 */
export function getFNAConfig(categorySubtabId: string): FNAConfig | null {
  return FNA_CONFIGS[categorySubtabId] || null;
}
