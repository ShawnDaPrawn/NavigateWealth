/**
 * Centralized currency formatting utility for the Navigate Wealth application
 * 
 * Standard format: R1,234,567.89
 * - Thousand separators with commas (,)
 * - Decimal point for cents (.)
 * - Currency symbol: R (South African Rand)
 * 
 * All currency fields across the application MUST use these utilities
 * to ensure consistent formatting. See Guidelines §5.3, §8.3.
 */

/**
 * Format a number as currency for display (read-only contexts)
 * Output: "R1,234,567.89"
 * 
 * Uses manual formatting to guarantee consistent output across
 * all browser/platform Intl implementations.
 */
export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'R0.00';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  // Fixed 2 decimal places
  const fixed = absAmount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');

  // Add thousand separators (commas)
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${isNegative ? '-' : ''}R${withCommas}.${decPart}`;
}

/**
 * Format currency with no decimal places (whole rands)
 * Output: "R1,234,567"
 */
export function formatCurrencyWhole(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'R0';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const intPart = Math.round(absAmount).toString();
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${isNegative ? '-' : ''}R${withCommas}`;
}

/**
 * Parse a currency string back to a number
 * Handles: "R1,234.56", "1,234.56", "1234.56", "1234", etc.
 * Returns 0 for invalid input.
 */
export function parseCurrency(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (!value) return 0;

  // Remove R symbol, spaces, and commas
  const cleaned = value.replace(/[R\s,]/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a display-only value for a currency input field.
 * Used when the input is NOT focused (blur state).
 * Output: "1,234,567.89" (no R prefix — that's shown in the label)
 */
export function formatCurrencyDisplay(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '';

  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[R\s,]/g, ''));
  if (isNaN(num) || num === 0) return '';

  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${withCommas}.${decPart}`;
}

/**
 * Format input value while the user is typing in a currency field.
 * 
 * IMPORTANT: This should only be used on BLUR, not on every keystroke.
 * While the user is typing, show the raw value to avoid cursor issues.
 * On blur, call this to add thousand separators.
 * 
 * Accepts raw user input and returns formatted string.
 * Input: "1234567.89" → Output: "1,234,567.89"
 * Input: "1234" → Output: "1,234"
 */
export function formatCurrencyInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';

  const stringValue = typeof value === 'number' ? value.toString() : value;
  if (!stringValue) return '';

  // Remove all non-numeric characters except decimal point
  const cleaned = stringValue.replace(/[^\d.]/g, '');

  // Prevent multiple decimal points — keep only the first one
  const decimalCount = (cleaned.match(/\./g) || []).length;
  let processedValue = cleaned;
  if (decimalCount > 1) {
    const firstDecimalIndex = cleaned.indexOf('.');
    processedValue = cleaned.substring(0, firstDecimalIndex + 1) + cleaned.substring(firstDecimalIndex + 1).replace(/\./g, '');
  }

  // Split by decimal point
  const parts = processedValue.split('.');

  // Format the integer part with thousand separators
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (parts.length > 1) {
    // Limit decimal places to 2
    const decimalPart = parts[1].substring(0, 2);
    return `${integerPart}.${decimalPart}`;
  } else if (processedValue.endsWith('.')) {
    return `${integerPart}.`;
  } else {
    return integerPart;
  }
}

/**
 * Clean a formatted currency string to a raw numeric string ready for parseFloat.
 * "1,234,567.89" → "1234567.89"
 */
export function cleanCurrencyInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '0';

  const stringValue = typeof value === 'number' ? value.toString() : value;
  if (!stringValue) return '0';

  return stringValue.replace(/[R\s,]/g, '');
}
