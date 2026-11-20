/**
 * The signing page's identity checks, as the ESign board draws them: the
 * emailed code (and/or the document access code) and the KBA identity check.
 *
 * Both run the live steps' own logic (useOtpVerification, useKbaVerification):
 * the same calls, auto-submit once the sixth digit is in, the same resend
 * cooldown, the same provider redirect and every message word for word. The
 * one thing drawn differently is the code entry: the board's six boxes are
 * one real input (a single field takes a pasted or autofilled code whole)
 * laid over six drawn boxes; what it accepts is what the live boxes accept —
 * digits only, six at most.
 */
import { useState, type ChangeEvent } from 'react';
import {
  useOtpVerification,
  type OtpVerificationOptions,
} from '../../components/esign-signer/hooks/useOtpVerification';
import {
  useKbaVerification,
  type KbaVerificationOptions,
} from '../../components/esign-signer/hooks/useKbaVerification';
import type { SignerSessionData } from '../../components/esign-signer/types';
import { ESignIcon } from './ESignIcons';

function DocumentBox({ title }: { title: string }) {
  return (
    <div className="nwes-doc">
      <span className="nwes-doc-icon">
        <ESignIcon name="file" size={17} />
      </span>
      <span className="nwes-doc-text">
        <span className="nwes-kicker">Document</span>
        <span className="nwes-doc-title">{title}</span>
      </span>
    </div>
  );
}

function Spinner() {
  return <span className="nwes-spin" aria-hidden="true" />;
}

export function ESignOtpCard(props: OtpVerificationOptions) {
  const { sessionData } = props;
  const {
    otp,
    setOtp,
    accessCode,
    setAccessCode,
    isVerifying,
    error,
    setError,
    resendCooldown,
    resendSuccess,
    setResendSuccess,
    inputRefs,
    handleVerify,
    handleResendOtp,
    maskedEmail,
  } = useOtpVerification(props);
  const [focused, setFocused] = useState(false);

  const code = otp.join('');
  // The live boxes take one digit each and ignore anything else; a paste
  // keeps the first six digits. One field does both.
  const onCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits.split('').concat(Array(6).fill('')).slice(0, 6));
    setError(null);
    setResendSuccess(false);
  };
  const caretAt = Math.min(code.length, 5);

  return (
    <div className="nwes-stack">
      <div className="nwes-head">
        <span className="nwes-badge">
          <ESignIcon name="shieldCheck" size={26} />
        </span>
        <h1 className="nw-h nwes-head-title">Verify Your Identity</h1>
        {sessionData?.otp_required && (
          <>
            <p className="nwes-head-text nwes-head-text--tight">
              We&apos;ve sent a 6-digit verification code to
            </p>
            <p className="nwes-masked">{maskedEmail}</p>
          </>
        )}
      </div>

      {sessionData && <DocumentBox title={sessionData.envelope_title} />}

      {sessionData?.otp_required && (
        <div>
          <label htmlFor="es-otp" className="nwes-otp-label">
            Enter Verification Code
          </label>
          <div className="nwes-otp">
            <div className="nwes-otp-boxes" aria-hidden="true">
              {otp.map((digit, index) => {
                const filled = index < code.length;
                const current = focused && index === caretAt && !filled;
                return (
                  <span
                    key={index}
                    className={`nwes-otp-box${filled ? ' nwes-otp-box--filled' : ''}${current ? ' nwes-otp-box--current' : ''}`}
                  >
                    {digit}
                    {current && <span className="nwes-caret" />}
                  </span>
                );
              })}
            </div>
            <input
              id="es-otp"
              ref={(el) => {
                inputRefs.current[0] = el;
              }}
              className="nwes-otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={onCodeChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={isVerifying}
              aria-invalid={error && !isVerifying ? true : undefined}
              aria-describedby={error && !isVerifying ? 'es-otp-error' : undefined}
              autoFocus
            />
          </div>
        </div>
      )}

      {sessionData?.access_code_required && (
        <div className="nwes-formfield">
          <label htmlFor="es-access" className="nwes-formfield-label">
            Document access code
          </label>
          <input
            id="es-access"
            className="nwes-input"
            type="password"
            autoComplete="one-time-code"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            disabled={isVerifying}
          />
        </div>
      )}

      {error && !isVerifying && (
        <div className="nwes-alert" role="alert" id="es-otp-error">
          <ESignIcon name="alert" size={17} className="nwes-alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {resendSuccess && (
        <div className="nwes-sent" role="status">
          <ESignIcon name="mail" size={17} />
          <span>A new code has been sent to your email.</span>
        </div>
      )}

      <button
        type="button"
        className="nw-btn nwes-primary"
        onClick={handleVerify}
        disabled={
          (sessionData?.otp_required && !otp.every((d) => d !== '')) ||
          (sessionData?.access_code_required && !accessCode.trim()) ||
          isVerifying
        }
      >
        {isVerifying && <Spinner />}
        {isVerifying ? 'Verifying...' : 'Verify & Continue'}
      </button>

      {sessionData?.otp_required && (
        <div className="nwes-resend">
          {resendCooldown > 0 ? (
            <p className="nwes-cooldown">Resend in {resendCooldown}s</p>
          ) : (
            <button type="button" className="nwes-ghost nwes-resend-btn" onClick={handleResendOtp}>
              Resend Code
            </button>
          )}
        </div>
      )}

      <p className="nwes-note nwes-note--rule">
        <ESignIcon name="clock" size={15} stroke="#0D1626" />
        <span>
          This verification code is valid for 10 minutes. Your identity verification ensures the
          security and integrity of your electronic signature.
        </span>
      </p>
    </div>
  );
}

export function ESignKbaCard({
  sessionData,
  ...options
}: KbaVerificationOptions & { sessionData: SignerSessionData | null }) {
  const { idNumber, setIdNumber, isVerifying, error, handleVerify } = useKbaVerification(options);

  return (
    <div className="nwes-stack">
      <div className="nwes-head">
        <span className="nwes-badge">
          <ESignIcon name="idCard" size={26} />
        </span>
        <h1 className="nw-h nwes-head-title">Verify your identity</h1>
        <p className="nwes-head-text">
          The sender requires an identity check before this document can be opened.
        </p>
      </div>

      {sessionData?.envelope_title && <DocumentBox title={sessionData.envelope_title} />}

      <div className="nwes-formfield">
        <label htmlFor="es-kba" className="nwes-formfield-label">
          South African ID or passport number
        </label>
        <input
          id="es-kba"
          className="nwes-input"
          type="text"
          autoComplete="off"
          placeholder="Enter your identity number"
          value={idNumber}
          onChange={(event) => setIdNumber(event.target.value)}
          disabled={isVerifying}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'es-kba-error' : undefined}
        />
      </div>

      {error && (
        <div className="nwes-alert" role="alert" id="es-kba-error">
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="nw-btn nwes-primary"
        onClick={handleVerify}
        disabled={isVerifying}
      >
        {isVerifying && <Spinner />}
        {isVerifying ? 'Verifying identity…' : 'Verify identity'}
      </button>

      <p className="nwes-note">
        <ESignIcon name="lock" size={15} stroke="#0D1626" />
        <span>
          Your identity number is sent securely to the configured verification provider and is not
          included in the signing audit log.
        </span>
      </p>
    </div>
  );
}
