// ============================================================================
// E-SIGNATURE API
// Client-side API for E-Signature module using shared API client
// ============================================================================

import { api } from '../../../../utils/api/client';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { createClient } from '../../../../utils/supabase/client';
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
  UpdateDraftSettingsRequest,
  UpdateDraftSettingsResponse,
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
    phone?: string;
    role: string;
    order: number;
    otpRequired?: boolean;
    accessCode?: string;
    clientId?: string;
    isSystemClient?: boolean;
    smsOptIn?: boolean;
  }>): Promise<{ success: boolean; count: number }> {
    return api.put<{ success: boolean; count: number }>(`/esign/envelopes/${envelopeId}/draft-signers`, { signers });
  },

  /**
   * Update editable envelope-level metadata (title, message, expiry, signing
   * mode) on a draft envelope. Phase 2 — used by the studio's settings popover.
   * Returns the diff of changed fields plus the latest envelope record.
   */
  async updateDraftSettings(envelopeId: string, payload: UpdateDraftSettingsRequest): Promise<UpdateDraftSettingsResponse> {
    return api.patch<UpdateDraftSettingsResponse>(`/esign/envelopes/${envelopeId}/draft-settings`, payload);
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

  // ==================== AUDIT SEARCH (P7.3) ====================

  /** Firm-scoped global audit search. */
  async searchAudit(params: {
    signer_email?: string;
    action?: string;
    from?: string;
    to?: string;
    envelope_id?: string;
    limit?: number;
  }): Promise<{
    hits: Array<{
      id: string;
      envelope_id: string;
      envelope_title: string;
      firm_id: string;
      actor_type: string;
      actor_id?: string;
      action: string;
      at: string;
      ip?: string;
      user_agent?: string;
      email?: string;
      phone?: string;
      metadata: Record<string, unknown>;
    }>;
    total: number;
    truncated: boolean;
    scanned: number;
    durationMs: number;
  }> {
    const qs = new URLSearchParams();
    if (params.signer_email) qs.set('signer_email', params.signer_email);
    if (params.action) qs.set('action', params.action);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.envelope_id) qs.set('envelope_id', params.envelope_id);
    if (params.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<{
      hits: Array<{
        id: string;
        envelope_id: string;
        envelope_title: string;
        firm_id: string;
        actor_type: string;
        actor_id?: string;
        action: string;
        at: string;
        ip?: string;
        user_agent?: string;
        email?: string;
        phone?: string;
        metadata: Record<string, unknown>;
      }>;
      total: number;
      truncated: boolean;
      scanned: number;
      durationMs: number;
    }>(`/esign/audit/search${suffix}`);
  },

  // ==================== RETENTION POLICY (P7.7) ====================

  async getRetentionPolicy(): Promise<{
    policy: {
      firm_id: string;
      completed_retention_days: number | null;
      terminated_retention_days: number | null;
      draft_retention_days: number | null;
      delete_artifacts: boolean;
      updated_at: string;
    } | null;
  }> {
    return api.get<{
      policy: {
        firm_id: string;
        completed_retention_days: number | null;
        terminated_retention_days: number | null;
        draft_retention_days: number | null;
        delete_artifacts: boolean;
        updated_at: string;
      } | null;
    }>(`/esign/retention`);
  },

  async setRetentionPolicy(payload: {
    completed_retention_days?: number | null;
    terminated_retention_days?: number | null;
    draft_retention_days?: number | null;
    delete_artifacts?: boolean;
  }): Promise<{ policy: Record<string, unknown> }> {
    return api.put<{ policy: Record<string, unknown> }>(`/esign/retention`, payload);
  },

  async deleteRetentionPolicy(): Promise<{ ok: boolean }> {
    return api.delete<{ ok: boolean }>(`/esign/retention`);
  },

  // ==================== FIRM BRANDING (P8.6) ====================

  async getFirmBranding(): Promise<{
    branding: {
      firm_id: string;
      display_name: string | null;
      logo_url: string | null;
      accent_hex: string | null;
      support_email: string | null;
      updated_at: string;
    } | null;
  }> {
    return api.get<{
      branding: {
        firm_id: string;
        display_name: string | null;
        logo_url: string | null;
        accent_hex: string | null;
        support_email: string | null;
        updated_at: string;
      } | null;
    }>(`/esign/branding`);
  },

  async setFirmBranding(payload: {
    display_name?: string | null;
    logo_url?: string | null;
    accent_hex?: string | null;
    support_email?: string | null;
  }): Promise<{ branding: Record<string, unknown> }> {
    return api.put<{ branding: Record<string, unknown> }>(`/esign/branding`, payload);
  },

  async deleteFirmBranding(): Promise<{ ok: boolean }> {
    return api.delete<{ ok: boolean }>(`/esign/branding`);
  },

  // ==================== SYNTHETIC PROBE (P7.4) ====================

  async getSyntheticProbe(): Promise<{
    latest: {
      ok: boolean; latencyMs: number; ranAt: string; error?: string;
      checks: Record<string, { ok: boolean; latencyMs: number; detail?: string }>;
    } | null;
    history: Array<{
      ok: boolean; latencyMs: number; ranAt: string; error?: string;
    }>;
  }> {
    return api.get<{
      latest: {
        ok: boolean; latencyMs: number; ranAt: string; error?: string;
        checks: Record<string, { ok: boolean; latencyMs: number; detail?: string }>;
      } | null;
      history: Array<{
        ok: boolean; latencyMs: number; ranAt: string; error?: string;
      }>;
    }>(`/esign/diagnostics/synthetic`);
  },

  async runSyntheticProbe(): Promise<{
    ok: boolean; latencyMs: number; ranAt: string; error?: string;
  }> {
    return api.post<{
      ok: boolean; latencyMs: number; ranAt: string; error?: string;
    }>(`/esign/diagnostics/synthetic/run`, {});
  },

  // ==================== METRICS (P7.1) ====================

  /** Org metrics bundle for the dashboard. */
  async getMetrics(): Promise<{
    firm_id: string;
    generated_at: string;
    statusCounts: Record<string, number>;
    funnel: {
      sent: number; opened: number; started: number; completed: number;
      sentToOpenedPct: number; openedToStartedPct: number; startedToCompletedPct: number;
    };
    timeToSign: {
      completedCount: number;
      averageMs: number | null;
      medianMs: number | null;
      byTemplate: Array<{ templateId: string | null; count: number; averageMs: number }>;
    };
    stuckEnvelopes: Array<{
      id: string; title: string; sent_at?: string;
      days_since_sent: number; signer_count: number; client_id?: string;
    }>;
    throughput30d: Array<{ date: string; completed: number     }>;
  }> {
    return api.get<{
      firm_id: string;
      generated_at: string;
      statusCounts: Record<string, number>;
      funnel: {
        sent: number; opened: number; started: number; completed: number;
        sentToOpenedPct: number; openedToStartedPct: number; startedToCompletedPct: number;
      };
      timeToSign: {
        completedCount: number;
        averageMs: number | null;
        medianMs: number | null;
        byTemplate: Array<{ templateId: string | null; count: number; averageMs: number }>;
      };
      stuckEnvelopes: Array<{
        id: string; title: string; sent_at?: string;
        days_since_sent: number; signer_count: number; client_id?: string;
      }>;
      throughput30d: Array<{ date: string; completed: number }>;
    }>(`/esign/metrics`);
  },

  // ==================== RECOVERY BIN (P6.8) ====================

  /** List soft-deleted envelopes for the caller's firm. */
  async listRecoveryBin(): Promise<{ envelopes: Array<Record<string, unknown>>; retention_days: number }> {
    return api.get(`/esign/recovery-bin`);
  },

  /** Restore a soft-deleted envelope. */
  async restoreEnvelope(envelopeId: string): Promise<{ success: boolean; envelope: Record<string, unknown> }> {
    return api.post(`/esign/recovery-bin/${envelopeId}/restore`, {});
  },

  /** Permanently purge a single envelope from the recovery bin. */
  async purgeEnvelope(envelopeId: string): Promise<{ success: boolean; purged: boolean }> {
    return api.delete(`/esign/recovery-bin/${envelopeId}`);
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
   * Record template usage (increment counter). P4.2 — returns the
   * pinned `version` so the express wizard can stamp it onto the
   * envelope at create-time.
   */
  async useTemplate(templateId: string): Promise<{
    success: boolean;
    usageCount: number;
    version: number;
    template: EsignTemplateRecord;
  }> {
    return api.post(`/esign/templates/${templateId}/use`);
  },

  /** P4.2 — list versions of a template. */
  async listTemplateVersions(templateId: string): Promise<{
    versions: Array<{ version: number; isLive: boolean; record: EsignTemplateRecord | null }>;
  }> {
    return api.get(`/esign/templates/${templateId}/versions`);
  },

  /** P4.2 — fetch a specific historical version of a template. */
  async getTemplateVersion(
    templateId: string,
    version: number,
  ): Promise<{ template: EsignTemplateRecord }> {
    return api.get(`/esign/templates/${templateId}/versions/${version}`);
  },

  // ==================== P4.7 — BULK SEND CAMPAIGNS ====================

  /**
   * Create a campaign from a CSV-driven recipient list. The server
   * persists the row plan; the client then drives per-row dispatch via
   * the standard upload + invites endpoints, reporting outcomes back
   * via `recordCampaignRowResult`.
   */
  async createCampaign(req: {
    templateId: string;
    templateVersion?: number;
    title: string;
    message?: string;
    expiryDays?: number;
    csvText?: string;
    rows?: Array<{
      rowId?: string;
      signers: Array<{ name: string; email: string; role?: string; order?: number }>;
    }>;
  }): Promise<{ campaign: import('./types').CampaignRecord; warnings: string[] }> {
    return api.post('/esign/campaigns', req);
  },

  async listCampaigns(): Promise<{ campaigns: import('./types').CampaignRecord[] }> {
    return api.get('/esign/campaigns');
  },

  async getCampaign(id: string): Promise<{ campaign: import('./types').CampaignRecord }> {
    return api.get(`/esign/campaigns/${id}`);
  },

  async cancelCampaign(id: string): Promise<{ campaign: import('./types').CampaignRecord }> {
    return api.post(`/esign/campaigns/${id}/cancel`);
  },

  async recordCampaignRowResult(
    id: string,
    rowId: string,
    body: { status: 'sent' | 'failed' | 'cancelled' | 'queued'; envelopeId?: string; errorMessage?: string },
  ): Promise<{ campaign: import('./types').CampaignRecord }> {
    return api.post(`/esign/campaigns/${id}/results/${rowId}`, body);
  },

  // ==================== PACKETS (P4.8) ====================

  /**
   * Upload a PDF without spawning an envelope. Returns a `documentId`
   * the caller can attach to a packet-run step (the server-side
   * advancement loop will materialise the envelope when its turn
   * comes round).
   */
  async uploadStandaloneDocument(file: File, firmId?: string): Promise<{
    documentId: string;
    pageCount: number;
    hash: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (firmId) formData.append('firmId', firmId);
    return api.post('/esign/documents/upload', formData);
  },

  async createPacket(req: {
    name: string;
    description?: string;
    steps: Array<{ templateId: string; templateVersion?: number; label?: string }>;
    firmId?: string;
  }): Promise<{ packet: import('./types').PacketRecord }> {
    return api.post('/esign/packets', req);
  },

  async listPackets(): Promise<{ packets: import('./types').PacketRecord[] }> {
    return api.get('/esign/packets');
  },

  async getPacket(id: string): Promise<{ packet: import('./types').PacketRecord }> {
    return api.get(`/esign/packets/${id}`);
  },

  async deletePacket(id: string): Promise<{ ok: boolean }> {
    return api.delete(`/esign/packets/${id}`);
  },

  async startPacketRun(req: {
    packetId: string;
    recipients: Array<{ name: string; email: string; role?: string; order: number }>;
    documentIdsByStep: string[];
    clientId?: string;
    firmId?: string;
    expiryDays?: number;
    message?: string;
  }): Promise<{
    run: import('./types').PacketRunRecord;
    firstEnvelopeId?: string;
    warning?: string;
  }> {
    return api.post('/esign/packet-runs', req);
  },

  async listPacketRuns(): Promise<{ runs: import('./types').PacketRunRecord[] }> {
    return api.get('/esign/packet-runs');
  },

  async getPacketRun(id: string): Promise<{ run: import('./types').PacketRunRecord }> {
    return api.get(`/esign/packet-runs/${id}`);
  },

  async cancelPacketRun(id: string): Promise<{ run: import('./types').PacketRunRecord }> {
    return api.post(`/esign/packet-runs/${id}/cancel`);
  },

  // ==================== P5.2 — SENDER NOTIFICATION PREFERENCES ==================

  async getNotificationPreferences(): Promise<{
    success: boolean;
    preferences: {
      userId: string;
      mode: 'every_event' | 'completion_only' | 'digest' | 'off';
      perEvent?: Record<string, boolean>;
      updated_at: string;
    };
  }> {
    return api.get('/esign/me/notification-prefs');
  },

  async setNotificationPreferences(input: {
    mode?: 'every_event' | 'completion_only' | 'digest' | 'off';
    perEvent?: Record<string, boolean>;
  }): Promise<{
    success: boolean;
    preferences: {
      userId: string;
      mode: 'every_event' | 'completion_only' | 'digest' | 'off';
      perEvent?: Record<string, boolean>;
      updated_at: string;
    };
  }> {
    return api.put('/esign/me/notification-prefs', input);
  },

  // ==================== P5.4 — WEBHOOK SUBSCRIPTIONS ====================

  async listWebhookSubscriptions(): Promise<{
    subscriptions: Array<{
      id: string;
      url: string;
      secret: string;
      events: string[];
      active: boolean;
      description?: string;
      created_at: string;
      updated_at: string;
      last_success_at?: string;
      last_failure_at?: string;
      last_failure_message?: string;
    }>;
  }> {
    return api.get('/esign/webhooks');
  },

  async createWebhookSubscription(input: {
    url: string;
    events: string[];
    description?: string;
  }): Promise<{ subscription: { id: string; secret: string; url: string; events: string[]; active: boolean } }> {
    return api.post('/esign/webhooks', input);
  },

  async updateWebhookSubscription(
    id: string,
    patch: { url?: string; events?: string[]; active?: boolean; description?: string },
  ): Promise<{ subscription: { id: string; url: string; events: string[]; active: boolean } }> {
    return api.patch(`/esign/webhooks/${id}`, patch);
  },

  async rotateWebhookSecret(id: string): Promise<{ subscription: { id: string; secret: string } }> {
    return api.post(`/esign/webhooks/${id}/rotate-secret`);
  },

  async deleteWebhookSubscription(id: string): Promise<{ success: boolean }> {
    return api.delete(`/esign/webhooks/${id}`);
  },

  async listWebhookDeliveries(opts?: {
    status?: 'pending' | 'delivered' | 'failed' | 'dead';
    limit?: number;
  }): Promise<{
    deliveries: Array<{
      id: string;
      subscription_id: string;
      event_type: string;
      envelope_id?: string;
      attempts: number;
      status: 'pending' | 'delivered' | 'failed' | 'dead';
      next_attempt_at: string;
      last_attempt_at?: string;
      last_error?: string;
      response_code?: number;
      created_at: string;
      delivered_at?: string;
    }>;
  }> {
    const qs = new URLSearchParams();
    if (opts?.status) qs.set('status', opts.status);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get(`/esign/webhooks/deliveries${suffix}`);
  },

  async listWebhookDeadLetters(): Promise<{
    deliveries: Array<{ id: string; event_type: string; last_error?: string; attempts: number; created_at: string }>;
  }> {
    return api.get('/esign/webhooks/dead-letters');
  },

  async replayWebhookDelivery(id: string): Promise<{ delivery: { id: string; status: string } }> {
    return api.post(`/esign/webhooks/deliveries/${id}/replay`);
  },

  // ==================== P5.7 — IN-APP NOTIFICATIONS ====================

  async listInAppNotifications(opts?: { limit?: number; unreadOnly?: boolean }): Promise<{
    success: boolean;
    items: Array<{
      id: string;
      user_id: string;
      type: string;
      title: string;
      body: string;
      envelope_id?: string;
      signer_id?: string;
      created_at: string;
      read_at?: string;
      metadata?: Record<string, unknown>;
    }>;
    unread: number;
    total: number;
  }> {
    const qs = new URLSearchParams();
    if (opts?.limit) qs.set('limit', String(opts.limit));
    if (opts?.unreadOnly) qs.set('unreadOnly', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get(`/esign/me/notifications${suffix}`);
  },

  async markInAppNotificationRead(id: string): Promise<{ success: boolean }> {
    return api.post(`/esign/me/notifications/${id}/read`);
  },

  async markAllInAppNotificationsRead(): Promise<{ success: boolean; updated: number }> {
    return api.post(`/esign/me/notifications/read-all`);
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

  // ==================== P3.3 — PAGE MANIFEST ====================

  /**
   * Fetch the current page-transformation manifest for an envelope. Returns
   * `null` when the sender hasn't customised page order (i.e. the original
   * PDF is the source of truth).
   */
  async getPageManifest(envelopeId: string): Promise<{ manifest: PageManifestPayload | null }> {
    return api.get(`/esign/envelopes/${envelopeId}/manifest`);
  },

  /** Save / replace the page manifest. Server validates source-page bounds. */
  async savePageManifest(
    envelopeId: string,
    manifest: PageManifestPayload,
  ): Promise<{ success: boolean; manifest: PageManifestPayload }> {
    return api.put(`/esign/envelopes/${envelopeId}/manifest`, { manifest });
  },

  /** Discard the manifest — signer will see the original PDF unchanged. */
  async clearPageManifest(envelopeId: string): Promise<{ success: boolean }> {
    return api.delete(`/esign/envelopes/${envelopeId}/manifest`);
  },

  /**
   * Render a transient preview of the manifest applied to the source PDF.
   * Returns a short-lived signed URL plus a pageMap so the studio can
   * remap field placements visually.
   */
  async materializePagePreview(
    envelopeId: string,
    manifest?: PageManifestPayload,
  ): Promise<{ url: string; pageCount: number; pageMap: Record<number, number | null> }> {
    return api.post(`/esign/envelopes/${envelopeId}/materialize-preview`, manifest ? { manifest } : {});
  },

  // ─────────────────────────────────────────────────────────────────────────
  // P3.4 — Multi-document envelope operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the ordered list of documents for an envelope. Each document
   * carries a presigned URL so the studio can render it without an
   * extra round-trip.
   */
  async listEnvelopeDocuments(envelopeId: string): Promise<{ documents: EnvelopeDocumentRef[] }> {
    return api.get(`/esign/envelopes/${envelopeId}/documents`);
  },

  /**
   * Append a new document to an existing draft envelope. Uses fetch
   * directly because we need multipart/form-data; the shared `api`
   * client only supports JSON bodies.
   */
  async addEnvelopeDocument(
    envelopeId: string,
    file: File,
    options?: { displayName?: string; idempotencyKey?: string },
  ): Promise<{ documents: EnvelopeDocumentRef[]; added: { document_id: string; page_count: number } }> {
    const fd = new FormData();
    fd.append('file', file);
    if (options?.displayName) fd.append('display_name', options.displayName);
    // Multipart bodies bypass the shared `api` client so we resolve the
    // current Supabase access token here. Falls back to the anon key for
    // unauthenticated callers (which the server will then reject).
    let token = publicAnonKey;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) token = data.session.access_token;
    } catch {
      /* fall back to anon */
    }
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/esign/envelopes/${envelopeId}/documents`,
      {
        method: 'POST',
        headers: {
          ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to add document (${res.status})`);
    }
    return res.json();
  },

  /**
   * Remove a document from a draft envelope. Refuses to remove the
   * last document.
   */
  async removeEnvelopeDocument(
    envelopeId: string,
    documentId: string,
  ): Promise<{ documents: EnvelopeDocumentRef[] }> {
    return api.delete(`/esign/envelopes/${envelopeId}/documents/${documentId}`);
  },

  /**
   * Reorder the envelope's documents. `order` is the desired list of
   * document_ids; missing ids are appended at the end so a stale
   * client cannot accidentally drop documents.
   */
  async reorderEnvelopeDocuments(
    envelopeId: string,
    order: string[],
  ): Promise<{ documents: EnvelopeDocumentRef[] }> {
    return api.put(`/esign/envelopes/${envelopeId}/documents/order`, { order });
  },
};

/**
 * P3.4 — Document reference returned by the multi-document API. The
 * `url` is a presigned URL valid for one hour.
 */
export interface EnvelopeDocumentRef {
  document_id: string;
  order: number;
  display_name: string;
  original_filename: string;
  page_count: number;
  storage_path: string;
  added_at: string;
  added_by_user_id?: string;
  url?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// P3.3 — Page manifest payload type. Mirrors `PageManifest` on the server.
// ─────────────────────────────────────────────────────────────────────────────

export interface PageManifestPayload {
  version: 1;
  pages: Array<{
    sourcePage: number;
    rotation: 0 | 90 | 180 | 270;
  }>;
  note?: string;
}