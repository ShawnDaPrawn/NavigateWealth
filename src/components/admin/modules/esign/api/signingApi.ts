/**
 * Public signer operations (no auth) and shared URL utilities.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import {
  VerifyOTPRequest,
  VerifyOTPResponse,
  SubmitSignatureRequest,
  SubmitSignatureResponse,
  RejectSigningRequest,
  RejectSigningResponse,
} from '../types';

export const signingApi = {
  // ==================== PUBLIC SIGNER OPERATIONS (No Auth) ====================

  /**
   * Send OTP for public signer (no auth required)
   */
  async sendOTPPublic(envelopeId: string, signerId: string): Promise<void> {
    // Note: Shared client will attach auth token if available, which is fine.
    // The endpoint is public anyway.
    return api.post<void>(`/esign/envelopes/${envelopeId}/signers/${signerId}/otp/send`);
  },

  /**
   * Verify OTP for public signer (no auth required)
   */
  async verifyOTPPublic(
    envelopeId: string,
    signerId: string,
    request: VerifyOTPRequest,
  ): Promise<VerifyOTPResponse> {
    return api.post<VerifyOTPResponse>(
      `/esign/envelopes/${envelopeId}/signers/${signerId}/verify`,
      request,
    );
  },

  /**
   * Submit signature for public signer (no auth required)
   */
  async submitSignaturePublic(
    envelopeId: string,
    request: SubmitSignatureRequest,
  ): Promise<SubmitSignatureResponse> {
    return api.post<SubmitSignatureResponse>(`/esign/envelopes/${envelopeId}/sign`, request);
  },

  /**
   * Reject signing for public signer (no auth required)
   */
  async rejectSigningPublic(
    envelopeId: string,
    request: RejectSigningRequest,
  ): Promise<RejectSigningResponse> {
    return api.post<RejectSigningResponse>(`/esign/envelopes/${envelopeId}/reject`, request);
  },

  // ==================== UTILITY METHODS ====================

  /**
   * Discard envelope (draft, sent, or viewed — with no completed signatures)
   */
  async deleteEnvelope(envelopeId: string): Promise<{ success: boolean; deleted: boolean }> {
    return api.delete<{ success: boolean; deleted: boolean }>(`/esign/envelopes/${envelopeId}`);
  },

  /**
   * Void envelope (admin only)
   */
  async voidEnvelope(envelopeId: string, reason?: string): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(`/esign/envelopes/${envelopeId}/void`, {
      reason: reason || 'Voided by admin',
    });
  },

  /**
   * P6.7 — download the evidence pack (sealed PDF + certificate +
   * audit + attachments + consent) as a single ZIP. Triggers a browser
   * download; the shared API client is used so auth headers are
   * attached consistently with the rest of the module.
   */
  async downloadEvidencePack(envelopeId: string, envelopeTitle?: string): Promise<void> {
    const response = await api.get<Response>(`/esign/envelopes/${envelopeId}/evidence-pack`);
    if (!(response instanceof Response)) {
      logger.error('Expected Response object for evidence pack download');
      return;
    }
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (envelopeTitle || 'envelope').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
    a.href = blobUrl;
    a.download = `evidence_${safeTitle}_${envelopeId}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  },
};
