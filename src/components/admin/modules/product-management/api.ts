import { api } from '../../../../utils/api/client';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { createClient } from '../../../../utils/supabase/client';
import { logger } from '../../../../utils/logger';
import { 
  Provider, 
  ProviderDTO,
  ProductCategoryId, 
  CategoryTableStructure, 
  SaveProviderRequest, 
  SaveSchemaRequest,
  IntegrationProvider,
  IntegrationStats,
  IntegrationConfig,
  UploadPreviewResponse,
  IntegrationSyncRun,
  PortalCredentialStatus,
  PortalProviderFlow,
  PortalBrainMemorySummary,
  PortalDiscoveryReport,
  PortalJobPolicyItem,
  PortalJobQueueSummary,
  PortalJobRunMode,
  PortalSyncJob,
  ProductField
} from './types';

interface ProvidersResponse {
  providers?: Provider[];
  [key: string]: unknown;
}

interface SchemaResponse {
  fields: ProductField[];
  categoryId: string;
}

interface IntegrationHistoryItem {
  status: string;
  uploadedAt: string;
  [key: string]: unknown;
}

async function getSupabaseAuthToken(): Promise<string> {
  let token = publicAnonKey;
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || publicAnonKey;
  } catch (error) {
    logger.warn('Failed to retrieve session, using anon key');
  }
  return token;
}

