/**
 * E-Signature Module Constants
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized constants for E-Signature module including status labels, colors,
 * field types, and configuration values.
 */

import type { EnvelopeStatus, SignerStatus, FieldType } from './types';
import {
  FileText,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// STATUS CONFIG (§5.3 — Config-driven status indicators, §8.3 colour vocabulary)
// ============================================================================

/**
 * Single-source-of-truth configuration for a status indicator.
 * Drives label, badge styling, dot colour, and icon for both
 * StatusBadge and any status-derived UI.
 */
export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
  icon: LucideIcon;
}

/**
 * Unified envelope status configuration.
 * One map replaces ENVELOPE_STATUS_LABELS, ENVELOPE_STATUS_COLORS,
 * and the switch-based getStatusIcon() in StatusBadge.
 */
export const ENVELOPE_STATUS_CONFIG: Record<EnvelopeStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
    dotClass: 'bg-gray-500',
    icon: FileText,
  },
  sent: {
    label: 'Sent',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
    icon: Send,
  },
  viewed: {
    label: 'Viewed',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dotClass: 'bg-cyan-500',
    icon: Eye,
  },
  partially_signed: {
    label: 'Partially Signed',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    dotClass: 'bg-yellow-500',
    icon: Clock,
  },
  // P7.5 — transient state during background completion (burn-in,
  // certificate merge, PKCS#7 seal, upload). Surfaced to the sender
  // so the UI doesn't appear to regress ("Partially Signed") while
  // the queue finishes the heavy work.
  completing: {
    label: 'Finalising',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    dotClass: 'bg-green-500',
    icon: CheckCircle2,
  },
  declined: {
    label: 'Declined',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
    icon: XCircle,
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
    icon: XCircle,
  },
  expired: {
    label: 'Expired',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    dotClass: 'bg-orange-500',
    icon: AlertCircle,
  },
  voided: {
    label: 'Voided',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-300',
    dotClass: 'bg-gray-400',
    icon: Ban,
  },
} as const;

/**
 * Unified signer status configuration.
 */
export const SIGNER_STATUS_CONFIG: Record<SignerStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
    dotClass: 'bg-gray-500',
    icon: Clock,
  },
  sent: {
    label: 'Sent',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
    icon: Send,
  },
  viewed: {
    label: 'Viewed',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    dotClass: 'bg-blue-500',
    icon: Eye,
  },
  otp_verified: {
    label: 'OTP Verified',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    dotClass: 'bg-cyan-500',
    icon: CheckCircle2,
  },
  signed: {
    label: 'Signed',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    dotClass: 'bg-green-500',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
    icon: XCircle,
  },
  declined: {
    label: 'Declined',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
    icon: XCircle,
  },
} as const;

// ============================================================================
// LEGACY FLAT MAPS (derived from config — kept for backward compatibility)
// ============================================================================

/** Human-readable labels for envelope statuses */
export const ENVELOPE_STATUS_LABELS: Record<EnvelopeStatus, string> =
  Object.fromEntries(Object.entries(ENVELOPE_STATUS_CONFIG).map(([k, v]) => [k, v.label])) as Record<EnvelopeStatus, string>;

/** Color classes for envelope statuses (Tailwind CSS) */
export const ENVELOPE_STATUS_COLORS: Record<EnvelopeStatus, string> =
  Object.fromEntries(Object.entries(ENVELOPE_STATUS_CONFIG).map(([k, v]) => [k, v.badgeClass])) as Record<EnvelopeStatus, string>;

/** Human-readable labels for signer statuses */
export const SIGNER_STATUS_LABELS: Record<SignerStatus, string> =
  Object.fromEntries(Object.entries(SIGNER_STATUS_CONFIG).map(([k, v]) => [k, v.label])) as Record<SignerStatus, string>;

/** Color classes for signer statuses (Tailwind CSS) */
export const SIGNER_STATUS_COLORS: Record<SignerStatus, string> =
  Object.fromEntries(Object.entries(SIGNER_STATUS_CONFIG).map(([k, v]) => [k, v.badgeClass])) as Record<SignerStatus, string>;

// ============================================================================
// FIELD TYPE CONSTANTS
// ============================================================================

/**
 * Human-readable labels for field types
 */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  text: 'Text',
  date: 'Date',
  checkbox: 'Checkbox',
};

/**
 * Icons for field types (lucide-react icon names)
 */
export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  signature: 'Pen',
  initials: 'Type',
  text: 'FileText',
  date: 'Calendar',
  checkbox: 'CheckSquare',
};

/**
 * Color classes for field types (Tailwind CSS)
 */
export const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  signature: 'bg-purple-100 text-purple-800 border-purple-200',
  initials: 'bg-blue-100 text-blue-800 border-blue-200',
  text: 'bg-green-100 text-green-800 border-green-200',
  date: 'bg-orange-100 text-orange-800 border-orange-200',
  checkbox: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default expiry days for new envelopes
 */
export const DEFAULT_EXPIRY_DAYS = 30;

/**
 * Default page size for pagination
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Default OTP length
 */
