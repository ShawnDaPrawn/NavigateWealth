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
 */
export type FieldType = 
  | 'signature'
  | 'initials'
  | 'text'
  | 'date'
  | 'checkbox';

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

  // Lightweight signer config saved on draft envelopes (persisted during
  // recipients → prepare transition so "Continue Editing" can restore them).
  // NOT the same as the real EsignSigner records created at invite-send time.
  draft_signers?: Array<{
    name: string;
    email: string;
    role: string;
    order: number;
    otpRequired?: boolean;
    accessCode?: string;
    clientId?: string;
    isSystemClient?: boolean;
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
  };
}

export interface UploadDocumentResponse {
  envelope: EsignEnvelope;
}

export interface SendInvitesRequest {
  signers: Array<{
    id?: string;
    name: string;
    email: string;
    role?: string;
    order?: number;
    otpRequired?: boolean;
    accessCode?: string;
    clientId?: string;
  }>;
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

export interface SignerFormData {
  name: string;
  email: string;
  role?: string;
  order?: number;
  otpRequired: boolean;
  accessCode?: string;
  clientId?: string;
  isSystemClient?: boolean;
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
  remind_interval_days: number;
  max_reminders: number;
  remind_before_expiry_days: number;
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
  fields: TemplateField[];
  usageCount: number;
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