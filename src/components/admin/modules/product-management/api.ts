import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import type {
  PortfolioAgent,
  PortfolioAgentIssued,
  PortfolioApplyReport,
  PortfolioTable,
} from '../../../../shared/integrations/portfolio-table';
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
  PortalProviderConnection,
  PortalProviderFlow,
  PortalBrainMemorySummary,
  PortalDiscoveryReport,
  PortalJobHistoryEntry,
  PortalJobPolicyItem,
  PortalJobQueueSummary,
  PortalJobRunMode,
  PortalSyncJob,
  ProductField,
} from './types';

interface SchemaResponse {
  fields: ProductField[];
  categoryId: string;
}

interface ProductDTO {
  id: string;
  provider_id?: string;
  providerId?: string;
  name: string;
  is_active?: boolean;
  isActive?: boolean;
}

interface IntegrationHistoryItem {
  status: string;
  uploadedAt: string;
  [key: string]: unknown;
}

const emptyIntegrationStats = (): IntegrationStats => ({
  lastAttempted: '-',
  lastUpdateStatus: null,
  lastSuccessful: '-',
});

const formatIntegrationDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatIntegrationDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const buildIntegrationStats = (history: IntegrationHistoryItem[]): IntegrationStats => {
  if (!Array.isArray(history) || history.length === 0) return emptyIntegrationStats();

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
  const lastAttempt = sortedHistory[0];
  const lastSuccess = sortedHistory.find((item) => item.status === 'success');

  return {
    lastAttempted: lastAttempt?.uploadedAt
      ? formatIntegrationDateTime(lastAttempt.uploadedAt)
      : '-',
    lastUpdateStatus:
      lastAttempt?.status === 'success' || lastAttempt?.status === 'failed'
        ? lastAttempt.status
        : null,
    lastSuccessful: lastSuccess?.uploadedAt ? formatIntegrationDate(lastSuccess.uploadedAt) : '-',
  };
};

/**
 * Fetch a workbook through the shared client and hand it to the browser as a
 * download.
 *
 * The client returns the raw `Response` for a non-JSON body, so this inherits
 * token refresh and a typed `APIError` on a JSON error reply — which the
 * template download used to lose by calling `fetch` itself with the anon key
 * as its fallback bearer.
 */
