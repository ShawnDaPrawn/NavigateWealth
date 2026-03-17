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
import { FNAAPI } from '../modules/fna/api';
import { RiskPlanningFnaAPI } from '../modules/risk-planning-fna/api';
import { MedicalFNAApiService } from '../modules/medical-fna/api';
import { RetirementFnaAPI } from '../modules/retirement-fna/api';
import { EstatePlanningAPI as EstatePlanningApiService } from '../modules/estate-planning-fna/api';

// ==================== LAZY WIZARD / RESULTS COMPONENTS ====================
// These are heavy components with deep dependency trees.
// Lazy-loading them avoids pulling in all FNA step forms, calculations,
// results views, and their own dependencies at initial page load.

const LazyRiskPlanningFNAWizard = React.lazy(() =>
  import('../modules/risk-planning-fna/components/RiskPlanningFNAWizard').then(m => ({ default: m.RiskPlanningFNAWizard }))
);
const LazyRiskPlanningFNAResultsView = React.lazy(() =>
  import('../modules/risk-planning-fna/components/RiskPlanningFNAResultsView').then(m => ({ default: m.RiskPlanningFNAResultsView }))
);

const LazyMedicalFNAWizard = React.lazy(() =>
  import('../modules/medical-fna/components/MedicalFNAWizard').then(m => ({ default: m.MedicalFNAWizard }))
);
const LazyMedicalFNAResultsView = React.lazy(() =>
  import('../modules/medical-fna/components/MedicalFNAResultsView').then(m => ({ default: m.MedicalFNAResultsView }))
);

const LazyRetirementFNAWizard = React.lazy(() =>
  import('../modules/retirement-fna/components/RetirementFNAWizard').then(m => ({ default: m.RetirementFNAWizard }))
);
const LazyRetirementFNAResultsView = React.lazy(() =>
  import('../modules/retirement-fna/components/RetirementFNAResultsView').then(m => ({ default: m.RetirementFNAResultsView }))
);

const LazyEstatePlanningFNAWizard = React.lazy(() =>
  import('../modules/estate-planning-fna/components/EstatePlanningFNAWizard').then(m => ({ default: m.EstatePlanningFNAWizard }))
);
const LazyEstatePlanningResultsView = React.lazy(() =>
  import('../modules/estate-planning-fna/components/EstatePlanningResultsView').then(m => ({ default: m.EstatePlanningResultsView }))
);

// Generic FNA components (shared module — also lazy)
const LazyFNAWizard = React.lazy(() =>
  import('../modules/fna/FNAWizard').then(m => ({ default: m.FNAWizard }))
);
const LazyFNAResultsView = React.lazy(() =>
  import('../modules/fna/FNAResultsView').then(m => ({ default: m.FNAResultsView }))
);

// ==================== CONFIG TYPE ====================

export interface FNAConfig {
  type: 'risk' | 'medical' | 'retirement' | 'investment' | 'estate';
  name: string;
  Wizard: React.ComponentType<Record<string, unknown>>;
  ResultsView: React.ComponentType<Record<string, unknown>>;
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
    getLatestPublished: (clientId) => RiskPlanningFnaAPI.getLatestPublished(clientId),
    deleteFNA: (fnaId) => RiskPlanningFnaAPI.delete(fnaId),
    publishFNA: (fnaId) => RiskPlanningFnaAPI.publish(fnaId),
    unpublishFNA: (fnaId) => RiskPlanningFnaAPI.unpublish(fnaId),
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
    getLatestPublished: (clientId) => MedicalFNAApiService.getLatestPublished(clientId),
    deleteFNA: (fnaId) => MedicalFNAApiService.deleteMedicalFNA(fnaId),
    publishFNA: (fnaId) => MedicalFNAApiService.publishMedicalFNA(fnaId),
    unpublishFNA: (fnaId) => MedicalFNAApiService.unpublishMedicalFNA(fnaId),
    wizardProps: {
      onCompleteKey: 'onFNAComplete',
    },
    resultsPropsKey: 'results',
  },
  
  'retirement': {
    type: 'retirement',
    name: 'Retirement FNA',
    Wizard: LazyRetirementFNAWizard,
    ResultsView: LazyRetirementFNAResultsView,
    getLatestPublished: (clientId) => RetirementFnaAPI.getLatestPublished(clientId),
    deleteFNA: (fnaId) => RetirementFnaAPI.delete(fnaId),
    publishFNA: (fnaId) => RetirementFnaAPI.publish(fnaId),
    unpublishFNA: (fnaId) => RetirementFnaAPI.unpublish(fnaId),
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
    getLatestPublished: (clientId) => EstatePlanningApiService.getLatestPublished(clientId),
    deleteFNA: (sessionId) => EstatePlanningApiService.deleteSession(sessionId),
    publishFNA: (sessionId) => EstatePlanningApiService.publishSession(sessionId),
    unpublishFNA: (sessionId) => EstatePlanningApiService.unpublishSession(sessionId),
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
