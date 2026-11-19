/**
 * ForgotPasswordRequest — "Reset Password", the form that asks for the
 * account's email address. It only draws; the page owns the checks and the
 * request (NavigatorForgotPasswordPage), which are the live page's own.
 *
 * Unlike the live page it does not leave an empty or malformed address to the
 * browser's own bubble: the form is `noValidate`, so the page's checks run and
 * their messages appear in the board's alert, with the field marked invalid
 * and focused. The checks and the messages are the same, and in both designs
 * nothing is sent until the address passes them.
 */
import { useId, type FormEvent, type RefObject } from 'react';
import { Link } from 'react-router';
import { ForgotPasswordIcon } from './ForgotPasswordIcons';
import '../styles/forgot-password.css';

interface ForgotPasswordRequestProps {
  email: string;
  onEmailChange: (value: string) => void;
  /** The message to show, or '' for none. */
  error: string;
  /** True when the message is about the address itself (empty or malformed). */
  invalid: boolean;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  inputRef: RefObject<HTMLInputElement>;
}

export function ForgotPasswordRequest({
  email,
  onEmailChange,
  error,
  invalid,
  loading,
  onSubmit,
  inputRef,
}: ForgotPasswordRequestProps) {
  const base = useId();
  const titleId = `${base}-title`;
  const emailId = `${base}-email`;
  const errorId = `${base}-error`;

  return (
    <form className="nwfp-form" noValidate onSubmit={onSubmit} aria-labelledby={titleId}>
      <span className="nwfp-mark" aria-hidden="true">
        <ForgotPasswordIcon name="key" size={24} />
      </span>
      <div>
        <h1 id={titleId} className="nwfp-title">
          Reset Password
        </h1>
        <p className="nwfp-lead">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      {error ? (
        <div id={errorId} className="nwfp-alert" role="alert">
          <ForgotPasswordIcon name="alert" size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="nwfp-field">
        <label className="nwfp-label" htmlFor={emailId}>
          Email Address
        </label>
        <input
          ref={inputRef}
          id={emailId}
          className="nwfp-input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          disabled={loading}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>

      <button
        type="submit"
        className="nw-btn nwfp-submit"
        disabled={loading}
        aria-busy={loading ? true : undefined}
      >
        {loading ? <span className="nwfp-spin" aria-hidden="true" /> : null}
        {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
      </button>

      <Link to="/login" className="nw-outline nwfp-back">
        <ForgotPasswordIcon name="arrowLeft" size={16} />
        Back to Login
      </Link>

      <p className="nwfp-signup">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="nwfp-link">
          Sign up
        </Link>
      </p>

      <div className="nwfp-notice">
        <ForgotPasswordIcon name="lock" size={15} stroke="#0D1626" />
        <span>
          For security reasons, we&apos;ll only send reset links to registered email addresses
        </span>
      </div>
    </form>
  );
}
