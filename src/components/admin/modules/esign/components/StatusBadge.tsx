/**
 * Status Badge Component (§7.1 — Config-driven)
 * Envelope and signer status as the board's pill (ES-Envelopes: .pill).
 * Labels come from ENVELOPE_STATUS_CONFIG / SIGNER_STATUS_CONFIG; the pill
 * colour follows what the status means for the sender.
 */

import { DsPill, type DsTone } from '../../../layout/page';
import type { EnvelopeStatus, SignerStatus } from '../types';
import { ENVELOPE_STATUS_CONFIG, SIGNER_STATUS_CONFIG } from '../constants';

interface StatusBadgeProps {
  status: EnvelopeStatus | SignerStatus;
  type: 'envelope' | 'signer';
  /** Kept for callers; the board's pills carry a dot, not an icon. */
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const TONE: Record<string, DsTone> = {
  draft: 'neutral',
  pending: 'neutral',
  sent: 'warn',
  viewed: 'warn',
  otp_verified: 'warn',
  partially_signed: 'warn',
  completing: 'info',
  completed: 'ok',
  signed: 'ok',
  declined: 'bad',
  rejected: 'bad',
  expired: 'bad',
  voided: 'bad',
};

/** "Partially Signed" → "Partially signed" (design system: sentence case). */
function sentenceCase(label: string | undefined): string {
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const config =
    type === 'envelope'
      ? ENVELOPE_STATUS_CONFIG[status as EnvelopeStatus]
      : SIGNER_STATUS_CONFIG[status as SignerStatus];
  const label = config?.label ?? status;
  if (!label) return null;
  return <DsPill tone={TONE[status] ?? 'info'}>{sentenceCase(label)}</DsPill>;
}
