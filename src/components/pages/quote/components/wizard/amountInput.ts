/**
 * Input mask for the rand-amount fields in the quote wizards.
 *
 * These format what the visitor is TYPING, not a stored value: every
 * non-digit is dropped and the digits are grouped with commas ("1250000" or
 * "R1 250 000" both become "1,250,000"). There is no "R" and no decimals,
 * because the field's label carries the currency and the wizards ask for
 * whole rands. For displaying a stored amount use utils/currencyFormatter.
 */

/** Keep the digits and group them in threes: "R 12500" becomes "12,500". */
export function formatAmountInput(value: string): string {
  const num = value.replace(/[^\d]/g, '');
  if (!num) return '';
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The number a masked amount stands for. Empty or digit-free input is 0. */
export function parseAmountInput(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? Number(cleaned) : 0;
}
