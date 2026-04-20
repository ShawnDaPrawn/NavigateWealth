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

/**
 * P3.4 — One row in the envelope's ordered document list. Stored in the
 * `envelopeDocuments` KV index so we can carry per-document metadata
 * (display name, original filename, page count, etc) without bloating
 * the envelope record itself.
 */
export interface EsignEnvelopeDocumentRef {
  document_id: string;
  order: number;
  display_name: string;
  original_filename: string;
  page_count: number;
  storage_path: string;
  added_at: string;
  added_by_user_id?: string;
}

export interface EsignEnvelope {
  id: string;
  firm_id: string;
  client_id: string;
  title: string;
  // P3.4 — `document_id` is the legacy "primary document" and is kept
  // as a mirror of `documents[0].document_id` for backward compatibility
  // with the certificate renderer, the audit trail, and any KV records
  // written before multi-document support landed.
  document_id: string;
  // P3.4 — ordered list of documents that belong to this envelope.
  // Optional so single-document envelopes don't have to populate it; the
  // services layer hydrates this on read for callers that want one
  // unified list.
  documents?: EsignEnvelopeDocumentRef[];
  // P7.5 — `completing` is a transient state used while the background
  // queue is generating the final signed PDF. It unblocks the signer
  // request path (which used to wait for burn-in + certificate merge +
  // seal) while keeping the UI honest: the envelope is no longer
  // `partially_signed` but also not yet fully `completed`.
  status: 'draft' | 'sent' | 'in_progress' | 'partially_signed' | 'completing' | 'completed' | 'declined' | 'voided' | 'expired';
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
  // P4.1 / P4.2 — pinned template provenance. Stamped at create-time
  // when the envelope is materialised from a saved template so the
  // exact template snapshot can always be retrieved.
  template_id?: string;
  template_version?: number;
  // P4.7 / P4.8 — bulk-send and packet provenance.
  campaign_id?: string;
  packet_run_id?: string;
  packet_step_index?: number;
  // P6.1 — hash of the sealed/signed final PDF. Written by the completion
  // workflow after PKCS#7 sealing and used by `/verify-hash` to match an
  // uploaded document to its envelope of origin.
  signed_document_hash?: string;
  // P6.4 — consent text version in effect at envelope send-time. Used
  // when rendering the signer consent prompt + stamped on every signer's
  // `consent_version` so subsequent text revisions don't mutate history.
  consent_version?: string;
  // P6.5 — optional signing reason / capacity instructions the sender
  // requires the signer(s) to attest to (e.g. "As trustee of …"). When
  // present the signer UI shows a read-only capacity block and stores
  // the acknowledgement on `EsignSigner.signing_reason`.
  signing_reason_required?: boolean;
  signing_reason_prompt?: string;
  // P6.6 — KBA gating per envelope. Off by default.
  kba_required?: boolean;
  kba_provider?: string;
  // P6.8 — soft-delete. Records are kept in the recovery bin for 90 days
  // before the scheduler permanently purges them. UI and listing filters
  // exclude rows with `deleted_at` set unless explicitly requested.
  deleted_at?: string;
  deleted_by?: string;
  delete_reason?: string;
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
  // P2.5 2.8 — distinguishes primary signers from witnesses and CC-only
  // recipients. Optional for back-compat with KV records written before
  // the kind field existed (treated as 'signer' when absent).
  kind?: 'signer' | 'witness' | 'cc';
  status: 'pending' | 'sent' | 'viewed' | 'otp_verified' | 'signed' | 'declined';
  access_code?: string;
  access_token: string;
  requires_otp: boolean;
  otp_verified: boolean;
  // P5.1 — per-signer opt-in for SMS channel (OTP + invite + reminder).
  // Optional for back-compat with signers created before SMS support.
  // When `sms_opt_in` is true, the signer MUST also have `phone` set.
  sms_opt_in?: boolean;
  // P5.6 — rotation audit trail for single-use signing tokens. Updated
  // whenever the access_token is regenerated (recall / resend). The
  // signer view does not display this field; it exists for investigation.
  token_rotated_at?: string;
  token_rotation_count?: number;
  invite_sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  signature_data?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  // P6.4 — Immutable stamp of the ECTA consent text version the signer
  // acknowledged. Absent for envelopes created before consent versioning.
  consent_version?: string;
  consent_accepted_at?: string;
  // P6.5 — Optional free-text reason / legal capacity the signer
  // attested to (e.g. "As Director of ABC (Pty) Ltd"). Surfaces on the
  // completion certificate evidence page.
  signing_reason?: string;
  // P6.3 — signature draw telemetry captured client-side (stroke count,
  // duration, pressure samples). Rendered on the evidence package.
  signature_telemetry?: {
    strokes?: number;
    duration_ms?: number;
    method?: 'draw' | 'type' | 'upload';
    adopted_at?: string;
  };
  // P6.6 — KBA outcome (when an envelope requires a KBA provider check).
  kba?: {
    provider: string;
    status: 'passed' | 'failed' | 'skipped' | 'error';
    reference?: string;
    verified_at?: string;
  };
}

export interface EsignField {
  id: string;
  envelope_id: string;
  // P3.4 — for multi-document envelopes a field belongs to a specific
  // document. Optional for back-compat: when missing, treat as the
  // envelope's primary document_id. The materialiser uses this to
  // remap (document_id, page) → (concatenated page) at send-time.
  document_id?: string;
  signer_id: string;
  // P3.5 — `attachment` requires the signer to upload a file (e.g. proof
  // of address, ID copy). Stored in the same storage bucket as the
  // envelope document, indexed by attachment id under the envelope.
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'attachment';
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
  // P2.5 2.8 — `witness` is a separate actor_type so the evidence trail can
  // distinguish a primary signer's sign event from a witness attestation.
  // The Postgres schema (Phase 0.1) already has a CHECK constraint that
  // includes 'witness'; this just keeps the TS layer aligned.
  actor_type: 'system' | 'sender_user' | 'signer' | 'witness';
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

// ---------------------------------------------------------------------------
// P4.8 — Packet workflows (server side)
// ---------------------------------------------------------------------------
// A "packet" is an authored sequence of templates that should be sent to a
// shared set of recipients one after the other. A "packet run" is the live
// execution of a packet for a particular set of recipients — the server
// owns the run record, advances `currentStepIndex` whenever the active
// envelope completes, and exposes the queued step to the client so it can
// materialise the next envelope. Keeping advancement on the server is what
// makes "envelope N completes → envelope N+1 sends" reliable across
// browsers / sessions.

export interface PacketRecipient {
  name: string;
  email: string;
  role?: string;
  order: number;
}

export interface PacketStepDefinition {
  templateId: string;
  templateVersion: number;
  label?: string;
}

export interface PacketRecord {
  id: string;
  firm_id: string;
  name: string;
  description?: string;
  steps: PacketStepDefinition[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export type PacketRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface PacketRunStepRecord {
  step_index: number;
  template_id: string;
  template_version: number;
  envelope_id?: string;
  status: 'pending' | 'sent' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface PacketRunRecord {
  id: string;
  firm_id: string;
  packet_id: string;
  recipients: PacketRecipient[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  status: PacketRunStatus;
  current_step_index: number;
  steps: PacketRunStepRecord[];
}