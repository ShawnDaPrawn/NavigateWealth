import { ProductKey, ProductKeyCategory } from './types';

/**
 * Predefined Product Keys for Key Manager
 * These keys represent standard data points that can be mapped from product fields
 */

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
    calculatedFrom: ['eb_risk_monthly_premium', 'eb_retirement_contribution_employee', 'eb_retirement_contribution_employer'],
  },
];

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

// Profile: Personal Information Keys
export const PROFILE_PERSONAL_KEYS: ProductKey[] = [
  {
    id: 'profile_title',
    category: 'profile_personal',
    name: 'Title',
    description: 'Client title (Mr, Mrs, Dr, etc.)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_first_name',
    category: 'profile_personal',
    name: 'First Name',
    description: 'Client first name',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_middle_name',
    category: 'profile_personal',
    name: 'Middle Name',
    description: 'Client middle name',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_last_name',
    category: 'profile_personal',
    name: 'Last Name',
    description: 'Client last name',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_date_of_birth',
    category: 'profile_personal',
    name: 'Date of Birth',
    description: 'Client date of birth',
    dataType: 'date',
    isCalculated: false,
  },
  {
    id: 'profile_gender',
    category: 'profile_personal',
    name: 'Gender',
    description: 'Client gender',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_nationality',
    category: 'profile_personal',
    name: 'Nationality',
    description: 'Client nationality',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_marital_status',
    category: 'profile_personal',
    name: 'Marital Status',
    description: 'Client marital status',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_marital_regime',
    category: 'profile_personal',
    name: 'Marital Regime',
    description: 'Marriage contract type (In Community of Property, etc.)',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_id_number',
    category: 'profile_personal',
    name: 'ID Number',
    description: 'National ID number',
    dataType: 'text',
    isCalculated: false,
  },
];

// Profile: Contact Information Keys
export const PROFILE_CONTACT_KEYS: ProductKey[] = [
  {
    id: 'profile_email',
    category: 'profile_contact',
    name: 'Email Address',
    description: 'Primary email address',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_secondary_email',
    category: 'profile_contact',
    name: 'Secondary Email',
    description: 'Secondary email address',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_phone_number',
    category: 'profile_contact',
    name: 'Phone Number',
    description: 'Primary phone number',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_alternative_phone',
    category: 'profile_contact',
    name: 'Alternative Phone',
    description: 'Alternative phone number',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_preferred_contact_method',
    category: 'profile_contact',
    name: 'Preferred Contact Method',
    description: 'Client preferred contact method',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_emergency_contact_name',
    category: 'profile_contact',
    name: 'Emergency Contact Name',
    description: 'Name of emergency contact person',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_emergency_contact_relationship',
    category: 'profile_contact',
    name: 'Emergency Contact Relationship',
    description: 'Relationship to emergency contact',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_emergency_contact_phone',
    category: 'profile_contact',
    name: 'Emergency Contact Phone',
    description: 'Emergency contact phone number',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_emergency_contact_email',
    category: 'profile_contact',
    name: 'Emergency Contact Email',
    description: 'Emergency contact email address',
    dataType: 'text',
    isCalculated: false,
  },
];

// Profile: Identity Keys
export const PROFILE_IDENTITY_KEYS: ProductKey[] = [
  {
    id: 'profile_id_country',
    category: 'profile_identity',
    name: 'ID Country',
    description: 'Country of ID document',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_passport_country',
    category: 'profile_identity',
    name: 'Passport Country',
    description: 'Country of passport issuance',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_passport_number',
    category: 'profile_identity',
    name: 'Passport Number',
    description: 'Passport number',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_tax_number',
    category: 'profile_identity',
    name: 'Tax Number',
    description: 'Tax reference number',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_permit_number',
    category: 'profile_identity',
    name: 'Work Permit Number',
    description: 'Work permit or visa number',
    dataType: 'text',
    isCalculated: false,
  },
];

// Profile: Address Keys
export const PROFILE_ADDRESS_KEYS: ProductKey[] = [
  {
    id: 'profile_residential_address_line1',
    category: 'profile_address',
    name: 'Residential Address Line 1',
    description: 'Residential street address line 1',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_residential_address_line2',
    category: 'profile_address',
    name: 'Residential Address Line 2',
    description: 'Residential street address line 2',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_residential_suburb',
    category: 'profile_address',
    name: 'Residential Suburb',
    description: 'Residential suburb',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_residential_city',
    category: 'profile_address',
    name: 'Residential City',
    description: 'Residential city',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_residential_province',
    category: 'profile_address',
    name: 'Residential Province',
    description: 'Residential province or state',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_residential_postal_code',
    category: 'profile_address',
    name: 'Residential Postal Code',
    description: 'Residential postal code',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_residential_country',
    category: 'profile_address',
    name: 'Residential Country',
    description: 'Residential country',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_address_line1',
    category: 'profile_address',
    name: 'Work Address Line 1',
    description: 'Work street address line 1',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_address_line2',
    category: 'profile_address',
    name: 'Work Address Line 2',
    description: 'Work street address line 2',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_suburb',
    category: 'profile_address',
    name: 'Work Suburb',
    description: 'Work suburb',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_city',
    category: 'profile_address',
    name: 'Work City',
    description: 'Work city',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_province',
    category: 'profile_address',
    name: 'Work Province',
    description: 'Work province or state',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_postal_code',
    category: 'profile_address',
    name: 'Work Postal Code',
    description: 'Work postal code',
    dataType: 'text',
    isCalculated: false,
  },
  {
    id: 'profile_work_country',
    category: 'profile_address',
    name: 'Work Country',
    description: 'Work country',
    dataType: 'text',
    isCalculated: false,
  },
];

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

