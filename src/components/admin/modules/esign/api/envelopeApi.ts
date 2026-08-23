/**
 * Envelope, signer, document and audit operations.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import {
  EsignEnvelope,
  EsignField,
  UploadDocumentRequest,
  UploadDocumentResponse,
  SendInvitesRequest,
  SendInvitesResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  SubmitSignatureRequest,
  SubmitSignatureResponse,
  RejectSigningRequest,
  RejectSigningResponse,
  SaveTemplateRequest,
  SaveTemplateResponse,
  GetAuditTrailResponse,
  GetDocumentUrlResponse,
  GetCertificateUrlResponse,
  GetClientEnvelopesResponse,
  UpdateDraftSettingsRequest,
  UpdateDraftSettingsResponse,
} from '../types';

export const envelopeApi = {
  // ==================== ENVELOPE OPERATIONS ====================

  /**
   * Upload a document and create an envelope
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const formData = new FormData();
    (request.files || []).forEach((file) => {
      formData.append('files', file);
    });
    formData.append('context', JSON.stringify(request.context));

    // The shared API client handles FormData automatically by removing Content-Type header
    return api.post<UploadDocumentResponse>('/esign/envelopes/upload', formData);
  },

  /**
   * Get envelope details
   */
  async getEnvelope(envelopeId: string): Promise<EsignEnvelope> {
    return api.get<EsignEnvelope>(`/esign/envelopes/${envelopeId}`);
  },

  /**
   * Update/Save fields for an envelope
   */
  async saveFields(
    envelopeId: string,
    fields: EsignField[],
  ): Promise<{ success: boolean; fields: EsignField[] }> {
    return api.put<{ success: boolean; fields: EsignField[] }>(
      `/esign/envelopes/${envelopeId}/fields`,
      { fields },
    );
  },

  /**
   * Persist draft signer configuration on a draft envelope.
   * Stores the lightweight form data (name, email, role, etc.) so
   * the "Continue Editing" flow can reconstruct the prepare studio.
   */
  async saveDraftSigners(
    envelopeId: string,
    signers: Array<{
      name: string;
      email: string;
      phone?: string;
      role: string;
      order: number;
      otpRequired?: boolean;
      accessCode?: string;
      clientId?: string;
      isSystemClient?: boolean;
      smsOptIn?: boolean;
    }>,
  ): Promise<{ success: boolean; count: number }> {
    return api.put<{ success: boolean; count: number }>(
      `/esign/envelopes/${envelopeId}/draft-signers`,
      { signers },
    );
  },

  /**
   * Update editable envelope-level metadata (title, message, expiry, signing
   * mode) on a draft envelope. Phase 2 — used by the studio's settings popover.
   * Returns the diff of changed fields plus the latest envelope record.
   */
  async updateDraftSettings(
    envelopeId: string,
    payload: UpdateDraftSettingsRequest,
  ): Promise<UpdateDraftSettingsResponse> {
    return api.patch<UpdateDraftSettingsResponse>(
      `/esign/envelopes/${envelopeId}/draft-settings`,
      payload,
    );
  },

  /**
   * Send invitations to signers
   */
  async sendInvites(envelopeId: string, request: SendInvitesRequest): Promise<SendInvitesResponse> {
    return api.post<SendInvitesResponse>(`/esign/envelopes/${envelopeId}/invites`, request);
  },

  /**
   * Get all envelopes (admin only)
   */
  async getAllEnvelopes(status?: string): Promise<{ envelopes: EsignEnvelope[] }> {
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    const queryString = queryParams.toString();
    const endpoint = queryString ? `/esign/envelopes?${queryString}` : '/esign/envelopes';

    try {
      return await api.get<{ envelopes: EsignEnvelope[] }>(endpoint);
    } catch (error) {
      logger.error('Error fetching envelopes', error, { status });
      return { envelopes: [] };
    }
  },

  /**
   * Get all envelopes for a client (merges client_id linkage + signer-email index)
   */
  async getClientEnvelopes(
    clientId: string,
    clientEmail?: string,
  ): Promise<GetClientEnvelopesResponse> {
    try {
      const params = new URLSearchParams();
      if (clientEmail) params.append('email', clientEmail);
      const qs = params.toString();
      const endpoint = qs
        ? `/esign/clients/${clientId}/envelopes?${qs}`
        : `/esign/clients/${clientId}/envelopes`;
      return await api.get<GetClientEnvelopesResponse>(endpoint);
    } catch (error) {
      logger.warn('E-Sign backend not available or error fetching client envelopes', {
        error,
        clientId,
      });
      return { envelopes: [] };
    }
  },

  /**
   * Save envelope as template
   */
  async saveAsTemplate(
    envelopeId: string,
    request: SaveTemplateRequest,
  ): Promise<SaveTemplateResponse> {
    return api.post<SaveTemplateResponse>(`/esign/envelopes/${envelopeId}/templates`, request);
  },

  /**
   * Download signed document
   */
  async downloadDocument(envelopeId: string, filename: string = 'document.pdf'): Promise<void> {
    // The API client returns the Response object if content-type is not json
    const response = await api.get<Response>(`/esign/envelopes/${envelopeId}/download`);

    if (!(response instanceof Response)) {
      logger.error('Expected Response object for download');
      return;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  },

  /**
   * P8.1 — fetch the envelope's current document as a Blob (no download
   * dialog). Used for in-app rendering: dashboard thumbnails, preview
   * panes, etc. Returns null if the envelope has no document or the
   * server returns an unexpected response.
   */
  async fetchDocumentBlob(envelopeId: string): Promise<Blob | null> {
    try {
      const response = await api.get<Response>(`/esign/envelopes/${envelopeId}/download`);
      if (!(response instanceof Response)) {
        return null;
      }
      return await response.blob();
    } catch (error) {
      logger.warn('Failed to fetch envelope document blob', { envelopeId, error });
      return null;
    }
  },

  // ==================== SIGNER OPERATIONS ====================

  /**
   * Send OTP to signer
   */
  async sendOTP(envelopeId: string, signerId: string): Promise<void> {
    return api.post<void>(`/esign/envelopes/${envelopeId}/signers/${signerId}/otp/send`);
  },

  /**
   * Verify OTP and access code
   */
  async verifyOTP(
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
   * Submit signature
   */
  async submitSignature(
    envelopeId: string,
    request: SubmitSignatureRequest,
  ): Promise<SubmitSignatureResponse> {
    return api.post<SubmitSignatureResponse>(`/esign/envelopes/${envelopeId}/sign`, request);
  },

  /**
   * Reject signing
   */
  async rejectSigning(
    envelopeId: string,
    request: RejectSigningRequest,
  ): Promise<RejectSigningResponse> {
    return api.post<RejectSigningResponse>(`/esign/envelopes/${envelopeId}/reject`, request);
  },

  // ==================== DOCUMENT & AUDIT OPERATIONS ====================

  /**
   * Get audit trail for envelope
   */
  async getAuditTrail(envelopeId: string): Promise<GetAuditTrailResponse> {
    try {
      return await api.get<GetAuditTrailResponse>(`/esign/envelopes/${envelopeId}/audit`);
    } catch (error) {
      logger.error('Error fetching audit trail', error, { envelopeId });
      return { events: [] };
    }
  },

  /**
   * Get presigned URL for document
   */
  async getDocumentUrl(envelopeId: string): Promise<GetDocumentUrlResponse> {
    return api.get<GetDocumentUrlResponse>(`/esign/envelopes/${envelopeId}/document`);
  },

  /**
   * Get presigned URL for completion certificate
   */
  async getCertificateUrl(envelopeId: string): Promise<GetCertificateUrlResponse> {
    return api.get<GetCertificateUrlResponse>(`/esign/envelopes/${envelopeId}/certificate`);
  },
};
