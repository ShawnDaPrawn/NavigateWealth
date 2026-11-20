/**
 * useSignerLandingFlow — the signer landing page's flow: the access token
 * captured once and cleared from the address bar, the initial validation that
 * picks the first step, the re-validation after a challenge (OTP, access code,
 * KBA), completion and rejection.
 *
 * Moved verbatim out of SignerLandingPage.tsx so the live page and the
 * Navigator redesign (src/site/pages/NavigatorSigningPage.tsx) run the very
 * same flow — the same token handling, the same calls and the same step
 * decisions — and differ only in how each step is drawn.
 *
 * Flow: loading → otp → signing → complete
 *       loading → waiting (sequential signing)
 *       loading → expired (invalid token)
 *       signing → rejected (signer declines)
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useSignerSession } from './useSignerSession';

export type SigningStep =
  'loading' | 'expired' | 'otp' | 'kba' | 'signing' | 'waiting' | 'complete' | 'rejected' | 'error';

export function useSignerLandingFlow() {
  const [searchParams] = useSearchParams();

  // SECURITY (SECURITY-AUDIT S8): the access token arrives as `/sign?token=…`
  // and IS the signer's credential. Left in the address bar it reaches browser
  // history, the `Referer` header on any outbound link, and anything reading
  // `location.href`. It is therefore captured ONCE here and stripped from the
  // URL below.
  //
  // The capture must be a ref rather than a plain read: after the
  // `replaceState` the query string is gone, so re-reading `searchParams` on a
  // later render would yield null and bounce a valid signer to the "expired"
  // screen. Every later use in this component (OTP, KBA, submit, reject) reads
  // this captured value.
  const tokenRef = useRef<string | null>(searchParams.get('token'));
  const token = tokenRef.current;

  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) return;
    url.searchParams.delete('token');
    // replaceState, not pushState: the token-bearing entry must be REPLACED, or
    // Back would restore it to the address bar.
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [token]);

  const [currentStep, setCurrentStep] = useState<SigningStep>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const {
    sessionData,
    validateToken,
    verifyOtp,
    verifyKba,
    submitSignature,
    rejectDocument,
    resendOtp,
  } = useSignerSession();

  // Initial token validation
  useEffect(() => {
    if (!token) {
      setCurrentStep('expired');
      return;
    }

    validateToken(token).then((result) => {
      if (result.success && result.data) {
        // Check envelope status first
        if (result.data.envelope_status === 'voided') {
          setErrorMessage('This document has been voided by the sender.');
          setCurrentStep('expired');
          return;
        }

        // Check if already signed
        if (result.data.signer_status === 'signed') {
          setCurrentStep('complete');
        } else if (
          result.data.signer_status === 'rejected' ||
          result.data.signer_status === 'declined'
        ) {
          setCurrentStep('rejected');
        } else if (result.data.is_turn === false) {
          // Sequential signing: not this signer's turn yet
          setCurrentStep('waiting');
        } else if (
          result.data.missing_factors?.includes('otp') ||
          result.data.missing_factors?.includes('access_code') ||
          (result.data.otp_required && result.data.signer_status !== 'otp_verified')
        ) {
          setCurrentStep('otp');
        } else if (result.data.missing_factors?.includes('kba')) {
          setCurrentStep('kba');
        } else if (result.data.challenge_required) {
          setErrorMessage('This signing challenge is not supported. Please contact the sender.');
          setCurrentStep('expired');
        } else {
          setCurrentStep('signing');
        }
      } else {
        setErrorMessage(result.error || 'This link has expired or is invalid.');
        setCurrentStep('expired');
      }
    });
  }, [token, validateToken]);

  const handleChallengeVerified = async () => {
    if (!token) return;
    const refreshed = await validateToken(token);
    if (refreshed.success && refreshed.data) {
      if (
        refreshed.data.missing_factors?.includes('otp') ||
        refreshed.data.missing_factors?.includes('access_code')
      ) {
        setCurrentStep('otp');
        return;
      }
      if (refreshed.data.missing_factors?.includes('kba')) {
        setCurrentStep('kba');
        return;
      }
      if (!refreshed.data.challenge_required) {
        setCurrentStep('signing');
        return;
      }
    }
    setErrorMessage(refreshed.error || 'Unable to open the document after verification.');
    setCurrentStep('expired');
  };

  const handleSigningComplete = () => {
    setCurrentStep('complete');
  };

  const handleReject = async (reason: string) => {
    if (!token) return;

    const result = await rejectDocument(token, reason);
    if (result.success) {
      setCurrentStep('rejected');
    }
  };

  return {
    token,
    currentStep,
    errorMessage,
    sessionData,
    verifyOtp,
    verifyKba,
    submitSignature,
    resendOtp,
    handleChallengeVerified,
    handleSigningComplete,
    handleReject,
  };
}
