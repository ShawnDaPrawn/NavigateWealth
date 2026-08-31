import { api } from '../../../../utils/api/client';
import { ENDPOINTS } from './constants';
import {
  Client,
  ClientGroup,
  EmailTemplate,
  CommunicationCampaign,
  BackendCampaign,
  ActivityLogEntry,
  CampaignHistoryPageResult,
  AttachmentFile,
  CommunicationLog,
  SendMessageResponse,
  MessageCreate,
  CommunicationMessage,
  EmailFooterSettings,
} from './types';
import { ProductProvider } from '../product-management';

// Raw template shape from the backend
interface BackendTemplate {
  id: string;
  name: string;
  enabled?: boolean;
  subject: string;
  title?: string;
  subtitle?: string;
  greeting?: string;
  content: string;
  buttonLabel?: string;
  buttonUrl?: string;
  footerNote?: string;
  category: string;
  createdAt: string;
  isSystem?: boolean;
}

// Helper to map backend Template to frontend EmailTemplate
const mapTemplateToFrontend = (data: BackendTemplate): EmailTemplate => ({
  id: data.id,
  name: data.name,
  enabled: data.enabled ?? true,
  subject: data.subject,
  title: data.title || '',
  subtitle: data.subtitle || '',
  greeting: data.greeting || '',
  bodyHtml: data.content,
  buttonLabel: data.buttonLabel || '',
  buttonUrl: data.buttonUrl || '',
  footerNote: data.footerNote || '',
  category: data.category,
  createdAt: data.createdAt,
  isSystem: data.isSystem,
});

// Helper to map frontend EmailTemplate to backend Template
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

function decodeHtmlEntities(text: string): string {
  if (typeof document !== 'undefined') {
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
  }
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Plain-text preview for campaign history: no tags, decoded entities, merge tokens shown as ellipsis. */
function buildCampaignMessagePreview(bodyHtml: string | undefined, maxLen = 120): string {
  if (!bodyHtml?.trim()) return '';
  let plain = stripHtmlTags(bodyHtml);
  plain = decodeHtmlEntities(plain);
  plain = plain.replace(/\{\{[^}]+\}\}/g, '…');
  plain = plain.replace(/\s+/g, ' ').trim();
  if (maxLen <= 0 || plain.length <= maxLen) return plain;
  return `${plain.slice(0, Math.max(0, maxLen - 1))}…`;
}