export const productManagementApi = {
  // -- Providers --

  fetchProviders: async (): Promise<Provider[]> => {
    // Switch to canonical ProductManagement API
    const response = await api.get<{ providers: ProviderDTO[] }>('product-management/providers');
    
    // Handle response wrapper { providers: [...] }
    const rawProviders = response.providers || [];

    // Map backend snake_case (ProviderDTO) to frontend camelCase (ProductProvider/Provider)
    return rawProviders.map((p: ProviderDTO) => ({
      // Direct mappings
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      description: p.description,
      
      // Transformed mappings — belt-and-suspenders for legacy camelCase data
      logo: p.logo_url || (p as Record<string, unknown>).logoUrl as string || '',
      website: p.website,
      contactEmail: p.contact_email || (p as Record<string, unknown>).contactEmail as string || '',
      contactPhone: p.contact_phone || (p as Record<string, unknown>).contactPhone as string || '',
      active: p.is_active !== undefined ? p.is_active : ((p as Record<string, unknown>).isActive !== undefined ? (p as Record<string, unknown>).isActive as boolean : true),
      categoryIds: p.category_ids || (p as Record<string, unknown>).categoryIds as string[] || [],
      
      // Enriched / UI-specific (defaults for now)
      brokerConsultants: [],
      supportedProducts: [],
      
      // Metadata
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  },

  createProvider: async (provider: SaveProviderRequest): Promise<Provider> => {
    // Map frontend -> backend (DTO Partial)
    const payload: Partial<ProviderDTO> = {
      name: provider.name,
      code: provider.name.toLowerCase().replace(/\s+/g, '-'), // Simple slug fallback
      type: 'other', // Default type
      description: provider.description,
      logo_url: provider.logo,
      website: provider.website,
      contact_email: provider.contactEmail,
      contact_phone: provider.contactPhone,
      category_ids: provider.categoryIds,
      is_active: provider.active
    };
    
    const res = await api.post<{ provider: ProviderDTO }>('product-management/providers', payload);
    const p = res.provider;

    // Map back to Domain Model
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      description: p.description,
      logo: p.logo_url,
      website: p.website,
      contactEmail: p.contact_email,
      contactPhone: p.contact_phone,
      active: p.is_active,
      categoryIds: p.category_ids || [],
      brokerConsultants: [],
      supportedProducts: [],
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
  },

  updateProvider: async (id: string, provider: SaveProviderRequest): Promise<Provider> => {
    // Map frontend -> backend (DTO Partial)
    const payload: Partial<ProviderDTO> = {
      name: provider.name,
      description: provider.description,
      logo_url: provider.logo,
      website: provider.website,
      contact_email: provider.contactEmail,
      contact_phone: provider.contactPhone,
      category_ids: provider.categoryIds,
      is_active: provider.active
    };

    const res = await api.put<{ provider: ProviderDTO }>(`product-management/providers/${id}`, payload);
    const p = res.provider;

    // Map back
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      description: p.description,
      logo: p.logo_url,
      website: p.website,
      contactEmail: p.contact_email,
      contactPhone: p.contact_phone,
      active: p.is_active,
      categoryIds: p.category_ids || [],
      brokerConsultants: [],
      supportedProducts: [],
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
  },

  deleteProvider: async (id: string): Promise<void> => {
    return api.delete(`product-management/providers/${id}`);
  },

  // -- Schemas --

  fetchSchema: async (categoryId: ProductCategoryId): Promise<CategoryTableStructure | null> => {
    try {
      const response = await api.get<SchemaResponse>(`integrations/schemas?categoryId=${categoryId}`);
      if (response && response.fields) {
        return {
          categoryId,
          fields: response.fields
        };
      }
      return null;
    } catch (error) {
      // Return null to indicate not found/error, allowing fallback to default
      logger.warn('Error fetching schema, falling back to default', error, { categoryId });
      return null;
    }
  },

  saveSchema: async (schema: SaveSchemaRequest): Promise<void> => {
    await api.post('integrations/schemas', schema);
  },

  // -- Integrations --

  fetchIntegrationProviders: async (): Promise<IntegrationProvider[]> => {
    // Switch to canonical ProductManagement API
    const response = await api.get<{ providers: ProviderDTO[] }>('product-management/providers');
    const rawProviders = response.providers || [];

    // Map to IntegrationProvider (Legacy shape)
    return rawProviders.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      categoryIds: p.category_ids || (p as Record<string, unknown>).categoryIds as string[] || [],
      logoUrl: p.logo_url || (p as Record<string, unknown>).logoUrl as string || '',
      // Stats are not available in the lightweight Provider list anymore
      // These will be fetched per-provider or need a separate aggregation endpoint
      lastAttempted: '-', 
      lastUpdateStatus: 'never',
      lastSuccessful: '-'
    }));
  },

  fetchIntegrationHistory: async (providerId: string, categoryId: string): Promise<IntegrationStats> => {
    const history = await api.get<IntegrationHistoryItem[]>(`integrations/history?providerId=${providerId}&categoryId=${categoryId}`);
    
    if (Array.isArray(history) && history.length > 0) {
        const lastAttempt = history[0];
        const lastSuccess = history.find((h) => h.status === 'success');
        
        return {
            lastAttempted: new Date(lastAttempt.uploadedAt).toLocaleDateString() + ' ' + new Date(lastAttempt.uploadedAt).toLocaleTimeString(),
            lastUpdateStatus: lastAttempt.status as 'success' | 'failed',
            lastSuccessful: lastSuccess ? new Date(lastSuccess.uploadedAt).toLocaleDateString() : '-'
        };
    }
    return { lastAttempted: '-', lastUpdateStatus: null, lastSuccessful: '-' };
  },

  fetchIntegrationConfig: async (providerId: string, categoryId: string): Promise<IntegrationConfig> => {
    return api.get<IntegrationConfig>(`integrations/config?providerId=${providerId}&categoryId=${categoryId}`);
  },

  saveIntegrationConfig: async (providerId: string, categoryId: string, config: IntegrationConfig): Promise<void> => {
    const payload = {
        providerId,
        categoryId,
        ...config
    };
    await api.post('integrations/config', payload);
  },

  uploadIntegrationFile: async (
    file: File, 
    providerId: string, 
    categoryId: string, 
    mode: 'preview' | 'commit'
  ): Promise<UploadPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('providerId', providerId);
    formData.append('categoryId', categoryId);
    formData.append('mode', mode);

    const token = await getSupabaseAuthToken();

    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to process file');
    return data;
  },

  publishIntegrationSyncRun: async (runId: string, rowIds?: string[]): Promise<IntegrationSyncRun> => {
    const token = await getSupabaseAuthToken();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/sync-runs/${runId}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rowIds }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish sync run');
    return data.run as IntegrationSyncRun;
  },

  fetchIntegrationSyncRun: async (runId: string): Promise<IntegrationSyncRun> => {
    const token = await getSupabaseAuthToken();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/sync-runs/${runId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch sync run');
    return data.run as IntegrationSyncRun;
  },

  downloadIntegrationTemplate: async (providerId: string, categoryId: string): Promise<void> => {
    const token = await getSupabaseAuthToken();
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/template?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to download integration template');
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] || `integration-template-${providerId}-${categoryId}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  fetchPortalFlow: async (providerId: string): Promise<PortalProviderFlow> => {
    const response = await api.get<{ success: boolean; flow: PortalProviderFlow }>(`integrations/portal-flows/${providerId}`);
    return response.flow;
  },

  fetchPortalBrainMemory: async (providerId: string, categoryId: string): Promise<PortalBrainMemorySummary> => {
    const response = await api.get<{ success: boolean; summary: PortalBrainMemorySummary }>(`integrations/portal-flows/${providerId}/brain-memory?categoryId=${categoryId}`);
    return response.summary;
  },

  savePortalFlow: async (providerId: string, flow: PortalProviderFlow): Promise<PortalProviderFlow> => {
    const response = await api.put<{ success: boolean; flow: PortalProviderFlow }>(`integrations/portal-flows/${providerId}`, flow);
    return response.flow;
  },

  fetchPortalCredentialStatus: async (providerId: string, profileId: string): Promise<PortalCredentialStatus> => {
    const response = await api.get<{ success: boolean; status: PortalCredentialStatus }>(`integrations/portal-flows/${providerId}/credentials/${profileId}`);
    return response.status;
  },

  savePortalCredentials: async (providerId: string, profileId: string, credentials: { username: string; password?: string }): Promise<PortalCredentialStatus> => {
    const response = await api.put<{ success: boolean; status: PortalCredentialStatus }>(`integrations/portal-flows/${providerId}/credentials/${profileId}`, credentials);
    return response.status;
  },

  createPortalJob: async (providerId: string, categoryId: string, credentialProfileId: string, runMode: PortalJobRunMode): Promise<{ job: PortalSyncJob; flow: PortalProviderFlow }> => {
    return api.post<{ success: boolean; job: PortalSyncJob; flow: PortalProviderFlow }>('integrations/portal-jobs', {
      providerId,
      categoryId,
      credentialProfileId,
      runMode,
    });
  },

  fetchPortalJob: async (jobId: string): Promise<PortalSyncJob> => {
    const response = await api.get<{ success: boolean; job: PortalSyncJob }>(`integrations/portal-jobs/${jobId}`);
    return response.job;
  },

  fetchPortalJobItems: async (jobId: string): Promise<{ items: PortalJobPolicyItem[]; summary: PortalJobQueueSummary }> => {
    const response = await api.get<{ success: boolean; items: PortalJobPolicyItem[]; summary: PortalJobQueueSummary }>(`integrations/portal-jobs/${jobId}/items`);
    return { items: response.items || [], summary: response.summary };
  },

  retryPortalJobItem: async (jobId: string, itemId: string): Promise<{ job: PortalSyncJob; items: PortalJobPolicyItem[]; summary: PortalJobQueueSummary }> => {
    const response = await api.post<{ success: boolean; job: PortalSyncJob; items: PortalJobPolicyItem[]; summary: PortalJobQueueSummary }>(`integrations/portal-jobs/${jobId}/items/${itemId}/retry`, {});
    return { job: response.job, items: response.items || [], summary: response.summary };
  },

  fetchLatestPortalJob: async (providerId: string, categoryId: string): Promise<PortalSyncJob | null> => {
    const response = await api.get<{ success: boolean; job: PortalSyncJob | null }>(`integrations/portal-jobs/latest?providerId=${providerId}&categoryId=${categoryId}`);
    return response.job;
  },

  fetchPortalDiscoveryReport: async (jobId: string): Promise<PortalDiscoveryReport | null> => {
    const response = await api.get<{ success: boolean; report: PortalDiscoveryReport | null }>(`integrations/portal-jobs/${jobId}/discovery-report`);
    return response.report;
  },

  submitPortalOtp: async (jobId: string, otp: string): Promise<PortalSyncJob> => {
    const response = await api.post<{ success: boolean; job: PortalSyncJob }>(`integrations/portal-jobs/${jobId}/otp`, { otp });
    return response.job;
  }
};
