/**
 * Signer Experience Type Definitions
 */

export interface SignerSessionData {
  envelope_id: string;
  envelope_title: string;
  envelope_message?: string;
  envelope_status?: string;
  signer_id: string;
  signer_name: string;
  signer_email: string;
  signer_role?: string;
  signer_status: 'pending' | 'sent' | 'viewed' | 'otp_verified' | 'signed' | 'rejected' | 'declined';
  signer_order?: number;
  otp_required: boolean;
  otp_verified?: boolean;
  access_code_required?: boolean;
  document_url: string;
  document_filename?: string;
  page_count: number;
  fields: SignerField[];
  expires_at?: string;
  /** Whether it is currently this signer's turn in the sequential signing order */
  is_turn?: boolean;
  /** Summary of all signers on the envelope for the waiting UI */
  all_signers?: SignerOrderSummary[];
}

export interface SignerField {
  id: string;
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'auto_date' | 'dropdown';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signer_id: string;
  value?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SignatureData {
  field_id: string;
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'auto_date' | 'dropdown';
  value: string;
}

export interface SignerSessionValidation {
  success: boolean;
  data?: SignerSessionData;
  error?: string;
}

export interface OtpVerificationResult {
  success: boolean;
  error?: string;
}

export interface SignatureSubmissionResult {
  success: boolean;
  error?: string;
}

/** Non-sensitive summary of a signer for the waiting/progress UI */
export interface SignerOrderSummary {
  order: number;
  name: string;
  role?: string;
  status: string;
  is_current: boolean;
}