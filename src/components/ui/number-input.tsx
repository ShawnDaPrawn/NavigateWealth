import * as React from 'react';
import { FormattedNumberInput, type FormattedNumberInputProps } from './formatted-number-input';

/**
 * NumberInputField — a plain number (an age, a count, a number of years, a
 * percentage).
 *
 * Digits only (plus one "." when `decimals` allows it), no leading zeros, and a
 * field showing 0 empties when focused, so typing 3 gives 3 rather than 03.
 * Use CurrencyInputField for rand amounts.
 *
 * Every numeric field in the app is this or CurrencyInputField; a native
 * `type="number"` input is a lint error (see eslint.config.mjs).
 */
export const NumberInputField = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps & { decimals?: number; allowNegative?: boolean }
>(({ decimals = 0, allowNegative = false, ...props }, ref) => (
  <FormattedNumberInput
    ref={ref}
    config={{ decimals, grouping: false, hideZero: false, padDecimals: false, allowNegative }}
    {...props}
  />
));

NumberInputField.displayName = 'NumberInputField';
