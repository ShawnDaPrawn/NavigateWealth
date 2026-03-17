/**
 * E-Signature Signer Service
 * API service for signer-side e-signature operations
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import type { 
  SignerSessionData, 
  SignatureData,
  SignerSessionValidation,
  OtpVerificationResult,
  SignatureSubmissionResult
} from '../types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign`;

class EsignSignerService {
  /**
   * Validate access token and get signer session data
   */
  async validateAccessToken(token: string): Promise<SignerSessionValidation> {
    try {
      const response = await fetch(`${API_BASE}/signer/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ access_token: token })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || errorData.message || 'Failed to validate token'
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data as SignerSessionData
      };
    } catch (error) {
      console.error('Error validating access token:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(token: string, otp: string): Promise<OtpVerificationResult> {
    try {
      const response = await fetch(`${API_BASE}/signer/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ 
          access_token: token,
          otp 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || errorData.message || 'Invalid OTP code'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Resend OTP code
   */
  async resendOtp(token: string): Promise<OtpVerificationResult> {
    try {
      const response = await fetch(`${API_BASE}/signer/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ access_token: token })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || errorData.message || 'Failed to resend OTP'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error resending OTP:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Submit signature data
   */
  async submitSignature(
    token: string, 
    signatures: SignatureData[]
  ): Promise<SignatureSubmissionResult> {
    try {
      const response = await fetch(`${API_BASE}/signer/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ 
          access_token: token,
          signature_data: signatures.map(s => ({
            field_id: s.field_id,
            type: s.type,
            value: s.value,
          })),
          field_values: signatures.map(s => ({
            field_id: s.field_id,
            value: s.value,
          })),
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || errorData.message || 'Failed to submit signature'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error submitting signature:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Reject document
   */
  async rejectDocument(token: string, reason: string): Promise<SignatureSubmissionResult> {
    try {
      const response = await fetch(`${API_BASE}/signer/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ 
          access_token: token,
          reason 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || errorData.message || 'Failed to reject document'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error rejecting document:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Download signed document
   */
  async downloadDocument(token: string): Promise<Blob | null> {
    try {
      const response = await fetch(`${API_BASE}/signer/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ access_token: token })
      });

      if (!response.ok) {
        console.error('Failed to download document');
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.error('Error downloading document:', error);
      return null;
    }
  }
}

export const esignSignerService = new EsignSignerService();