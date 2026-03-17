import { api } from '../../../../utils/api/client';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { createClient } from '../../../../utils/supabase/client';
import { ENDPOINTS, BASE_URL } from './constants';
import {
  Client,
  ClientGroup,
  EmailTemplate,
  CommunicationCampaign,
  BackendCampaign,
  ActivityLogEntry,
  AttachmentFile,
  CommunicationLog,
  SendMessageResponse,
  MessageCreate,
  CommunicationMessage,
  EmailFooterSettings
} from './types';
import { ProductProvider } from '../product-management/types';

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
  isSystem: data.isSystem
});

// Helper to map frontend EmailTemplate to backend Template
const mapTemplateToBackend = (template: EmailTemplate): Omit<BackendTemplate, 'id' | 'createdAt' | 'isSystem'> => ({
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
  category: template.category
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
    const response = await api.get<{ data: ClientGroup[] }>(`${ENDPOINTS.GROUPS}?page=${page}&limit=${limit}`);
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
    return api.get<{ groups: unknown[]; clients: unknown[]; summary: unknown }>(`${ENDPOINTS.GROUPS}/debug`);
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
    const response = await api.post<{ template: BackendTemplate }>(ENDPOINTS.TEMPLATES, backendData);
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
          copyrightText: ''
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
    const response = await api.get<{ campaigns: CommunicationCampaign[] }>(ENDPOINTS.CAMPAIGNS);
    return response.campaigns || [];
  },

  async createCampaign(campaign: Partial<CommunicationCampaign>): Promise<CommunicationCampaign> {
    const response = await api.post<{ campaign: CommunicationCampaign }>(ENDPOINTS.CAMPAIGNS, campaign);
    return response.campaign;
  },

  async sendCampaign(id: string): Promise<{ success: boolean; message?: string }> {
    return api.post<{ success: boolean; message?: string }>(ENDPOINTS.CAMPAIGN_SEND(id), {});
  },

  // History & Logs
  async getHistory(page = 1, limit = 50): Promise<ActivityLogEntry[]> {
    const response = await api.get<{ campaigns: BackendCampaign[] }>(`${ENDPOINTS.CAMPAIGNS}?page=${page}&limit=${limit}`);
    const campaigns = response.campaigns || [];
    
    return campaigns.map((campaign) => ({
      id: campaign.id,
      timestamp: new Date(campaign.createdAt),
      userId: campaign.createdBy || 'system',
      userName: campaign.createdBy === 'admin' ? 'Administrator' : (campaign.createdBy || 'System'),
      channel: campaign.channel,
      recipientType: campaign.recipientType,
      recipientCount: campaign.stats?.total || campaign.selectedRecipients?.length || (campaign.selectedGroup ? campaign.selectedGroup.clientCount : 0) || 0,
      subject: campaign.subject,
      messagePreview: campaign.bodyHtml ? campaign.bodyHtml.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : '',
      attachmentCount: campaign.attachments?.length || 0,
      templateUsed: 'Custom Email',
      status: campaign.status
    })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },

  async getClientLogs(clientId: string): Promise<CommunicationLog[]> {
    const response = await api.get<{ communications: CommunicationLog[] }>(ENDPOINTS.CLIENT_LOGS(clientId));
    return response.communications || [];
  },

  async deleteLog(id: string): Promise<void> {
    return api.delete<void>(`${ENDPOINTS.LOGS}/${id}`);
  },

  // Files
  async uploadFile(file: File): Promise<AttachmentFile> {
    const formData = new FormData();
    formData.append('file', file);
    
    // We use raw fetch here because we need to handle FormData and specific auth headers
    const res = await fetch(`${BASE_URL}/${ENDPOINTS.UPLOAD}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload file');
    }
    return res.json();
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
      cc: data.cc // Pass CCs
    };
    
    // Manual fetch to ensure consistent auth and headers for this specific endpoint
    // which might differ in behavior or strictness
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || publicAnonKey;
        
        const response = await fetch(`${BASE_URL}/${ENDPOINTS.SEND_DIRECT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || `Failed to send: ${response.statusText}`);
            }
            return data;
        } else {
             if (!response.ok) {
                 const text = await response.text();
                 throw new Error(`Failed to send: ${response.status} ${response.statusText}`);
             }
             return { success: true, messageId: 'unknown' };
        }
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
      const response = await api.get<{ providers: ProductProvider[] } | ProductProvider[]>('integrations/providers');
      
      let providers: Array<{ id: string; name: string; logoUrl?: string; categoryIds?: string[] }> = [];
      if (Array.isArray(response)) {
        providers = response;
      } else if (response && Array.isArray(response.providers)) {
        providers = response.providers as Array<{ id: string; name: string; logoUrl?: string; categoryIds?: string[] }>;
      }

      return providers.map(p => ({
        id: p.id,
        name: p.name,
        logo: p.logoUrl,
        brokerConsultants: [],
        supportedProducts: [],
        active: true,
        categoryIds: p.categoryIds || []
      }));
    } catch (error) {
      console.warn('Failed to fetch providers from integrations, trying fallback product-management endpoint');
      try {
        const response = await api.get<{ providers: ProductProvider[] }>('product-management/providers');
        return response.providers || [];
      } catch (fallbackError) {
        console.error('Failed to fetch providers from both endpoints', fallbackError);
        return [];
      }
    }
  }
};