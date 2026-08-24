/**
 * FNA Configuration
 * Central configuration for all FNA types to eliminate duplication.
 *
 * API services are imported eagerly (lightweight).
 * Wizard and ResultsView components use React.lazy to defer heavy
 * component trees until the user actually opens a wizard or views results.
 */

import React from 'react';

// API services are lightweight (no JSX, no component trees) — safe to import eagerly
import { RiskPlanningFnaAPI } from '../modules/risk-planning-fna';
import { MedicalFNAApiService } from '../modules/medical-fna';
import { RetirementFnaAPI } from '../modules/retirement-fna';
import { EstatePlanningAPI as EstatePlanningApiService } from '../modules/estate-planning-fna';
import { InvestmentINAApiService } from '../modules/investment-ina';
import { TaxPlanningFnaAPI } from '../modules/tax-planning-fna';

// ==================== LAZY WIZARD / RESULTS COMPONENTS ====================
// These are heavy components with deep dependency trees.
// Lazy-loading them avoids pulling in all FNA step forms, calculations,
// results views, and their own dependencies at initial page load.

const LazyRiskPlanningFNAWizard = React.lazy(() =>
  import('../modules/risk-planning-fna/components/RiskPlanningFNAWizard').then((m) => ({
    default: m.RiskPlanningFNAWizard,
  })),
);
const LazyRiskPlanningFNAResultsView = React.lazy(() =>
  import('../modules/risk-planning-fna/components/RiskPlanningFNAResultsView').then((m) => ({
    default: m.RiskPlanningFNAResultsView,
  })),
);

const LazyMedicalFNAWizard = React.lazy(() =>
  import('../modules/medical-fna/components/MedicalFNAWizard').then((m) => ({
    default: m.MedicalFNAWizard,
  })),
);
const LazyMedicalFNAResultsView = React.lazy(() =>
  import('../modules/medical-fna/components/MedicalFNAResultsView').then((m) => ({
    default: m.MedicalFNAResultsView,
  })),
);

const LazyRetirementFNAWizard = React.lazy(() =>
  import('../modules/retirement-fna/components/RetirementFNAWizard').then((m) => ({
    default: m.RetirementFNAWizard,
  })),
);
const LazyRetirementFNAResultsView = React.lazy(() =>
  import('../modules/retirement-fna/components/RetirementFNAResultsView').then((m) => ({
    default: m.RetirementFNAResultsView,
  })),
);

const LazyEstatePlanningFNAWizard = React.lazy(() =>
  import('../modules/estate-planning-fna/components/EstatePlanningFNAWizard').then((m) => ({
    default: m.EstatePlanningFNAWizard,
  })),
);
const LazyEstatePlanningResultsView = React.lazy(() =>
  import('../modules/estate-planning-fna/components/EstatePlanningResultsView').then((m) => ({
    default: m.EstatePlanningResultsView,
  })),
);

const LazyInvestmentINAWizard = React.lazy(() =>
  import('../modules/investment-ina/components/InvestmentINAWizard').then((m) => ({
    default: m.InvestmentINAWizard,
  })),
);
const LazyInvestmentINAResultsView = React.lazy(() =>
  import('../modules/investment-ina/components/InvestmentINAResultsView').then((m) => ({
    default: m.InvestmentINAResultsView,
  })),
);

const LazyTaxPlanningFNAWizard = React.lazy(() =>
  import('../modules/tax-planning-fna/components/TaxPlanningFNAWizard').then((m) => ({
    default: m.TaxPlanningFNAWizard,
  })),
);
const LazyTaxPlanningResultsView = React.lazy(() =>
  import('../modules/tax-planning-fna/components/TaxPlanningResultsView').then((m) => ({
    default: m.TaxPlanningResultsView,
  })),
);

// ==================== CONFIG TYPE ====================

// The registry is a dynamic dispatch table: each module's concrete session /
// result type is erased to a generic Record so consumers can share one config
// shape (they spread props into the components and index into the results,
// e.g. `fnaData.results`). These helpers coerce each module's typed API promise
// to that generic shape at this single boundary.
const asRecordOrNull = <T>(p: Promise<T | null>): Promise<Record<string, unknown> | null> =>
  p as unknown as Promise<Record<string, unknown> | null>;
const asRecord = <T>(p: Promise<T>): Promise<Record<string, unknown>> =>
  p as unknown as Promise<Record<string, unknown>>;

export interface FNAConfig {
  type: 'risk' | 'medical' | 'retirement' | 'investment' | 'estate' | 'tax';
  name: string;
  // Wizard/ResultsView are rendered with dynamically-spread props
  // (`<config.Wizard {...props} />`), so each module's specific prop type is
  // intentionally erased here.
  Wizard: React.ComponentType<any>;
  ResultsView: React.ComponentType<any>;
  // API functions
  getLatestPublished: (clientId: string) => Promise<Record<string, unknown> | null>;
  deleteFNA: (fnaId: string) => Promise<void>;
  publishFNA: (fnaId: string) => Promise<Record<string, unknown>>;
  unpublishFNA: (fnaId: string) => Promise<Record<string, unknown>>;
  // Wizard props mapping
  wizardProps?: {
    onCompleteKey?: string;
  };
  // Results props mapping
  resultsPropsKey?: string;
}

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
