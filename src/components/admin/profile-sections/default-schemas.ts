/**
 * DEFAULT PRODUCT SCHEMAS (Client-side fallback)
 * Used when the server API is unreachable
 */

interface DefaultSchemaField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  keyId?: string;
}

export const DEFAULT_SCHEMAS: Record<string, { fields: DefaultSchemaField[] }> = {
  'risk_planning': {
    fields: [
      { id: 'rp_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'rp_2', name: 'Life Cover', type: 'currency', required: true },
      { id: 'rp_3', name: 'Severe Illness', type: 'currency', required: false },
      { id: 'rp_4', name: 'Capital Disability', type: 'currency', required: false },
      { id: 'rp_5', name: 'Income Protection', type: 'currency', required: false },
      { id: 'rp_6', name: 'Premium', type: 'currency', required: true },
      { id: 'rp_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'medical_aid': {
    fields: [
      { id: 'ma_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'ma_2', name: 'Plan', type: 'text', required: true },
      { id: 'ma_3', name: 'Main Member', type: 'text', required: true },
      { id: 'ma_4', name: 'Dependents', type: 'number', required: false },
      { id: 'ma_5', name: 'Hospital Benefit', type: 'text', required: false },
      { id: 'ma_6', name: 'Premium', type: 'currency', required: true },
      { id: 'ma_7', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'retirement_planning': {
    fields: [
      { id: 'ret_1', name: 'Policy Number', type: 'text', required: true },
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
      { id: 'ret_pre_5', name: 'Retirement Age', type: 'number', required: false, keyId: 'retirement_age' },
      { id: 'ret_pre_8', name: 'Maturity Date', type: 'date', required: false, keyId: 'retirement_maturity_date' },
      { id: 'ret_pre_6', name: 'Premium', type: 'currency', required: true, keyId: 'retirement_monthly_contribution' },
      { id: 'ret_pre_7', name: 'Notes', type: 'long_text', required: false },
      { id: 'ret_pre_9', name: 'Assumed growth (%)', type: 'percentage', required: false, keyId: 'retirement_assumptions_growth' },
      { id: 'ret_pre_10', name: 'Premium escalation (%) — anniversary', type: 'percentage', required: false, keyId: 'retirement_assumptions_escalation' },
    ]
  },
  'retirement_post': {
    fields: [
      { id: 'ret_post_1', name: 'Policy Number', type: 'text', required: true },
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
      { id: 'inv_2', name: 'Product Type', type: 'dropdown', required: true, options: ['Endowment', 'Unit Trust', 'Tax Free Savings', 'Offshore Investment', 'Shares'], keyId: 'invest_product_type' },
      { id: 'inv_3', name: 'Current Value', type: 'currency', required: true, keyId: 'invest_current_value' },
      { id: 'inv_4', name: 'Estimated Maturity Value', type: 'currency', required: false, keyId: 'invest_maturity_value' },
      { id: 'inv_5', name: 'Maturity Date', type: 'date', required: false, keyId: 'invest_maturity_date' },
      { id: 'inv_6', name: 'Premium', type: 'currency', required: false, keyId: 'invest_monthly_contribution' },
      { id: 'inv_7', name: 'Notes', type: 'long_text', required: false },
      { id: 'inv_8', name: 'Growth Rate', type: 'percentage', required: false, keyId: 'invest_assumptions_growth' },
      { id: 'inv_9', name: 'Escalation Rate', type: 'percentage', required: false, keyId: 'invest_assumptions_escalation' },
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
      { id: 'inv_vol_7', name: 'Notes', type: 'long_text', required: false },
      { id: 'inv_vol_8', name: 'Assumed growth (%)', type: 'percentage', required: false, keyId: 'invest_assumptions_growth' },
      { id: 'inv_vol_9', name: 'Contribution escalation (%) — anniversary', type: 'percentage', required: false, keyId: 'invest_assumptions_escalation' },
    ]
  },
  'investments_guaranteed': {
    fields: [
      { id: 'inv_gua_1', name: 'Policy Number', type: 'text', required: true },
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
      { id: 'eb_2', name: 'Employer', type: 'text', required: true },
      { id: 'eb_3', name: 'Benefit Type', type: 'dropdown', required: true, options: ['Group Life', 'Group Disability', 'Group Income Protection', 'Pension Fund', 'Provident Fund'] },
      { id: 'eb_4', name: 'Cover Amount', type: 'currency', required: false },
      { id: 'eb_5', name: 'Monthly Contribution', type: 'currency', required: false },
      { id: 'eb_6', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'employee_benefits_risk': {
    fields: [
      { id: 'eb_risk_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'eb_risk_2', name: 'Employer', type: 'text', required: true },
      { id: 'eb_risk_3', name: 'Benefit Type', type: 'dropdown', required: true, options: ['Group Life', 'Group Disability', 'Group Income Protection', 'Funeral Cover'] },
      { id: 'eb_risk_4', name: 'Cover Amount', type: 'currency', required: true },
      { id: 'eb_risk_5', name: 'Monthly Contribution', type: 'currency', required: false },
      { id: 'eb_risk_6', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'employee_benefits_retirement': {
    fields: [
      { id: 'eb_ret_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'eb_ret_2', name: 'Employer', type: 'text', required: true },
      { id: 'eb_ret_3', name: 'Fund Type', type: 'dropdown', required: true, options: ['Pension Fund', 'Provident Fund'] },
      { id: 'eb_ret_4', name: 'Fund Value', type: 'currency', required: true },
      { id: 'eb_ret_5', name: 'Monthly Contribution', type: 'currency', required: false },
      { id: 'eb_ret_6', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'tax_planning': {
    fields: [
      { id: 'tax_1', name: 'Tax Reference Number', type: 'text', required: true },
      { id: 'tax_2', name: 'Tax Type', type: 'dropdown', required: true, options: ['Personal Income Tax', 'Corporate Tax', 'VAT', 'PAYE', 'Dividend Tax'] },
      { id: 'tax_3', name: 'Year of Assessment', type: 'number', required: true },
      { id: 'tax_4', name: 'Amount Due/Refundable', type: 'currency', required: false },
      { id: 'tax_5', name: 'Notes', type: 'long_text', required: false },
    ]
  },
  'estate_planning': {
    fields: [
      { id: 'est_1', name: 'Policy Number', type: 'text', required: true },
      { id: 'est_2', name: 'Executor', type: 'text', required: false },
      { id: 'est_3', name: 'Last Will & Testament', type: 'boolean', required: true },
      { id: 'est_4', name: 'Living Will', type: 'boolean', required: false },
      { id: 'est_5', name: 'Premium', type: 'currency', required: false },
      { id: 'est_6', name: 'Premium Escalation', type: 'text', required: false },
      { id: 'est_7', name: 'Notes', type: 'long_text', required: false },
    ]
  }
};