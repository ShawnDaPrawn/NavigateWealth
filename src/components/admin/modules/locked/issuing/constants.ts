/**
 * Issuing — Constants & helpers
 */

import type { SpendingLimitInterval } from './types';

export const ENDPOINTS = {
  CARDHOLDERS: '/issuing/cardholders',
  CARDS: '/issuing/cards',
  CARD_SECRETS: (cardId: string) => `/issuing/cards/${cardId}/secrets`,
} as const;

export const DEFAULT_CURRENCY = 'usd';

export const SPENDING_LIMIT_INTERVALS: Array<{ value: SpendingLimitInterval; label: string }> = [
  { value: 'per_authorization', label: 'Per authorization' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'all_time', label: 'All time' },
];

/** Format integer minor units as a currency string (e.g. 50000 → "$500.00"). */
export function formatMinor(amountMinor: number, currency = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** Parse a user-entered major-unit amount into integer minor units, or null. */
export function parseToMinor(value: string): number | null {
  if (value.includes('-')) return null;
  if (/[^0-9.,\s$€£]/.test(value)) return null;
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const major = Number(cleaned);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}

/** Humanise a snake_case status (e.g. "active" → "Active"). */
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
