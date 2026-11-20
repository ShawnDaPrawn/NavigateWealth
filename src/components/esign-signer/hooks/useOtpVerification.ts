/**
 * useOtpVerification — the OTP / access-code step's state and handlers: the
 * six digits, the access code, auto-submit once every digit is in, paste
 * support, the resend cooldown and the masked email.
 *
 * Moved verbatim out of OtpVerificationStep.tsx so the live step and the
 * Navigator redesign (src/site/sections/ESignVerify.tsx) verify, resend and
 * report errors identically and differ only in how the step is drawn.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { SignerSessionData } from '../types';

export interface OtpVerificationOptions {
  token: string;
  sessionData: SignerSessionData | null;
  onVerified: () => void;
  verifyOtp: (
    token: string,
    otp: string,
    accessCode?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (token: string) => Promise<{ success: boolean; error?: string }>;
}

export function useOtpVerification({
  token,
  sessionData,
  onVerified,
  verifyOtp,
  resendOtp,
}: OtpVerificationOptions) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [accessCode, setAccessCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = useCallback(async () => {
    const otpValue = otp.join('');

    if (sessionData?.otp_required && otpValue.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    if (sessionData?.access_code_required && !accessCode.trim()) {
      setError('Please enter the document access code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    const result = await verifyOtp(token, otpValue, accessCode.trim() || undefined);

    if (result.success) {
      onVerified();
    } else {
      setError(result.error || 'Invalid verification code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }

    setIsVerifying(false);
  }, [accessCode, otp, token, verifyOtp, onVerified, sessionData]);

  // Auto-submit when all digits are entered, once per code. After a correct
  // code the page refreshes the session, which rebuilds handleVerify while the
  // six digits are still filled in; without this guard that re-ran the effect
  // and sent verify-otp a second time. A wrong code clears the boxes, so the
  // next code typed is submitted as usual.
  const autoSubmittedCode = useRef<string | null>(null);
  useEffect(() => {
    const isComplete =
      !sessionData?.access_code_required &&
      (!sessionData?.otp_required || otp.every((digit) => digit !== '')) &&
      Boolean(sessionData?.otp_required);
    const code = otp.join('');
    if (!isComplete) {
      autoSubmittedCode.current = null;
      return;
    }
    if (!isVerifying && autoSubmittedCode.current !== code) {
      autoSubmittedCode.current = code;
      handleVerify();
    }
  }, [accessCode, otp, isVerifying, handleVerify, sessionData]);

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);
    setResendSuccess(false);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(newOtp);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleResendOtp = async () => {
    setError(null);
    setResendSuccess(false);

    try {
      const result = await resendOtp(token);

      if (result.success) {
        setResendCooldown(60);
        setResendSuccess(true);
        // Clear success message after 5s
        setTimeout(() => setResendSuccess(false), 5000);
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (_err) {
      setError('An error occurred while resending the code');
    }
  };

  // Mask email for display
  const maskedEmail = sessionData?.signer_email
    ? (() => {
        const [local, domain] = sessionData.signer_email.split('@');
        if (!domain) return sessionData.signer_email;
        const masked =
          local.length > 2
            ? local[0] + '•'.repeat(Math.min(local.length - 2, 6)) + local[local.length - 1]
            : local;
        return `${masked}@${domain}`;
      })()
    : 'your email';

  return {
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
    handleOtpChange,
    handleKeyDown,
    handlePaste,
    handleResendOtp,
    maskedEmail,
  };
}
