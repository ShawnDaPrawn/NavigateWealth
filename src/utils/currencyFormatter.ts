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

import { formatCurrency as formatSharedCurrency } from '../shared/formatting/format';

/**
 * Format a number as currency for display (read-only contexts)
 * Output: "R1,234,567.89"
 *
 * Delegates to the shared formatter, which is the same manual formatting
 * (no Intl, so output is identical on every platform). Kept as a one-argument
 * function on purpose: the shared version's second parameter is a currency
 * code, so passing it straight to `.map()` would read the array index as one.
 */
export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null) return 'R0.00';
  return formatSharedCurrency(amount);
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
    processedValue =
      cleaned.substring(0, firstDecimalIndex + 1) +
      cleaned.substring(firstDecimalIndex + 1).replace(/\./g, '');
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

// ── Typing into an amount field ──────────────────────────────────────────────
//
// The rules every currency (and numeric) input applies keystroke by keystroke,
// so an amount looks the same while it is typed as when it is displayed:
//
//   - digits only, with a comma between every three digits of the rands;
//   - one "." starts the cents, at most `decimals` digits after it;
//   - no leading zeros: typing 265 into an empty or zero field gives 265, never
//     0265, and "." on its own becomes "0.";
//   - a leading "-" only where the field allows negative numbers.

export interface AmountTypingOptions {
  /** Digits allowed after the decimal point. 0 = whole numbers only. */
  decimals?: number;
  /** Comma between every three integer digits. */
  grouping?: boolean;
  /** Longest integer part accepted (keeps values inside float precision). */
  maxIntegerDigits?: number;
  /** Accept a leading "-". */
  allowNegative?: boolean;
}

const DEFAULT_TYPING: Required<AmountTypingOptions> = {
  decimals: 2,
  grouping: true,
  maxIntegerDigits: 13,
  allowNegative: false,
};

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats what has been typed into an amount field.
 * "0265" → "265" · "1234567.891" → "1,234,567.89" · "." → "0." · "12a3" → "123"
 */
export function formatAmountWhileTyping(input: string, options: AmountTypingOptions = {}): string {
  const { decimals, grouping, maxIntegerDigits, allowNegative } = { ...DEFAULT_TYPING, ...options };
  const sign = allowNegative && input.trimStart().startsWith('-') ? '-' : '';
  const kept = input.replace(decimals > 0 ? /[^\d.]/g : /\D/g, '');
  const dot = kept.indexOf('.');
  let integer = (dot === -1 ? kept : kept.slice(0, dot)).replace(/^0+(?=\d)/, '');
  integer = integer.slice(0, maxIntegerDigits);
  if (dot === -1) return sign + (grouping ? groupThousands(integer) : integer);
  const fraction = kept
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, decimals);
  return `${sign}${grouping ? groupThousands(integer || '0') : integer || '0'}.${fraction}`;
}

/** The number in a typed amount, or undefined while nothing has been typed. */
export function parseTypedAmount(formatted: string): number | undefined {
  const raw = formatted.replace(/,/g, '');
  if (raw === '' || raw === '.' || raw === '-' || raw === '-.') return undefined;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** A stored value (number or numeric string) as the field shows it. */
export function formatStoredAmount(
  value: number | string | null | undefined,
  options: AmountTypingOptions & { hideZero?: boolean; padDecimals?: boolean } = {},
): string {
  if (value === undefined || value === null || value === '') return '';
  const decimals = options.decimals ?? DEFAULT_TYPING.decimals;
  const parsed =
    typeof value === 'number' ? value : parseFloat(String(value).replace(/[R\s,]/g, ''));
  if (!Number.isFinite(parsed) || (parsed < 0 && !options.allowNegative)) return '';
  if (parsed === 0 && options.hideZero) return '';
  // Round first so float noise (0.1 + 0.2) never reaches the field.
  const factor = 10 ** decimals;
  const rounded = Math.round(parsed * factor) / factor;
  return finishTypedAmount(formatAmountWhileTyping(String(rounded), options), {
    decimals,
    padDecimals: options.padDecimals,
  });
}

/**
 * Tidies an amount: a trailing "." or a lone "-" goes, and with `padDecimals`
 * a started cents part is completed ("1,234.5" → "1,234.50"). Whole amounts
 * stay whole.
 */
export function finishTypedAmount(
  formatted: string,
  {
    decimals = DEFAULT_TYPING.decimals,
    padDecimals = false,
  }: AmountTypingOptions & {
    padDecimals?: boolean;
  } = {},
): string {
  if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);
  if (formatted === '-') return '';
  const dot = formatted.indexOf('.');
  if (!padDecimals || dot === -1) return formatted;
  return formatted.padEnd(dot + 1 + decimals, '0');
}

/** How many digits, points and signs `text` contains — what a caret position means. */
export function countAmountCharacters(text: string): number {
  return text.replace(/[^\d.-]/g, '').length;
}

/** The caret position in `formatted` just after its first `count` digits/points. */
export function caretAfterAmountCharacters(formatted: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ',' && ++seen === count) return i + 1;
  }
  return formatted.length;
}
