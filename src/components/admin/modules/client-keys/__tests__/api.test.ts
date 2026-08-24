/**
 * client-keys API — moved with the code it covers.
 *
 * These cases were written against client-management/api.ts when the three
 * client-keys calls still lived there. They are unchanged apart from the name
 * of the object under test.
 */
import { describe, it, expect, vi } from 'vitest';
import { clientKeysApi } from '../api';

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

vi.mock('../../product-management', () => ({
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

describe('clientKeysApi', () => {
  describe('getClientKeys', () => {
    it('returns structured key data from KV response', async () => {
      mockApiGet.mockResolvedValue({
        value: { medical_aid_premium: 3500, profile_personal_age: 40 },
      });
      const result = await clientKeysApi.getClientKeys('u-001');
      expect(result.keys.length).toBe(2);
      const premiumKey = result.keys.find((k) => k.keyId === 'medical_aid_premium');
      expect(premiumKey?.name).toBe('Medical Aid Premium');
      expect(premiumKey?.dataType).toBe('currency');
    });

    it('falls back to inference for keys not in registry', async () => {
      mockApiGet.mockResolvedValue({ value: { unknown_custom_key: 100 } });
      const result = await clientKeysApi.getClientKeys('u-001');
      expect(result.keys.length).toBe(1);
      expect(result.keys[0].keyId).toBe('unknown_custom_key');
    });

    it('returns empty keys on 404 (first-time setup)', async () => {
      mockApiGet.mockRejectedValue({ statusCode: 404 });
      const result = await clientKeysApi.getClientKeys('u-001');
      expect(result.keys).toEqual([]);
      expect(result.totalCategories).toBe(0);
    });

    it('returns empty keys on message-based 404', async () => {
      mockApiGet.mockRejectedValue({ message: '404 Not Found' });
      const result = await clientKeysApi.getClientKeys('u-001');
      expect(result.keys).toEqual([]);
    });

    it('throws on non-404 errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      await expect(clientKeysApi.getClientKeys('u-001')).rejects.toThrow('Server error');
    });

    it('marks boolean values as boolean dataType', async () => {
      mockApiGet.mockResolvedValue({ value: { unknown_flag: true } });
      const result = await clientKeysApi.getClientKeys('u-001');
      expect(result.keys[0].dataType).toBe('boolean');
    });

    it('marks numeric values as currency dataType when not in registry', async () => {
      mockApiGet.mockResolvedValue({ value: { unknown_amount: 500 } });
      const result = await clientKeysApi.getClientKeys('u-001');
      expect(result.keys[0].dataType).toBe('currency');
    });
  });

  describe('recalculateClientKeys', () => {
    it('triggers recalculation and returns success', async () => {
      mockApiPost.mockResolvedValue({ success: true });
      const result = await clientKeysApi.recalculateClientKeys('u-001');
      expect(result.success).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith('/integrations/recalculate-totals', {
        clientId: 'u-001',
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Recalc failed'));
      await expect(clientKeysApi.recalculateClientKeys('u-001')).rejects.toThrow('Recalc failed');
    });
  });

  describe('getClientKeyHistory', () => {
    it('returns hardcoded history stub', async () => {
      const result = await clientKeysApi.getClientKeyHistory('u-001', 'medical_aid_premium');
      expect(result.history).toHaveLength(1);
      expect(result.history[0].value).toBe(1000000);
      expect(result.history[0].changedBy).toBe('System (Auto-calculation)');
    });
  });
});
