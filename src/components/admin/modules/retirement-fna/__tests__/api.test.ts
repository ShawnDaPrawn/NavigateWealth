import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetirementFnaAPI } from '../api';

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
  id: 'rfna-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { currentAge: 45, retirementAge: 65, currentSavings: 500000 },
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RetirementFnaAPI', () => {
  describe('getAllForClient', () => {
    it('returns sessions for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_SESSION] });
      const result = await RetirementFnaAPI.getAllForClient('client-001');
      expect(result).toEqual([MOCK_SESSION]);
      expect(mockApiGet).toHaveBeenCalledWith('/retirement-fna/client/client-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(RetirementFnaAPI.getAllForClient('client-001')).rejects.toThrow('Fetch failed');
    });
  });

  describe('getById', () => {
    it('returns specific session', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await RetirementFnaAPI.getById('rfna-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiGet).toHaveBeenCalledWith('/retirement-fna/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(RetirementFnaAPI.getById('rfna-001')).rejects.toThrow('Not found');
    });
  });

  describe('getLatestPublished', () => {
    it('returns latest published session', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiGet.mockResolvedValue({ success: true, data: published });
      const result = await RetirementFnaAPI.getLatestPublished('client-001');
      expect(result?.status).toBe('published');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await RetirementFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await RetirementFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await RetirementFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates session and returns it', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await RetirementFnaAPI.create('client-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiPost).toHaveBeenCalledWith('/retirement-fna/create', {
        clientId: 'client-001',
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Create failed'));
      await expect(RetirementFnaAPI.create('client-001')).rejects.toThrow('Create failed');
    });
  });

  describe('updateInputs', () => {
    it('updates inputs and returns session', async () => {
      const updated = { ...MOCK_SESSION, inputs: { currentAge: 50 } };
      mockApiPut.mockResolvedValue({ success: true, data: updated });
      const result = await RetirementFnaAPI.updateInputs('rfna-001', { currentAge: 50 } as never);
      expect(result.inputs).toEqual({ currentAge: 50 });
      expect(mockApiPut).toHaveBeenCalledWith('/retirement-fna/rfna-001/inputs', {
        currentAge: 50,
      });
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(RetirementFnaAPI.updateInputs('rfna-001', {})).rejects.toThrow('Update failed');
    });
  });

  describe('calculate', () => {
    it('triggers calculation and returns session', async () => {
      const calculated = { ...MOCK_SESSION, status: 'calculated' };
      mockApiPost.mockResolvedValue({ success: true, data: calculated });
      const result = await RetirementFnaAPI.calculate('rfna-001');
      expect(result.status).toBe('calculated');
      expect(mockApiPost).toHaveBeenCalledWith('/retirement-fna/rfna-001/calculate');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Calculation failed'));
      await expect(RetirementFnaAPI.calculate('rfna-001')).rejects.toThrow('Calculation failed');
    });
  });

  describe('saveDraft', () => {
    it('saves as draft and returns session', async () => {
      mockApiPut.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await RetirementFnaAPI.saveDraft('rfna-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiPut).toHaveBeenCalledWith('/retirement-fna/rfna-001/draft');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Save failed'));
      await expect(RetirementFnaAPI.saveDraft('rfna-001')).rejects.toThrow('Save failed');
    });
  });

  describe('publish', () => {
    it('publishes session and returns it', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiPut.mockResolvedValue({ success: true, data: published });
      const result = await RetirementFnaAPI.publish('rfna-001');
      expect(result.status).toBe('published');
      expect(mockApiPut).toHaveBeenCalledWith('/retirement-fna/rfna-001/publish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Publish failed'));
      await expect(RetirementFnaAPI.publish('rfna-001')).rejects.toThrow('Publish failed');
    });
  });

  describe('unpublish', () => {
    it('unpublishes session and returns it', async () => {
      const unpublished = { ...MOCK_SESSION, status: 'draft' };
      mockApiPut.mockResolvedValue({ success: true, data: unpublished });
      const result = await RetirementFnaAPI.unpublish('rfna-001');
      expect(result.status).toBe('draft');
      expect(mockApiPut).toHaveBeenCalledWith('/retirement-fna/rfna-001/unpublish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Unpublish failed'));
      await expect(RetirementFnaAPI.unpublish('rfna-001')).rejects.toThrow('Unpublish failed');
    });
  });

  describe('archive', () => {
    it('archives session and returns it', async () => {
      const archived = { ...MOCK_SESSION, status: 'archived' };
      mockApiPut.mockResolvedValue({ success: true, data: archived });
      const result = await RetirementFnaAPI.archive('rfna-001');
      expect(result.status).toBe('archived');
      expect(mockApiPut).toHaveBeenCalledWith('/retirement-fna/rfna-001/archive');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Archive failed'));
      await expect(RetirementFnaAPI.archive('rfna-001')).rejects.toThrow('Archive failed');
    });
  });

  describe('delete', () => {
    it('deletes session', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(RetirementFnaAPI.delete('rfna-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/retirement-fna/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(RetirementFnaAPI.delete('rfna-001')).rejects.toThrow('Delete failed');
    });
  });

  describe('getAutoPopulatedInputs', () => {
    it('returns auto-populated inputs', async () => {
      const inputs = { currentAge: 45, retirementAge: 65 };
      mockApiGet.mockResolvedValue({ success: true, data: inputs });
      const result = await RetirementFnaAPI.getAutoPopulatedInputs('client-001');
      expect(result).toEqual(inputs);
      expect(mockApiGet).toHaveBeenCalledWith('/retirement-fna/client/client-001/auto-populate');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Auto-populate failed'));
      await expect(RetirementFnaAPI.getAutoPopulatedInputs('client-001')).rejects.toThrow(
        'Auto-populate failed',
      );
    });
  });
});
