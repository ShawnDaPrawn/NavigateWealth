/**
 * Compliance Module - Type Definitions
 * Fresh file moved to root to fix bundling issues
 */

// FAIS (Financial Advisory and Intermediary Services)
export interface FAISRecord {
  id: string;
  adviser_id: string;
  fsp_number: string;
  fsp_name: string;
  category: string; // Category I, II, IIA, etc.
  license_valid_until: string;
  status: 'active' | 'expired' | 'suspended';
  created_at: string;
  updated_at: string;
}

// AML (Anti-Money Laundering)
export interface AMLCheck {
  id: string;
  client_id: string;
  check_type: 'kyc' | 'screening' | 'verification';
  status: 'clear' | 'flagged' | 'pending';
  risk_level: 'low' | 'medium' | 'high';
  checked_at: string;
  checked_by: string;
  notes?: string;
  external_reference?: string;
}

// POPIA (Protection of Personal Information Act)
export interface POPIAConsent {
  id: string;
  user_id: string;
  consent_type: 'general' | 'marketing' | 'profiling' | 'data_sharing';
  consented: boolean;
  consent_date: string;
  withdrawn_date?: string;
  ip_address?: string;
  user_agent?: string;
}

// Debarment Check
export interface DebarmentCheck {
  id: string;
  adviser_id: string;
  name: string;
  id_number: string;
  status: 'clear' | 'flagged';
  checked_at: string;
  checked_by: string;
  notes?: string;
  external_reference?: string;
}

// Documents & Insurance Record
export interface DocumentsInsuranceRecord {
  id: string;
  title: string;
  documentType: string;
  version: string;
  sumInsured?: number;
  insuranceProvider?: string;
  approvedBy?: string;
  effectiveDate: string;
  reviewCycle: string;
  due: string;
  status: 'active' | 'expired' | 'pending' | 'draft';
  created_at: string;
  updated_at: string;
}

// Compliance Summary
export interface ComplianceSummary {
  fais: {
    total: number;
    active: number;
    expired: number;
  };
  aml: {
    total: number;
    recent: number;
    clear: number;
  };
  popia: {
    total: number;
    active: number;
    withdrawn: number;
  };
  debarment: {
    total: number;
    recent: number;
    clear: number;
  };
  lastUpdated: string;
}
