/**
 * Untitled UI "Input field" (Type = Default) and "Textarea input field".
 *
 * Figma variants → props:
 *   Size         sm | md                               → size (Input only)
 *   Destructive  True                                  → invalid (hint shows as the error)
 *   State        Placeholder / Filled                  → the value
 *                Focused                               → CSS (:focus-within)
 *                Disabled                              → disabled
 *   Label, Hint text, Required *, Help icon, Icon      → label, hint, required, helpText, icon
 * The Leading/Trailing dropdown, Leading text, Payment, Tags and Trailing
 * button input types are not exported yet.
 */
import * as React from 'react';
import { clsx } from 'clsx';

import { AlertCircle, HelpCircle, type UntitledIcon } from '../icons/icons';

interface FieldChromeProps {
  label?: React.ReactNode;
  /** Shown under the field; becomes the error message when `invalid`. */
  hint?: React.ReactNode;
  /** The "?" icon's tooltip text. */
  helpText?: string;
  invalid?: boolean;
  /** Class for the outer wrapper (label + control + hint). */
  wrapperClassName?: string;
}

interface FieldProps extends FieldChromeProps {
  id: string;
  hintId: string;
  size: 'sm' | 'md';
  required?: boolean;
  multiline?: boolean;
  icon?: UntitledIcon;
  children: React.ReactNode;
}

function Field({
  id,
  hintId,
  size,
  label,
  hint,
  helpText,
  invalid,
  required,
  multiline,
  icon: Icon,
  wrapperClassName,
  children,
}: FieldProps) {
  const trailing = invalid ? (
    <AlertCircle className="uui-field__trailing-icon" />
  ) : helpText ? (
    <span className="uui-field__help" role="img" aria-label={helpText} title={helpText}>
      <HelpCircle className="uui-field__trailing-icon" />
    </span>
  ) : null;

  return (
    <div
      className={clsx('uui-field', wrapperClassName)}
      data-size={size}
      data-invalid={invalid || undefined}
    >
      {label && (
        <label className="uui-field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="uui-field__required" aria-hidden="true">
              *
            </span>
          )}
          {multiline && trailing && !invalid && trailing}
        </label>
      )}
      <div className="uui-field__control" data-multiline={multiline || undefined}>
        {Icon && <Icon />}
        {children}
        {!(multiline && !invalid) && trailing}
      </div>
      {hint && (
        <p className="uui-field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldChromeProps {
  size?: 'sm' | 'md';
  /** Leading icon, e.g. Mail01 for an email field. */
  icon?: UntitledIcon;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      label,
      hint,
      helpText,
      invalid,
      icon,
      wrapperClassName,
      id,
      className,
      required,
      ...props
    },
    ref,
  ) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const hintId = `${inputId}-hint`;

    return (
      <Field
        id={inputId}
        hintId={hintId}
        size={size}
        label={label}
        hint={hint}
        helpText={helpText}
        invalid={invalid}
        required={required}
        icon={icon}
        wrapperClassName={wrapperClassName}
      >
        <input
          ref={ref}
          id={inputId}
          className={clsx('uui-field__input', className)}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          {...props}
        />
      </Field>
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChromeProps {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, hint, helpText, invalid, wrapperClassName, id, className, required, ...props },
    ref,
  ) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const hintId = `${inputId}-hint`;

    return (
      <Field
        id={inputId}
        hintId={hintId}
        size="md"
        label={label}
        hint={hint}
        helpText={helpText}
        invalid={invalid}
        required={required}
        multiline
        wrapperClassName={wrapperClassName}
      >
        <textarea
          ref={ref}
          id={inputId}
          className={clsx('uui-field__input', className)}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          {...props}
        />
      </Field>
    );
  },
);
Textarea.displayName = 'Textarea';