async function downloadWorkbook(endpoint: string, fallbackFileName: string): Promise<void> {
  const res = await api.get<Response>(endpoint);
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || fallbackFileName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const productManagementApi = {
  // -- Providers --

  fetchProviders: async (): Promise<Provider[]> => {
    const [providerResponse, productsResponse] = await Promise.all([
      api.get<{ providers: ProviderDTO[] }>('product-management/providers'),
      api
        .get<{ products: ProductDTO[] }>('product-management/products?active=true')
        .catch(() => ({ products: [] })),
    ]);

    const rawProviders = providerResponse.providers || [];
    const rawProducts = productsResponse.products || [];
    const productsByProvider = new Map<string, string[]>();

    for (const product of rawProducts) {
      const providerId = String(product.provider_id || product.providerId || '').trim();
      const productName = String(product.name || '').trim();
      if (!providerId || !productName) continue;
      const existing = productsByProvider.get(providerId) || [];
      if (!existing.includes(productName)) existing.push(productName);
      productsByProvider.set(providerId, existing);
    }

    // Map backend snake_case (ProviderDTO) to frontend camelCase (ProductProvider/Provider)
    return rawProviders.map((p: ProviderDTO) => ({
      // Direct mappings
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      description: p.description,

      // Transformed mappings — belt-and-suspenders for legacy camelCase data
      logo: p.logo_url || ((p as unknown as Record<string, unknown>).logoUrl as string) || '',
      website: p.website,
      contactEmail:
        p.contact_email || ((p as unknown as Record<string, unknown>).contactEmail as string) || '',
      contactPhone:
        p.contact_phone || ((p as unknown as Record<string, unknown>).contactPhone as string) || '',
      active:
        p.is_active !== undefined
          ? p.is_active
          : (p as unknown as Record<string, unknown>).isActive !== undefined
            ? ((p as unknown as Record<string, unknown>).isActive as boolean)
            : true,
      categoryIds:
        p.category_ids || ((p as unknown as Record<string, unknown>).categoryIds as string[]) || [],

      // Enriched / UI-specific
      brokerConsultants: [],
      supportedProducts: (productsByProvider.get(p.id) || []).sort((a, b) => a.localeCompare(b)),

      // Metadata
      createdAt: p.created_at,
      updatedAt: p.updated_at,
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
      is_active: provider.active,
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
      updatedAt: p.updated_at,
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
      is_active: provider.active,
    };

    const res = await api.put<{ provider: ProviderDTO }>(
      `product-management/providers/${id}`,
      payload,
    );
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
      updatedAt: p.updated_at,
    };
  },

  deleteProvider: async (id: string): Promise<void> => {
    return api.delete(`product-management/providers/${id}`);
  },

  // -- Schemas --

  fetchSchema: async (categoryId: ProductCategoryId): Promise<CategoryTableStructure | null> => {
    try {
      const response = await api.get<SchemaResponse>(
        `integrations/schemas?categoryId=${categoryId}`,
      );
      if (response && response.fields) {
        return {
          categoryId,
          fields: response.fields,
        };
      }
      return null;
    } catch (error) {
      // Return null to indicate not found/error, allowing fallback to default
      logger.warn('Error fetching schema, falling back to default', { error, categoryId });
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

    return Promise.all(
      rawProviders.map(async (p) => {
        const categoryIds =
          p.category_ids ||
          ((p as unknown as Record<string, unknown>).categoryIds as string[]) ||
          [];
        const categoryHistoryResults = await Promise.allSettled(
          categoryIds.map((categoryId) =>
            api.get<IntegrationHistoryItem[]>(
              `integrations/history?providerId=${encodeURIComponent(p.id)}&categoryId=${encodeURIComponent(categoryId)}`,
            ),
          ),
        );
        const providerHistory = categoryHistoryResults.flatMap((result) =>
          result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [],
        );
        const stats = buildIntegrationStats(providerHistory);

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          categoryIds,
          logoUrl:
            p.logo_url || ((p as unknown as Record<string, unknown>).logoUrl as string) || '',
          lastAttempted: stats.lastAttempted,
          lastUpdateStatus: stats.lastUpdateStatus || 'never',
          lastSuccessful: stats.lastSuccessful,
        };
      }),
    );
  },

  fetchIntegrationHistory: async (
    providerId: string,
    categoryId: string,
  ): Promise<IntegrationStats> => {
    const history = await api.get<IntegrationHistoryItem[]>(
      `integrations/history?providerId=${providerId}&categoryId=${categoryId}`,
    );

    return buildIntegrationStats(history);
  },

  fetchIntegrationConfig: async (
    providerId: string,
    categoryId: string,
  ): Promise<IntegrationConfig> => {
    return api.get<IntegrationConfig>(
      `integrations/config?providerId=${providerId}&categoryId=${categoryId}`,
    );
  },

  saveIntegrationConfig: async (
    providerId: string,
    categoryId: string,
    config: IntegrationConfig,
  ): Promise<void> => {
    const payload = {
      providerId,
      categoryId,
      ...config,
    };
    await api.post('integrations/config', payload);
  },

  uploadIntegrationFile: async (
    file: File,
    providerId: string,
    categoryId: string,
    mode: 'preview' | 'commit',
  ): Promise<UploadPreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('providerId', providerId);
    formData.append('categoryId', categoryId);
    formData.append('mode', mode);

    return api.post<UploadPreviewResponse>('/integrations/upload', formData);
  },

  publishIntegrationSyncRun: async (
    runId: string,
    providerId: string,
    categoryId: string,
    rowIds?: string[],
  ): Promise<IntegrationSyncRun> => {
    const data = await api.post<{ run: IntegrationSyncRun }>(
      `/integrations/sync-runs/${runId}/publish`,
      { providerId, categoryId, rowIds },
    );
    return data.run;
  },

  fetchIntegrationSyncRun: async (runId: string): Promise<IntegrationSyncRun> => {
    const data = await api.get<{ run: IntegrationSyncRun }>(`/integrations/sync-runs/${runId}`);
    return data.run;
  },

  downloadIntegrationTemplate: async (providerId: string, categoryId: string): Promise<void> => {
    await downloadWorkbook(
      `integrations/template?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
      `integration-template-${providerId}-${categoryId}.xlsx`,
    );
  },

  // -- Portfolio table --
  // The provider/product book: the same table an outside agent reads and
  // writes through /integrations/portfolio-table.

  fetchPortfolioTable: async (providerId: string, categoryId: string): Promise<PortfolioTable> => {
    const response = await api.get<{ success: boolean; table: PortfolioTable }>(
      `integrations/portfolio-table?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.table;
  },

  downloadPortfolioTable: async (providerId: string, categoryId: string): Promise<void> => {
    await downloadWorkbook(
      `integrations/portfolio-table/download?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
      `portfolio-${providerId}-${categoryId}.xlsx`,
    );
  },

  /**
   * Upload an amended portfolio sheet. `preview` reports what would change
   * and writes nothing; `apply` writes the differences to the matching
   * records.
   */
  uploadPortfolioTable: async (
    file: File,
    providerId: string,
    categoryId: string,
    mode: 'preview' | 'apply',
  ): Promise<PortfolioApplyReport> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('providerId', providerId);
    formData.append('categoryId', categoryId);
    formData.append('mode', mode);
    return api.post<PortfolioApplyReport>('integrations/portfolio-table/upload', formData);
  },

  /** A short-lived link to the policy print (PDF) on record for one policy. */
  fetchPolicyPrintUrl: async (policyId: string, clientId: string): Promise<string> => {
    const response = await api.get<{ success: boolean; url: string }>(
      `integrations/portfolio-table/print?policyId=${encodeURIComponent(policyId)}&clientId=${encodeURIComponent(clientId)}`,
    );
    return response.url;
  },

  // -- Portfolio agent tokens (super admin) --
  // One token per outside agent; the agent's name is the actor on its writes.

  listPortfolioAgents: async (): Promise<PortfolioAgent[]> => {
    const response = await api.get<{ success: boolean; agents: PortfolioAgent[] }>(
      'integrations/portfolio-agents',
    );
    return response.agents;
  },

  /** The only call that ever returns a token in the clear. */
  issuePortfolioAgentToken: async (name: string): Promise<PortfolioAgentIssued> => {
    const response = await api.post<{ success: boolean } & PortfolioAgentIssued>(
      'integrations/portfolio-agents',
      { name },
    );
    return { agent: response.agent, token: response.token };
  },

  revokePortfolioAgentToken: async (name: string): Promise<PortfolioAgent> => {
    const response = await api.post<{ success: boolean; agent: PortfolioAgent }>(
      `integrations/portfolio-agents/${encodeURIComponent(name)}/revoke`,
    );
    return response.agent;
  },

  fetchPortalFlow: async (providerId: string, categoryId: string): Promise<PortalProviderFlow> => {
    const response = await api.get<{ success: boolean; flow: PortalProviderFlow }>(
      `integrations/portal-flows/${providerId}?categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.flow;
  },

  fetchPortalBrainMemory: async (
    providerId: string,
    categoryId: string,
  ): Promise<PortalBrainMemorySummary> => {
    const response = await api.get<{ success: boolean; summary: PortalBrainMemorySummary }>(
      `integrations/portal-flows/${providerId}/brain-memory?categoryId=${categoryId}`,
    );
    return response.summary;
  },

  savePortalFlow: async (
    providerId: string,
    categoryId: string,
    flow: PortalProviderFlow,
  ): Promise<PortalProviderFlow> => {
    const response = await api.put<{ success: boolean; flow: PortalProviderFlow }>(
      `integrations/portal-flows/${providerId}?categoryId=${encodeURIComponent(categoryId)}`,
      flow,
    );
    return response.flow;
  },

  resetPortalFlow: async (providerId: string, categoryId: string): Promise<PortalProviderFlow> => {
    const response = await api.delete<{ success: boolean; flow: PortalProviderFlow }>(
      `integrations/portal-flows/${providerId}?categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.flow;
  },

  fetchPortalCredentialStatus: async (
    providerId: string,
    profileId: string,
    categoryId: string,
  ): Promise<PortalCredentialStatus> => {
    const response = await api.get<{ success: boolean; status: PortalCredentialStatus }>(
      `integrations/portal-flows/${providerId}/credentials/${profileId}?categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.status;
  },

  savePortalCredentials: async (
    providerId: string,
    profileId: string,
    categoryId: string,
    credentials: { username: string; password?: string },
  ): Promise<PortalCredentialStatus> => {
    const response = await api.put<{ success: boolean; status: PortalCredentialStatus }>(
      `integrations/portal-flows/${providerId}/credentials/${profileId}?categoryId=${encodeURIComponent(categoryId)}`,
      credentials,
    );
    return response.status;
  },

  /** Sign-in state for every provider, for the Connections screen. */
  fetchPortalConnections: async (): Promise<PortalProviderConnection[]> => {
    const response = await api.get<{ success: boolean; connections: PortalProviderConnection[] }>(
      'integrations/portal-connections',
    );
    return response.connections || [];
  },

  /**
   * Start a run whose only purpose is to prove the stored credentials sign in.
   *
   * Queues no policies, reads no policy data and writes nothing to the book, so
   * it is safe to run against a provider that has not been set up yet — which
   * is the only moment it is useful.
   */
  startPortalConnectionTest: async (
    providerId: string,
    categoryId: string,
    credentialProfileId: string,
  ): Promise<{ job: PortalSyncJob; flow: PortalProviderFlow }> => {
    return api.post<{ success: boolean; job: PortalSyncJob; flow: PortalProviderFlow }>(
      'integrations/portal-jobs',
      { providerId, categoryId, credentialProfileId, connectionTest: true },
    );
  },

  createPortalJob: async (
    providerId: string,
    categoryId: string,
    credentialProfileId: string,
    runMode: PortalJobRunMode,
    options: Pick<PortalProviderFlow, 'policySchedule' | 'documentArtifacts'> & {
      /**
       * Scope the run to specific policies. Omitted (or empty) queues every
       * eligible policy for the provider and category, which is what the
       * provider-wide run has always done.
       */
      policyIds?: string[];
    } = {},
  ): Promise<{ job: PortalSyncJob; flow: PortalProviderFlow }> => {
    return api.post<{ success: boolean; job: PortalSyncJob; flow: PortalProviderFlow }>(
      'integrations/portal-jobs',
      {
        providerId,
        categoryId,
        credentialProfileId,
        runMode,
        policySchedule: options.policySchedule,
        documentArtifacts: options.documentArtifacts,
        ...(options.policyIds && options.policyIds.length > 0
          ? { policyIds: options.policyIds }
          : {}),
      },
    );
  },

  fetchPortalJob: async (
    jobId: string,
    providerId: string,
    categoryId: string,
  ): Promise<PortalSyncJob> => {
    const response = await api.get<{ success: boolean; job: PortalSyncJob }>(
      `integrations/portal-jobs/${jobId}?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.job;
  },

  fetchPortalJobItems: async (
    jobId: string,
    providerId: string,
    categoryId: string,
  ): Promise<{ items: PortalJobPolicyItem[]; summary: PortalJobQueueSummary }> => {
    const response = await api.get<{
      success: boolean;
      items: PortalJobPolicyItem[];
      summary: PortalJobQueueSummary;
    }>(
      `integrations/portal-jobs/${jobId}/items?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
    );
    return { items: response.items || [], summary: response.summary };
  },

  retryPortalJobItem: async (
    jobId: string,
    itemId: string,
    providerId: string,
    categoryId: string,
  ): Promise<{
    job: PortalSyncJob;
    items: PortalJobPolicyItem[];
    summary: PortalJobQueueSummary;
  }> => {
    const response = await api.post<{
      success: boolean;
      job: PortalSyncJob;
      items: PortalJobPolicyItem[];
      summary: PortalJobQueueSummary;
    }>(`integrations/portal-jobs/${jobId}/items/${itemId}/retry`, { providerId, categoryId });
    return { job: response.job, items: response.items || [], summary: response.summary };
  },

  fetchLatestPortalJob: async (
    providerId: string,
    categoryId: string,
  ): Promise<PortalSyncJob | null> => {
    const response = await api.get<{ success: boolean; job: PortalSyncJob | null }>(
      `integrations/portal-jobs/latest?providerId=${providerId}&categoryId=${categoryId}`,
    );
    return response.job;
  },

  fetchPortalJobHistory: async (
    providerId: string,
    categoryId: string,
  ): Promise<PortalJobHistoryEntry[]> => {
    const response = await api.get<{ success: boolean; jobs: PortalJobHistoryEntry[] }>(
      `integrations/portal-jobs/history?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.jobs || [];
  },

  fetchPortalDiscoveryReport: async (
    jobId: string,
    providerId: string,
    categoryId: string,
  ): Promise<PortalDiscoveryReport | null> => {
    const response = await api.get<{ success: boolean; report: PortalDiscoveryReport | null }>(
      `integrations/portal-jobs/${jobId}/discovery-report?providerId=${encodeURIComponent(providerId)}&categoryId=${encodeURIComponent(categoryId)}`,
    );
    return response.report;
  },

  submitPortalOtp: async (
    jobId: string,
    otp: string,
    providerId: string,
    categoryId: string,
  ): Promise<PortalSyncJob> => {
    const response = await api.post<{ success: boolean; job: PortalSyncJob }>(
      `integrations/portal-jobs/${jobId}/otp`,
      { otp, providerId, categoryId },
    );
    return response.job;
  },
};