// Consolidated key registry
export const ALL_PRODUCT_KEYS: ProductKey[] = [
  ...RISK_KEYS,
  ...MEDICAL_AID_KEYS,
  ...RETIREMENT_PRE_KEYS,
  ...RETIREMENT_POST_KEYS,
  ...INVEST_VOLUNTARY_KEYS,
  ...INVEST_GUARANTEED_KEYS,
  ...EMPLOYEE_BENEFITS_KEYS,
  ...ESTATE_PLANNING_KEYS,
  ...TAX_KEYS,
  ...PROFILE_PERSONAL_KEYS,
  ...PROFILE_CONTACT_KEYS,
  ...PROFILE_IDENTITY_KEYS,
  ...PROFILE_ADDRESS_KEYS,
  ...PROFILE_EMPLOYMENT_KEYS,
  ...PROFILE_HEALTH_KEYS,
  ...PROFILE_FAMILY_KEYS,
  ...PROFILE_BANKING_KEYS,
  ...PROFILE_RISK_KEYS,
  ...PROFILE_FINANCIAL_KEYS,
];

// Helper to get keys by category
export function getKeysByCategory(category: ProductKeyCategory): ProductKey[] {
  switch (category) {
    case 'risk':
      return RISK_KEYS;
    case 'medical_aid':
      return MEDICAL_AID_KEYS;
    case 'retirement_pre':
      return RETIREMENT_PRE_KEYS;
    case 'retirement_post':
      return RETIREMENT_POST_KEYS;
    case 'invest_voluntary':
      return INVEST_VOLUNTARY_KEYS;
    case 'invest_guaranteed':
      return INVEST_GUARANTEED_KEYS;
    case 'employee_benefits':
      return EMPLOYEE_BENEFITS_KEYS;
    case 'employee_benefits_risk':
      return EMPLOYEE_BENEFITS_RISK_KEYS;
    case 'employee_benefits_retirement':
      return EMPLOYEE_BENEFITS_RETIREMENT_KEYS;
    case 'estate_planning':
      return ESTATE_PLANNING_KEYS;
    case 'tax':
      return TAX_KEYS;
    case 'profile_personal':
      return PROFILE_PERSONAL_KEYS;
    case 'profile_contact':
      return PROFILE_CONTACT_KEYS;
    case 'profile_identity':
      return PROFILE_IDENTITY_KEYS;
    case 'profile_address':
      return PROFILE_ADDRESS_KEYS;
    case 'profile_employment':
      return PROFILE_EMPLOYMENT_KEYS;
    case 'profile_health':
      return PROFILE_HEALTH_KEYS;
    case 'profile_family':
      return PROFILE_FAMILY_KEYS;
    case 'profile_banking':
      return PROFILE_BANKING_KEYS;
    case 'profile_risk':
      return PROFILE_RISK_KEYS;
    case 'profile_financial':
      return PROFILE_FINANCIAL_KEYS;
    default:
      return [];
  }
}

// Key categories with display names
export const KEY_CATEGORIES = [
  { id: 'risk' as ProductKeyCategory, name: 'Risk', description: 'Life, disability, and income protection' },
  { id: 'medical_aid' as ProductKeyCategory, name: 'Medical Aid', description: 'Medical aid and healthcare' },
  { id: 'retirement_pre' as ProductKeyCategory, name: 'Pre-Retirement', description: 'Retirement accumulation (RA, Pension, Provident)' },
  { id: 'retirement_post' as ProductKeyCategory, name: 'Post-Retirement', description: 'Retirement income (Living Annuity, etc.)' },
  { id: 'invest_voluntary' as ProductKeyCategory, name: 'Voluntary Investments', description: 'Discretionary investments (Unit Trusts, TFSA)' },
  { id: 'invest_guaranteed' as ProductKeyCategory, name: 'Guaranteed Investments', description: 'Fixed period/rate investments (Endowments, etc.)' },
  { id: 'employee_benefits' as ProductKeyCategory, name: 'Employee Benefits (General)', description: 'General Group benefits and schemes' },
  { id: 'employee_benefits_risk' as ProductKeyCategory, name: 'Employee Benefits (Risk)', description: 'Group Risk benefits (Life, Disability, etc.)' },
  { id: 'employee_benefits_retirement' as ProductKeyCategory, name: 'Employee Benefits (Retirement)', description: 'Group Retirement benefits (Pension, Provident)' },
  { id: 'estate_planning' as ProductKeyCategory, name: 'Estate Planning', description: 'Wills, trusts, and estate' },
  { id: 'tax' as ProductKeyCategory, name: 'Tax', description: 'Tax planning and compliance' },
  { id: 'profile_personal' as ProductKeyCategory, name: 'Personal Information', description: 'Client personal details' },
  { id: 'profile_contact' as ProductKeyCategory, name: 'Contact Information', description: 'Client contact details' },
  { id: 'profile_identity' as ProductKeyCategory, name: 'Identity Information', description: 'Client identity details' },
  { id: 'profile_address' as ProductKeyCategory, name: 'Address Information', description: 'Client address details' },
  { id: 'profile_employment' as ProductKeyCategory, name: 'Employment Information', description: 'Client employment details' },
  { id: 'profile_health' as ProductKeyCategory, name: 'Health Information', description: 'Client health details' },
  { id: 'profile_family' as ProductKeyCategory, name: 'Family Information', description: 'Client family details' },
  { id: 'profile_banking' as ProductKeyCategory, name: 'Banking Information', description: 'Client banking details' },
  { id: 'profile_risk' as ProductKeyCategory, name: 'Risk Profile', description: 'Client risk profile' },
  { id: 'profile_financial' as ProductKeyCategory, name: 'Financial Information', description: 'Client financial details' },
];