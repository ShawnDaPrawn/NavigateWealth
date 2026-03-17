/**
 * E-Signature Helper Utilities
 * Common utility functions for e-signature operations
 */

import type {
  EsignEnvelope,
  EsignSigner,
  EsignField,
  SigningProgress,
  EnvelopeStats,
  FieldType,
} from '../types';

// ==================== PROGRESS CALCULATION ====================

/**
 * Calculate signing progress for an envelope
 */
export function calculateSigningProgress(envelope: EsignEnvelope): SigningProgress {
  const signers = envelope.signers || [];
  const totalSigners = signers.length;
  const signedCount = signers.filter(s => s.status === 'signed').length;
  const pendingCount = signers.filter(s => ['pending', 'viewed', 'otp_verified'].includes(s.status)).length;
  const percentComplete = totalSigners > 0 ? Math.round((signedCount / totalSigners) * 100) : 0;
  const isComplete = totalSigners > 0 && signedCount === totalSigners;

  return {
    totalSigners,
    signedCount,
    pendingCount,
    percentComplete,
    isComplete,
  };
}

/**
 * Calculate envelope statistics
 */
export function calculateEnvelopeStats(envelopes: EsignEnvelope[]): EnvelopeStats {
  return {
    total: envelopes.length,
    draft: envelopes.filter(e => e.status === 'draft').length,
    sent: envelopes.filter(e => ['sent', 'viewed', 'partially_signed'].includes(e.status)).length,
    completed: envelopes.filter(e => e.status === 'completed').length,
    expired: envelopes.filter(e => e.status === 'expired').length,
    rejected: envelopes.filter(e => e.status === 'rejected').length,
  };
}

// ==================== VALIDATION ====================

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate PDF file
 */
export function isValidPDF(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File must be a PDF' };
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  // Check minimum size (1KB)
  if (file.size < 1024) {
    return { valid: false, error: 'File is too small to be a valid PDF' };
  }

  return { valid: true };
}

/**
 * Validate signer data
 */
