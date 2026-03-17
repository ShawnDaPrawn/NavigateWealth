/**
 * Investment INA Constants
 * Extracted from types.ts for module structure alignment (Phase 5)
 */

import type { GoalType, RiskProfile, DefaultEconomicAssumptions } from './types';

// ==================== DEFAULT ECONOMIC ASSUMPTIONS ====================

export const DEFAULT_ECONOMIC_ASSUMPTIONS: DefaultEconomicAssumptions = {
  longTermInflationRate: 0.06, // 6% inflation
  expectedRealReturns: {
    conservative: 0.02,  // 2% real return
    moderate: 0.035,     // 3.5% real return
    balanced: 0.05,      // 5% real return
    growth: 0.065,       // 6.5% real return
    aggressive: 0.08,    // 8% real return
  },
};

// ==================== LABEL MAPPINGS ====================

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  'education': 'Education',
  'home-deposit': 'Home Deposit',
  'travel': 'Travel',
  'emigration': 'Emigration',
  'wealth-creation': 'Wealth Creation',
  'business-funding': 'Business Funding',
  'sabbatical': 'Sabbatical',
  'financial-freedom': 'Financial Freedom',
  'other': 'Other',
};

export const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  'conservative': 'Conservative',
  'moderate': 'Moderate',
  'balanced': 'Balanced',
  'growth': 'Growth',
  'aggressive': 'Aggressive',
};
