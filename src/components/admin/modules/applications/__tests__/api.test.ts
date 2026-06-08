import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applicationsApi } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
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

const MOCK_APPLICATION = {
  id: 'app-001',
  application_number: 'NW-2025-001',
  status: 'submitted',
  created_at: '2025-01-01T00:00:00Z',
  submitted_at: '2025-01-02T00:00:00Z',
  application_data: {
    accountReasons: ['investment'],
    existingProducts: ['life'],
    externalProviders: [],
    customProviders: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applicationsApi', () => {
  describe('getApplications', () => {
    it('fetches incomplete applications by combining draft and in_progress', async () => {
      mockApiGet
        .mockResolvedValueOnce({ applications: [MOCK_APPLICATION] })
        .mockResolvedValueOnce({ applications: [] });
      const result = await applicationsApi.getApplications('incomplete');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });

    it('fetches incomplete applications and merges both results', async () => {
      const draft = {
        ...MOCK_APPLICATION,
        id: 'app-001',
        status: 'draft',
        created_at: '2025-01-02T00:00:00Z',
      };
      const inProgress = {
        ...MOCK_APPLICATION,
        id: 'app-002',
        status: 'in_progress',
        created_at: '2025-01-01T00:00:00Z',
      };
      mockApiGet
        .mockResolvedValueOnce({ applications: [draft] })
        .mockResolvedValueOnce({ applications: [inProgress] });
      const result = await applicationsApi.getApplications('incomplete');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('app-001');
    });

    it('fetches pending applications', async () => {
      mockApiGet.mockResolvedValue({ applications: [MOCK_APPLICATION] });
      const result = await applicationsApi.getApplications('pending');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=submitted'));
    });

    it('fetches approved applications', async () => {
      mockApiGet.mockResolvedValue({ applications: [MOCK_APPLICATION] });
      await applicationsApi.getApplications('approved');
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=approved'));
    });

    it('fetches invited applications', async () => {
      mockApiGet.mockResolvedValue({ applications: [] });
      await applicationsApi.getApplications('invited');
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('status=invited'));
    });

    it('returns empty array for unknown tab status', async () => {
      const result = await applicationsApi.getApplications('unknown' as never);
      expect(result).toEqual([]);
    });

    it('returns empty array when no applications in response', async () => {
      mockApiGet.mockResolvedValue({ applications: [] });
      const result = await applicationsApi.getApplications('pending');
      expect(result).toEqual([]);
    });

    it('throws on API error for pending tab', async () => {
      mockApiGet.mockRejectedValue(new Error('Fetch failed'));
      await expect(applicationsApi.getApplications('pending')).rejects.toThrow('Fetch failed');
    });

    it('throws on API error for incomplete tab', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));
      await expect(applicationsApi.getApplications('incomplete')).rejects.toThrow('Network error');
    });
  });

  describe('getStats', () => {
    it('returns application statistics', async () => {
      const stats = { total: 50, submitted: 10, draft: 5, approved: 30, declined: 5 };
      mockApiGet.mockResolvedValue({ stats });
      const result = await applicationsApi.getStats();
      expect(result.total).toBe(50);
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('admin/stats'));
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Stats unavailable'));
      await expect(applicationsApi.getStats()).rejects.toThrow('Stats unavailable');
    });
  });

  describe('getApplicationDetail', () => {
    it('returns normalized application by ID', async () => {
      mockApiGet.mockResolvedValue({ application: MOCK_APPLICATION });
      const result = await applicationsApi.getApplicationDetail('app-001');
      expect(result.id).toBe('app-001');
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('app-001'));
    });

    it('throws on API error', async () => {
      mockApiGet.mockRejectedValue(new Error('Not found'));
      await expect(applicationsApi.getApplicationDetail('app-001')).rejects.toThrow('Not found');
    });
  });

  describe('approveApplication', () => {
    it('posts to approve endpoint', async () => {
      mockApiPost.mockResolvedValue(undefined);
      await expect(applicationsApi.approveApplication('app-001')).resolves.toBeUndefined();
      expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('app-001/approve'));
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Approve failed'));
      await expect(applicationsApi.approveApplication('app-001')).rejects.toThrow('Approve failed');
    });
  });

  describe('declineApplication', () => {
    it('posts to decline endpoint with reason', async () => {
      mockApiPost.mockResolvedValue(undefined);
      await applicationsApi.declineApplication('app-001', 'Insufficient documents');
      expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('app-001/decline'), {
        reason: 'Insufficient documents',
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Decline failed'));
      await expect(applicationsApi.declineApplication('app-001', 'Reason')).rejects.toThrow(
        'Decline failed',
      );
    });
  });

  describe('updateApplicationData', () => {
    it('patches application data', async () => {
      mockApiPatch.mockResolvedValue({ success: true, amendments_count: 1 });
      const result = await applicationsApi.updateApplicationData(
        'app-001',
        { field: 'value' },
        'Updated field',
      );
      expect(result.success).toBe(true);
      expect(result.amendments_count).toBe(1);
      expect(mockApiPatch).toHaveBeenCalledWith(expect.stringContaining('app-001'), {
        application_data: { field: 'value' },
        amendment_notes: 'Updated field',
      });
    });

    it('patches without amendment notes', async () => {
      mockApiPatch.mockResolvedValue({ success: true, amendments_count: 0 });
      await applicationsApi.updateApplicationData('app-001', { field: 'value' });
      expect(mockApiPatch).toHaveBeenCalledWith(expect.any(String), {
        application_data: { field: 'value' },
        amendment_notes: undefined,
      });
    });

    it('throws on API error', async () => {
      mockApiPatch.mockRejectedValue(new Error('Update failed'));
      await expect(applicationsApi.updateApplicationData('app-001', {})).rejects.toThrow(
        'Update failed',
      );
    });
  });

  describe('inviteApplicant', () => {
    it('posts invite and returns result', async () => {
      const inviteResult = {
        success: true,
        applicationId: 'app-002',
        applicationNumber: 'NW-2025-002',
      };
      mockApiPost.mockResolvedValue(inviteResult);
      const result = await applicationsApi.inviteApplicant({
        email: 'client@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
      expect(result.applicationId).toBe('app-002');
      expect(mockApiPost).toHaveBeenCalledWith(
        expect.stringContaining('invite'),
        expect.objectContaining({ email: 'client@example.com' }),
      );
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Invite failed'));
      await expect(
        applicationsApi.inviteApplicant({ email: 'x@x.com', firstName: 'X', lastName: 'Y' }),
      ).rejects.toThrow('Invite failed');
    });
  });

  describe('resendInvite', () => {
    it('posts resend invite and returns result', async () => {
      mockApiPost.mockResolvedValue({ success: true });
      const result = await applicationsApi.resendInvite('app-001');
      expect(result.success).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith(expect.stringContaining('invite/resend'), {
        applicationId: 'app-001',
      });
    });

    it('throws on API error', async () => {
      mockApiPost.mockRejectedValue(new Error('Resend failed'));
      await expect(applicationsApi.resendInvite('app-001')).rejects.toThrow('Resend failed');
    });
  });
});
