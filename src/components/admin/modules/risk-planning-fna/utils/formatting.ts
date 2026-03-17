/**
 * Currency Formatting Utilities
 */

/**
 * Format number as South African Rand
 * Uses manual formatting for consistent comma-separated thousands
 * and dot-separated decimals across all platforms.
 */
export function formatCurrency(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return 'R0';
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const intPart = Math.round(abs).toString();
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}`;
}

/**
 * Format number as percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}