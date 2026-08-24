/**
 * Types and formatters for the client security tab. Moved verbatim from
 * SecurityTab.tsx.
 */
import type { PendingEmailChangeSummary } from '../../../../../utils/auth/securityTypes';

export interface SecurityTabProps {
  selectedClient: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    accountStatus?: string;
  };
}

export interface SecurityStatus {
  suspended: boolean;
  suspendedAt?: string;
  suspendedBy?: string;
  suspendedReason?: string;
  deleted?: boolean;
  deletedAt?: string;
  closedBy?: string;
  closureReason?: string;
  twoFactorEnabled: boolean;
  passwordLastChanged?: string;
  pendingEmailChange?: PendingEmailChangeSummary | null;
}

export interface ActivityLogEntry {
  id: string;
  type: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export type SecurityAction =
  | 'suspend'
  | 'unsuspend'
  | 'password'
  | 'twoFactor'
  | 'emailRequest'
  | 'emailVerify'
  | 'emailResend'
  | null;

export function formatRelativeDate(dateString?: string) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

export function formatDateTime(dateString?: string) {
  if (!dateString) return 'Not available';
  return new Date(dateString).toLocaleString();
}

export function formatEventType(type: string) {
  return type
    .split('_')
    .map((word) => {
      if (word.toLowerCase() === '2fa') return '2FA';
      if (word.toLowerCase() === 'ip') return 'IP';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
