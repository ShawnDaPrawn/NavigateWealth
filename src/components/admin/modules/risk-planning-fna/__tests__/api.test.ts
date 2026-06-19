import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskPlanningFnaAPI } from '../api';

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
  id: 'rfna-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { coverAmount: 1000000 },
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RiskPlanningFnaAPI', () => {
  describe('getClientProfile', () => {
    it('returns client profile data', async () => {
      const profile = { name: 'John Doe', age: 40 };
      mockApiGet.mockResolvedValue({ success: true, data: profile });
      const result = await RiskPlanningFnaAPI.getClientProfile('client-001');
      expect(result).toEqual(profile);
      expect(mockApiGet).toHaveBeenCalledWith('/risk-planning-fna/client-profile/client-001');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await RiskPlanningFnaAPI.getClientProfile('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await RiskPlanningFnaAPI.getClientProfile('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await RiskPlanningFnaAPI.getClientProfile('client-001');
      expect(result).toBeNull();
    });
  });

  describe('getLatestPublished', () => {
    it('returns latest published FNA', async () => {
      const published = { ...MOCK_FNA, status: 'published' };
      mockApiGet.mockResolvedValue({ success: true, data: published });
      const result = await RiskPlanningFnaAPI.getLatestPublished('client-001');
      expect(result?.status).toBe('published');
      expect(mockApiGet).toHaveBeenCalledWith('/risk-planning-fna/client/client-001/latest');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await RiskPlanningFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await RiskPlanningFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await RiskPlanningFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates new FNA and returns it', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_FNA });
      const inputData = {
        coverAmount: 1000000,
      } as unknown as import('../types').InformationGatheringInput;
      const result = await RiskPlanningFnaAPI.create('client-001', { inputData });
      expect(result).toEqual(MOCK_FNA);
      expect(mockApiPost).toHaveBeenCalledWith('/risk-planning-fna/create', {
        clientId: 'client-001',
        inputData,
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Create failed'));
      await expect(RiskPlanningFnaAPI.create('client-001', { inputData: {} })).rejects.toThrow(
        'Create failed',
      );
    });
  });

  describe('update', () => {
    it('updates FNA and returns it', async () => {
      const updated = { ...MOCK_FNA, inputs: { coverAmount: 2000000 } };
      mockApiPut.mockResolvedValue({ success: true, data: updated });
      const result = await RiskPlanningFnaAPI.update('rfna-001', {
        inputs: { coverAmount: 2000000 },
      } as never);
      expect(result).toEqual(updated);
      expect(mockApiPut).toHaveBeenCalledWith('/risk-planning-fna/update/rfna-001', {
        inputs: { coverAmount: 2000000 },
      });
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(RiskPlanningFnaAPI.update('rfna-001', {})).rejects.toThrow('Update failed');
    });
  });

  describe('publish', () => {
    it('publishes FNA and returns it', async () => {
      const published = { ...MOCK_FNA, status: 'published' };
      mockApiPost.mockResolvedValue({ success: true, data: published });
      const result = await RiskPlanningFnaAPI.publish('rfna-001');
      expect(result.status).toBe('published');
      expect(mockApiPost).toHaveBeenCalledWith('/risk-planning-fna/publish/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Publish failed'));
      await expect(RiskPlanningFnaAPI.publish('rfna-001')).rejects.toThrow('Publish failed');
    });
  });

  describe('unpublish', () => {
    it('unpublishes FNA and returns it', async () => {
      const unpublished = { ...MOCK_FNA, status: 'draft' };
      mockApiPost.mockResolvedValue({ success: true, data: unpublished });
      const result = await RiskPlanningFnaAPI.unpublish('rfna-001');
      expect(result.status).toBe('draft');
      expect(mockApiPost).toHaveBeenCalledWith('/risk-planning-fna/unpublish/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Unpublish failed'));
      await expect(RiskPlanningFnaAPI.unpublish('rfna-001')).rejects.toThrow('Unpublish failed');
    });
  });

  describe('delete', () => {
    it('deletes FNA (soft delete to archive)', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(RiskPlanningFnaAPI.delete('rfna-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/risk-planning-fna/archive/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(RiskPlanningFnaAPI.delete('rfna-001')).rejects.toThrow('Delete failed');
    });
  });

  describe('archive', () => {
    it('archives FNA by delegating to delete', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(RiskPlanningFnaAPI.archive('rfna-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/risk-planning-fna/archive/rfna-001');
    });

    it('throws when delete throws', async () => {
      mockApiDelete.mockRejectedValue(new Error('Archive failed'));
      await expect(RiskPlanningFnaAPI.archive('rfna-001')).rejects.toThrow('Archive failed');
    });
  });

  describe('hardDelete', () => {
    it('hard deletes FNA permanently', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(RiskPlanningFnaAPI.hardDelete('rfna-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/risk-planning-fna/hard-delete/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Hard delete failed'));
      await expect(RiskPlanningFnaAPI.hardDelete('rfna-001')).rejects.toThrow('Hard delete failed');
    });
  });

  describe('getById', () => {
    it('returns FNA by ID', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_FNA });
      const result = await RiskPlanningFnaAPI.getById('rfna-001');
      expect(result).toEqual(MOCK_FNA);
      expect(mockApiGet).toHaveBeenCalledWith('/risk-planning-fna/rfna-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(RiskPlanningFnaAPI.getById('rfna-001')).rejects.toThrow('Not found');
    });
  });

  describe('listForClient', () => {
    it('returns list of FNAs for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_FNA] });
      const result = await RiskPlanningFnaAPI.listForClient('client-001');
      expect(result).toEqual([MOCK_FNA]);
      expect(mockApiGet).toHaveBeenCalledWith('/risk-planning-fna/client/client-001/list');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(RiskPlanningFnaAPI.listForClient('client-001')).rejects.toThrow('Fetch failed');
    });
  });
});
