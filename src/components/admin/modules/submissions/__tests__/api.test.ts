import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submissionsApi } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

const MOCK_SUBMISSION = {
  id: 'sub-001',
  type: 'quote',
  status: 'new',
  recipientEmail: 'client@example.com',
  createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submissionsApi', () => {
  describe('list', () => {
    it('returns all submissions without filters', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [MOCK_SUBMISSION] });
      const result = await submissionsApi.list();
      expect(result).toEqual([MOCK_SUBMISSION]);
      expect(mockApiGet).toHaveBeenCalledWith('/submissions');
    });

    it('returns empty array when data absent', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: null });
      const result = await submissionsApi.list();
      expect(result).toEqual([]);
    });

    it('appends type filter to query string', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [] });
      await submissionsApi.list({ type: 'quote' });
      expect(mockApiGet).toHaveBeenCalledWith('/submissions?type=quote');
    });

    it('appends status filter to query string', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [] });
      await submissionsApi.list({ status: 'new' });
      expect(mockApiGet).toHaveBeenCalledWith('/submissions?status=new');
    });

    it('appends both type and status filters', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: [] });
      await submissionsApi.list({ type: 'quote', status: 'new' });
      expect(mockApiGet).toHaveBeenCalledWith('/submissions?type=quote&status=new');
    });
  });

  describe('getById', () => {
    it('returns submission by ID', async () => {
      mockApiGet.mockResolvedValue({ success: true, data: MOCK_SUBMISSION });
      const result = await submissionsApi.getById('sub-001');
      expect(result).toEqual(MOCK_SUBMISSION);
      expect(mockApiGet).toHaveBeenCalledWith('/submissions/sub-001');
    });
  });

  describe('create', () => {
    it('creates submission and returns it', async () => {
      mockApiPost.mockResolvedValue({ success: true, data: MOCK_SUBMISSION });
      const input = { type: 'quote', recipientEmail: 'client@example.com' };
      const result = await submissionsApi.create(input as never);
      expect(result).toEqual(MOCK_SUBMISSION);
      expect(mockApiPost).toHaveBeenCalledWith('/submissions', input);
    });
  });

  describe('update', () => {
    it('updates submission and returns it', async () => {
      const updated = { ...MOCK_SUBMISSION, status: 'processed' };
      mockApiPatch.mockResolvedValue({ success: true, data: updated });
      const result = await submissionsApi.update('sub-001', { status: 'processed' } as never);
      expect(result.status).toBe('processed');
      expect(mockApiPatch).toHaveBeenCalledWith('/submissions/sub-001', { status: 'processed' });
    });
  });

  describe('countNew', () => {
    it('returns count of new submissions', async () => {
      mockApiGet.mockResolvedValue({ success: true, count: 5 });
      const result = await submissionsApi.countNew();
      expect(result).toBe(5);
      expect(mockApiGet).toHaveBeenCalledWith('/submissions/count/new');
    });

    it('returns 0 when count is absent', async () => {
      mockApiGet.mockResolvedValue({ success: true });
      const result = await submissionsApi.countNew();
      expect(result).toBe(0);
    });
  });

  describe('delete', () => {
    it('deletes submission', async () => {
      mockApiDelete.mockResolvedValue(undefined);
      await expect(submissionsApi.delete('sub-001')).resolves.toBeUndefined();
      expect(mockApiDelete).toHaveBeenCalledWith('/submissions/sub-001');
    });
  });

  describe('sendInvite', () => {
    it('posts invite and returns response', async () => {
      const inviteResponse = { success: true, message: 'Invite sent' };
      mockApiPost.mockResolvedValue(inviteResponse);
      const params = {
        recipientEmail: 'client@example.com',
        recipientName: 'John Doe',
        inviteTypeId: 'quote',
        formUrl: 'https://example.com/form',
        emailSubject: 'Quote Request',
        emailBody: 'Please fill out this form',
        emailButtonLabel: 'Start Quote',
      };
      const result = await submissionsApi.sendInvite(params);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Invite sent');
      expect(mockApiPost).toHaveBeenCalledWith('/submissions/invite', params);
    });
  });
});
