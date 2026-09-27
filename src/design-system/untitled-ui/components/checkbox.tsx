/**
 * Untitled UI "Checkbox" (Type = Checkbox | Radio) over "_Checkbox base".
 *
 * Figma variants → props:
 *   Size           sm | md                      → size
 *   Checked        True                         → checked / defaultChecked
 *   Indeterminate  True                         → indeterminate (Checkbox only)
 *   State          Disabled                     → disabled
 *                  Hover / Focused              → CSS
 *   Text, Supporting text                       → label, hint
 *
 * A real <input> sits invisibly over the drawn box, so forms, keyboard and
 * screen readers behave natively; the box is styled from its :checked,
 * :indeterminate, :focus-visible and :disabled states.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { Check, Minus } from '../icons/icons';

// Figma strokes the tick 1.67px at sm (12px icon) and 2px at md (14px icon).
const MARK_STROKE = { sm: 3.33, md: 3.43 } as const;

interface ChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  size?: 'sm' | 'md';
  label?: React.ReactNode;
  /** Supporting text under the label. */
  hint?: React.ReactNode;
  /** Class for the outer <label>. */
  wrapperClassName?: string;
}

function useMergedRef<T>(ref: React.ForwardedRef<T>, inner: React.MutableRefObject<T | null>) {
  return React.useCallback(
    (node: T | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref, inner],
  );
}

function Choice({
  kind,
  size = 'sm',
  label,
  hint,
  wrapperClassName,
  className,
  inputRef,
  id,
  children,
  ...props
}: ChoiceProps & {
  kind: 'checkbox' | 'radio';
  inputRef: React.Ref<HTMLInputElement>;
  children: React.ReactNode;
}) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;

  return (
    <label
      className={clsx('uui-choice', wrapperClassName)}
      data-type={kind}
      data-size={size}
      htmlFor={inputId}
    >
      <span className="uui-choice__control">
        <input
          ref={inputRef}
          id={inputId}
          type={kind}
          className={clsx('uui-choice__input', className)}
          aria-describedby={hint ? hintId : undefined}
          {...props}
        />
        <span className="uui-choice__box" aria-hidden="true">
          {children}
        </span>
      </span>
      {(label || hint) && (
        <span className="uui-choice__text">
          {label && <span className="uui-choice__label">{label}</span>}
          {hint && (
            <span className="uui-choice__hint" id={hintId}>
              {hint}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export interface CheckboxProps extends ChoiceProps {
  /** The dash state for a partly-selected group. */
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ indeterminate = false, size = 'sm', onChange, ...props }, ref) => {
    const inner = React.useRef<HTMLInputElement | null>(null);
    const setRef = useMergedRef(ref, inner);

    // `indeterminate` is a DOM property with no HTML attribute, and the browser
    // clears it on every click. Re-apply it after each render and after each
    // change, so the prop stays the source of truth even when a click does not
    // make the parent re-render.
    React.useEffect(() => {
      if (inner.current) inner.current.indeterminate = indeterminate;
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event);
      event.currentTarget.indeterminate = indeterminate;
    };

    return (
      <Choice kind="checkbox" size={size} inputRef={setRef} onChange={handleChange} {...props}>
        <Check className="uui-choice__mark" data-mark="check" strokeWidth={MARK_STROKE[size]} />
        <Minus className="uui-choice__mark" data-mark="minus" strokeWidth={MARK_STROKE[size]} />
      </Choice>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export type RadioProps = ChoiceProps;

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>((props, ref) => (
  <Choice kind="radio" inputRef={ref} {...props}>
    <span className="uui-choice__dot" />
  </Choice>
));
Radio.displayName = 'Radio';
