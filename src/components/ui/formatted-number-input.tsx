import * as React from 'react';
import { Input } from './input';
import { cn } from './utils';
import {
  caretAfterAmountCharacters,
  countAmountCharacters,
  finishTypedAmount,
  formatAmountWhileTyping,
  formatStoredAmount,
  parseTypedAmount,
} from '../../utils/currencyFormatter';

/**
 * FormattedNumberInput — the text input behind CurrencyInputField and
 * NumberInputField.
 *
 * It formats as the user types (see formatAmountWhileTyping in
 * utils/currencyFormatter): no leading zeros, an optional "." with a limited
 * number of decimals, and optionally a comma every three digits. The caret
 * stays where the user is typing when separators move, and Backspace/Delete
 * step over a comma instead of getting stuck on it.
 *
 * Two ways to listen, so it drops into either kind of form:
 * - `onChange(event)` with `event.target.value` the raw number string
 *   ("1234.5", or "" when empty) — what react-hook-form's `field.onChange`
 *   and string-valued state expect;
 * - `onValueChange(number | undefined)` — for number-valued state.
 */
export type FormattedNumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'type'
> & {
  value?: number | string | null;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: number | undefined) => void;
};

interface FormatConfig {
  decimals: number;
  grouping: boolean;
  /** An empty field rather than "0" (the placeholder says 0). */
  hideZero: boolean;
  /** A stored 1234.5 shows as "1,234.50". What the user types is never re-padded. */
  padDecimals: boolean;
  /** Accept a leading "-". */
  allowNegative?: boolean;
  prefix?: string;
}

function sameAmount(a: number | undefined, b: number | undefined): boolean {
  return (a ?? 0) === (b ?? 0);
}

function toAmount(value: number | string | null | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const FormattedNumberInput = React.forwardRef<
  HTMLInputElement,
  FormattedNumberInputProps & { config: FormatConfig }
>(function FormattedNumberInput(
  { value, onChange, onValueChange, onFocus, onBlur, onKeyDown, config, className, ...props },
  forwardedRef,
) {
  const { decimals, grouping, hideZero, padDecimals, allowNegative = false, prefix } = config;
  const typing = { decimals, grouping, allowNegative };
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const caretRef = React.useRef<number | null>(null);
  const [display, setDisplay] = React.useState(() =>
    formatStoredAmount(value, { ...typing, hideZero, padDecimals }),
  );
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  // Follow the value when it changes from outside (prefill, reset, recalculation),
  // but never rewrite what the user is typing when it already means that number.
  React.useEffect(() => {
    setDisplay((current) =>
      sameAmount(toAmount(value), parseTypedAmount(current))
        ? current
        : formatStoredAmount(value, { decimals, grouping, allowNegative, hideZero, padDecimals }),
    );
  }, [value, decimals, grouping, allowNegative, hideZero, padDecimals]);

  React.useLayoutEffect(() => {
    const node = inputRef.current;
    if (caretRef.current === null || !node) return;
    if (document.activeElement === node) node.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const node = e.target;
    const caret = node.selectionStart ?? node.value.length;
    const next = formatAmountWhileTyping(node.value, typing);
    caretRef.current = caretAfterAmountCharacters(
      next,
      countAmountCharacters(node.value.slice(0, caret)),
    );
    setDisplay(next);
    rerender(); // place the caret even when the text did not change (a rejected key)

    onValueChange?.(parseTypedAmount(next));
    if (onChange) {
      const target = { name: node.name, id: node.id, type: 'text', value: next.replace(/,/g, '') };
      onChange({
        ...e,
        target,
        currentTarget: target,
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const node = e.currentTarget;
    const start = node.selectionStart;
    if (start !== null && start === node.selectionEnd) {
      // Step over a separator so the key deletes the digit beside it.
      if (e.key === 'Backspace' && start > 0 && node.value[start - 1] === ',') {
        node.setSelectionRange(start - 1, start - 1);
      } else if (e.key === 'Delete' && node.value[start] === ',') {
        node.setSelectionRange(start + 1, start + 1);
      }
    }
    onKeyDown?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // A field showing 0 starts empty, so the first digit typed is the number.
    if (display === '0') setDisplay('');
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // What was typed stays as typed (it is already formatted); only a dangling
    // "." or "-" goes. An emptied field shows the value again (0 → the placeholder).
    const finished = finishTypedAmount(display, { decimals });
    setDisplay(
      finished === ''
        ? formatStoredAmount(value, { decimals, grouping, allowNegative, hideZero, padDecimals })
        : finished,
    );
    onBlur?.(e);
  };

  const input = (
    <Input
      ref={setRefs}
      type="text"
      inputMode={allowNegative ? 'text' : decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={display}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(prefix && 'pl-8', className)}
      {...props}
    />
  );

  if (!prefix) return input;
  return (
    <div className="relative">
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none"
        aria-hidden="true"
      >
        {prefix}
      </span>
      {input}
    </div>
  );
});
