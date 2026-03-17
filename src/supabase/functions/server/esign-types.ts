/**
 * E-Signature Type Definitions
 * Centralized type definitions for the E-Signature module.
 */

export interface EsignDocument {
  id: string;
  firm_id: string;
  storage_path: string;
  original_filename: string;
  page_count: number;
  hash: string;
  created_at: string;
}

export interface EsignEnvelope {
  id: string;
  firm_id: string;
  client_id: string;
  title: string;
  document_id: string;
  status: 'draft' | 'sent' | 'in_progress' | 'partially_signed' | 'completed' | 'declined' | 'voided' | 'expired';
  message?: string;
  signing_mode?: SigningMode;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  completed_at?: string;
  voided_at?: string;
  expires_at: string;
  advice_case_id?: string;
  request_id?: string;
  product_id?: string;
  signed_document_path?: string;
}

export interface EsignSigner {
  id: string;
  envelope_id: string;
  client_id?: string;
  name: string;
  email: string;
  phone?: string;
  order: number;
  role: string;
  status: 'pending' | 'sent' | 'viewed' | 'otp_verified' | 'signed' | 'declined';
  access_code?: string;
  access_token: string;
  requires_otp: boolean;
  otp_verified: boolean;
  invite_sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  signature_data?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface EsignField {
  id: string;
  envelope_id: string;
  signer_id: string;
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface EsignAuditEvent {
  id: string;
  envelope_id: string;
  actor_type: 'system' | 'sender_user' | 'signer';
  actor_id?: string;
  action: string;
  at: string;
  ip?: string;
  user_agent?: string;
  email?: string;
  phone?: string;
  metadata: Record<string, unknown>;
}

export interface EsignCertificate {
  id: string;
  envelope_id: string;
  storage_path: string;
  generated_at: string;
  hash: string;
}

/**
 * Signing mode for an envelope.
 * - sequential: Signers are notified one at a time in order. Each signer must complete before the next is invited.
 * - parallel: All signers are invited simultaneously and can sign in any order.
 */
export type SigningMode = 'sequential' | 'parallel';