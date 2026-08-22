/**
 * The shapes a compliance check result takes, and the activity-type maps.
 *
 * Split out of `ComplianceResultViewer.tsx` (1,486 lines), which held forty
 * named functions: the viewer, seventeen per-check result views, the primitives
 * they share, and an HTML report generator. Each was already self-contained.
 */

export interface HoneycombAddress {
  line1?: string;
  line2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  source?: string;
  lastReported?: string;
}

/** Compliance check result data — Record base allows unknown provider fields */
export type ComplianceCheckData = Record<string, unknown>;

export interface ComplianceActivity {
  id: string;
  type: string;
  date: string;
  status: string;
  details?: Record<string, unknown>;
}

export interface CheckResult {
  id: string;
  checkType: string;
  clientId: string;
  matterId: string | null;
  submittedAt: string;
  status: string;
  summary: string;
  rawResponse: Record<string, unknown>;
}

export interface ComplianceResultViewerProps {
  open: boolean;
  onClose: () => void;
  activity: ComplianceActivity | null;
  clientId: string;
  clientName: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maps the activity `type` string (from logActivity) to the KV checkType
 * used in honeycomb_checks storage.
 */
export const ACTIVITY_TYPE_TO_CHECK_TYPE: Record<string, string> = {
  'IDV Report': 'idv_no_photo',
  'IDV Report (Photo)': 'idv_with_photo',
  'Bulk IDV': 'idv_bulk',
  'Bank Verification': 'bank_verification',
  'Consumer Credit Check': 'consumer_credit',
  'Consumer Trace': 'consumer_trace',
  'Debt Review Enquiry': 'debt_enquiry',
  'CIPC Search': 'cipc',
  'Director Enquiry': 'director_enquiry',
  'Best Known Address': 'best_known_address',
  'Custom Screening': 'custom_screening',
  'Sanctions Search': 'sanctions_search',
  'Enforcement Actions Search': 'enforcement_actions',
  'Legal A Listing Search': 'legal_a_listing',
  'Lifestyle Audit': 'lifestyle_audit',
  'Income Predictor': 'income_predictor',
  'Tenders Blue Search': 'tenders_blue',
  'Risk Assessment': 'assessment',
  'Client Registration': 'registration',
};
