import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaxPlanningFnaAPI, TaxPlanningApiService } from '../api';

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

const MOCK_PLAN = {
  id: 'tp-001',
  clientId: 'client-001',
  status: 'draft',
  inputs: { annualIncome: 1200000 },
  createdAt: '2025-01-01T00:00:00Z',
};

const MOCK_SAVE_DATA = {
  inputs: { annualIncome: 1200000 } as never,
  finalResults: { taxSavings: 50000 } as never,
  adjustments: [],
  recommendations: [],
  adviserNotes: 'Notes here',
  status: 'draft' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaxPlanningFnaAPI', () => {
  describe('autoPopulateInputs', () => {
    it('returns auto-populated inputs for client', async () => {
      const inputs = { annualIncome: 1200000 };
      mockApiPost.mockResolvedValue({ success: true, data: inputs });
      const result = await TaxPlanningFnaAPI.autoPopulateInputs('client-001');
      expect(result).toEqual(inputs);
      expect(mockApiPost).toHaveBeenCalledWith('/tax-planning-fna/client/client-001/auto-populate');
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Auto-populate failed'));
      await expect(TaxPlanningFnaAPI.autoPopulateInputs('client-001')).rejects.toThrow(
        'Auto-populate failed',
      );
    });
  });

  describe('saveSession', () => {
    it('saves session and returns plan', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_PLAN });
      const result = await TaxPlanningFnaAPI.saveSession('client-001', MOCK_SAVE_DATA);
      expect(result).toEqual(MOCK_PLAN);
      expect(mockApiPost).toHaveBeenCalledWith('/tax-planning-fna/save', {
        clientId: 'client-001',
        ...MOCK_SAVE_DATA,
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Save failed'));
      await expect(TaxPlanningFnaAPI.saveSession('client-001', MOCK_SAVE_DATA)).rejects.toThrow(
        'Save failed',
      );
    });
  });

  describe('getAllSessions', () => {
    it('returns all sessions for client', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_PLAN] });
      const result = await TaxPlanningFnaAPI.getAllSessions('client-001');
      expect(result).toEqual([MOCK_PLAN]);
      expect(mockApiGet).toHaveBeenCalledWith('/tax-planning-fna/client/client-001');
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(TaxPlanningFnaAPI.getAllSessions('client-001')).rejects.toThrow('Fetch failed');
    });
  });

  describe('getLatestPublished', () => {
    it('returns latest published session', async () => {
      const published = { ...MOCK_PLAN, status: 'published' };
      mockApiGet.mockResolvedValue({ success: true, data: published });
      const result = await TaxPlanningFnaAPI.getLatestPublished('client-001');
      expect((result as unknown as { status: string })?.status).toBe('published');
      expect(mockApiGet).toHaveBeenCalledWith(
        '/tax-planning-fna/client/client-001/latest-published',
      );
    });

    it('returns null on 404', async () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404 });
      mockApiGet.mockRejectedValue(err);
      const result = await TaxPlanningFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on message-based 404', async () => {
      mockApiGet.mockRejectedValue(new Error('404 Not Found'));
      const result = await TaxPlanningFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });

    it('returns null on other errors', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      const result = await TaxPlanningFnaAPI.getLatestPublished('client-001');
      expect(result).toBeNull();
    });
  });

  // These were no-op stubs, so "Delete" on a Tax FNA reported success and
  // deleted nothing. They now call the server.
  describe('deleteSession', () => {
    it('deletes the session on the server', async () => {
      mockApiDelete.mockResolvedValue({ success: true });
      await TaxPlanningFnaAPI.deleteSession('tp-001');
      expect(mockApiDelete).toHaveBeenCalledWith('/tax-planning-fna/tp-001');
    });

    it('names the client for a session whose id does not', async () => {
      mockApiDelete.mockResolvedValue({ success: true });
      await TaxPlanningFnaAPI.deleteSession('uuid-1', 'client-001');
      expect(mockApiDelete).toHaveBeenCalledWith('/tax-planning-fna/uuid-1?clientId=client-001');
    });

    it('surfaces a failure instead of reporting success', async () => {
      mockApiDelete.mockRejectedValue(new Error('Not found'));
      await expect(TaxPlanningFnaAPI.deleteSession('tp-001')).rejects.toThrow('Not found');
    });
  });

  describe('publishSession', () => {
    it('publishes the session on the server', async () => {
      mockApiPut.mockResolvedValue({ success: true, data: { id: 'tp-001', status: 'published' } });
      await expect(TaxPlanningFnaAPI.publishSession('tp-001')).resolves.toMatchObject({
        status: 'published',
      });
      expect(mockApiPut).toHaveBeenCalledWith('/tax-planning-fna/tp-001/publish');
    });
  });

  describe('unpublishSession', () => {
    it('returns the session to a draft on the server', async () => {
      mockApiPut.mockResolvedValue({ success: true, data: { id: 'tp-001', status: 'draft' } });
      await TaxPlanningFnaAPI.unpublishSession('tp-001', 'client-001');
      expect(mockApiPut).toHaveBeenCalledWith(
        '/tax-planning-fna/tp-001/unpublish?clientId=client-001',
      );
    });
  });

  describe('TaxPlanningApiService alias', () => {
    it('is the same object as TaxPlanningFnaAPI', () => {
      expect(TaxPlanningApiService).toBe(TaxPlanningFnaAPI);
    });
  });
});
