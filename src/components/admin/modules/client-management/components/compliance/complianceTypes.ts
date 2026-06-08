export interface ComplianceActivity {
  id: string;
  type: string;
  date: string;
  status: string;
  details?: Record<string, unknown>;
}

export type ComplianceSubTab =
  | 'overview'
  | 'identity-verification'
  | 'cdd'
  | 'financial-intelligence'
  | 'corporate-governance'
  | 'screening-sanctions'
  | 'address-reports'
  | 'risk-assessment'
  | 'activity-log';
