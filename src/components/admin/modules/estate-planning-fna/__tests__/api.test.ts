import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EstatePlanningAPI } from '../api';

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
  id: 'ep-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { estateValue: 5000000 },
  createdAt: '2025-01-01T00:00:00Z',
};

const MOCK_INPUTS = {
  estateValue: 5000000,
  outstandingLiabilities: 500000,
};

const MOCK_RESULTS = {
  liquidityNeeded: 1000000,
  coverageGap: 200000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EstatePlanningAPI', () => {
  describe('autoPopulateInputs', () => {
    it('returns auto-populated inputs for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_INPUTS });
      const result = await EstatePlanningAPI.autoPopulateInputs('client-001');
      expect(result).toEqual(MOCK_INPUTS);
      expect(mockApiGet).toHaveBeenCalledWith(
        '/estate-planning-fna/client/client-001/auto-populate',
      );
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Auto-populate failed'));
      await expect(EstatePlanningAPI.autoPopulateInputs('client-001')).rejects.toThrow(
        'Auto-populate failed',
      );
    });
  });

  describe('saveSession', () => {
    it('saves session as draft with default empty adviser notes', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await EstatePlanningAPI.saveSession(
        'client-001',
        MOCK_INPUTS as never,
        null,
        'draft',
      );
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiPost).toHaveBeenCalledWith('/estate-planning-fna/save', {
        clientId: 'client-001',
        inputs: MOCK_INPUTS,
        results: null,
        status: 'draft',
        adviserNotes: '',
      });
    });

    it('saves session as published with adviser notes', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiPost.mockResolvedValue({ success: true, data: published });
      const result = await EstatePlanningAPI.saveSession(
        'client-001',
        MOCK_INPUTS as never,
        MOCK_RESULTS as never,
        'published',
        'Review complete',
      );
      expect(result.status).toBe('published');
      expect(mockApiPost).toHaveBeenCalledWith('/estate-planning-fna/save', {
        clientId: 'client-001',
        inputs: MOCK_INPUTS,
        results: MOCK_RESULTS,
        status: 'published',
        adviserNotes: 'Review complete',
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Save failed'));
      await expect(
        EstatePlanningAPI.saveSession('client-001', {} as never, null, 'draft'),
      ).rejects.toThrow('Save failed');
    });
  });

  describe('getAllSessions', () => {
    it('returns all sessions for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_SESSION] });
      const result = await EstatePlanningAPI.getAllSessions('client-001');
      expect(result).toEqual([MOCK_SESSION]);
      expect(mockApiGet).toHaveBeenCalledWith('/estate-planning-fna/client/client-001/sessions');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(EstatePlanningAPI.getAllSessions('client-001')).rejects.toThrow('Fetch failed');
    });
  });

  describe('getLatestPublished', () => {
    it('returns latest published session', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiGet.mockResolvedValue({ success: true, data: published });
      const result = await EstatePlanningAPI.getLatestPublished('client-001');
      expect(result?.status).toBe('published');
      expect(mockApiGet).toHaveBeenCalledWith(
        '/estate-planning-fna/client/client-001/latest-published',
      );
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await EstatePlanningAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await EstatePlanningAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await EstatePlanningAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });
  });

  describe('getSessionById', () => {
    it('returns specific session', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_SESSION });
      const result = await EstatePlanningAPI.getSessionById('ep-001');
      expect(result).toEqual(MOCK_SESSION);
      expect(mockApiGet).toHaveBeenCalledWith('/estate-planning-fna/session/ep-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(EstatePlanningAPI.getSessionById('ep-001')).rejects.toThrow('Not found');
    });
  });

  describe('deleteSession', () => {
    it('deletes session', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(EstatePlanningAPI.deleteSession('ep-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/estate-planning-fna/session/ep-001');
    });

    it('throws on API error', async () => {
      mockApiDelete.mockRejectedValue(new Error('Delete failed'));
      await expect(EstatePlanningAPI.deleteSession('ep-001')).rejects.toThrow('Delete failed');
    });
  });

  describe('publishSession', () => {
    it('publishes session and returns it', async () => {
      const published = { ...MOCK_SESSION, status: 'published' };
      mockApiPut.mockResolvedValue({ success: true, data: published });
      const result = await EstatePlanningAPI.publishSession('ep-001');
      expect(result.status).toBe('published');
      expect(mockApiPut).toHaveBeenCalledWith('/estate-planning-fna/session/ep-001/publish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Publish failed'));
      await expect(EstatePlanningAPI.publishSession('ep-001')).rejects.toThrow('Publish failed');
    });
  });

  describe('unpublishSession', () => {
    it('unpublishes session and returns it', async () => {
      const unpublished = { ...MOCK_SESSION, status: 'draft' };
      mockApiPut.mockResolvedValue({ success: true, data: unpublished });
      const result = await EstatePlanningAPI.unpublishSession('ep-001');
      expect(result.status).toBe('draft');
      expect(mockApiPut).toHaveBeenCalledWith('/estate-planning-fna/session/ep-001/unpublish');
    });

    it('throws on API error', async () => {
      mockApiPut.mockRejectedValue(new Error('Unpublish failed'));
      await expect(EstatePlanningAPI.unpublishSession('ep-001')).rejects.toThrow(
        'Unpublish failed',
      );
    });
  });
});
