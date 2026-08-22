/**
 * Product keys — Retirement, pre- and post-retirement.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../types';

// Retirement Keys (Pre-Retirement)
export const RETIREMENT_PRE_KEYS: ProductKey[] = [
  {
    id: 'retirement_fund_value',
    category: 'retirement_pre',
    name: 'Fund Value',
    description: 'Current retirement fund value',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'retirement_monthly_contribution',
    category: 'retirement_pre',
    name: 'Monthly Contribution',
    description: 'Monthly contribution amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'retirement_fund_type',
    category: 'retirement_pre',
    name: 'Fund Type',
    description: 'Type of retirement fund (RA, Pension, Provident)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'retirement_estimated_maturity_value',
    category: 'retirement_pre',
    name: 'Estimated Maturity Value',
    description: 'Projected value of the retirement fund at maturity',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'retirement_current_value',
    category: 'retirement_pre',
    name: 'Current Value',
    description: 'Current value of the retirement fund',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'retirement_product_type',
    category: 'retirement_pre',
    name: 'Product Type',
    description: 'Type of retirement product',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'retirement_age',
    category: 'retirement_pre',
    name: 'Retirement Age',
    description: 'Planned age of retirement for this policy',
    dataType: 'number',
    isCalculated: false,
  },
  {
    id: 'retirement_status',
    category: 'retirement_pre',
    name: 'Status',
    description: 'Status of the retirement policy (e.g. Active, Paid-up)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'retirement_maturity_date',
    category: 'retirement_pre',
    name: 'Maturity Date',
    description: 'Date when the retirement policy matures',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'retirement_assumptions_growth',
    category: 'retirement_pre',
    name: 'Assumed Growth Rate (%)',
    description: 'Projected annual growth rate for maturity calculation',
    dataType: 'percentage',
    isCalculated: false,
  },
  {
    id: 'retirement_assumptions_escalation',
    category: 'retirement_pre',
    name: 'Premium Escalation (%)',
    description:
      'Annual increase to the monthly premium on each policy anniversary (e.g. 5 or 6). Use 0 if the premium does not escalate. Maturity projections use this together with date of inception when present.',
    dataType: 'percentage',
    isCalculated: false,
  },
  {
    id: 'retirement_date_of_inception',
    category: 'retirement_pre',
    name: 'Date of Inception',
    description:
      'Policy start / commencement date. Used to time annual premium escalation on anniversary for maturity projections.',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'retirement_total_contribution',
    category: 'retirement_pre',
    name: 'Total Contribution',
    description: 'Total monthly contribution across all retirement policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['retirement_monthly_contribution'],
  },
  {
    id: 'retirement_fund_value_total',
    category: 'retirement_pre',
    name: 'Retirement Fund Value Total',
    description: 'Total of all retirement fund current totals',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['retirement_fund_value'],
  },
  // Retirement FNA Recommendations
  {
    id: 'retirement_contribution_recommended',
    category: 'retirement_pre',
    name: 'Recommended Monthly Contribution',
    description: 'Calculated recommended monthly contribution to reach retirement goal',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'retirement_lumpsum_recommended',
    category: 'retirement_pre',
    name: 'Recommended Lump Sum',
    description: 'Calculated recommended lump sum investment',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'retirement_capital_goal_recommended',
    category: 'retirement_pre',
    name: 'Recommended Capital Goal',
    description: 'Calculated capital required at retirement',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
];

// Retirement Keys (Post-Retirement)
export const RETIREMENT_POST_KEYS: ProductKey[] = [
  {
    id: 'post_retirement_capital_value',
    category: 'retirement_post',
    name: 'Capital Value',
    description: 'Current capital value of the living annuity/pension',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'post_retirement_drawdown_amount',
    category: 'retirement_post',
    name: 'Monthly Drawdown',
    description: 'Monthly income drawn from capital',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'post_retirement_drawdown_percentage',
    category: 'retirement_post',
    name: 'Drawdown Percentage',
    description: 'Annual drawdown percentage',
    dataType: 'percentage',
    isCalculated: false,
  },
  {
    id: 'post_retirement_frequency',
    category: 'retirement_post',
    name: 'Income Frequency',
    description: 'Frequency of income payments',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'post_retirement_date_of_inception',
    category: 'retirement_post',
    name: 'Date of Inception',
    description: 'Start date of the post-retirement policy',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'post_retirement_total_capital',
    category: 'retirement_post',
    name: 'Total Capital Value',
    description: 'Total capital across all post-retirement products',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['post_retirement_capital_value'],
  },
  {
    id: 'post_retirement_total_income',
    category: 'retirement_post',
    name: 'Total Monthly Income',
    description: 'Total monthly income from all post-retirement products',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['post_retirement_drawdown_amount'],
  },
];
