/**
 * useSignerSession Hook
 * Manages signer session state and API calls
 */

import { useCallback, useState } from 'react';
import { esignSignerService } from '../services/esignSignerService';
import type {
  SignerSessionData,
  SignatureData,
  SignerSessionValidation,
  OtpVerificationResult,
  KbaVerificationResult,
  SignatureSubmissionResult,
} from '../types';

export function useSignerSession() {
  const [sessionData, setSessionData] = useState<SignerSessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable across renders. The signing page validates the link in an effect
  // that depends on this function: a new function on every render re-ran that
  // effect after every response, POSTing /signer/validate without end until
  // the server's rate limit (30 per 5 minutes) answered 429, which the page
  // shows as a dead link. It reads only state setters and the service module.
  const validateToken = useCallback(async (token: string): Promise<SignerSessionValidation> => {
    setLoading(true);
    setError(null);

    try {
      const result = await esignSignerService.validateAccessToken(token);

      if (result.success && result.data) {
        // Map server response fields to match our expected types
        const data = result.data as SignerSessionData & Record<string, unknown>;
        const mappedData: SignerSessionData = {
          ...data,
          // Ensure page_count is populated from document_page_count if needed
          page_count:
            data.page_count ||
            ((data as Record<string, unknown>).document_page_count as number) ||
            1,
        };
        setSessionData(mappedData);
        return { success: true, data: mappedData };
      } else {
        setError(result.error || 'Invalid or expired token');
      }

      return result;
    } catch (_err) {
      const errorMsg = 'Failed to validate token';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = async (
    token: string,
    otp: string,
    accessCode?: string,
  ): Promise<OtpVerificationResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = accessCode
        ? await esignSignerService.verifyOtp(token, otp, accessCode)
        : await esignSignerService.verifyOtp(token, otp);

      if (result.success) {
        // Update session data to reflect OTP verified status
        if (sessionData) {
          setSessionData({
            ...sessionData,
            signer_status: 'otp_verified',
          });
        }
      } else {
        setError(result.error || 'Invalid OTP');
      }

      return result;
    } catch (_err) {
      const errorMsg = 'Failed to verify OTP';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const submitSignature = async (
    token: string,
    signatures: SignatureData[],
  ): Promise<SignatureSubmissionResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await esignSignerService.submitSignature(token, signatures);

      if (result.success) {
        // Update session data to reflect signed status
        if (sessionData) {
          setSessionData({
            ...sessionData,
            signer_status: 'signed',
          });
        }
      } else {
        setError(result.error || 'Failed to submit signature');
      }

      return result;
    } catch (_err) {
      const errorMsg = 'Failed to submit signature';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const verifyKba = async (token: string, idNumber?: string): Promise<KbaVerificationResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await esignSignerService.verifyKba(token, idNumber);
      if (!result.success) {
        setError(result.error || 'Identity verification failed');
      }
      return result;
    } catch (_err) {
      const errorMsg = 'Failed to verify identity';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const rejectDocument = async (
    token: string,
    reason: string,
  ): Promise<SignatureSubmissionResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await esignSignerService.rejectDocument(token, reason);

      if (result.success) {
        // Update session data to reflect rejected status
        if (sessionData) {
          setSessionData({
            ...sessionData,
            signer_status: 'rejected',
          });
        }
      } else {
        setError(result.error || 'Failed to reject document');
      }

      return result;
    } catch (_err) {
      const errorMsg = 'Failed to reject document';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    sessionData,
    loading,
    error,
    validateToken,
    verifyOtp,
    verifyKba,
    submitSignature,
    rejectDocument,
    resendOtp: async (token: string): Promise<OtpVerificationResult> => {
      return esignSignerService.resendOtp(token);
    },
  };
}
