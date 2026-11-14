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

/** Tones for the compliance status pills. */
export type PillTone = 'good' | 'bad' | 'warn' | 'neutral';

/** The pill tone for a Honeycomb check status. */
export function checkStatusTone(status: string): PillTone {
  if (status === 'completed') return 'good';
  if (status === 'failed') return 'bad';
  return 'warn';
}
