import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportingApi } from '../api';

const mockApiGet = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
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

const MOCK_ROWS = [
  { clientId: 'c-001', name: 'John Doe', status: 'active' },
  { clientId: 'c-002', name: 'Jane Smith', status: 'inactive' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reportingApi', () => {
  describe('getReportData', () => {
    it('fetches personal-clients report and returns rows', async () => {
      mockApiGet.mockResolvedValue({ rows: MOCK_ROWS, count: 2, generatedAt: '2025-01-01' });
      const result = await reportingApi.getReportData({ id: 'personal-clients', parameters: {} });
      expect(result).toEqual(MOCK_ROWS);
      expect(mockApiGet).toHaveBeenCalledWith('/reporting/clients/personal-list');
    });

    it('fetches applications-pipeline report', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({ id: 'applications-pipeline', parameters: {} });
      expect(mockApiGet).toHaveBeenCalledWith('/reporting/clients/applications-pipeline');
    });

    it('fetches fna-completion report', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({ id: 'fna-completion', parameters: {} });
      expect(mockApiGet).toHaveBeenCalledWith('/reporting/clients/fna-completion');
    });

    it('fetches compliance-audit report', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({ id: 'compliance-audit', parameters: {} });
      expect(mockApiGet).toHaveBeenCalledWith('/reporting/clients/compliance-audit');
    });

    it('fetches lifecycle-audit report', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({ id: 'lifecycle-audit', parameters: {} });
      expect(mockApiGet).toHaveBeenCalledWith('/reporting/clients/lifecycle-audit');
    });

    it('appends startDate query param when provided', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({
        id: 'personal-clients',
        parameters: { startDate: '2025-01-01' },
      });
      expect(mockApiGet).toHaveBeenCalledWith(
        '/reporting/clients/personal-list?startDate=2025-01-01',
      );
    });

    it('appends endDate query param when provided', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({
        id: 'personal-clients',
        parameters: { endDate: '2025-12-31' },
      });
      expect(mockApiGet).toHaveBeenCalledWith(
        '/reporting/clients/personal-list?endDate=2025-12-31',
      );
    });

    it('appends both date params when provided', async () => {
      mockApiGet.mockResolvedValue({ rows: [], count: 0, generatedAt: '2025-01-01' });
      await reportingApi.getReportData({
        id: 'personal-clients',
        parameters: { startDate: '2025-01-01', endDate: '2025-12-31' },
      });
      expect(mockApiGet).toHaveBeenCalledWith(
        '/reporting/clients/personal-list?startDate=2025-01-01&endDate=2025-12-31',
      );
    });

    it('returns empty array and warns on unexpected response shape', async () => {
      mockApiGet.mockResolvedValue({ unexpected: 'shape' });
      const result = await reportingApi.getReportData({ id: 'personal-clients', parameters: {} });
      expect(result).toEqual([]);
    });

    it('handles raw array response as fallback', async () => {
      mockApiGet.mockResolvedValue(MOCK_ROWS);
      const result = await reportingApi.getReportData({ id: 'personal-clients', parameters: {} });
      expect(result).toEqual(MOCK_ROWS);
    });

    it('throws for unknown report ID', async () => {
      await expect(
        reportingApi.getReportData({ id: 'unknown-report', parameters: {} }),
      ).rejects.toThrow("Report type 'unknown-report' is not yet implemented");
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));
      await expect(
        reportingApi.getReportData({ id: 'personal-clients', parameters: {} }),
      ).rejects.toThrow('Server error');
    });
  });
});
