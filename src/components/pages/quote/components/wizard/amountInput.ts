/**
 * The rand-amount fields in the quote wizards keep their value as a
 * comma-grouped string ("45,000", "45,000.50"), which the review steps show
 * as-is and the submit handlers turn into a number with `parseAmountInput`.
 *
 * The fields themselves are CurrencyInputField, which formats in the box while
 * the visitor types (and draws the "R"). `formatAmountInput` turns what the
 * field reports into the string the wizard stores. For displaying a stored
 * number use utils/currencyFormatter.
 */
import { finishTypedAmount, formatAmountWhileTyping } from '../../../../../utils/currencyFormatter';

/**
 * Group the rands in threes and keep up to two decimals, with no leading zeros:
 * "R 12500" becomes "12,500", "1250000.5" becomes "1,250,000.50", "0265"
 * becomes "265". A trailing "." is dropped, so the stored string always reads
 * as a finished amount.
 */
export function formatAmountInput(value: string): string {
  return finishTypedAmount(formatAmountWhileTyping(value, { decimals: 2, grouping: true }), {
    decimals: 2,
    padDecimals: true,
  });
}

/** The number a stored amount stands for ("45,000.50" is 45000.5). Empty or digit-free input is 0. */
export function parseAmountInput(value: string): number {
  const parsed = parseFloat(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
