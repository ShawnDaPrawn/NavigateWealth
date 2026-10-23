import * as React from 'react';
import { FormattedNumberInput, type FormattedNumberInputProps } from './formatted-number-input';

/**
 * CurrencyInputField — a rand amount.
 *
 * Shows an "R" prefix and formats while you type, keystroke by keystroke: a
 * comma every three digits and "." for cents (two at most) appear in the box as
 * they are typed, never afterwards; no leading zeros. Zero shows as an empty
 * field with a "0.00" placeholder, so the first digit typed is the amount.
 *
 * Every rand amount the user types goes through this component; a native
 * `type="number"` input is a lint error (see eslint.config.mjs).
 *
 * Works with react-hook-form (`{...field}`; the event carries the raw number
 * string, e.g. "1234.5") or with number state via `onValueChange`.
 */
export const CurrencyInputField = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps & { allowNegative?: boolean }
>(({ placeholder = '0.00', allowNegative = false, ...props }, ref) => (
  <FormattedNumberInput
    ref={ref}
    placeholder={placeholder}
    config={{
      decimals: 2,
      grouping: true,
      hideZero: true,
      padDecimals: true,
      allowNegative,
      prefix: 'R',
    }}
    {...props}
  />
));

CurrencyInputField.displayName = 'CurrencyInputField';
