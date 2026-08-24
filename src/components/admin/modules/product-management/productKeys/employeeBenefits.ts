/**
 * Product keys — Employee benefits — risk, retirement, and the combined set.
 *
 * One slice of the catalogue that used to be all 1,637 lines of
 * `keyManagerConstants.ts`. That file still composes these into
 * `ALL_PRODUCT_KEYS` and dispatches them from `getKeysByCategory`; it just no
 * longer holds the definitions itself.
 */
import type { ProductKey } from '../types';

// Employee Benefits Keys (Risk)
export const EMPLOYEE_BENEFITS_RISK_KEYS: ProductKey[] = [
  {
    id: 'eb_group_life_cover',
    category: 'employee_benefits_risk',
    name: 'Group Life Cover',
    description: 'Group life cover amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_group_disability',
    category: 'employee_benefits_risk',
    name: 'Group Disability Cover',
    description: 'Group disability cover amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_group_ip_monthly',
    category: 'employee_benefits_risk',
    name: 'Group Income Protection (Monthly)',
    description: 'Monthly group income protection amount',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_risk_monthly_premium',
    category: 'employee_benefits_risk',
    name: 'Risk Premium',
    description: 'Monthly premium amount for group risk benefits',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_risk_date_of_inception',
    category: 'employee_benefits_risk',
    name: 'Date of Inception',
    description: 'Start date of the group risk policy',
    dataType: 'date',
    isCalculated: false,
  },
];

// Employee Benefits Keys (Retirement)
export const EMPLOYEE_BENEFITS_RETIREMENT_KEYS: ProductKey[] = [
  {
    id: 'eb_pension_fund_value',
    category: 'employee_benefits_retirement',
    name: 'Pension Fund Value',
    description: 'Current value of pension fund',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_provident_fund_value',
    category: 'employee_benefits_retirement',
    name: 'Provident Fund Value',
    description: 'Current value of provident fund',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_retirement_contribution_employee',
    category: 'employee_benefits_retirement',
    name: 'Employee Contribution',
    description: 'Monthly employee contribution to retirement fund',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_retirement_contribution_employer',
    category: 'employee_benefits_retirement',
    name: 'Employer Contribution',
    description: 'Monthly employer contribution to retirement fund',
    dataType: 'currency',
    isCalculated: false,
  },
  {
    id: 'eb_retirement_date_of_inception',
    category: 'employee_benefits_retirement',
    name: 'Date of Inception',
    description: 'Start date of the group retirement policy',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'eb_retirement_total_contribution',
    category: 'employee_benefits_retirement',
    name: 'Total Monthly Contribution',
    description: 'Total monthly contribution (Employee + Employer)',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: ['eb_retirement_contribution_employee', 'eb_retirement_contribution_employer'],
  },
];

// Employee Benefits Global / Legacy Keys
export const EMPLOYEE_BENEFITS_KEYS: ProductKey[] = [
  ...EMPLOYEE_BENEFITS_RISK_KEYS,
  ...EMPLOYEE_BENEFITS_RETIREMENT_KEYS,
  {
    id: 'eb_date_of_inception',
    category: 'employee_benefits',
    name: 'Date of Inception',
    description: 'Start date of the employee benefit policy',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'eb_total_premium',
    category: 'employee_benefits', // Keeping as general category for now or map to one of them?
    // Actually, calculated keys usually belong to a category.
    // But if it sums from multiple, it's tricky.
    // Let's put it in 'employee_benefits_risk' as a placeholder or 'employee_benefits' if we keep the parent.
    // Ideally we should probably split the totals too.
    // But for backward compatibility with 'eb_total_premium', I'll calculate it from risk premium + retirement contributions?
    name: 'Total EB Cost',
    description: 'Total monthly cost across all employee benefit policies',
    dataType: 'currency',
    isCalculated: true,
    calculatedFrom: [
      'eb_risk_monthly_premium',
      'eb_retirement_contribution_employee',
      'eb_retirement_contribution_employer',
    ],
  },
];
