/**
 * Currency Formatting Utilities
 */

/**
 * Format number as South African Rand
 * Uses manual formatting for consistent comma-separated thousands
 * and dot-separated decimals across all platforms.
 */
export { formatCurrencyWhole as formatCurrency } from '../../../../../utils/currencyFormatter';

/**
 * Format number as percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}
