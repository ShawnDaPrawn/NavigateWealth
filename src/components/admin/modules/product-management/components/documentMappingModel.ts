/**
 * Model of the document-mapping tab: the canonical benefit keys, product
 * categories, terminology shapes, and the bulk re-extraction state shapes.
 * Split out of DocumentMappingTab.tsx.
 */
import { projectId } from '../../../../../utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

/** Canonical benefit keys for the dropdown */
export const CANONICAL_BENEFIT_KEYS = [
  { value: 'risk_life_cover', label: 'Life Cover' },
  { value: 'risk_severe_illness', label: 'Severe Illness / Critical Illness' },
  { value: 'risk_disability', label: 'Capital Disability' },
  { value: 'risk_temporary_icb', label: 'Income Protection (Temporary)' },
  { value: 'risk_permanent_icb', label: 'Income Protection (Permanent)' },
  { value: 'risk_monthly_premium', label: 'Risk Premium' },
  { value: 'medical_aid_plan_type', label: 'Medical Aid Plan Type' },
  { value: 'medical_aid_monthly_premium', label: 'Medical Aid Premium' },
  { value: 'medical_aid_dependents', label: 'Medical Aid Dependents' },
  { value: 'retirement_fund_type', label: 'Retirement Fund Type' },
  { value: 'retirement_fund_value', label: 'Retirement Fund Value' },
  { value: 'retirement_monthly_contribution', label: 'Retirement Contribution' },
  { value: 'post_retirement_capital_value', label: 'Living Annuity Capital' },
  { value: 'post_retirement_drawdown_amount', label: 'Living Annuity Income' },
  { value: 'invest_product_type', label: 'Investment Product Type' },
  { value: 'invest_current_value', label: 'Investment Current Value' },
  { value: 'invest_monthly_contribution', label: 'Investment Contribution' },
  { value: 'eb_group_life_cover', label: 'Group Life Cover' },
  { value: 'eb_group_disability', label: 'Group Disability Cover' },
  { value: 'eb_group_ip_monthly', label: 'Group Income Protection' },
  { value: 'eb_monthly_premium', label: 'Employee Benefits Premium' },
] as const;

/** Product category mappings */
export const PRODUCT_CATEGORIES = [
  { value: 'risk_planning', label: 'Risk Planning' },
  { value: 'medical_aid', label: 'Medical Aid' },
  { value: 'retirement_pre', label: 'Pre-Retirement' },
  { value: 'retirement_post', label: 'Post-Retirement' },
  { value: 'investments_voluntary', label: 'Voluntary Investments' },
  { value: 'investments_guaranteed', label: 'Guaranteed Investments' },
  { value: 'employee_benefits_risk', label: 'Employee Benefits (Risk)' },
  { value: 'employee_benefits_retirement', label: 'Employee Benefits (Retirement)' },
  { value: 'estate_planning', label: 'Estate Planning' },
  { value: 'tax_planning', label: 'Tax Planning' },
] as const;

export interface TerminologyMap {
  providerId: string;
  providerName: string;
  benefitMappings: Record<string, string>;
  productMappings: Record<string, string>;
  updatedAt: string;
  updatedBy: string;
}

export interface NewMappingRow {
  term: string;
  canonicalKey: string;
}

/** Provider selected for a bulk re-extraction run. */
export interface BulkProvider {
  id: string;
  name: string;
}

export interface BulkPreview {
  candidateCount: number;
  candidates: Array<{ policyId: string; fileName: string; hasExistingExtraction: boolean }>;
}

export interface BulkResults {
  totalProcessed: number;
  successCount: number;
  failCount: number;
  results: Array<{ policyId: string; status: string; confidence?: number; error?: string }>;
}

export interface BulkProgress {
  current: number;
  total: number;
  currentFileName: string;
  currentStatus: string;
  /** Timestamps of completed results for ETA calculation */
  completedTimestamps: number[];
  /** Start time for elapsed tracking */
  startedAt: number;
}

export interface StreamingResult {
  policyId: string;
  fileName: string;
  status: string;
  confidence?: number;
  error?: string;
}
