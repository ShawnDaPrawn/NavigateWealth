/**
 * The pieces the log-in and sign-up forms share: the password field with its
 * show/hide button, the in-form alerts, and the spinner a submit button shows
 * while it waits.
 *
 * The boards draw none of the alerts; they are the live pages' messages
 * (success, "verification email sent", errors, the localhost notice) in the
 * design system's form-alert style. Errors are assertive alerts, as on the
 * live pages; the rest are polite status messages.
 */
import type { ChangeEvent, ReactNode } from 'react';
import { LoginIcon, type LoginIconName } from './LoginIcons';
import '../styles/login.css';

interface LoginPasswordInputProps {
  id: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  shown: boolean;
  onToggle: () => void;
  /** The show/hide button's accessible names, as the live page words them. */
  showLabel: string;
  hideLabel: string;
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  /** The sign-up board's fields are 46px tall; the log-in board's are 48px. */
  compact?: boolean;
}

export function LoginPasswordInput({
  id,
  name,
  value,
  onChange,
  shown,
  onToggle,
  showLabel,
  hideLabel,
  placeholder,
  autoComplete,
  disabled,
  invalid,
  describedBy,
  onFocus,
  onBlur,
  compact = false,
}: LoginPasswordInputProps) {
  return (
    <div className="nwli-pw">
      <input
        id={id}
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`nwli-input nwli-input--pw${compact ? ' nwli-input--compact' : ''}`}
      />
      <button
        type="button"
        className={`nwli-toggle${compact ? ' nwli-toggle--compact' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={shown ? hideLabel : showLabel}
      >
        <LoginIcon name="eye" size={17} />
      </button>
    </div>
  );
}

export type LoginAlertTone = 'danger' | 'success' | 'info' | 'warn';

const TONE_ICON: Record<LoginAlertTone, LoginIconName> = {
  danger: 'alert',
  success: 'checkCircle',
  info: 'mail',
  warn: 'alert',
};

interface LoginAlertProps {
  tone: LoginAlertTone;
  id?: string;
  children: ReactNode;
  /** A close button, as the live sign-up page puts on its error. */
  onClose?: () => void;
  closeLabel?: string;
}

export function LoginAlert({ tone, id, children, onClose, closeLabel }: LoginAlertProps) {
  return (
    <div
      className={`nwli-alert nwli-alert--${tone} nw-in`}
      role={tone === 'danger' ? 'alert' : undefined}
      aria-live={tone === 'danger' ? 'assertive' : undefined}
    >
      <LoginIcon name={TONE_ICON[tone]} size={16} />
      <div className="nwli-alert-body" id={id}>
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          className="nwli-alert-close"
          onClick={onClose}
          aria-label={closeLabel}
        >
          <LoginIcon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

/** The ring a submit button turns while it waits; still for reduced motion. */
export function LoginSpinner() {
  return <span className="nwli-spinner" aria-hidden="true" />;
}
