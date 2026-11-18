/**
 * Form field primitives for the Navigator account pages: a labelled field with
 * an inline error, and a password input with a show/hide toggle.
 *
 * Inputs are 16px so iOS does not zoom on focus. Password inputs never block
 * paste (password managers depend on it) and opt out of spell-check and
 * auto-capitalisation, so a revealed password is not sent to a spelling
 * service or altered by the keyboard.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { fieldErrorId } from './accountUi';

interface AccountFieldProps {
  /** The id of the control the label names. */
  htmlFor: string;
  label: ReactNode;
  /** Sits on the label's row, right-aligned (e.g. "Forgot?"). */
  aside?: ReactNode;
  /** Inline validation message; the control must reference fieldErrorId(htmlFor). */
  error?: string | null;
  children: ReactNode;
  /** Rendered after the error (strength meter, match note). */
  after?: ReactNode;
}

export function AccountField({ htmlFor, label, aside, error, children, after }: AccountFieldProps) {
  const labelEl = (
    <label htmlFor={htmlFor} className="nwac-label">
      {label}
    </label>
  );
  return (
    <div className="nwac-field">
      {aside ? (
        <div className="nwac-label-row">
          {labelEl}
          {aside}
        </div>
      ) : (
        labelEl
      )}
      {children}
      {error ? (
        <p id={fieldErrorId(htmlFor)} className="nwac-field-error">
          <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {after}
    </div>
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  id: string;
  autoComplete: 'current-password' | 'new-password';
  shown: boolean;
  onToggle: () => void;
  /** Accessible names for the toggle: [while hidden, while shown]. */
  toggleLabels?: readonly [string, string];
};

export function PasswordInput({
  id,
  shown,
  onToggle,
  toggleLabels = ['Show password', 'Hide password'],
  disabled,
  ...rest
}: PasswordInputProps) {
  return (
    <div className="nwac-pw">
      <input
        {...rest}
        id={id}
        type={shown ? 'text' : 'password'}
        className="nwac-input nwac-input--pw"
        disabled={disabled}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="nwac-eye"
        onClick={onToggle}
        disabled={disabled}
        aria-label={shown ? toggleLabels[1] : toggleLabels[0]}
        aria-controls={id}
      >
        {shown ? (
          <EyeOff size={17} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye size={17} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
