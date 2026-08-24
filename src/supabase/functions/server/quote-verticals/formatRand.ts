/**
 * Rand formatting, shared by every vertical's PDF and HTML rendering.
 */
/**
 * Format a number as South African Rand with comma-separated thousands.
 * Uses manual formatting for consistent output across all runtimes (Deno, browser).
 * Pattern: R1,234,567 (no decimals for whole amounts).
 *
 * §5.3 — Centralised currency formatting; avoids Intl.NumberFormat('en-ZA')
 * which produces space-separated thousands on some runtimes.
 */
export function formatRand(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (isNaN(num)) return 'R0';
  const isNeg = num < 0;
  const intPart = Math.round(Math.abs(num)).toString();
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${isNeg ? '-' : ''}R${withCommas}`;
}

// Health check
