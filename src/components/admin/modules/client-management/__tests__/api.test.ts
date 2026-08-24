import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clientApi, getClientProfileQueryOptions } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
  },
  APIError: class APIError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'APIError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../utils/queryKeys', () => ({
  clientKeys: {
    profile: (userId: string) => ['clients', userId, 'profile'],
  },
}));

vi.mock('../../product-management/keyManagerConstants', () => ({
  ALL_PRODUCT_KEYS: [
    {
      id: 'medical_aid_premium',
      name: 'Medical Aid Premium',
      dataType: 'currency',
      category: 'medical_aid',
      isCalculated: false,
      description: 'Monthly premium',
    },
    {
      id: 'retirement_pre_total',
      name: 'Pre-Retirement Total',
      dataType: 'currency',
      category: 'retirement_pre',
      isCalculated: true,
      calculatedFrom: ['retirement_pre_ra'],
      description: 'Total pre-retirement',
    },
    {
      id: 'profile_personal_age',
      name: 'Age',
      dataType: 'number',
      category: 'profile_personal',
      isCalculated: false,
      description: 'Client age',
    },
  ],
}));

const MOCK_CLIENTS_RESPONSE = {
  users: [{ id: 'u-001', email: 'client@example.com', firstName: 'John', lastName: 'Doe' }],
  total: 1,
};

const MOCK_PROFILE = {
  id: 'u-001',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-01',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('clientApi', () => {
  describe('getClients', () => {
    it('fetches all clients without pagination', async () => {
      mockApiGet.mockResolvedValue(MOCK_CLIENTS_RESPONSE);
      const result = await clientApi.getClients();
      expect(result).toEqual(MOCK_CLIENTS_RESPONSE);
      expect(mockApiGet).toHaveBeenCalledWith('profile/all-users');
    });

    it('fetches clients with page param', async () => {
      mockApiGet.mockResolvedValue(MOCK_CLIENTS_RESPONSE);
      await clientApi.getClients({ page: 2 });
      expect(mockApiGet).toHaveBeenCalledWith('profile/all-users?page=2');
    });

    it('fetches clients with perPage param', async () => {
      mockApiGet.mockResolvedValue(MOCK_CLIENTS_RESPONSE);
      await clientApi.getClients({ perPage: 20 });
      expect(mockApiGet).toHaveBeenCalledWith('profile/all-users?perPage=20');
    });

    it('fetches clients with both pagination params', async () => {
      mockApiGet.mockResolvedValue(MOCK_CLIENTS_RESPONSE);
      await clientApi.getClients({ page: 1, perPage: 10 });
      expect(mockApiGet).toHaveBeenCalledWith('profile/all-users?page=1&perPage=10');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(clientApi.getClients()).rejects.toThrow('Fetch failed');
    });
  });

  describe('fetchClientProfile', () => {
    it('returns profile response for existing client', async () => {
      const profileResponse = { success: true, data: MOCK_PROFILE };
      mockApiGet.mockResolvedValue(profileResponse);
      const result = await clientApi.fetchClientProfile('u-001');
      expect(result).toEqual(profileResponse);
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('profile/personal-info?key='),
      );
    });

    it('returns empty response on 404 (client has no profile yet)', async () => {
      const { APIError } = await import('../../../../../utils/api/client');
      mockApiGet.mockRejectedValue(new APIError('Not found', 404));
      const result = await clientApi.fetchClientProfile('u-new');
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });

    it('throws on non-404 errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      await expect(clientApi.fetchClientProfile('u-001')).rejects.toThrow('Server error');
    });
  });

  describe('updateClientProfile', () => {
    it('posts profile update', async () => {
      mockApiPost.mockResolvedValue(undefined);
      await expect(
        clientApi.updateClientProfile('u-001', MOCK_PROFILE as never),
      ).resolves.toBeUndefined();
      expect(mockApiPost).toHaveBeenCalledWith(
        'profile/personal-info',
        expect.objectContaining({ data: MOCK_PROFILE }),
      );
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Update failed'));
      await expect(clientApi.updateClientProfile('u-001', MOCK_PROFILE as never)).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('updateClientMetadata', () => {
    it('puts metadata update and returns response', async () => {
      const metaResponse = { success: true };
      mockApiPut.mockResolvedValue(metaResponse);
      const result = await clientApi.updateClientMetadata('u-001', { tier: 'premium' });
      expect(result).toEqual(metaResponse);
      expect(mockApiPut).toHaveBeenCalledWith('profile/users/u-001/metadata', {
        metadata: { tier: 'premium' },
      });
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(clientApi.updateClientMetadata('u-001', {})).rejects.toThrow('Update failed');
    });
  });

  describe('runCleanup', () => {
    it('runs cleanup with dryRun=false by default', async () => {
      mockApiPost.mockResolvedValue({ success: true, processed: 5 });
      const result = await clientApi.runCleanup();
      expect(result).toEqual({ success: true, processed: 5 });
      expect(mockApiPost).toHaveBeenCalledWith('clients/maintenance/cleanup', { dryRun: false });
    });

    it('runs cleanup in dry-run mode', async () => {
      mockApiPost.mockResolvedValue({ success: true, processed: 0 });
      await clientApi.runCleanup(true);
      expect(mockApiPost).toHaveBeenCalledWith('clients/maintenance/cleanup', { dryRun: true });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Cleanup failed'));
      await expect(clientApi.runCleanup()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('runKvCleanup', () => {
    it('runs KV cleanup with dryRun=false by default', async () => {
      mockApiPost.mockResolvedValue({ success: true, cleaned: 3 });
      const result = await clientApi.runKvCleanup();
      expect(result).toEqual({ success: true, cleaned: 3 });
      expect(mockApiPost).toHaveBeenCalledWith('kv-cleanup/run', { dryRun: false });
    });

    it('runs KV cleanup in dry-run mode', async () => {
      mockApiPost.mockResolvedValue({ success: true, cleaned: 0 });
      await clientApi.runKvCleanup(true);
      expect(mockApiPost).toHaveBeenCalledWith('kv-cleanup/run', { dryRun: true });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('KV cleanup failed'));
      await expect(clientApi.runKvCleanup()).rejects.toThrow('KV cleanup failed');
    });
  });

  describe('getClientProfileQueryOptions', () => {
    it('returns query options with correct key and stale time', () => {
      const options = getClientProfileQueryOptions('u-001');
      expect(options.queryKey).toEqual(['clients', 'u-001', 'profile']);
      expect(options.staleTime).toBe(5 * 60 * 1000);
      expect(typeof options.queryFn).toBe('function');
    });

    it('queryFn returns profile data when profile exists', async () => {
      const profileResponse = { success: true, data: MOCK_PROFILE };
      mockApiGet.mockResolvedValue(profileResponse);
      const options = getClientProfileQueryOptions('u-001');
      const result = await options.queryFn();
      expect(result).toEqual(MOCK_PROFILE);
    });

    it('queryFn returns null when profile fetch returns success:false', async () => {
      mockApiGet.mockResolvedValue({ success: false, data: null });
      const options = getClientProfileQueryOptions('u-001');
      const result = await options.queryFn();
      expect(result).toBeNull();
    });
  });
});