export const DEFAULT_OTP_LENGTH = 6;

/**
 * OTP expiry time in minutes
 */
export const OTP_EXPIRY_MINUTES = 10;

/**
 * Maximum file size for uploads (10MB)
 */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Allowed file types for document upload
 */
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
] as const;

/**
 * Default field dimensions (in pixels)
 */
export const DEFAULT_FIELD_WIDTH = 200;
export const DEFAULT_FIELD_HEIGHT = 50;
export const DEFAULT_SIGNATURE_HEIGHT = 80;
export const DEFAULT_CHECKBOX_SIZE = 20;

/**
 * Default filter values
 */
export const DEFAULT_FILTERS = {
  status: [],
  clientId: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  search: '',
} as const;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Stale time for React Query cache (30 seconds)
 */
export const QUERY_STALE_TIME = 30000;

/**
 * Garbage collection time for React Query cache (5 minutes)
 */
export const QUERY_GC_TIME = 5 * 60 * 1000;

/**
 * Debounce time for search input (milliseconds)
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Days threshold for "expiring soon" warning
 */
export const EXPIRING_SOON_DAYS = 3;

/**
 * Maximum number of signers per envelope
 */
export const MAX_SIGNERS_PER_ENVELOPE = 10;

/**
 * Maximum number of fields per envelope
 */
export const MAX_FIELDS_PER_ENVELOPE = 100;

// ============================================================================
// SIGNER ROLE CONSTANTS
// ============================================================================

/**
 * Predefined signer roles for the e-signature workflow.
 * Ordered roles enable sequential signing: e.g., First Life Assured signs first,
 * then Premium Payer receives the document to sign.
 */
export const SIGNER_ROLES = [
  { value: 'first_life_assured', label: 'First Life Assured' },
  { value: 'second_life_assured', label: 'Second Life Assured' },
  { value: 'premium_payer', label: 'Premium Payer' },
  { value: 'policy_owner', label: 'Policy Owner' },
  { value: 'witness', label: 'Witness' },
  { value: 'financial_adviser', label: 'Financial Adviser' },
  { value: 'beneficiary', label: 'Beneficiary' },
  { value: 'cessionary', label: 'Cessionary' },
  { value: 'signer', label: 'Signer' },
] as const;

/**
 * Signer color palette for visual differentiation in the field editor.
 * Each signer gets a unique color to easily identify which fields belong to which signer.
 */
export const SIGNER_COLORS = [
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', hex: '#f59e0b' },
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', hex: '#3b82f6' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', hex: '#10b981' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', hex: '#8b5cf6' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', hex: '#ec4899' },
  { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', hex: '#ef4444' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', hex: '#06b6d4' },
  { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300', hex: '#84cc16' },
] as const;

/**
 * Maximum signers currently allowed per envelope.
 * Supports sequential signing: each signer receives notification after the previous completes.
 */
export const CURRENT_MAX_SIGNERS = 4;

// ============================================================================
// UI MESSAGES
// ============================================================================

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  ENVELOPE_CREATED: 'Envelope created successfully',
  ENVELOPE_SENT: 'Envelope sent to signers',
  ENVELOPE_VOIDED: 'Envelope voided successfully',
  SIGNATURE_SUBMITTED: 'Signature submitted successfully',
  TEMPLATE_SAVED: 'Template saved successfully',
  FIELDS_SAVED: 'Fields saved successfully',
  OTP_SENT: 'OTP sent successfully',
  OTP_VERIFIED: 'OTP verified successfully',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  UPLOAD_FAILED: 'Failed to upload document',
  SEND_FAILED: 'Failed to send invitations',
  VOID_FAILED: 'Failed to void envelope',
  SIGNATURE_FAILED: 'Failed to submit signature',
  TEMPLATE_FAILED: 'Failed to save template',
  FIELDS_FAILED: 'Failed to save fields',
  OTP_SEND_FAILED: 'Failed to send OTP',
  OTP_VERIFY_FAILED: 'Failed to verify OTP',
  INVALID_FILE_TYPE: 'Invalid file type. Only PDF files are allowed.',
  FILE_TOO_LARGE: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
  MAX_SIGNERS_EXCEEDED: `Maximum ${MAX_SIGNERS_PER_ENVELOPE} signers allowed`,
  ENVELOPE_NOT_FOUND: 'Envelope not found',
  UNAUTHORIZED: 'You are not authorized to perform this action',
} as const;

/**
 * Info messages
 */
export const INFO_MESSAGES = {
  EMPTY_STATE: 'No envelopes found',
  LOADING: 'Loading envelopes...',
  PROCESSING: 'Processing...',
  SELECT_DOCUMENT: 'Select a PDF document to upload',
  ADD_SIGNERS: 'Add at least one signer to continue',
  PLACE_FIELDS: 'Place signature fields on the document',
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Email validation regex
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Minimum title length
 */
export const MIN_TITLE_LENGTH = 3;

/**
 * Maximum title length
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * Maximum message length
 */
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * Maximum rejection reason length
 */
export const MAX_REJECTION_REASON_LENGTH = 500;