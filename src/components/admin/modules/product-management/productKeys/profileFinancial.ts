/**
 * Product keys — Client profile — circumstances that drive advice.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../types';

// Profile: Employment Keys
export const PROFILE_EMPLOYMENT_KEYS: ProductKey[] = [
  {
    id: 'profile_employment_status',
    category: 'profile_employment',
    name: 'Employment Status',
    description: 'Current employment status',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_employer_name',
    category: 'profile_employment',
    name: 'Employer Name',
    description: 'Name of current employer',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_job_title',
    category: 'profile_employment',
    name: 'Job Title',
    description: 'Current job title or position',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_industry',
    category: 'profile_employment',
    name: 'Industry',
    description: 'Industry sector',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_occupation',
    category: 'profile_employment',
    name: 'Occupation',
    description: 'Specific occupation or profession',
    dataType: 'text',
    isCalculated: false,
  },
];

// Profile: Health Keys
export const PROFILE_HEALTH_KEYS: ProductKey[] = [
  {
    id: 'profile_height',
    category: 'profile_health',
    name: 'Height',
    description: 'Client height',
    dataType: 'number',
    isCalculated: false,
  },
  {
    id: 'profile_weight',
    category: 'profile_health',
    name: 'Weight',
    description: 'Client weight',
    dataType: 'number',
    isCalculated: false,
  },
  {
    id: 'profile_blood_type',
    category: 'profile_health',
    name: 'Blood Type',
    description: 'Blood type',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_smoker_status',
    category: 'profile_health',
    name: 'Smoker Status',
    description: 'Whether client is a smoker',
    dataType: 'boolean',
    isCalculated: false,
  },
  {
    id: 'profile_has_chronic_conditions',
    category: 'profile_health',
    name: 'Has Chronic Conditions',
    description: 'Whether client has chronic health conditions',
    dataType: 'boolean',
    isCalculated: false,
  },
];

// Profile: Family Keys
export const PROFILE_FAMILY_KEYS: ProductKey[] = [
  {
    id: 'profile_spouse_name',
    category: 'profile_family',
    name: 'Spouse Name',
    description: 'Name of spouse or partner',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_number_of_dependents',
    category: 'profile_family',
    name: 'Number of Dependents',
    description: 'Total number of financial dependents',
    dataType: 'number',
    isCalculated: false,
  },
  {
    id: 'profile_number_of_children',
    category: 'profile_family',
    name: 'Number of Children',
    description: 'Total number of children',
    dataType: 'number',
    isCalculated: false,
  },
];

// Profile: Banking Keys
export const PROFILE_BANKING_KEYS: ProductKey[] = [
  {
    id: 'profile_bank_name',
    category: 'profile_banking',
    name: 'Bank Name',
    description: 'Primary bank name',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_account_number',
    category: 'profile_banking',
    name: 'Account Number',
    description: 'Bank account number',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_account_type',
    category: 'profile_banking',
    name: 'Account Type',
    description: 'Type of bank account (Cheque, Savings, etc.)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_branch_code',
    category: 'profile_banking',
    name: 'Branch Code',
    description: 'Bank branch code',
    dataType: 'text',
    isCalculated: false,
  },
];

// Profile: Risk Profile Keys
export const PROFILE_RISK_KEYS: ProductKey[] = [
  {
    id: 'profile_risk_tolerance',
    category: 'profile_risk',
    name: 'Risk Tolerance',
    description: 'Investment risk tolerance level',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_risk_category',
    category: 'profile_risk',
    name: 'Risk Category',
    description: 'Risk category (Conservative, Moderate, Aggressive)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_investment_experience',
    category: 'profile_risk',
    name: 'Investment Experience',
    description: 'Level of investment experience',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_investment_time_horizon',
    category: 'profile_risk',
    name: 'Investment Time Horizon',
    description: 'Investment time horizon in years',
    dataType: 'number',
    isCalculated: false,
  },
];

// Profile: Financial Information Keys
export const PROFILE_FINANCIAL_KEYS: ProductKey[] = [
  {
    id: 'profile_gross_income',
    category: 'profile_financial',
    name: 'Gross Monthly Income',
    description: 'Gross monthly income before deductions',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_net_income',
    category: 'profile_financial',
    name: 'Net Monthly Income',
    description: 'Net monthly income after deductions',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_gross_annual_income',
    category: 'profile_financial',
    name: 'Gross Annual Income',
    description: 'Gross annual income before deductions',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_net_annual_income',
    category: 'profile_financial',
    name: 'Net Annual Income',
    description: 'Net annual income after deductions',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_monthly_expenses',
    category: 'profile_financial',
    name: 'Monthly Expenses',
    description: 'Total monthly living expenses',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_total_assets',
    category: 'profile_financial',
    name: 'Total Assets',
    description: 'Total value of all assets',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_total_liabilities',
    category: 'profile_financial',
    name: 'Total Liabilities',
    description: 'Total value of all liabilities',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'profile_net_worth',
    category: 'profile_financial',
    name: 'Net Worth',
    description: 'Net worth (Assets - Liabilities)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['profile_total_assets', 'profile_total_liabilities'],
  },
];
