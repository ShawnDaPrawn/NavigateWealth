import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvestmentINAFnaAPI } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
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

const MOCK_SESSION = {
  id: 'ina-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { lumpSumAmount: 100000, investmentTerm: 10 },
  createdAt: '2025-01-01T00:00:00Z',
};

const MOCK_INPUTS = {
  lumpSumAmount: 100000,
  investmentTerm: 10,
  expectedReturn: 0.08,
};

const MOCK_RESULTS = {
  projectedValue: 215892,
  realReturn: 0.05,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InvestmentINAFnaAPI', () => {
  describe('autoPopulateInputs', () => {
    it('returns auto-populated inputs for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_INPUTS });
      const result = await InvestmentINAFnaAPI.autoPopulateInputs('client-001');
      expect(result).toEqual(MOCK_INPUTS);
      expect(mockApiGet).toHaveBeenCalledWith('/ina/investment/client/client-001/auto-populate');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Auto-populate failed'));
      await expect(InvestmentINAFnaAPI.autoPopulateInputs('client-001')).rejects.toThrow(
        'Auto-populate failed',
      );
    });
  });

  describe('calculateINA', () => {
    it('calculates INA and returns results', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_RESULTS });
      const result = await InvestmentINAFnaAPI.calculateINA('client-001', MOCK_INPUTS as never);
      expect(result).toEqual(MOCK_RESULTS);
      expect(mockApiPost).toHaveBeenCalledWith(
        '/ina/investment/client/client-001/calculate',
        MOCK_INPUTS,
      );
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Calculation failed'));
      await expect(
        InvestmentINAFnaAPI.calculateINA('client-001', MOCK_INPUTS as never),
      ).rejects.toThrow('Calculation failed');
    });
  });

  describe('saveSession', () => {
    it('saves session as draft', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await InvestmentINAFnaAPI.saveSession(
        'client-001',
        MOCK_INPUTS as never,
        null,
        'draft',
      );
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiPost).toHaveBeenCalledWith('/ina/investment/client/client-001/save', {
        inputs: MOCK_INPUTS,
        results: null,
        status: 'draft',
      });
    });

    it('saves session as published', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiPost.mockResolvedValue({ success: true, data: published });
      const result = await InvestmentINAFnaAPI.saveSession(
        'client-001',
        MOCK_INPUTS as never,
        MOCK_RESULTS as never,
        'published',
      );
      expect(result.status).toBe('published');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Save failed'));
      await expect(
        InvestmentINAFnaAPI.saveSession('client-001', {} as never, null, 'draft'),
      ).rejects.toThrow('Save failed');
    });
  });

  describe('getAllSessions', () => {
    it('returns all sessions for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_SESSION] });
      const result = await InvestmentINAFnaAPI.getAllSessions('client-001');
      expect(result).toEqual([MOCK_SESSION]);
      expect(mockApiGet).toHaveBeenCalledWith('/ina/investment/client/client-001/sessions');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(InvestmentINAFnaAPI.getAllSessions('client-001')).rejects.toThrow(
        'Fetch failed',
      );
    });
  });

  describe('getLatestPublished', () => {
    it('returns latest published session', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiGet.mockResolvedValue({ success: true, data: published });
      const result = await InvestmentINAFnaAPI.getLatestPublished('client-001');
      expect(result?.status).toBe('published');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await InvestmentINAFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await InvestmentINAFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await InvestmentINAFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });
  });

  describe('getSessionById', () => {
    it('returns specific session', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await InvestmentINAFnaAPI.getSessionById('ina-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiGet).toHaveBeenCalledWith('/ina/investment/session/ina-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(InvestmentINAFnaAPI.getSessionById('ina-001')).rejects.toThrow('Not found');
    });
  });

  describe('deleteSession', () => {
    it('deletes session', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(InvestmentINAFnaAPI.deleteSession('ina-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/ina/investment/session/ina-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(InvestmentINAFnaAPI.deleteSession('ina-001')).rejects.toThrow('Delete failed');
    });
  });

  describe('publishSession', () => {
    it('publishes session and returns it', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiPut.mockResolvedValue({ success: true, data: published });
      const result = await InvestmentINAFnaAPI.publishSession('ina-001');
      expect(result.status).toBe('published');
      expect(mockApiPut).toHaveBeenCalledWith('/ina/investment/session/ina-001/publish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Publish failed'));
      await expect(InvestmentINAFnaAPI.publishSession('ina-001')).rejects.toThrow('Publish failed');
    });
  });

  describe('unpublishSession', () => {
    it('unpublishes session and returns it', async () => {
      const unpublished = { ...MOCK_SESSION, status: 'draft' };
      mockApiPut.mockResolvedValue({ success: true, data: unpublished });
      const result = await InvestmentINAFnaAPI.unpublishSession('ina-001');
      expect(result.status).toBe('draft');
      expect(mockApiPut).toHaveBeenCalledWith('/ina/investment/session/ina-001/unpublish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Unpublish failed'));
      await expect(InvestmentINAFnaAPI.unpublishSession('ina-001')).rejects.toThrow(
        'Unpublish failed',
      );
    });
  });
});
