import { getApiBaseUrl } from './apiBase';
/**
 * Audit search and export, retention policy, branding, reminders, signing mode.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import { ReminderConfig, SigningMode } from '../types';

export const complianceApi = {
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
  async updateReminderConfig(
    envelopeId: string,
    config: Partial<ReminderConfig>,
  ): Promise<{ config: ReminderConfig }> {
    return api.put<{ config: ReminderConfig }>(
      `/esign/envelopes/${envelopeId}/reminder-config`,
      config,
    );
  },

  // ==================== SIGNING MODE ====================

  /**
   * Update signing mode for an envelope
   */
  async updateSigningMode(
    envelopeId: string,
    signingMode: SigningMode,
  ): Promise<{ success: boolean; signing_mode: SigningMode }> {
    return api.patch<{ success: boolean; signing_mode: SigningMode }>(
      `/esign/envelopes/${envelopeId}/signing-mode`,
      { signing_mode: signingMode },
    );
  },

  /**
   * Send manual reminder to pending signers
   */
  async sendReminder(envelopeId: string): Promise<{
    success: boolean;
    remindersSent: { signerId: string; email: string; sentAt: string }[];
    totalReminders: number;
  }> {
    return api.post<{
      success: boolean;
      remindersSent: { signerId: string; email: string; sentAt: string }[];
      totalReminders: number;
    }>(`/esign/envelopes/${envelopeId}/remind`);
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
    return `${getApiBaseUrl()}/envelopes/${envelopeId}/audit/export`;
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
};
