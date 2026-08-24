/**
 * Product keys — Investments, voluntary and guaranteed.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../../types/product-keys';

// Investment Keys (Voluntary)
export const INVEST_VOLUNTARY_KEYS: ProductKey[] = [
  {
    id: 'invest_current_value',
    category: 'invest_voluntary',
    name: 'Current Value',
    description: 'Current investment value',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'invest_monthly_contribution',
    category: 'invest_voluntary',
    name: 'Monthly Contribution',
    description: 'Monthly investment contribution for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'invest_product_type',
    category: 'invest_voluntary',
    name: 'Investment Type',
    description: 'Type of investment product',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'invest_maturity_value',
    category: 'invest_voluntary',
    name: 'Maturity Value',
    description: 'Projected or actual maturity value',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'invest_maturity_date',
    category: 'invest_voluntary',
    name: 'Maturity Date',
    description: 'Date of investment maturity',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'invest_date_of_inception',
    category: 'invest_voluntary',
    name: 'Date of Inception',
    description:
      'Policy or investment start date. Used to time annual contribution escalation on anniversary for maturity projections.',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'invest_total_contribution',
    category: 'invest_voluntary',
    name: 'Total Contribution',
    description: 'Total monthly contribution across all investment policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['invest_monthly_contribution'],
  },
  {
    id: 'invest_assumptions_growth',
    category: 'invest_voluntary',
    name: 'Assumed Growth Rate (%)',
    description: 'Projected annual growth rate for maturity calculation',
    dataType: 'percentage',
    isCalculated: false,
  },
  {
    id: 'invest_assumptions_escalation',
    category: 'invest_voluntary',
    name: 'Premium Escalation (%)',
    description:
      'Annual increase to the monthly contribution on each policy anniversary. Use 0 if the contribution does not escalate. Maturity projections use this with date of inception when present.',
    dataType: 'percentage',
    isCalculated: false,
  },
  // Investment FNA Recommendations
  {
    id: 'invest_contribution_recommended',
    category: 'invest_voluntary',
    name: 'Recommended Contribution',
    description: 'Calculated recommended monthly investment contribution',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'invest_lumpsum_recommended',
    category: 'invest_voluntary',
    name: 'Recommended Lump Sum',
    description: 'Calculated recommended lump sum investment',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
];

// Investment Keys (Guaranteed)
export const INVEST_GUARANTEED_KEYS: ProductKey[] = [
  {
    id: 'invest_guaranteed_capital',
    category: 'invest_guaranteed',
    name: 'Guaranteed Capital',
    description: 'Initial capital investment amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'invest_guaranteed_rate',
    category: 'invest_guaranteed',
    name: 'Guaranteed Rate',
    description: 'Guaranteed interest rate',
    dataType: 'percentage',
    isCalculated: false,
  },
  {
    id: 'invest_guaranteed_term',
    category: 'invest_guaranteed',
    name: 'Investment Term',
    description: 'Term of the investment (months/years)',
    dataType: 'number',
    isCalculated: false,
  },
  {
    id: 'invest_guaranteed_maturity_value',
    category: 'invest_guaranteed',
    name: 'Guaranteed Maturity Value',
    description: 'Guaranteed value at maturity',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'invest_guaranteed_maturity_date',
    category: 'invest_guaranteed',
    name: 'Maturity Date',
    description: 'Date of investment maturity',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'invest_guaranteed_date_of_inception',
    category: 'invest_guaranteed',
    name: 'Date of Inception',
    description: 'Start date of the guaranteed investment',
    dataType: 'date',
    isCalculated: false,
  },
];
