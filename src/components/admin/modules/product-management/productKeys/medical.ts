/**
 * Product keys — Medical aid.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../types';

// Medical Aid Keys
export const MEDICAL_AID_KEYS: ProductKey[] = [
  {
    id: 'medical_aid_monthly_premium',
    category: 'medical_aid',
    name: 'Monthly Premium',
    description: 'Monthly medical aid premium amount for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'medical_aid_msa',
    category: 'medical_aid',
    name: 'Medical Savings Account (MSA)',
    description: 'Medical Savings Account balance or allocation',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'medical_aid_late_joiner_penalty',
    category: 'medical_aid',
    name: 'Late Joiner Penalty',
    description: 'Late joiner penalty amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'medical_aid_hospital_tariff',
    category: 'medical_aid',
    name: 'Hospital Tariff / Rate',
    description: 'Hospital reimbursement rate (e.g., 100%, 200%, Network)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'medical_aid_plan_type',
    category: 'medical_aid',
    name: 'Plan Type',
    description: 'Type of medical aid plan',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'medical_aid_dependents',
    category: 'medical_aid',
    name: 'Number of Dependents',
    description: 'Number of dependents covered',
    dataType: 'number',
    isCalculated: false,
  },
  {
    id: 'medical_aid_total_premium',
    category: 'medical_aid',
    name: 'Total Premium',
    description: 'Total monthly premium across all medical aid policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['medical_aid_monthly_premium'],
  },
  {
    id: 'medical_aid_date_of_inception',
    category: 'medical_aid',
    name: 'Date of Inception',
    description: 'Start date of the medical aid policy',
    dataType: 'date',
    isCalculated: false,
  },
  // Medical Aid FNA Needs Keys
  {
    id: 'medical_aid_dependents_recommended',
    category: 'medical_aid',
    name: 'Recommended Dependents',
    description: 'Calculated number of dependents needed',
    dataType: 'text',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'medical_aid_hospital_cover_recommended',
    category: 'medical_aid',
    name: 'Recommended Hospital Cover',
    description: 'Recommended in-hospital cover (100% or 200%)',
    dataType: 'text',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'medical_aid_msa_recommended',
    category: 'medical_aid',
    name: 'MSA Recommended',
    description: 'Whether a Medical Savings Account is recommended',
    dataType: 'boolean',
    isCalculated: true,
    isRecommendation: true,
  },
  {
    id: 'medical_aid_ljp_band_recommended',
    category: 'medical_aid',
    name: 'LJP Band',
    description: 'Calculated Late Joiner Penalty band',
    dataType: 'text',
    isCalculated: true,
    isRecommendation: true,
  },
];
