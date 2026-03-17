// ============================================================================
// E-SIGNATURE API
// Client-side API for E-Signature module using shared API client
// ============================================================================

import { api } from '../../../../utils/api/client';
import { projectId } from '../../../../utils/supabase/info';
import { logger } from '../../../../utils/logger';
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
  ReminderConfig,
  SigningMode,
  EsignTemplateRecord,
  CreateTemplateInput,
  UpdateTemplateInput,
} from './types';

export const esignApi = {
  // ==================== ENVELOPE OPERATIONS ====================

  /**
   * Upload a document and create an envelope
   */
  async uploadDocument(request: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const formData = new FormData();
    (request.files || []).forEach(file => {
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
  async saveFields(envelopeId: string, fields: EsignField[]): Promise<{ success: boolean; fields: EsignField[] }> {
    return api.put<{ success: boolean; fields: EsignField[] }>(`/esign/envelopes/${envelopeId}/fields`, { fields });
  },

  /**
   * Persist draft signer configuration on a draft envelope.
   * Stores the lightweight form data (name, email, role, etc.) so
   * the "Continue Editing" flow can reconstruct the prepare studio.
   */
  async saveDraftSigners(envelopeId: string, signers: Array<{
    name: string;
    email: string;
    role: string;
    order: number;
    otpRequired?: boolean;
    accessCode?: string;
    clientId?: string;
    isSystemClient?: boolean;
  }>): Promise<{ success: boolean; count: number }> {
    return api.put<{ success: boolean; count: number }>(`/esign/envelopes/${envelopeId}/draft-signers`, { signers });
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
  async getClientEnvelopes(clientId: string, clientEmail?: string): Promise<GetClientEnvelopesResponse> {
    try {
      const params = new URLSearchParams();
      if (clientEmail) params.append('email', clientEmail);
      const qs = params.toString();
      const endpoint = qs
        ? `/esign/clients/${clientId}/envelopes?${qs}`
        : `/esign/clients/${clientId}/envelopes`;
      return await api.get<GetClientEnvelopesResponse>(endpoint);
    } catch (error) {
      logger.warn('E-Sign backend not available or error fetching client envelopes', error, { clientId });
      return { envelopes: [] };
    }
  },

  /**
   * Save envelope as template
   */
  async saveAsTemplate(envelopeId: string, request: SaveTemplateRequest): Promise<SaveTemplateResponse> {
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
  async verifyOTP(envelopeId: string, signerId: string, request: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    return api.post<VerifyOTPResponse>(`/esign/envelopes/${envelopeId}/signers/${signerId}/verify`, request);
  },

  /**
   * Submit signature
   */
  async submitSignature(envelopeId: string, request: SubmitSignatureRequest): Promise<SubmitSignatureResponse> {
    return api.post<SubmitSignatureResponse>(`/esign/envelopes/${envelopeId}/sign`, request);
  },

  /**
   * Reject signing
   */
  async rejectSigning(envelopeId: string, request: RejectSigningRequest): Promise<RejectSigningResponse> {
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
  async verifyOTPPublic(envelopeId: string, signerId: string, request: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    return api.post<VerifyOTPResponse>(`/esign/envelopes/${envelopeId}/signers/${signerId}/verify`, request);
  },

  /**
   * Submit signature for public signer (no auth required)
   */
  async submitSignaturePublic(envelopeId: string, request: SubmitSignatureRequest): Promise<SubmitSignatureResponse> {
    return api.post<SubmitSignatureResponse>(`/esign/envelopes/${envelopeId}/sign`, request);
  },

  /**
   * Reject signing for public signer (no auth required)
   */
  async rejectSigningPublic(envelopeId: string, request: RejectSigningRequest): Promise<RejectSigningResponse> {
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
    return api.post<{ success: boolean }>(`/esign/envelopes/${envelopeId}/void`, { reason: reason || 'Voided by admin' });
  },

  /**
   * Get API base URL
   */
  getApiBaseUrl(): string {
    return `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign`;
  },

  // ==================== REMINDER CONFIG ====================

  /**
   * Get reminder configuration for an envelope
   */
  async getReminderConfig(envelopeId: string): Promise<{ config: ReminderConfig }> {
    return api.get<{ config: ReminderConfig }>(`/esign/envelopes/${envelopeId}/reminder-config`);
  },

  /**
   * Update reminder configuration for an envelope
   */
  async updateReminderConfig(envelopeId: string, config: Partial<ReminderConfig>): Promise<{ config: ReminderConfig }> {
    return api.put<{ config: ReminderConfig }>(`/esign/envelopes/${envelopeId}/reminder-config`, config);
  },

  // ==================== SIGNING MODE ====================

  /**
   * Update signing mode for an envelope
   */
  async updateSigningMode(envelopeId: string, signingMode: SigningMode): Promise<{ success: boolean; signing_mode: SigningMode }> {
    return api.patch<{ success: boolean; signing_mode: SigningMode }>(`/esign/envelopes/${envelopeId}/signing-mode`, { signing_mode: signingMode });
  },

  /**
   * Send manual reminder to pending signers
   */
  async sendReminder(envelopeId: string): Promise<{ success: boolean; remindersSent: { signerId: string; email: string; sentAt: string }[]; totalReminders: number }> {
    return api.post<{ success: boolean; remindersSent: { signerId: string; email: string; sentAt: string }[]; totalReminders: number }>(`/esign/envelopes/${envelopeId}/remind`);
  },

  /**
   * Recall an envelope
   */
  async recallEnvelope(envelopeId: string, reason?: string): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(`/esign/envelopes/${envelopeId}/recall`, { reason });
  },

  // ==================== PHASE 3: AUDIT EXPORT ====================

  /**
   * Get audit trail export URL (opens CSV download in new tab)
   */
  getAuditExportUrl(envelopeId: string): string {
    return `${this.getApiBaseUrl()}/envelopes/${envelopeId}/audit/export`;
  },

  /**
   * Download audit trail as CSV file
   */
  async downloadAuditTrailCsv(envelopeId: string): Promise<void> {
    try {
      const response = await api.get<Response>(`/esign/envelopes/${envelopeId}/audit/export`);

      // The shared API client might return the raw Response for non-JSON content
      let blob: Blob;
      if (response instanceof Response) {
        blob = await response.blob();
      } else {
        // Fallback: treat as string
        blob = new Blob([JSON.stringify(response)], { type: 'text/csv' });
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `audit-trail-${envelopeId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err: unknown) {
      logger.error('Failed to download audit trail CSV', err, { envelopeId });
      throw err;
    }
  },

  // ==================== PHASE 4: TEMPLATE OPERATIONS ====================

  /**
   * Create a new template (blank or from envelope)
   */
  async createTemplate(input: CreateTemplateInput): Promise<{ template: EsignTemplateRecord }> {
    return api.post<{ template: EsignTemplateRecord }>('/esign/templates', input);
  },

  /**
   * List all templates
   */
  async listTemplates(): Promise<{ templates: EsignTemplateRecord[] }> {
    try {
      return await api.get<{ templates: EsignTemplateRecord[] }>('/esign/templates');
    } catch (error) {
      logger.error('Error fetching templates', error);
      return { templates: [] };
    }
  },

  /**
   * Get single template by ID
   */
  async getTemplate(templateId: string): Promise<{ template: EsignTemplateRecord }> {
    return api.get<{ template: EsignTemplateRecord }>(`/esign/templates/${templateId}`);
  },

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, updates: UpdateTemplateInput): Promise<{ template: EsignTemplateRecord }> {
    return api.put<{ template: EsignTemplateRecord }>(`/esign/templates/${templateId}`, updates);
  },

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/esign/templates/${templateId}`);
  },

  /**
   * Record template usage (increment counter)
   */
  async useTemplate(templateId: string): Promise<{ success: boolean; usageCount: number }> {
    return api.post<{ success: boolean; usageCount: number }>(`/esign/templates/${templateId}/use`);
  },

  // ==================== MAINTENANCE / BULK OPERATIONS ====================

  /**
   * Run envelope expiry sweep (admin only, dry-run-first pattern)
   */
  async runExpirySweep(dryRun = true): Promise<{
    success: boolean;
    scannedCount: number;
    expiredCount: number;
    skippedCount: number;
    expired: Array<{
      envelopeId: string;
      title: string;
      status: string;
      expiresAt: string;
      signerCount: number;
      signedCount: number;
    }>;
    errors: Array<{ envelopeId: string; error: string }>;
    dryRun: boolean;
    durationMs: number;
  }> {
    return api.post('/esign/maintenance/expiry-sweep', { dryRun });
  },

  /**
   * Send reminders to pending signers across multiple envelopes (admin only)
   */
  async bulkRemind(envelopeIds: string[], dryRun = true): Promise<{
    success: boolean;
    dryRun: boolean;
    envelopeCount: number;
    totalPendingSigners: number;
    totalRemindersSent: number;
    results: Array<{
      envelopeId: string;
      title: string;
      pendingSigners: Array<{ name: string; email: string }>;
      remindersSent: number;
      error?: string;
    }>;
  }> {
    return api.post('/esign/maintenance/bulk-remind', { envelopeIds, dryRun });
  },

  /**
   * Void multiple envelopes at once (admin only, dry-run-first pattern)
   */
  async bulkVoid(envelopeIds: string[], reason: string, dryRun = true): Promise<{
    success: boolean;
    dryRun: boolean;
    envelopeCount: number;
    voidedCount: number;
    results: Array<{
      envelopeId: string;
      title: string;
      previousStatus: string;
      voided: boolean;
      error?: string;
    }>;
  }> {
    return api.post('/esign/maintenance/bulk-void', { envelopeIds, reason, dryRun });
  },

  /**
   * Verify a document hash against stored envelope data (public)
   */
  async verifyDocumentHash(hash: string): Promise<{
    verified: boolean;
    matchType?: 'original' | 'signed';
    envelope?: {
      id: string;
      title: string;
      status: string;
      completedAt: string | null;
      createdAt: string;
    };
    signers?: Array<{
      name: string;
      role: string;
      status: string;
      signedAt: string | null;
    }>;
    message: string;
  }> {
    return api.post('/esign/verify-hash', { hash });
  },
};