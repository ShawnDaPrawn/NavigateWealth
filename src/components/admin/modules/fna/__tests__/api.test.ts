import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FNAAPI } from '../api';

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

const MOCK_FNA = {
  id: 'fna-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { monthlyIncome: 50000, monthlyExpenses: 20000 },
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FNAAPI', () => {
  describe('getClientFNAs', () => {
    it('returns FNA sessions for client', async () => {
      mockApiGet.mockResolvedValue([MOCK_FNA]);
      const result = await FNAAPI.getClientFNAs('client-001');
      expect(result).toEqual([MOCK_FNA]);
      expect(mockApiGet).toHaveBeenCalledWith('/fna/client/client-001');
    });

    it('returns empty array on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      const result = await FNAAPI.getClientFNAs('client-001');
      expect(result).toEqual([]);
    });
  });

  describe('getFNA', () => {
    it('returns specific FNA session', async () => {
      mockApiGet.mockResolvedValue(MOCK_FNA);
      const result = await FNAAPI.getFNA('fna-001');
      expect(result).toEqual(MOCK_FNA);
      expect(mockApiGet).toHaveBeenCalledWith('/fna/fna-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('FNA not found'));
      await expect(FNAAPI.getFNA('fna-001')).rejects.toThrow('FNA not found');
    });
  });

  describe('getLatestPublishedFNA', () => {
    it('returns latest published FNA for client', async () => {
      const published = { ...MOCK_FNA, status: 'published' };
      mockApiGet.mockResolvedValue(published);
      const result = await FNAAPI.getLatestPublishedFNA('client-001');
      expect(result?.status).toBe('published');
      expect(mockApiGet).toHaveBeenCalledWith('/fna/client/client-001/latest-published');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not Found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await FNAAPI.getLatestPublishedFNA('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404 error', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await FNAAPI.getLatestPublishedFNA('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other API errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Internal server error'));
      const result = await FNAAPI.getLatestPublishedFNA('client-001');
      expect(result).toBeNull();
    });
  });

  describe('createFNA', () => {
    it('creates new FNA session and returns it', async () => {
      mockApiPost.mockResolvedValue(MOCK_FNA);
      const result = await FNAAPI.createFNA('client-001');
      expect(result).toEqual(MOCK_FNA);
      expect(mockApiPost).toHaveBeenCalledWith('/fna/create', { clientId: 'client-001' });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Create failed'));
      await expect(FNAAPI.createFNA('client-001')).rejects.toThrow('Create failed');
    });
  });

  describe('updateFNAInputs', () => {
    it('updates FNA inputs and returns session', async () => {
      const updated = { ...MOCK_FNA, inputs: { monthlyIncome: 60000 } };
      mockApiPut.mockResolvedValue(updated);
      const result = await FNAAPI.updateFNAInputs('fna-001', { monthlyIncome: 60000 } as never);
      expect(result.inputs).toEqual({ monthlyIncome: 60000 });
      expect(mockApiPut).toHaveBeenCalledWith('/fna/fna-001/inputs', { monthlyIncome: 60000 });
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(FNAAPI.updateFNAInputs('fna-001', {})).rejects.toThrow('Update failed');
    });
  });

  describe('calculateFNA', () => {
    it('triggers calculation and returns session with results', async () => {
      const calculated = { ...MOCK_FNA, status: 'calculated', results: { gap: 10000 } };
      mockApiPost.mockResolvedValue(calculated);
      const result = await FNAAPI.calculateFNA('fna-001');
      expect(result.status).toBe('calculated');
      expect(mockApiPost).toHaveBeenCalledWith('/fna/fna-001/calculate');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Calculation failed'));
      await expect(FNAAPI.calculateFNA('fna-001')).rejects.toThrow('Calculation failed');
    });
  });

  describe('saveDraft', () => {
    it('saves FNA as draft and returns session', async () => {
      const draft = { ...MOCK_FNA, status: 'draft' };
      mockApiPut.mockResolvedValue(draft);
      const result = await FNAAPI.saveDraft('fna-001');
      expect(result.status).toBe('draft');
      expect(mockApiPut).toHaveBeenCalledWith('/fna/fna-001/draft');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Save failed'));
      await expect(FNAAPI.saveDraft('fna-001')).rejects.toThrow('Save failed');
    });
  });

  describe('publishFNA', () => {
    it('publishes FNA and returns session', async () => {
      const published = { ...MOCK_FNA, status: 'published' };
      mockApiPut.mockResolvedValue(published);
      const result = await FNAAPI.publishFNA('fna-001');
      expect(result.status).toBe('published');
      expect(mockApiPut).toHaveBeenCalledWith('/fna/fna-001/publish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Publish failed'));
      await expect(FNAAPI.publishFNA('fna-001')).rejects.toThrow('Publish failed');
    });
  });

  describe('unpublishFNA', () => {
    it('unpublishes FNA and returns session', async () => {
      const unpublished = { ...MOCK_FNA, status: 'draft' };
      mockApiPut.mockResolvedValue(unpublished);
      const result = await FNAAPI.unpublishFNA('fna-001');
      expect(result.status).toBe('draft');
      expect(mockApiPut).toHaveBeenCalledWith('/fna/fna-001/unpublish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Unpublish failed'));
      await expect(FNAAPI.unpublishFNA('fna-001')).rejects.toThrow('Unpublish failed');
    });
  });

  describe('archiveFNA', () => {
    it('archives FNA session', async () => {
      mockApiPut.mockResolvedValue(undefined);
      await expect(FNAAPI.archiveFNA('fna-001')).resolves.toBeUndefined();
      expect(mockApiPut).toHaveBeenCalledWith('/fna/fna-001/archive');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Archive failed'));
      await expect(FNAAPI.archiveFNA('fna-001')).rejects.toThrow('Archive failed');
    });
  });

  describe('deleteFNA', () => {
    it('deletes FNA session', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(FNAAPI.deleteFNA('fna-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/fna/fna-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(FNAAPI.deleteFNA('fna-001')).rejects.toThrow('Delete failed');
    });
  });

  describe('autoPopulateFromProfile', () => {
    it('returns auto-populated FNA inputs', async () => {
      const inputs = { monthlyIncome: 45000, monthlyExpenses: 18000 };
      mockApiGet.mockResolvedValue(inputs);
      const result = await FNAAPI.autoPopulateFromProfile('client-001');
      expect(result).toEqual(inputs);
      expect(mockApiGet).toHaveBeenCalledWith('/fna/client/client-001/auto-populate');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Auto-populate failed'));
      await expect(FNAAPI.autoPopulateFromProfile('client-001')).rejects.toThrow(
        'Auto-populate failed',
      );
    });
  });
});
