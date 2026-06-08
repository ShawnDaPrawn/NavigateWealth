import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productManagementApi } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

vi.mock('../../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'anon-key',
}));

vi.mock('../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
  }),
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MOCK_PROVIDER_DTO = {
  id: 'prov-001',
  name: 'Test Insurer',
  code: 'test-insurer',
  type: 'insurer',
  description: 'A test insurer',
  logo_url: 'https://example.com/logo.png',
  website: 'https://example.com',
  contact_email: 'info@example.com',
  contact_phone: '+27100000000',
  is_active: true,
  category_ids: ['medical_aid', 'retirement_pre'],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-02T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('productManagementApi', () => {
  describe('fetchProviders', () => {
    it('fetches providers and products in parallel, returning mapped providers', async () => {
      mockApiGet.mockResolvedValueOnce({ providers: [MOCK_PROVIDER_DTO] }).mockResolvedValueOnce({
        products: [
          { id: 'prod-001', provider_id: 'prov-001', name: 'Medical Plan A', is_active: true },
        ],
      });

      const result = await productManagementApi.fetchProviders();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prov-001');
      expect(result[0].logo).toBe('https://example.com/logo.png');
      expect(result[0].contactEmail).toBe('info@example.com');
      expect(result[0].supportedProducts).toEqual(['Medical Plan A']);
    });

    it('gracefully handles products fetch failure', async () => {
      mockApiGet
        .mockResolvedValueOnce({ providers: [MOCK_PROVIDER_DTO] })
        .mockRejectedValueOnce(new Error('Products unavailable'));

      const result = await productManagementApi.fetchProviders();
      expect(result).toHaveLength(1);
      expect(result[0].supportedProducts).toEqual([]);
    });

    it('deduplicates product names per provider', async () => {
      mockApiGet.mockResolvedValueOnce({ providers: [MOCK_PROVIDER_DTO] }).mockResolvedValueOnce({
        products: [
          { id: 'p-1', provider_id: 'prov-001', name: 'Plan A' },
          { id: 'p-2', provider_id: 'prov-001', name: 'Plan A' },
        ],
      });

      const result = await productManagementApi.fetchProviders();
      expect(result[0].supportedProducts).toEqual(['Plan A']);
    });

    it('returns empty array when no providers', async () => {
      mockApiGet.mockResolvedValueOnce({ providers: [] }).mockResolvedValueOnce({ products: [] });

      const result = await productManagementApi.fetchProviders();
      expect(result).toEqual([]);
    });
  });

  describe('createProvider', () => {
    it('maps frontend request to DTO and returns mapped provider', async () => {
      mockApiPost.mockResolvedValue({ provider: MOCK_PROVIDER_DTO });
      const request = {
        name: 'Test Insurer',
        description: 'A test insurer',
        logo: 'https://example.com/logo.png',
        website: 'https://example.com',
        contactEmail: 'info@example.com',
        contactPhone: '+27100000000',
        active: true,
        categoryIds: ['medical_aid'],
      };
      const result = await productManagementApi.createProvider(request as never);
      expect(result.id).toBe('prov-001');
      expect(result.logo).toBe('https://example.com/logo.png');
      expect(mockApiPost).toHaveBeenCalledWith(
        'product-management/providers',
        expect.objectContaining({ name: 'Test Insurer', is_active: true }),
      );
    });
  });

  describe('updateProvider', () => {
    it('maps request to DTO and returns updated provider', async () => {
      mockApiPut.mockResolvedValue({ provider: { ...MOCK_PROVIDER_DTO, name: 'Updated Insurer' } });
      const request = {
        name: 'Updated Insurer',
        description: 'Updated',
        logo: '',
        website: '',
        contactEmail: '',
        contactPhone: '',
        active: true,
        categoryIds: [],
      };
      const result = await productManagementApi.updateProvider('prov-001', request as never);
      expect(result.name).toBe('Updated Insurer');
      expect(mockApiPut).toHaveBeenCalledWith(
        'product-management/providers/prov-001',
        expect.objectContaining({ name: 'Updated Insurer' }),
      );
    });
  });

  describe('deleteProvider', () => {
    it('deletes provider by ID', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(productManagementApi.deleteProvider('prov-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('product-management/providers/prov-001');
    });
  });

  describe('fetchSchema', () => {
    it('returns schema when fields are present', async () => {
      const fields = [{ id: 'f-1', name: 'Premium', dataType: 'currency' }];
      mockApiGet.mockResolvedValue({ fields, categoryId: 'medical_aid' });
      const result = await productManagementApi.fetchSchema('medical_aid' as never);
      expect(result?.categoryId).toBe('medical_aid');
      expect(result?.fields).toEqual(fields);
    });

    it('returns null when fields are absent', async () => {
      mockApiGet.mockResolvedValue({});
      const result = await productManagementApi.fetchSchema('medical_aid' as never);
      expect(result).toBeNull();
    });

    it('returns null on error (fallback to default)', async () => {
      mockApiGet.mockRejectedValue(new Error('Schema not found'));
      const result = await productManagementApi.fetchSchema('medical_aid' as never);
      expect(result).toBeNull();
    });
  });

  describe('saveSchema', () => {
    it('posts schema to integrations endpoint', async () => {
      mockApiPost.mockResolvedValue(undefined);
      const schema = { categoryId: 'medical_aid', fields: [] };
      await productManagementApi.saveSchema(schema as never);
      expect(mockApiPost).toHaveBeenCalledWith('integrations/schemas', schema);
    });
  });

  describe('fetchIntegrationHistory', () => {
    it('builds stats from history array', async () => {
      const history = [
        { status: 'success', uploadedAt: '2025-06-01T12:00:00Z' },
        { status: 'failed', uploadedAt: '2025-05-01T12:00:00Z' },
      ];
      mockApiGet.mockResolvedValue(history);
      const result = await productManagementApi.fetchIntegrationHistory('prov-001', 'medical_aid');
      expect(result.lastUpdateStatus).toBe('success');
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('integrations/history?providerId=prov-001'),
      );
    });

    it('returns empty stats when history is empty array', async () => {
      mockApiGet.mockResolvedValue([]);
      const result = await productManagementApi.fetchIntegrationHistory('prov-001', 'medical_aid');
      expect(result.lastAttempted).toBe('-');
      expect(result.lastUpdateStatus).toBeNull();
    });
  });

  describe('fetchIntegrationConfig', () => {
    it('fetches integration config', async () => {
      const config = { fieldMappings: [], enabled: true };
      mockApiGet.mockResolvedValue(config);
      const result = await productManagementApi.fetchIntegrationConfig('prov-001', 'medical_aid');
      expect(result).toEqual(config);
    });
  });

  describe('saveIntegrationConfig', () => {
    it('posts config with providerId and categoryId', async () => {
      mockApiPost.mockResolvedValue(undefined);
      const config = { fieldMappings: [] } as never;
      await productManagementApi.saveIntegrationConfig('prov-001', 'medical_aid', config);
      expect(mockApiPost).toHaveBeenCalledWith(
        'integrations/config',
        expect.objectContaining({ providerId: 'prov-001', categoryId: 'medical_aid' }),
      );
    });
  });

  describe('publishIntegrationSyncRun', () => {
    it('posts to publish endpoint and returns run', async () => {
      const run = { id: 'run-001', status: 'published' };
      mockApiPost.mockResolvedValue({ run });
      const result = await productManagementApi.publishIntegrationSyncRun(
        'run-001',
        'prov-001',
        'medical_aid',
      );
      expect(result).toEqual(run);
      expect(mockApiPost).toHaveBeenCalledWith('/integrations/sync-runs/run-001/publish', {
        providerId: 'prov-001',
        categoryId: 'medical_aid',
        rowIds: undefined,
      });
    });
  });

  describe('fetchIntegrationSyncRun', () => {
    it('fetches sync run by ID', async () => {
      const run = { id: 'run-001', status: 'pending' };
      mockApiGet.mockResolvedValue({ run });
      const result = await productManagementApi.fetchIntegrationSyncRun('run-001');
      expect(result).toEqual(run);
    });
  });

  describe('fetchPortalFlow', () => {
    it('returns portal flow for provider', async () => {
      const flow = { steps: [], providerId: 'prov-001' };
      mockApiGet.mockResolvedValue({ success: true, flow });
      const result = await productManagementApi.fetchPortalFlow('prov-001', 'medical_aid');
      expect(result).toEqual(flow);
    });
  });

  describe('fetchPortalBrainMemory', () => {
    it('returns brain memory summary', async () => {
      const summary = { interactions: 5 };
      mockApiGet.mockResolvedValue({ success: true, summary });
      const result = await productManagementApi.fetchPortalBrainMemory('prov-001', 'medical_aid');
      expect(result).toEqual(summary);
    });
  });

  describe('savePortalFlow', () => {
    it('puts flow and returns updated flow', async () => {
      const flow = { steps: [] } as never;
      mockApiPut.mockResolvedValue({ success: true, flow });
      const result = await productManagementApi.savePortalFlow('prov-001', 'medical_aid', flow);
      expect(result).toEqual(flow);
    });
  });

  describe('resetPortalFlow', () => {
    it('deletes flow and returns reset flow', async () => {
      const flow = { steps: [] };
      mockApiDelete.mockResolvedValue({ success: true, flow });
      const result = await productManagementApi.resetPortalFlow('prov-001', 'medical_aid');
      expect(result).toEqual(flow);
    });
  });

  describe('fetchPortalCredentialStatus', () => {
    it('returns credential status', async () => {
      const status = { hasCredentials: true, profileId: 'prof-001' };
      mockApiGet.mockResolvedValue({ success: true, status });
      const result = await productManagementApi.fetchPortalCredentialStatus(
        'prov-001',
        'prof-001',
        'medical_aid',
      );
      expect(result).toEqual(status);
    });
  });

  describe('savePortalCredentials', () => {
    it('puts credentials and returns updated status', async () => {
      const status = { hasCredentials: true };
      mockApiPut.mockResolvedValue({ success: true, status });
      const result = await productManagementApi.savePortalCredentials(
        'prov-001',
        'prof-001',
        'medical_aid',
        { username: 'user', password: 'pass' },
      );
      expect(result).toEqual(status);
    });
  });

  describe('createPortalJob', () => {
    it('creates portal job and returns job+flow', async () => {
      const job = { id: 'job-001', status: 'pending' };
      const flow = { steps: [] };
      mockApiPost.mockResolvedValue({ success: true, job, flow });
      const result = await productManagementApi.createPortalJob(
        'prov-001',
        'medical_aid',
        'prof-001',
        'run',
      );
      expect(result.job).toEqual(job);
      expect(result.flow).toEqual(flow);
    });
  });

  describe('fetchPortalJob', () => {
    it('returns portal job by ID', async () => {
      const job = { id: 'job-001', status: 'running' };
      mockApiGet.mockResolvedValue({ success: true, job });
      const result = await productManagementApi.fetchPortalJob(
        'job-001',
        'prov-001',
        'medical_aid',
      );
      expect(result).toEqual(job);
    });
  });

  describe('fetchPortalJobItems', () => {
    it('returns items and summary', async () => {
      const items = [{ id: 'item-001' }];
      const summary = { total: 1, pending: 1 };
      mockApiGet.mockResolvedValue({ success: true, items, summary });
      const result = await productManagementApi.fetchPortalJobItems(
        'job-001',
        'prov-001',
        'medical_aid',
      );
      expect(result.items).toEqual(items);
      expect(result.summary).toEqual(summary);
    });

    it('returns empty items when response has no items', async () => {
      mockApiGet.mockResolvedValue({ success: true, summary: {} });
      const result = await productManagementApi.fetchPortalJobItems(
        'job-001',
        'prov-001',
        'medical_aid',
      );
      expect(result.items).toEqual([]);
    });
  });

  describe('retryPortalJobItem', () => {
    it('retries item and returns updated job/items/summary', async () => {
      const job = { id: 'job-001', status: 'running' };
      const items = [{ id: 'item-001', status: 'retrying' }];
      const summary = { total: 1, retrying: 1 };
      mockApiPost.mockResolvedValue({ success: true, job, items, summary });
      const result = await productManagementApi.retryPortalJobItem(
        'job-001',
        'item-001',
        'prov-001',
        'medical_aid',
      );
      expect(result.job).toEqual(job);
      expect(result.items).toEqual(items);
    });
  });

  describe('fetchLatestPortalJob', () => {
    it('returns latest portal job', async () => {
      const job = { id: 'job-001', status: 'completed' };
      mockApiGet.mockResolvedValue({ success: true, job });
      const result = await productManagementApi.fetchLatestPortalJob('prov-001', 'medical_aid');
      expect(result).toEqual(job);
    });

    it('returns null when no job exists', async () => {
      mockApiGet.mockResolvedValue({ success: true, job: null });
      const result = await productManagementApi.fetchLatestPortalJob('prov-001', 'medical_aid');
      expect(result).toBeNull();
    });
  });

  describe('fetchPortalDiscoveryReport', () => {
    it('returns discovery report', async () => {
      const report = { discoveries: [] };
      mockApiGet.mockResolvedValue({ success: true, report });
      const result = await productManagementApi.fetchPortalDiscoveryReport(
        'job-001',
        'prov-001',
        'medical_aid',
      );
      expect(result).toEqual(report);
    });

    it('returns null when no report', async () => {
      mockApiGet.mockResolvedValue({ success: true, report: null });
      const result = await productManagementApi.fetchPortalDiscoveryReport(
        'job-001',
        'prov-001',
        'medical_aid',
      );
      expect(result).toBeNull();
    });
  });

  describe('submitPortalOtp', () => {
    it('posts OTP and returns updated job', async () => {
      const job = { id: 'job-001', status: 'authenticated' };
      mockApiPost.mockResolvedValue({ success: true, job });
      const result = await productManagementApi.submitPortalOtp(
        'job-001',
        '123456',
        'prov-001',
        'medical_aid',
      );
      expect(result).toEqual(job);
      expect(mockApiPost).toHaveBeenCalledWith('integrations/portal-jobs/job-001/otp', {
        otp: '123456',
        providerId: 'prov-001',
        categoryId: 'medical_aid',
      });
    });
  });
});
