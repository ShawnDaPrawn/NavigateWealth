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
   * Persist the signer's adopted signature/initials so they're pre-loaded
   * on the next envelope sent to the same email. Best-effort — the caller
   * should not block signing on failure.
   */
  async saveSignerSignature(
    token: string,
    payload: { signature?: string | null; initials?: string | null }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}/signer/saved-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          access_token: token,
          signature: payload.signature ?? null,
          initials: payload.initials ?? null,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Failed to save signature' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error saving signer signature:', error);
      return { success: false, error: 'Network error while saving signature.' };
    }
  }

  /**
   * Record a "signer paused" audit-trail entry. The signing link remains
   * valid until envelope expiry; this just gives the sender visibility.
   */
  async pauseSigning(
    token: string,
    progress?: { completed: number; required: number }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}/signer/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          access_token: token,
          completed_count: progress?.completed,
          required_count: progress?.required,
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Failed to record pause' };
      }
      return { success: true };
    } catch (error) {
      console.error('Error pausing signing:', error);
      return { success: false, error: 'Network error.' };
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

  /**
   * P3.5 — upload an attachment file for an attachment-type field. The
   * server validates the access token, mime type, and size, then writes
   * the file to the attachments bucket and stamps the field's value with
   * `attachment:{id}` so completion checks pass.
   */
  async uploadAttachment(
    token: string,
    fieldId: string,
    file: File,
  ): Promise<{ attachmentId: string; filename: string; size: number; mimeType: string; path: string }> {
    const fd = new FormData();
    fd.append('access_token', token);
    fd.append('field_id', fieldId);
    fd.append('file', file);
    const response = await fetch(`${API_BASE}/signer/attachment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${publicAnonKey}` },
      body: fd,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload attachment');
    }
    const data = await response.json();
    return {
      attachmentId: data.attachmentId,
      filename: data.filename,
      size: data.size,
      mimeType: data.mimeType,
      path: data.path,
    };
  }
}

export const esignSignerService = new EsignSignerService();

/**
 * P3.5 — convenience wrapper used by the signing workflow's hidden file
 * input handler so we don't have to reach into the service singleton in
 * line. Returns the same shape as the service method for future-proofing.
 */
export async function uploadAttachmentForSigner(
  token: string,
  fieldId: string,
  file: File,
): Promise<{ attachmentId: string; filename: string; size: number; mimeType: string; path: string }> {
  return esignSignerService.uploadAttachment(token, fieldId, file);
}