function decodePlainHistoryText(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  let t = decodeHtmlEntities(text);
  t = t.replace(/\{\{[^}]+\}\}/g, '…');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function mapCampaignsToActivityLog(campaigns: BackendCampaign[]): ActivityLogEntry[] {
  return campaigns
    .map((campaign): ActivityLogEntry => {
      const createdBy = campaign.createdBy || 'system';
      const userName =
        campaign.createdByName ||
        (createdBy === 'admin' ? 'Administrator' : createdBy === 'system' ? 'System' : createdBy);
      const groupName =
        typeof campaign.selectedGroup?.name === 'string' ? campaign.selectedGroup.name : undefined;

      return {
        id: campaign.id,
        timestamp: campaign.createdAt ? new Date(campaign.createdAt) : new Date(0),
        userId: createdBy,
        userName,
        channel: campaign.channel,
        recipientType: campaign.recipientType,
        recipientCount:
          campaign.stats?.total ||
          campaign.selectedRecipients?.length ||
          (campaign.selectedGroup ? campaign.selectedGroup.clientCount : 0) ||
          0,
        groupName,
        subject: decodePlainHistoryText(campaign.subject),
        messagePreview: buildCampaignMessagePreview(campaign.bodyHtml, 120),
        messagePreviewFull: buildCampaignMessagePreview(campaign.bodyHtml, 8000),
        attachmentCount: campaign.attachments?.length || 0,
        // Individual messages are not template-driven; labelling them
        // "Custom Email" alongside campaigns hides the distinction the
        // adviser cares about.
        templateUsed: campaign.origin === 'direct' ? 'Individual Message' : 'Custom Email',
        status: campaign.status,
        origin: campaign.origin === 'direct' ? 'direct' : 'campaign',
        stats: campaign.stats,
        cc: campaign.cc,
        failureReason: campaign.failureReason,
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

const mapTemplateToBackend = (
  template: EmailTemplate,
): Omit<BackendTemplate, 'id' | 'createdAt' | 'isSystem'> => ({
  name: template.name,
  enabled: template.enabled,
  subject: template.subject,
  title: template.title,
  subtitle: template.subtitle,
  greeting: template.greeting,
  content: template.bodyHtml,
  buttonLabel: template.buttonLabel,
  buttonUrl: template.buttonUrl,
  footerNote: template.footerNote,
  category: template.category ?? '',
});

export const communicationApi = {
  // Clients & Groups
  async getClients(): Promise<Client[]> {
    return api.get<Client[]>(ENDPOINTS.CLIENTS);
  },

  async getAllClients(): Promise<Client[]> {
    return api.get<Client[]>(ENDPOINTS.CLIENTS);
  },

  async getGroups(page = 1, limit = 100): Promise<ClientGroup[]> {
    const response = await api.get<{ data: ClientGroup[] }>(
      `${ENDPOINTS.GROUPS}?page=${page}&limit=${limit}`,
    );
    return response.data || [];
  },

  async getGroupById(id: string): Promise<ClientGroup> {
    const response = await api.get<{ group: ClientGroup }>(ENDPOINTS.GROUP_BY_ID(id));
    return response.group;
  },

  async createGroup(group: Partial<ClientGroup>): Promise<ClientGroup> {
    const response = await api.post<{ group: ClientGroup }>(ENDPOINTS.GROUPS, group);
    return response.group;
  },

  async updateGroup(id: string, group: Partial<ClientGroup>): Promise<ClientGroup> {
    const response = await api.put<{ group: ClientGroup }>(ENDPOINTS.GROUP_BY_ID(id), group);
    return response.group;
  },

  async deleteGroup(id: string): Promise<void> {
    return api.delete<void>(ENDPOINTS.GROUP_BY_ID(id));
  },

  async recalculateGroupMemberships(): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>(`${ENDPOINTS.GROUPS}/recalculate`, {});
  },

  async debugGroups(): Promise<{ groups: unknown[]; clients: unknown[]; summary: unknown }> {
    return api.get<{ groups: unknown[]; clients: unknown[]; summary: unknown }>(
      `${ENDPOINTS.GROUPS}/debug`,
    );
  },

  // Templates
  async getAllTemplates(): Promise<EmailTemplate[]> {
    // This supports both the legacy simple list and the detailed list from settings service
    // We'll standardize on the detailed one
    const response = await api.get<{ templates: BackendTemplate[] }>(ENDPOINTS.TEMPLATES);
    return (response.templates || []).map(mapTemplateToFrontend);
  },

  async getTemplate(id: string): Promise<EmailTemplate> {
    const response = await api.get<{ template: BackendTemplate }>(`${ENDPOINTS.TEMPLATES}/${id}`);
    return mapTemplateToFrontend(response.template);
  },

  async createTemplate(template: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const backendData = mapTemplateToBackend(template as EmailTemplate);
    const response = await api.post<{ template: BackendTemplate }>(
      ENDPOINTS.TEMPLATES,
      backendData,
    );
    return mapTemplateToFrontend(response.template);
  },

  async saveTemplate(template: EmailTemplate): Promise<void> {
    const backendData = mapTemplateToBackend(template);

    if (template.id) {
      await api.put(`${ENDPOINTS.TEMPLATES}/${template.id}`, backendData);
      return;
    }

    await api.post(ENDPOINTS.TEMPLATES, backendData);
  },

  async toggleTemplate(id: string, enabled: boolean): Promise<void> {
    await api.put(`${ENDPOINTS.TEMPLATES}/${id}`, { enabled });
  },

  // Email Footer
  async getFooterSettings(): Promise<EmailFooterSettings> {
    try {
      return await api.get<EmailFooterSettings>(ENDPOINTS.EMAIL_FOOTER);
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { status?: number } };
      if (err?.status === 404 || err?.response?.status === 404) {
        return {
          companyName: '',
          address: '',
          contactEmail: '',
          contactPhone: '',
          socialLinks: {},
          copyrightText: '',
        };
      }
      throw error;
    }
  },

  async saveFooterSettings(settings: EmailFooterSettings): Promise<void> {
    await api.post(ENDPOINTS.EMAIL_FOOTER, settings);
  },

  // Campaigns
  async getAllCampaigns(): Promise<CommunicationCampaign[]> {
    const response = await api.get<{ campaigns: CommunicationCampaign[] }>(
      `${ENDPOINTS.CAMPAIGNS}?all=1`,
    );
    return response.campaigns || [];
  },

  async createCampaign(campaign: Partial<CommunicationCampaign>): Promise<CommunicationCampaign> {
    const response = await api.post<{ campaign: CommunicationCampaign }>(
      ENDPOINTS.CAMPAIGNS,
      campaign,
    );
    return response.campaign;
  },

  async sendCampaign(id: string): Promise<{ success: boolean; message?: string }> {
    return api.post<{ success: boolean; message?: string }>(ENDPOINTS.CAMPAIGN_SEND(id), {});
  },

  // History & Logs
  /** Paginated + filtered campaign history (server-side). */
  async getHistoryPage(params: {
    page?: number;
    limit?: number;
    search?: string;
    channel?: string;
    recipientType?: string;
    createdBy?: string;
    status?: string;
    origin?: string;
  }): Promise<CampaignHistoryPageResult> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', String(limit));
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.channel && params.channel !== 'all') q.set('channel', params.channel);
    if (params.recipientType && params.recipientType !== 'all') {
      q.set('recipientType', params.recipientType);
    }
    if (params.createdBy && params.createdBy !== 'all') q.set('createdBy', params.createdBy);
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.origin && params.origin !== 'all') q.set('origin', params.origin);
    const response = await api.get<{
      campaigns: BackendCampaign[];
      total: number;
      page: number;
      limit: number;
      senderOptions?: { userId: string; label: string }[];
    }>(`${ENDPOINTS.CAMPAIGNS}?${q.toString()}`);
    return {
      entries: mapCampaignsToActivityLog(response.campaigns || []),
      total: response.total ?? 0,
      page: response.page ?? page,
      limit: response.limit ?? limit,
      senderOptions: response.senderOptions ?? [],
    };
  },

  /** Paginated campaign rows (server page/limit, no extra filters). */
  async getHistory(page = 1, limit = 50): Promise<ActivityLogEntry[]> {
    const r = await this.getHistoryPage({ page, limit });
    return r.entries;
  },

  async getClientLogs(clientId: string): Promise<CommunicationLog[]> {
    const response = await api.get<{ communications: CommunicationLog[] }>(
      ENDPOINTS.CLIENT_LOGS(clientId),
    );
    return response.communications || [];
  },

  async deleteLog(id: string): Promise<void> {
    return api.delete<void>(`${ENDPOINTS.LOGS}/${id}`);
  },

  // Files
  async uploadFile(file: File): Promise<AttachmentFile> {
    const formData = new FormData();
    formData.append('file', file);

    // Was a raw fetch sending `Bearer ${publicAnonKey}` at a route guarded by
    // `requireAuth, requireAdmin` (communication-routes.ts:88) — so this upload
    // could never have succeeded, from the day it was written. The anon key is
    // not a credential; it 401s. The shared client sends the real session JWT,
    // and already strips Content-Type for FormData so the browser can set the
    // multipart boundary.
    return api.post<AttachmentFile>(ENDPOINTS.UPLOAD, formData);
  },

  // Direct Messages & Inbox
  async sendDirectMessage(data: {
    clientId: string;
    subject: string;
    message: string;
    category: string;
    priority: string;
    sendEmail: boolean;
    clientEmail?: string; // Added client email parameter
    attachments?: AttachmentFile[]; // Added attachments parameter
    cc?: string[]; // Added CC parameter
  }): Promise<SendMessageResponse> {
    const payload: MessageCreate = {
      recipients: [data.clientId],
      subject: data.subject,
      content: data.message,
      category: data.category,
      priority: data.priority,
      sendEmail: data.sendEmail,
      recipientEmail: data.clientEmail, // Pass client email for email sending
      senderName: 'Navigate Wealth Admin',
      attachments: data.attachments, // Pass attachments if provided
      cc: data.cc, // Pass CCs
    };

    // Was a hand-rolled fetch falling back to `publicAnonKey` when there was no
    // session — which cannot authenticate, so the fallback only ever turned
    // "logged out" into a confusing 401. The shared client sends the session JWT
    // (or no Authorization header at all), and applies the same error handling
    // this block was duplicating.
    try {
      return await api.post<SendMessageResponse>(ENDPOINTS.SEND_DIRECT, payload);
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  async getInbox(): Promise<CommunicationMessage[]> {
    const response = await api.get<{ messages: CommunicationMessage[] }>(ENDPOINTS.INBOX);
    return response.messages || [];
  },

  async markAsRead(id: string): Promise<void> {
    return api.post<void>(ENDPOINTS.READ_MESSAGE(id), {});
  },

  async deleteMessage(id: string): Promise<void> {
    return api.delete<void>(ENDPOINTS.MESSAGE_BY_ID(id));
  },

  // Integrations / Providers
  async getProviders(): Promise<ProductProvider[]> {
    try {
      const response = await api.get<{ providers: ProductProvider[] } | ProductProvider[]>(
        'integrations/providers',
      );

      let providers: Array<{ id: string; name: string; logoUrl?: string; categoryIds?: string[] }> =
        [];
      if (Array.isArray(response)) {
        providers = response;
      } else if (response && Array.isArray(response.providers)) {
        providers = response.providers as Array<{
          id: string;
          name: string;
          logoUrl?: string;
          categoryIds?: string[];
        }>;
      }

      return providers.map((p) => ({
        id: p.id,
        name: p.name,
        logo: p.logoUrl,
        brokerConsultants: [],
        supportedProducts: [],
        active: true,
        categoryIds: p.categoryIds || [],
      }));
    } catch (_error) {
      console.warn(
        'Failed to fetch providers from integrations, trying fallback product-management endpoint',
      );
      try {
        const response = await api.get<{ providers: ProductProvider[] }>(
          'product-management/providers',
        );
        return response.providers || [];
      } catch (fallbackError) {
        console.error('Failed to fetch providers from both endpoints', fallbackError);
        return [];
      }
    }
  },
};
