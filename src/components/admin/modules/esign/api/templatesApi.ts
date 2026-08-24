/**
 * Templates, bulk-send campaigns and packets.
 *
 * One slice of what used to be the single 1,300-line `esignApi` object. The
 * aggregate in `../api.ts` spreads every slice back together, so consumers
 * keep calling `esignApi.method(...)` unchanged.
 */
import { api } from '../../../../../utils/api/client';
import { logger } from '../../../../../utils/logger';
import {
  EsignEnvelope,
  EsignTemplateRecord,
  CreateTemplateInput,
  UpdateTemplateInput,
} from '../types';
import type { EnvelopeDocumentRef } from '../api';

export const templatesApi = {
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
  async updateTemplate(
    templateId: string,
    updates: UpdateTemplateInput,
  ): Promise<{ template: EsignTemplateRecord }> {
    return api.put<{ template: EsignTemplateRecord }>(`/esign/templates/${templateId}`, updates);
  },

  /**
   * Rebuild an existing template from a configured draft envelope so the
   * saved documents, fields, and recipient slots all stay in sync.
   */
  async syncTemplateFromEnvelope(input: {
    templateId: string;
    envelopeId: string;
    name?: string;
    description?: string;
    category?: string;
  }): Promise<{ template: EsignTemplateRecord }> {
    return api.post<{ template: EsignTemplateRecord }>(
      `/esign/templates/${input.templateId}/from-envelope`,
      {
        envelopeId: input.envelopeId,
        name: input.name,
        description: input.description,
        category: input.category,
      },
    );
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

  /**
   * Clone a template's saved source documents into a fresh draft envelope,
   * returning a document-id map so the client can hydrate template fields
   * onto the new draft without re-uploading a PDF.
   */
  async materialiseTemplateDraft(input: {
    templateId: string;
    title?: string;
    message?: string;
    expiryDays?: number;
    clientId?: string;
    campaignId?: string;
    packetRunId?: string;
    packetStepIndex?: number;
  }): Promise<{
    envelope: EsignEnvelope;
    documentMap: Record<string, string>;
    documents: EnvelopeDocumentRef[];
  }> {
    return api.post(`/esign/templates/${input.templateId}/materialise-draft`, {
      title: input.title,
      message: input.message,
      expiryDays: input.expiryDays,
      clientId: input.clientId,
      campaignId: input.campaignId,
      packetRunId: input.packetRunId,
      packetStepIndex: input.packetStepIndex,
    });
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
  }): Promise<{ campaign: import('../types').CampaignRecord; warnings: string[] }> {
    return api.post('/esign/campaigns', req);
  },

  async listCampaigns(): Promise<{ campaigns: import('../types').CampaignRecord[] }> {
    return api.get('/esign/campaigns');
  },

  async getCampaign(id: string): Promise<{ campaign: import('../types').CampaignRecord }> {
    return api.get(`/esign/campaigns/${id}`);
  },

  async cancelCampaign(id: string): Promise<{ campaign: import('../types').CampaignRecord }> {
    return api.post(`/esign/campaigns/${id}/cancel`);
  },

  async recordCampaignRowResult(
    id: string,
    rowId: string,
    body: {
      status: 'sent' | 'failed' | 'cancelled' | 'queued';
      envelopeId?: string;
      errorMessage?: string;
    },
  ): Promise<{ campaign: import('../types').CampaignRecord }> {
    return api.post(`/esign/campaigns/${id}/results/${rowId}`, body);
  },

  // ==================== PACKETS (P4.8) ====================

  /**
   * Upload a PDF without spawning an envelope. Returns a `documentId`
   * the caller can attach to a packet-run step (the server-side
   * advancement loop will materialise the envelope when its turn
   * comes round).
   */
  async uploadStandaloneDocument(
    file: File,
    firmId?: string,
  ): Promise<{
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
  }): Promise<{ packet: import('../types').PacketRecord }> {
    return api.post('/esign/packets', req);
  },

  async listPackets(): Promise<{ packets: import('../types').PacketRecord[] }> {
    return api.get('/esign/packets');
  },

  async getPacket(id: string): Promise<{ packet: import('../types').PacketRecord }> {
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
    run: import('../types').PacketRunRecord;
    firstEnvelopeId?: string;
    warning?: string;
  }> {
    return api.post('/esign/packet-runs', req);
  },

  async listPacketRuns(): Promise<{ runs: import('../types').PacketRunRecord[] }> {
    return api.get('/esign/packet-runs');
  },

  async getPacketRun(id: string): Promise<{ run: import('../types').PacketRunRecord }> {
    return api.get(`/esign/packet-runs/${id}`);
  },

  async cancelPacketRun(id: string): Promise<{ run: import('../types').PacketRunRecord }> {
    return api.post(`/esign/packet-runs/${id}/cancel`);
  },
};
