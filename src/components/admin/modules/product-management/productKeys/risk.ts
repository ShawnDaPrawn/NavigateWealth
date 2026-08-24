/**
 * Product keys — Risk planning.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../types';

// Risk Planning Keys
export const RISK_KEYS: ProductKey[] = [
  // Individual field keys (assignable to policy fields)
  {
    id: 'risk_life_cover',
    category: 'risk',
    name: 'Life Cover',
    description: 'Individual life cover amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'risk_severe_illness',
    category: 'risk',
    name: 'Severe Illness',
    description: 'Individual severe illness cover amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'risk_disability',
    category: 'risk',
    name: 'Disability',
    description: 'Individual lump sum disability cover amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'risk_temporary_icb',
    category: 'risk',
    name: 'Temporary ICB',
    description: 'Monthly temporary income protection amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'risk_permanent_icb',
    category: 'risk',
    name: 'Permanent ICB',
    description: 'Monthly permanent income protection amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'risk_icb_waiting_period',
    category: 'risk',
    name: 'ICB Waiting Period',
    description: 'Waiting period before income protection benefits begin',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'risk_monthly_premium',
    category: 'risk',
    name: 'Monthly Premium',
    description: 'Monthly premium amount for a single risk policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'risk_date_of_inception',
    category: 'risk',
    name: 'Date of Inception',
    description: 'Start date of the policy',
    dataType: 'date',
    isCalculated: false,
  },

  // Calculated total keys (derived from summing individual fields, not assignable)
  {
    id: 'risk_life_cover_total',
    category: 'risk',
    name: 'Life Cover Total',
    description: 'Total life cover across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['risk_life_cover'],
  },
  {
    id: 'risk_severe_illness_total',
    category: 'risk',
    name: 'Severe Illness Total',
    description: 'Total severe illness cover across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['risk_severe_illness'],
  },
  {
    id: 'risk_disability_total',
    category: 'risk',
    name: 'Disability Total',
    description: 'Total disability cover across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['risk_disability'],
  },
  {
    id: 'risk_temporary_icb_total',
    category: 'risk',
    name: 'Temporary ICB Total',
    description: 'Total monthly temporary income protection across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['risk_temporary_icb'],
  },
  {
    id: 'risk_permanent_icb_total',
    category: 'risk',
    name: 'Permanent ICB Total',
    description: 'Total monthly permanent income protection across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['risk_permanent_icb'],
  },
  {
    id: 'risk_total_premium',
    category: 'risk',
    name: 'Total Premium',
    description: 'Total monthly premium across all risk policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['risk_monthly_premium'],
  },
  // Risk FNA Recommendations
  {
    id: 'risk_life_cover_recommended',
    category: 'risk',
    name: 'Recommended Life Cover',
    description: 'Calculated recommended life cover amount',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'risk_severe_illness_recommended',
    category: 'risk',
    name: 'Recommended Severe Illness',
    description: 'Calculated recommended severe illness cover amount',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'risk_disability_recommended',
    category: 'risk',
    name: 'Recommended Disability',
    description: 'Calculated recommended disability cover amount',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'risk_temporary_icb_recommended',
    category: 'risk',
    name: 'Recommended Temporary ICB',
    description: 'Calculated recommended temporary income protection',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'risk_permanent_icb_recommended',
    category: 'risk',
    name: 'Recommended Permanent ICB',
    description: 'Calculated recommended permanent income protection',
    dataType: 'currency',
    isCalculated: true,
    isRecommendation: true,
  },
];
