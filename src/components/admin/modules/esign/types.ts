/**
 * E-Signature Type Definitions
 * Navigate Wealth Admin Dashboard
 * 
 * All TypeScript type definitions for the E-Signature module.
 * Type-safe interfaces for Navigate Wealth E-Signature functionality.
 */

// ============================================================================
// ENUMS & UNIONS
// ============================================================================

/**
 * Signing mode determines how signers are notified.
 * - sequential: Signers sign one at a time in order (next signer is notified when previous completes).
 * - parallel: All signers are invited simultaneously and can sign in any order.
 */
export type SigningMode = 'sequential' | 'parallel';

/**
 * Envelope status types
 */
export type EnvelopeStatus = 
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_signed'
  // P7.5 — transient state while the background queue is finalising.
  // Sender sees "Finalising"; signer flows treat it as effectively
  // complete (no more fields to fill).
  | 'completing'
  | 'completed'
  | 'declined'
  | 'rejected'
  | 'expired'
  | 'voided';

/**
 * Signer status types
 */
export type SignerStatus = 
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'otp_verified'
  | 'signed'
  | 'rejected'
  | 'declined';

/**
 * Field type for document form fields
 *
 * P3.5 — `attachment` is a placeholder on the document where the signer
 * is required (or invited) to upload a supporting file. The uploaded
 * file is stored under the envelope's storage prefix and surfaced on
 * the completion certificate.
 */
export type FieldType = 
  | 'signature'
  | 'initials'
  | 'text'
  | 'date'
  | 'checkbox'
  | 'attachment';

/**
 * Actor type for audit trail
 */
export type ActorType = 
  | 'system'
  | 'sender_user'
  | 'signer';

// ============================================================================
// DATABASE ENTITIES
// ============================================================================

export interface EsignDocument {
  id: string;
  firm_id: string;
  storage_path: string;
  original_filename: string;
  page_count: number;
  hash: string;
  created_at: string;
}

