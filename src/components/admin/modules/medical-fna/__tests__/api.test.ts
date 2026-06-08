import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedicalFnaAPI } from '../api';

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
  id: 'mfna-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { currentCoverage: 5000, requiredCoverage: 10000 },
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MedicalFnaAPI', () => {
  describe('getClientMedicalFNAs', () => {
    it('returns sessions for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_SESSION] });
      const result = await MedicalFnaAPI.getClientMedicalFNAs('client-001');
      expect(result).toEqual([MOCK_SESSION]);
      expect(mockApiGet).toHaveBeenCalledWith('/medical-fna/client/client-001');
    });

    it('returns empty array on error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      const result = await MedicalFnaAPI.getClientMedicalFNAs('client-001');
      expect(result).toEqual([]);
    });
  });

  describe('getMedicalFNA', () => {
    it('returns specific session', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await MedicalFnaAPI.getMedicalFNA('mfna-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiGet).toHaveBeenCalledWith('/medical-fna/mfna-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(MedicalFnaAPI.getMedicalFNA('mfna-001')).rejects.toThrow('Not found');
    });
  });

  describe('getLatestPublished', () => {
    it('returns latest published session', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiGet.mockResolvedValue({ success: true, data: published });
      const result = await MedicalFnaAPI.getLatestPublished('client-001');
      expect(result?.status).toBe('published');
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await MedicalFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await MedicalFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await MedicalFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });
  });

  describe('createMedicalFNA', () => {
    it('creates session and returns it', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await MedicalFnaAPI.createMedicalFNA('client-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiPost).toHaveBeenCalledWith('/medical-fna/create', { clientId: 'client-001' });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Create failed'));
      await expect(MedicalFnaAPI.createMedicalFNA('client-001')).rejects.toThrow('Create failed');
    });
  });

  describe('updateMedicalFNAInputs', () => {
    it('updates inputs and returns session', async () => {
      const updated = { ...MOCK_SESSION, inputs: { currentCoverage: 7000 } };
      mockApiPut.mockResolvedValue({ success: true, data: updated });
      const result = await MedicalFnaAPI.updateMedicalFNAInputs('mfna-001', {
        currentCoverage: 7000,
      } as never);
      expect(result.inputs).toEqual({ currentCoverage: 7000 });
      expect(mockApiPut).toHaveBeenCalledWith('/medical-fna/inputs/mfna-001', {
        currentCoverage: 7000,
      });
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(MedicalFnaAPI.updateMedicalFNAInputs('mfna-001', {})).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('updateMedicalFNAResults', () => {
    it('updates results and adjustments', async () => {
      mockApiPut.mockResolvedValue({ success: true, data: MOCK_SESSION });
      await MedicalFnaAPI.updateMedicalFNAResults(
        'mfna-001',
        { gap: 5000 } as never,
        { premium: 300 } as never,
      );
      expect(mockApiPut).toHaveBeenCalledWith('/medical-fna/results/mfna-001', {
        results: { gap: 5000 },
        adjustments: { premium: 300 },
      });
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Update failed'));
      await expect(
        MedicalFnaAPI.updateMedicalFNAResults('mfna-001', {} as never, {} as never),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('calculateMedicalFNA', () => {
    it('triggers calculation and returns session', async () => {
      const calculated = { ...MOCK_SESSION, status: 'calculated' };
      mockApiPost.mockResolvedValue({ success: true, data: calculated });
      const result = await MedicalFnaAPI.calculateMedicalFNA('mfna-001');
      expect(result.status).toBe('calculated');
      expect(mockApiPost).toHaveBeenCalledWith('/medical-fna/calculate/mfna-001');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Calculation failed'));
      await expect(MedicalFnaAPI.calculateMedicalFNA('mfna-001')).rejects.toThrow(
        'Calculation failed',
      );
    });
  });

  describe('saveDraft', () => {
    it('saves as draft and returns session', async () => {
      mockApiPut.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await MedicalFnaAPI.saveDraft('mfna-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiPut).toHaveBeenCalledWith('/medical-fna/draft/mfna-001');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Save failed'));
      await expect(MedicalFnaAPI.saveDraft('mfna-001')).rejects.toThrow('Save failed');
    });
  });

  describe('publishMedicalFNA', () => {
    it('publishes session and returns it', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiPost.mockResolvedValue({ success: true, data: published });
      const result = await MedicalFnaAPI.publishMedicalFNA('mfna-001');
      expect(result.status).toBe('published');
      expect(mockApiPost).toHaveBeenCalledWith('/medical-fna/publish/mfna-001');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Publish failed'));
      await expect(MedicalFnaAPI.publishMedicalFNA('mfna-001')).rejects.toThrow('Publish failed');
    });
  });

  describe('unpublishMedicalFNA', () => {
    it('unpublishes session and returns it', async () => {
      const unpublished = { ...MOCK_SESSION, status: 'draft' };
      mockApiPost.mockResolvedValue({ success: true, data: unpublished });
      const result = await MedicalFnaAPI.unpublishMedicalFNA('mfna-001');
      expect(result.status).toBe('draft');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Unpublish failed'));
      await expect(MedicalFnaAPI.unpublishMedicalFNA('mfna-001')).rejects.toThrow(
        'Unpublish failed',
      );
    });
  });

  describe('archiveMedicalFNA', () => {
    it('archives session', async () => {
      mockApiPut.mockResolvedValue(undefined);
      await expect(MedicalFnaAPI.archiveMedicalFNA('mfna-001')).resolves.toBeUndefined();
      expect(mockApiPut).toHaveBeenCalledWith('/medical-fna/archive/mfna-001');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Archive failed'));
      await expect(MedicalFnaAPI.archiveMedicalFNA('mfna-001')).rejects.toThrow('Archive failed');
    });
  });

  describe('deleteMedicalFNA', () => {
    it('deletes session', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(MedicalFnaAPI.deleteMedicalFNA('mfna-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/medical-fna/delete/mfna-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(MedicalFnaAPI.deleteMedicalFNA('mfna-001')).rejects.toThrow('Delete failed');
    });
  });

  describe('autoPopulateFromProfile', () => {
    it('returns auto-populated inputs', async () => {
      const inputs = { currentCoverage: 3000 };
      mockApiGet.mockResolvedValue({ success: true, data: inputs });
      const result = await MedicalFnaAPI.autoPopulateFromProfile('client-001');
      expect(result).toEqual(inputs);
      expect(mockApiGet).toHaveBeenCalledWith('/medical-fna/client/client-001/auto-populate');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Auto-populate failed'));
      await expect(MedicalFnaAPI.autoPopulateFromProfile('client-001')).rejects.toThrow(
        'Auto-populate failed',
      );
    });
  });
});
