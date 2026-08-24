/**
 * Product keys — Estate planning and tax.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../../types/product-keys';

// Estate Planning Keys
export const ESTATE_PLANNING_KEYS: ProductKey[] = [
  {
    id: 'estate_will_date',
    category: 'estate_planning',
    name: 'Will Date',
    description: 'Date will was last updated',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'estate_executor_appointed',
    category: 'estate_planning',
    name: 'Executor Appointed',
    description: 'Whether an executor has been appointed',
    dataType: 'boolean',
    isCalculated: false,
  },
  {
    id: 'estate_trust_value',
    category: 'estate_planning',
    name: 'Trust Value',
    description: 'Total value held in trust',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'estate_annual_fee',
    category: 'estate_planning',
    name: 'Annual Fee',
    description: 'Annual estate planning fee for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'estate_date_of_inception',
    category: 'estate_planning',
    name: 'Date of Inception',
    description: 'Date of inception for estate planning',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'estate_total_annual_fee',
    category: 'estate_planning',
    name: 'Total Annual Fee',
    description: 'Total annual estate planning fees across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['estate_annual_fee'],
  },
];

// Tax Keys
export const TAX_KEYS: ProductKey[] = [
  {
    id: 'tax_annual_income',
    category: 'tax',
    name: 'Annual Taxable Income',
    description: 'Annual taxable income amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'tax_retirement_contributions',
    category: 'tax',
    name: 'Retirement Contributions',
    description: 'Annual retirement fund contributions',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'tax_medical_aid_credits',
    category: 'tax',
    name: 'Medical Aid Tax Credits',
    description: 'Medical aid tax credit amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'tax_annual_fee',
    category: 'tax',
    name: 'Annual Tax Planning Fee',
    description: 'Annual tax planning fee for a single policy',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'tax_date_of_inception',
    category: 'tax',
    name: 'Date of Inception',
    description: 'Date of inception for tax planning',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'tax_total_annual_fee',
    category: 'tax',
    name: 'Total Annual Fee',
    description: 'Total annual tax planning fees across all policies (calculated)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['tax_annual_fee'],
  },
];

// ----------------------------------------------------------------------------
// CLIENT PROFILE KEYS
// ----------------------------------------------------------------------------