export function validateSigner(signer: {
  name: string;
  email: string;
  order?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!signer.name || signer.name.trim().length === 0) {
    errors.push('Signer name is required');
  }

  if (!signer.email || signer.email.trim().length === 0) {
    errors.push('Signer email is required');
  } else if (!isValidEmail(signer.email)) {
    errors.push('Invalid email address');
  }

  if (signer.order !== undefined && signer.order < 1) {
    errors.push('Signer order must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate envelope has required data
 */
export function canSendEnvelope(envelope: EsignEnvelope): { canSend: boolean; reason?: string } {
  if (envelope.status !== 'draft') {
    return { canSend: false, reason: 'Envelope is not in draft status' };
  }

  const signers = envelope.signers || [];
  if (signers.length === 0) {
    return { canSend: false, reason: 'At least one signer is required' };
  }

  const fields = envelope.fields || [];
  if (fields.length === 0) {
    return { canSend: false, reason: 'At least one field is required' };
  }

  // Check all signers have at least one field
  for (const signer of signers) {
    const signerFields = fields.filter(f => f.signer_id === signer.id);
    if (signerFields.length === 0) {
      return { canSend: false, reason: `Signer "${signer.name}" has no assigned fields` };
    }
  }

  return { canSend: true };
}

// ==================== SORTING & FILTERING ====================

/**
 * Sort signers by order
 */
export function sortSignersByOrder(signers: EsignSigner[]): EsignSigner[] {
  return [...signers].sort((a, b) => a.order - b.order);
}

/**
 * Group fields by page
 */
export function groupFieldsByPage(fields: EsignField[]): Map<number, EsignField[]> {
  const grouped = new Map<number, EsignField[]>();
  
  for (const field of fields) {
    const pageFields = grouped.get(field.page) || [];
    pageFields.push(field);
    grouped.set(field.page, pageFields);
  }
  
  return grouped;
}

/**
 * Get fields for a specific signer
 */
export function getSignerFields(fields: EsignField[], signerId: string): EsignField[] {
  return fields.filter(f => f.signer_id === signerId);
}

/**
 * Filter envelopes by status
 */
export function filterEnvelopesByStatus(
  envelopes: EsignEnvelope[],
  statuses: string[]
): EsignEnvelope[] {
  if (statuses.length === 0) return envelopes;
  return envelopes.filter(e => statuses.includes(e.status));
}

/**
 * Sort envelopes by date
 */
export function sortEnvelopesByDate(
  envelopes: EsignEnvelope[],
  direction: 'asc' | 'desc' = 'desc'
): EsignEnvelope[] {
  return [...envelopes].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return direction === 'asc' ? dateA - dateB : dateB - dateA;
  });
}

// ==================== FORMATTING ====================

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format signer name with role
 */
export function formatSignerName(signer: EsignSigner): string {
  return signer.role ? `${signer.name} (${signer.role})` : signer.name;
}

/**
 * Get next signer in order
 */
export function getNextSigner(signers: EsignSigner[]): EsignSigner | null {
  const sorted = sortSignersByOrder(signers);
  return sorted.find(s => ['pending', 'viewed', 'otp_verified'].includes(s.status)) || null;
}

/**
 * Get progress message
 */
export function getProgressMessage(envelope: EsignEnvelope): string {
  const progress = calculateSigningProgress(envelope);
  
  if (progress.isComplete) {
    return 'All signers have completed signing';
  }
  
  if (progress.signedCount === 0) {
    return `Waiting for ${progress.totalSigners} signer${progress.totalSigners > 1 ? 's' : ''}`;
  }
  
  return `${progress.signedCount} of ${progress.totalSigners} signed`;
}

// ==================== FIELD HELPERS ====================

/**
 * Get field icon based on type
 */
export function getFieldIcon(type: FieldType): string {
  switch (type) {
    case 'signature':
      return '✍️';
    case 'initials':
      return '📝';
    case 'text':
      return '📄';
    case 'date':
      return '📅';
    case 'checkbox':
      return '☑️';
    default:
      return '📋';
  }
}

/**
 * Get field label
 */
export function getFieldLabel(type: FieldType): string {
  switch (type) {
    case 'signature':
      return 'Signature';
    case 'initials':
      return 'Initials';
    case 'text':
      return 'Text';
    case 'date':
      return 'Date';
    case 'checkbox':
      return 'Checkbox';
    default:
      return type;
  }
}

/**
 * Check if all required fields are filled
 */
export function areAllRequiredFieldsFilled(
  fields: EsignField[],
  signerId: string
): boolean {
  const signerFields = getSignerFields(fields, signerId);
  const requiredFields = signerFields.filter(f => f.required);
  
  return requiredFields.every(f => f.value !== null && f.value !== undefined && f.value !== '');
}

// ==================== URL HELPERS ====================

/**
 * Generate signing link for public access
 */
export function generateSigningLink(envelopeId: string, accessToken: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/sign/${envelopeId}/${accessToken}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

// ==================== DATE HELPERS ====================

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get expiry warning level
 */
export function getExpiryWarningLevel(
  expiresAt: string | null
): 'none' | 'info' | 'warning' | 'danger' {
  if (!expiresAt) return 'none';
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffMs <= 0) return 'danger'; // Expired
  if (diffHours <= 24) return 'danger'; // Less than 1 day
  if (diffHours <= 72) return 'warning'; // Less than 3 days
  if (diffHours <= 168) return 'info'; // Less than 7 days
  
  return 'none';
}

// ==================== COLOR HELPERS ====================

/**
 * Get progress bar color based on percentage
 */
export function getProgressColor(percent: number): string {
  if (percent === 0) return 'bg-gray-200';
  if (percent < 50) return 'bg-yellow-500';
  if (percent < 100) return 'bg-blue-500';
  return 'bg-green-500';
}

/**
 * Get expiry badge color
 */
export function getExpiryBadgeColor(expiresAt: string | null): string {
  const level = getExpiryWarningLevel(expiresAt);
  
  switch (level) {
    case 'danger':
      return 'bg-red-100 text-red-800';
    case 'warning':
      return 'bg-orange-100 text-orange-800';
    case 'info':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// ==================== ERROR HANDLING ====================

/**
 * Parse API error message
 */
export function parseApiError(error: unknown): string {
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return String((error as Record<string, unknown>).error);
  }
  
  return 'An unexpected error occurred';
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const message = parseApiError(error);
  
  // Common error translations
  const errorMappings: Record<string, string> = {
    'Unauthorized': 'You are not authorized to perform this action',
    'Invalid access token': 'Your signing link has expired or is invalid',
    'OTP has expired': 'Your verification code has expired. Please request a new one.',
    'Invalid OTP': 'The verification code you entered is incorrect',
    'Envelope not found': 'This document could not be found',
    'Signer not found': 'Signer information could not be found',
    'Upload failed': 'Failed to upload document. Please try again.',
  };
  
  return errorMappings[message] || message;
}