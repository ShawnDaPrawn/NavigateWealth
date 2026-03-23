/**
 * DEFAULT PRODUCT SCHEMAS
 * Extracted to separate file to reduce main bundle size
 */

export const DEFAULT_SCHEMAS: Record<string, unknown> = {
  'risk_planning': {
    fields: [
      { id: 'rp_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'rp_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'risk_date_of_inception' },
      { id: 'rp_2', name: 'Life Cover', type: 'currency', required: true, keyId: 'risk_life_cover' },
      { id: 'rp_3', name: 'Severe Illness', type: 'currency', required: false, keyId: 'risk_severe_illness' },
      { id: 'rp_4', name: 'Capital Disability', type: 'currency', required: false, keyId: 'risk_disability' },
      { id: 'rp_5', name: 'Income Protection', type: 'currency', required: false, keyId: 'risk_temporary_icb' },
      { id: 'rp_6', name: 'Premium', type: 'currency', required: true, keyId: 'risk_monthly_premium' },
      { id: 'rp_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'medical_aid': {
    fields: [
      { id: 'ma_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'ma_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'medical_aid_date_of_inception' },
      { id: 'ma_2', name: 'Plan', type: 'text', required: true, keyId: 'medical_aid_plan_type' },
      { id: 'ma_3', name: 'Main Member', type: 'text', required: true },
      { id: 'ma_4', name: 'Dependents', type: 'number', required: false, keyId: 'medical_aid_dependents' },
      { id: 'ma_5', name: 'Hospital Benefit', type: 'text', required: false },
      { id: 'ma_8', name: 'Medical Savings Account (MSA)', type: 'currency', required: false, keyId: 'medical_aid_msa' },
      { id: 'ma_9', name: 'Late Joiner Penalty (LPJ)', type: 'currency', required: false, keyId: 'medical_aid_late_joiner_penalty' },
      { id: 'ma_10', name: 'Hospital Tariff / Rate', type: 'text', required: false, keyId: 'medical_aid_hospital_tariff' },
      { id: 'ma_6', name: 'Premium', type: 'currency', required: true, keyId: 'medical_aid_monthly_premium' },
      { id: 'ma_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'retirement_planning': {
    fields: [
      { id: 'ret_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'ret_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'retirement_date_of_inception' },
      { id: 'ret_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Retirement Annuity', 'Pension Fund', 'Provident Fund', 'Preservation Fund', 'Living Annuity'], keyId: 'retirement_fund_type' },
      { id: 'ret_3', name: 'Current Value', type: 'currency', required: true, keyId: 'retirement_fund_value' },
      { id: 'ret_4', name: 'Projected Maturity Value', type: 'currency', required: false },
      { id: 'ret_5', name: 'Retirement Age', type: 'number', required: false },
      { id: 'ret_6', name: 'Premium', type: 'currency', required: true, keyId: 'retirement_monthly_contribution' },
      { id: 'ret_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'retirement_pre': {
    fields: [
      { id: 'ret_pre_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'ret_pre_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'retirement_date_of_inception' },
      { id: 'ret_pre_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Retirement Annuity', 'Pension Fund', 'Provident Fund', 'Preservation Fund', 'Living Annuity'], keyId: 'retirement_fund_type' },
      { id: 'ret_pre_3', name: 'Current Value', type: 'currency', required: true, keyId: 'retirement_fund_value' },
      { id: 'ret_pre_4', name: 'Estimated Maturity Value', type: 'currency', required: false, keyId: 'retirement_estimated_maturity_value' },
      { id: 'ret_pre_md', name: 'Maturity Date', type: 'date', required: false, keyId: 'retirement_maturity_date' },
      { id: 'ret_pre_5', name: 'Retirement Age', type: 'number', required: false },
      { id: 'ret_pre_6', name: 'Premium', type: 'currency', required: true, keyId: 'retirement_monthly_contribution' },
      { id: 'ret_pre_gr', name: 'Assumed Growth (%)', type: 'percentage', required: false, keyId: 'retirement_assumptions_growth' },
      { id: 'ret_pre_esc', name: 'Premium Escalation (%) — Anniversary', type: 'percentage', required: false, keyId: 'retirement_assumptions_escalation' },
      { id: 'ret_pre_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'retirement_post': {
    fields: [
      { id: 'ret_post_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'ret_post_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'post_retirement_date_of_inception' },
      { id: 'ret_post_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Living Annuity', 'Life Annuity'], keyId: 'retirement_fund_type' },
      { id: 'ret_post_3', name: 'Current Value', type: 'currency', required: true, keyId: 'retirement_fund_value' },
      { id: 'ret_post_4', name: 'Drawdown Percentage', type: 'percentage', required: true },
      { id: 'ret_post_5', name: 'Anniversary Date', type: 'date', required: false },
      { id: 'ret_post_6', name: 'Income Amount', type: 'currency', required: true },
      { id: 'ret_post_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'investments': {
    fields: [
      { id: 'inv_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'inv_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'invest_date_of_inception' },
      { id: 'inv_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Endowment', 'Unit Trust', 'Tax Free Savings', 'Offshore Investment', 'Shares'], keyId: 'invest_product_type' },
      { id: 'inv_3', name: 'Current Value', type: 'currency', required: true, keyId: 'invest_current_value' },
      { id: 'inv_4', name: 'Projected Value', type: 'currency', required: false },
      { id: 'inv_5', name: 'Maturity Date', type: 'date', required: false },
      { id: 'inv_6', name: 'Premium', type: 'currency', required: false, keyId: 'invest_monthly_contribution' },
      { id: 'inv_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'investments_voluntary': {
    fields: [
      { id: 'inv_vol_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'inv_vol_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'invest_date_of_inception' },
      { id: 'inv_vol_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Unit Trust', 'Tax Free Savings', 'Offshore Investment', 'Shares'], keyId: 'invest_product_type' },
      { id: 'inv_vol_3', name: 'Current Value', type: 'currency', required: true, keyId: 'invest_current_value' },
      { id: 'inv_vol_4', name: 'Estimated Maturity Value', type: 'currency', required: false, keyId: 'invest_maturity_value' },
      { id: 'inv_vol_5', name: 'Maturity Date', type: 'date', required: false, keyId: 'invest_maturity_date' },
      { id: 'inv_vol_6', name: 'Premium', type: 'currency', required: false, keyId: 'invest_monthly_contribution' },
      { id: 'inv_vol_gr', name: 'Assumed Growth (%)', type: 'percentage', required: false, keyId: 'invest_assumptions_growth' },
      { id: 'inv_vol_esc', name: 'Contribution Escalation (%) — Anniversary', type: 'percentage', required: false, keyId: 'invest_assumptions_escalation' },
      { id: 'inv_vol_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'investments_guaranteed': {
    fields: [
      { id: 'inv_gua_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'inv_gua_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'invest_guaranteed_date_of_inception' },
      { id: 'inv_gua_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Endowment', 'Guaranteed Plan', 'Fixed Deposit'], keyId: 'invest_product_type' },
      { id: 'inv_gua_3', name: 'Guaranteed Capital', type: 'currency', required: true, keyId: 'invest_guaranteed_capital' },
      { id: 'inv_gua_4', name: 'Guaranteed Rate', type: 'percentage', required: true, keyId: 'invest_guaranteed_rate' },
      { id: 'inv_gua_5', name: 'Maturity Date', type: 'date', required: true, keyId: 'invest_guaranteed_maturity_date' },
      { id: 'inv_gua_6', name: 'Maturity Value', type: 'currency', required: true, keyId: 'invest_guaranteed_maturity_value' },
      { id: 'inv_gua_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'employee_benefits': {
    fields: [
      { id: 'eb_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'eb_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'eb_date_of_inception' },
      { id: 'eb_2', name: 'Employer', type: 'text', required: true },
      { id: 'eb_3', name: 'Benefit Type', type: 'dropdown', required: true, options: ['Group Life', 'Group Disability', 'Group Income Protection', 'Pension Fund', 'Provident Fund'] },
      { id: 'eb_4', name: 'Cover Amount', type: 'currency', required: false, keyId: 'eb_group_life_cover' },
      { id: 'eb_5', name: 'Monthly Contribution', type: 'currency', required: false, keyId: 'eb_monthly_premium' },
      { id: 'eb_6', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'employee_benefits_risk': {
    fields: [
      { id: 'eb_risk_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'eb_risk_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'eb_risk_date_of_inception' },
      { id: 'eb_risk_2', name: 'Employer', type: 'text', required: true },
      { id: 'eb_risk_3', name: 'Benefit Type', type: 'dropdown', required: true, options: ['Group Life', 'Group Disability', 'Group Income Protection', 'Funeral Cover'], keyId: 'risk_product_type' }, // Maybe map to a risk key or EB key?
      { id: 'eb_risk_4', name: 'Life Cover', type: 'currency', required: false, keyId: 'eb_group_life_cover' },
      { id: 'eb_risk_5', name: 'Disability Cover', type: 'currency', required: false, keyId: 'eb_group_disability' },
      { id: 'eb_risk_6', name: 'Income Protection', type: 'currency', required: false, keyId: 'eb_group_ip_monthly' },
      { id: 'eb_risk_7', name: 'Monthly Premium', type: 'currency', required: false, keyId: 'eb_risk_monthly_premium' },
      { id: 'eb_risk_8', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'employee_benefits_retirement': {
    fields: [
      { id: 'eb_ret_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'eb_ret_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'eb_retirement_date_of_inception' },
      { id: 'eb_ret_2', name: 'Employer', type: 'text', required: true },
      { id: 'eb_ret_3', name: 'Fund Type', type: 'dropdown', required: true, options: ['Pension Fund', 'Provident Fund', 'Umbrella Fund'] },
      { id: 'eb_ret_4', name: 'Fund Value', type: 'currency', required: false, keyId: 'eb_pension_fund_value' }, // Or Provident, depending on type, but default schema picks one
      { id: 'eb_ret_5', name: 'Employee Contribution', type: 'currency', required: false, keyId: 'eb_retirement_contribution_employee' },
      { id: 'eb_ret_6', name: 'Employer Contribution', type: 'currency', required: false, keyId: 'eb_retirement_contribution_employer' },
      { id: 'eb_ret_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'tax_planning': {
    fields: [
      { id: 'tax_1', name: 'Tax Reference Number', type: 'text', required: true },
      { id: 'tax_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'tax_date_of_inception' },
      { id: 'tax_2', name: 'Tax Type', type: 'dropdown', required: true, options: ['Personal Income Tax', 'Corporate Tax', 'VAT', 'PAYE', 'Dividend Tax'] },
      { id: 'tax_3', name: 'Year of Assessment', type: 'number', required: true },
      { id: 'tax_4', name: 'Amount Due/Refundable', type: 'currency', required: false },
      { id: 'tax_5', name: 'Notes', type: 'long_text', required: false },
      { id: 'tax_6', name: 'Annual Fee', type: 'currency', required: false, keyId: 'tax_annual_fee' },
    ]
  },
  'estate_planning': {
    fields: [
      { id: 'est_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'est_inception', name: 'Date of Inception', type: 'date', required: false, keyId: 'estate_date_of_inception' },
      { id: 'est_2', name: 'Executor', type: 'text', required: false },
      { id: 'est_3', name: 'Last Will & Testament', type: 'boolean', required: true },
      { id: 'est_4', name: 'Living Will', type: 'boolean', required: false },
      { id: 'est_5', name: 'Premium', type: 'currency', required: false, keyId: 'estate_annual_fee' },
      { id: 'est_6', name: 'Premium Escalation', type: 'percentage', required: false },
      { id: 'est_7', name: 'Notes', type: 'long_text', required: false },
    ]
  }
};