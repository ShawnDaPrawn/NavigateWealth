/**
 * Portfolio Summary — Constants & Default Fallbacks
 * Centralised configuration per Guidelines §5.3
 */

import type { PortfolioFinancialOverview, PortfolioClientData } from './api';

// ── Default fallbacks for when API data is loading/empty ──

const DEFAULT_PILLAR = {
  status: 'not-assessed',
  statusText: 'Not Yet Assessed',
  nextReview: new Date().toISOString().split('T')[0],
} as const;

export const DEFAULT_CLIENT_DATA: PortfolioClientData = {
  firstName: 'Client',
  lastName: '',
  memberNumber: '',
  totalWealthValue: 0,
  lastUpdated: new Date().toISOString(),
  riskTolerance: 'Not assessed',
  financialScore: 0,
};

export const DEFAULT_FINANCIAL_OVERVIEW: PortfolioFinancialOverview = {
  retirement: { currentValue: 0, projectedValue: 0, monthlyContribution: 0, progressToGoal: 0, ...DEFAULT_PILLAR },
  risk: { deathCover: 0, disabilityCover: 0, criticalIllnessCover: 0, ...DEFAULT_PILLAR },
  investment: { totalValue: 0, monthlyContribution: 0, goalsLinked: 0, performance: 'N/A', ...DEFAULT_PILLAR },
  estate: { willStatus: 'not-drafted', trustStatus: 'not-established', nominationStatus: 'incomplete', lastUpdated: '', ...DEFAULT_PILLAR },
  medicalAid: { scheme: 'Not specified', plan: 'Not specified', monthlyPremium: 0, dependants: 0, ...DEFAULT_PILLAR },
  tax: { returnStatus: 'not-filed', estimatedRefund: 0, taxYear: new Date().getFullYear(), filingDate: '', ...DEFAULT_PILLAR },
};
