/**
 * Treasury — Constants & formatting helpers
 *
 * Amounts are integer minor units (cents) everywhere; format only for display.
 */

export const ENDPOINTS = {
  FINANCIAL_ACCOUNT: '/treasury/financial-account',
  BALANCE: '/treasury/balance',
  PLATFORM_BALANCE: '/treasury/platform-balance',
  TRANSACTIONS: '/treasury/transactions',
  DEPOSIT: '/treasury/deposit',
  SEND: '/treasury/send',
} as const;

export const DEFAULT_CURRENCY = 'usd';

/** Format integer minor units as a currency string (e.g. 123456 → "$1,234.56"). */
export function formatMinor(amountMinor: number, currency = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    // Unknown currency code — fall back to a plain number with the code suffix.
    return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** Parse a user-entered major-unit amount ("1,234.56") into integer minor units. */
export function parseToMinor(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const major = Number(cleaned);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}

/** Human label for a Treasury transaction status. */
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}