export interface EsignSigner {
  id: string;
  envelope_id: string;
  client_id?: string | null;
  name: string;
  email: string;
  role?: string;
  order: number;
  otp_required: boolean;
  otp_hash?: string | null;
  otp_expires_at?: string | null;
  access_code?: string | null;
  access_token: string;
  status: SignerStatus;
  signed_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EsignField {
  id: string;
  envelope_id: string;
  template_id?: string | null;
  // P3.4 — for multi-document envelopes a field belongs to a specific
  // document. Optional for back-compat: when missing, the field is
  // assumed to live on the envelope's primary document.
  document_id?: string;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signer_id?: string | null;
  value?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EsignEnvelope {
  id: string;
  firm_id?: string;
  client_id: string;
  household_id?: string | null;
  advice_case_id?: string | null;
  request_id?: string | null;
  product_id?: string | null;
  title: string;
  message?: string | null;
  document_id?: string;
  template_id?: string | null;
  /**
   * P4.2 — Pinned template version this envelope was materialised
   * from. Persisted at create-from-template time so subsequent edits
   * to the template don't retroactively rewrite this envelope's
   * structure. Absent on envelopes not created from a template.
   */
  template_version?: number;
  /** P4.7 — Campaign/run id when this envelope was spawned by a bulk
   *  send. Used by the dashboard to group campaign envelopes together. */
  campaign_id?: string | null;
  /** P4.8 — Packet-run id + step index when this envelope is part of
   *  a packet workflow. Completion of step N triggers step N+1. */
  packet_run_id?: string | null;
  packet_step_index?: number | null;
  status: EnvelopeStatus;
  signing_mode?: SigningMode;
  expires_at?: string | null;
  completed_at?: string | null;
  voided_at?: string | null;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  
  // Populated relations
  document?: {
    id: string;
    filename: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    page_count: number;
    upload_status: string;
    created_at: string;
    url?: string; // Presigned URL from Supabase Storage
  };
  esign_documents?: EsignDocument;
  signers?: EsignSigner[];
  fields?: EsignField[];
  audit_events?: EsignAuditEvent[];
  documentUrl?: string;
  totalSigners?: number;
  signedCount?: number;

  // P3.1 + P3.2 — non-persisted, populated only on the upload response so
  // the studio can surface autodetected fields. Stripped on subsequent
  // GETs once the sender has accepted/dismissed candidates.
  field_candidates?: FieldCandidate[];

  // Lightweight signer config saved on draft envelopes (persisted during
  // recipients → prepare transition so "Continue Editing" can restore them).
  // NOT the same as the real EsignSigner records created at invite-send time.
  draft_signers?: Array<{
    name: string;
    email: string;
    phone?: string;
    role: string;
    order: number;
    otpRequired?: boolean;
    accessCode?: string;
    clientId?: string;
    isSystemClient?: boolean;
    // P5.1 — persisted opt-in so a draft remembers SMS preference.
    smsOptIn?: boolean;
  }>;
}

export interface EsignTemplate {
  id: string;
  firm_id: string;
  name: string;
  description?: string | null;
  document_id: string;
  is_global: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  
  // Populated relations
  esign_documents?: EsignDocument;
  fields?: EsignField[];
}

export interface EsignAuditEvent {
  id: string;
  envelope_id: string;
  actor_type: ActorType;
  actor_id?: string | null;
  action: string;
  at: string;
  ip?: string | null;
  user_agent?: string | null;
  email?: string | null;
  phone?: string | null;
  metadata: Record<string, unknown>;
}

export interface EsignCompletionCertificate {
  id: string;
  envelope_id: string;
  storage_path: string;
  hash: string;
  generated_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface UploadDocumentRequest {
  files: File[];
  context: {
    clientId?: string;  // Optional for standalone envelopes
    title: string;
    message?: string;
    expiryDays?: number;
    expiresAt?: string;
    adviceCaseId?: string;
    requestId?: string;
    productId?: string;
    householdId?: string;
    signingMode?: SigningMode;
    /** P4.1 / P4.2 — when present the envelope is pinned to this
     *  template snapshot; subsequent edits to the template won't
     *  retroactively rewrite the envelope. */
    templateId?: string;
    templateVersion?: number;
    /** P4.7 — campaign provenance stamped at create time. */
    campaignId?: string;
    /** P4.8 — packet-run provenance stamped at create time. */
    packetRunId?: string;
    packetStepIndex?: number;
  };
}

/**
 * P3.1 + P3.2 — Field-placement suggestions from the backend's PDF
 * analysis pipeline. The studio renders these as opt-in ghost overlays
 * with "Accept" / "Accept all" / "Dismiss" actions; sender remains in
 * full control. Empty array on analysis failure or no signals found.
 */
export interface FieldCandidate {
  id: string;
  type: FieldType;
  page: number;
  /** Percentage coordinates (0–100). y measured from page top. */
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  source: 'acroform' | 'anchor';
  label?: string;
  anchorText?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadDocumentResponse {
  envelope: EsignEnvelope;
  /** Suggested field placements; sender accepts/dismisses in the studio. */
  field_candidates?: FieldCandidate[];
}

/**
 * Editable subset of envelope-level metadata (Phase 2 — sender experience).
 * All fields optional: the API patches only what's present and ignores
 * anything that hasn't actually changed.
 */
export interface UpdateDraftSettingsRequest {
  title?: string;
  message?: string | null;
  expiryDays?: number;
  expires_at?: string | null;
  signing_mode?: SigningMode;
}

export interface UpdateDraftSettingsResponse {
  success: boolean;
  changed: Record<string, { from: unknown; to: unknown }>;
  envelope?: EsignEnvelope;
}

export interface SendInvitesRequest {
  signers: Array<{
    id?: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    order?: number;
    /** P4.7 — bulk send and packets short-circuit OTP. The server side
     *  uses the camelCase `requiresOtp` flag (see addSignersToEnvelope),
     *  while the legacy wizard sends `otpRequired`; both are accepted. */
    requiresOtp?: boolean;
    otpRequired?: boolean;
    accessCode?: string;
    clientId?: string;
    /** P5.1 — per-signer opt-in for the SMS channel (OTP + invite +
     *  reminder). Requires `phone` to be set. Off by default; senders
     *  must tick explicitly to comply with POPIA s69. */
    smsOptIn?: boolean;
  }>;
  /** P3.4 / P4.7 — field placements applied at send-time. Optional for
   *  the legacy "save fields then send" path; required for clients that
   *  short-circuit the studio (bulk send, express templates). */
  fields?: Array<Record<string, unknown>>;
  expiryDays?: number;
  message?: string;
  signingMode?: SigningMode;
}

export interface SendInvitesResponse {
  envelopeId: string;
  signers: Array<{
    id: string;
    name: string;
    email: string;
    status: SignerStatus;
  }>;
}

export interface VerifyOTPRequest {
  code: string;
  accessCode?: string;
}

export interface VerifyOTPResponse {
  verified: boolean;
}

export interface SubmitSignatureRequest {
  signerId: string;
  signatureDataUrl?: string;
  fields?: Array<{
    id: string;
    value: string;
  }>;
  consentAccepted: boolean;
}

export interface SubmitSignatureResponse {
  envelopeId: string;
  status: EnvelopeStatus;
  signedCount: number;
  totalSigners: number;
}

export interface RejectSigningRequest {
  signerId: string;
  reason: string;
}

export interface RejectSigningResponse {
  envelopeId: string;
  status: EnvelopeStatus;
}

export interface SaveTemplateRequest {
  name: string;
  description?: string;
}

export interface SaveTemplateResponse {
  id: string;
  name: string;
  description?: string | null;
  documentId: string;
}

export interface GetAuditTrailResponse {
  events: EsignAuditEvent[];
}

export interface GetDocumentUrlResponse {
  url: string;
}

export interface GetCertificateUrlResponse {
  url: string;
  generatedAt: string;
}

export interface GetClientEnvelopesResponse {
  envelopes: EsignEnvelope[];
}

// ============================================================================
// FORM/UI TYPES
// ============================================================================

/**
 * Signer "kind" classifies the recipient's role in the workflow:
 *  - 'signer'  → standard signer; required to place a signature/initials/etc.
 *  - 'witness' → witness signer; signs to attest, but the studio enforces no
 *                hard requirement that they have any specific field type.
 *  - 'cc'      → carbon-copy recipient; receives a notification only and does
 *                NOT participate in signing. Field placement is suppressed for
 *                CC recipients in the studio UI.
 *
 * Backwards-compat: existing signers without `kind` are treated as 'signer'.
 */
export type SignerKind = 'signer' | 'witness' | 'cc';

export interface SignerFormData {
  name: string;
  email: string;
  /** P5.1 — required when `smsOptIn` is true. Stored E.164 or
   *  locale-normalised by the server on submit. */
  phone?: string;
  role?: string;
  order?: number;
  otpRequired: boolean;
  accessCode?: string;
  clientId?: string;
  isSystemClient?: boolean;
  /** Defaults to 'signer' when omitted. */
  kind?: SignerKind;
  /** P5.1 — per-signer opt-in for SMS OTP / invite / reminder. Off by
   *  default (POPIA s69). UI only enables when a phone is present. */
  smsOptIn?: boolean;
}

// ============================================================================
// FIELD VALIDATION METADATA (PHASE 2)
// ============================================================================

/**
 * Built-in text-field formats. These drive both the client-side input mask /
 * validation in the SigningWorkflow and the studio's validation editor.
 *
 * 'sa_id' is wired up end-to-end in Phase 1: SignerWorkflow masks input as
 * `000000 0000 0 00` and validates the Luhn checksum.
 */
export type TextFieldFormat =
  | 'free_text'
  | 'sa_id'
  | 'sa_mobile'
  | 'sa_postal_code'
  | 'number'
  | 'email'
  | 'phone'
  | 'custom_regex';

/**
 * Field-level validation rules persisted on `EsignField.metadata`. All fields
 * are optional; the SigningWorkflow only enforces what's present.
 */
export interface FieldValidationMetadata {
  format?: TextFieldFormat;
  minLength?: number;
  maxLength?: number;
  /** Custom regex source (without delimiters or flags). Required when
   *  `format === 'custom_regex'`. */
  pattern?: string;
  /** Free-text help shown next to the input dialog. */
  helpText?: string;
}

/**
 * P3.6 — Pre-fill metadata persisted on `EsignField.metadata.prefill`.
 *
 * The studio binds a field to one of a fixed set of CRM-derived tokens.
 * At envelope-send time the backend resolves the token against the
 * targeted signer's client record and stamps the resolved value into
 * `EsignField.value`. The signer view honours `locked`:
 *   - `locked: true`  → value is rendered read-only (think "name" /
 *                       "ID number" — must match the CRM record).
 *   - `locked: false` → value is rendered as the input default; the
 *                       signer can edit before submitting.
 *
 * The token list is intentionally small and explicit so a future audit
 * can prove no PII was ever inferred / hallucinated.
 */
export type PrefillToken =
  | 'client.name'
  | 'client.email'
  | 'client.phone'
  | 'client.id_number'
  | 'client.address'
  | 'envelope.advice_case_id'
  | 'envelope.product_id'
  | 'envelope.request_id';

export interface PrefillMetadata {
  token: PrefillToken;
  /** When true the signer cannot edit the resolved value. */
  locked: boolean;
}

// ---------------------------------------------------------------------------
// P4.5 / P4.6 — Conditional & Calculated field metadata
// ---------------------------------------------------------------------------
//
// Both live on `EsignField.metadata` under reserved keys so they round-trip
// through every existing read/write path without a schema change. The
// signer-side rule engine (`utils/esignRuleEngine.ts`) evaluates these
// against the signer's in-flight values and surfaces visibility / value to
// the renderer. The required-field gate from Phase 1 honours visibility:
// hidden fields are never blocking.

/**
 * Boolean / value comparison used by `ConditionalRule`. Kept intentionally
 * tiny so it can be safely evaluated without a real expression parser.
 */
export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'is_checked'
  | 'is_unchecked'
  | 'is_filled'
  | 'is_empty';

export interface ConditionalRule {
  /** Field id that controls visibility. Must reference another field on
   *  the same envelope and (recommended) the same signer. */
  sourceFieldId: string;
  operator: ConditionalOperator;
  /** Required for `equals` / `not_equals`. Compared as strings; checkbox
   *  fields use 'true' / 'false'. */
  value?: string;
}

export interface ConditionalMetadata {
  /** All rules must pass for the field to be visible. (AND semantics.)
   *  Empty array = always visible (default). */
  rules: ConditionalRule[];
  /** When the field becomes hidden, optionally clear its value so a
   *  later toggle of the source doesn't surface a stale answer. */
  clearOnHide?: boolean;
}

/**
 * Tokens recognised by the formula evaluator. Identifiers are
 * `{field:<id>}` references that resolve to that field's current
 * (numeric) value. Operators are limited to + - * / and parentheses;
 * functions allowed: SUM, MIN, MAX, ROUND, IF (3-arg).
 *
 * Calculated fields are rendered read-only and are excluded from the
 * required-field gate (their value is derived, not entered).
 */
export interface CalculatedMetadata {
  formula: string;
  /** Decimal places for the displayed result. Default 2. */
  precision?: number;
  /** Optional currency / unit prefix for display only (e.g. "R "). */
  prefix?: string;
}

// ---------------------------------------------------------------------------
// P4.7 — Bulk-send "campaigns"
// ---------------------------------------------------------------------------

// Shapes mirror the server records in
// src/supabase/functions/server/esign-campaign-service.ts so dispatch
// loops can iterate `results` and report each row's outcome without
// any case-conversion middleware.

export type CampaignStatus = 'draft' | 'sending' | 'partial' | 'sent' | 'cancelled';

export interface CampaignRecipientResult {
  rowId: string;
  envelopeId: string | null;
  status: 'queued' | 'sent' | 'failed' | 'cancelled';
  errorMessage?: string;
  signers: Array<{ name: string; email: string; role?: string; order: number }>;
}

export interface CampaignRecord {
  id: string;
  firmId: string;
  templateId: string;
  templateVersion: number;
  title: string;
  message?: string;
  expiryDays: number;
  status: CampaignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  results: CampaignRecipientResult[];
}

// ---------------------------------------------------------------------------
// P4.8 — Packet workflows
// ---------------------------------------------------------------------------
// Shapes match the server records (see src/supabase/functions/server/
// esign-types.ts) so the API responses can be consumed without any
// case-conversion middleware.

export interface PacketStep {
  templateId: string;
  /** Snapshot the version at the time the packet was authored so packet
   *  runs are reproducible even if the template is later edited. */
  templateVersion: number;
  /** Optional human label used in the dashboard; defaults to template name. */
  label?: string;
}

export interface PacketRecord {
  id: string;
  firm_id: string;
  name: string;
  description?: string;
  steps: PacketStep[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export type PacketRunStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

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

export interface PacketRunRecipient {
  name: string;
  email: string;
  role?: string;
  order: number;
}

export interface PacketRunRecord {
  id: string;
  firm_id: string;
  packet_id: string;
  recipients: PacketRunRecipient[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  status: PacketRunStatus;
  current_step_index: number;
  steps: PacketRunStepRecord[];
}

export interface FieldFormData {
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  signerId?: string;
}

export interface EnvelopeCreateData {
  title: string;
  clientId: string;
  file: File;
  signers: SignerFormData[];
  fields?: FieldFormData[];
  expiryDays?: number;
  message?: string;
  signingMode?: SigningMode;
  adviceCaseId?: string;
  requestId?: string;
  productId?: string;
  householdId?: string;
}

export interface EnvelopeFilters {
  status?: EnvelopeStatus[];
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface SigningProgress {
  totalSigners: number;
  signedCount: number;
  pendingCount: number;
  percentComplete: number;
  isComplete: boolean;
}

export interface EnvelopeStats {
  total: number;
  draft: number;
  sent: number;
  completed: number;
  expired: number;
  rejected: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface EsignApiError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface EsignValidationError {
  field: string;
  message: string;
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isEnvelopeComplete(envelope: EsignEnvelope): boolean {
  return envelope.status === 'completed';
}

export function isEnvelopePending(envelope: EsignEnvelope): boolean {
  return ['sent', 'viewed', 'partially_signed'].includes(envelope.status);
}

export function isEnvelopeExpired(envelope: EsignEnvelope): boolean {
  if (!envelope.expires_at) return false;
  return new Date(envelope.expires_at) < new Date();
}

export function canEnvelopeBeEdited(envelope: EsignEnvelope): boolean {
  return envelope.status === 'draft';
}

export function canEnvelopeBeSent(envelope: EsignEnvelope): boolean {
  return envelope.status === 'draft' && 
         envelope.signers && 
         envelope.signers.length > 0;
}

export function isSignerPending(signer: EsignSigner): boolean {
  return ['pending', 'viewed', 'otp_verified'].includes(signer.status);
}

export function hasSignerSigned(signer: EsignSigner): boolean {
  return signer.status === 'signed';
}

export function hasSignerRejected(signer: EsignSigner): boolean {
  return signer.status === 'rejected';
}

// ============================================================================
// STATUS HELPERS (§7.1 — Config-driven, delegated to constants)
// ============================================================================

import {
  ENVELOPE_STATUS_CONFIG,
  SIGNER_STATUS_CONFIG,
} from './constants';

export function getEnvelopeStatusColor(status: EnvelopeStatus): string {
  return ENVELOPE_STATUS_CONFIG[status]?.badgeClass ?? 'bg-gray-100 text-gray-800';
}

export function getEnvelopeStatusLabel(status: EnvelopeStatus): string {
  return ENVELOPE_STATUS_CONFIG[status]?.label ?? status;
}

export function getSignerStatusColor(status: SignerStatus): string {
  return SIGNER_STATUS_CONFIG[status]?.badgeClass ?? 'bg-gray-100 text-gray-800';
}

export function getSignerStatusLabel(status: SignerStatus): string {
  return SIGNER_STATUS_CONFIG[status]?.label ?? status;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

export function formatEnvelopeDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatEnvelopeDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDaysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

export function isExpiringSoon(expiresAt: string | null, daysThreshold = 3): boolean {
  const daysUntilExpiry = getDaysUntilExpiry(expiresAt);
  return daysUntilExpiry !== null && daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
}

// ============================================================================
// AUTOMATION & REMINDER TYPES
// ============================================================================

export interface ReminderConfig {
  auto_remind: boolean;
  /** P5.3 — cadence strategy. Defaults to `escalating` on the server. */
  schedule?: 'fixed' | 'escalating';
  /** Used when `schedule === 'fixed'`. Days between reminders. */
  remind_interval_days: number;
  /** Upper bound on reminders per signer (both modes). */
  max_reminders: number;
  /** Days before expiry that the urgent reminder fires. */
  remind_before_expiry_days: number;
  /** P5.3 — offsets in days since invitation for the escalating schedule. */
  escalation_offsets_days?: number[];
}

// ============================================================================
// TEMPLATE TYPES (PHASE 4)
// ============================================================================

export interface TemplateRecipient {
  name: string;
  email: string;
  role?: string;
  order: number;
  otpRequired: boolean;
  accessCode?: string;
  kind?: 'signer' | 'witness' | 'cc';
}

export interface TemplateDocument {
  documentId: string;
  order: number;
  displayName: string;
  originalFilename: string;
  pageCount: number;
  storagePath: string;
}

export interface TemplateField {
  type: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  /** Index into the recipients array */
  recipientIndex: number;
  /** Template-owned source document this field belongs to. */
  documentId?: string;
  metadata?: Record<string, unknown>;
}

export interface EsignTemplateRecord {
  id: string;
  name: string;
  description?: string;
  category?: string;
  signingMode: SigningMode;
  defaultMessage?: string;
  defaultExpiryDays: number;
  recipients: TemplateRecipient[];
  documents: TemplateDocument[];
  fields: TemplateField[];
  usageCount: number;
  /**
   * P4.2 — Monotonically increasing version. New templates start at 1.
   * Substantive edits (recipients, fields, signing mode, default
   * expiry) snapshot the outgoing version into history and bump this
   * counter. Envelopes pin the version they were materialised from.
   */
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  signingMode?: SigningMode;
  defaultMessage?: string;
  defaultExpiryDays?: number;
  recipients?: TemplateRecipient[];
  documents?: TemplateDocument[];
  fields?: TemplateField[];
  /** If provided, template is created from this envelope's config */
  fromEnvelopeId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  category?: string;
  signingMode?: SigningMode;
  defaultMessage?: string;
  defaultExpiryDays?: number;
  recipients?: TemplateRecipient[];
  documents?: TemplateDocument[];
  fields?: TemplateField[];
}

/** Template category presets for the admin panel */
export const TEMPLATE_CATEGORIES = [
  'Client Onboarding',
  'Policy Application',
  'Compliance',
  'Investment',
  'Insurance',
  'Estate Planning',
  'General',
  'Other',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];
