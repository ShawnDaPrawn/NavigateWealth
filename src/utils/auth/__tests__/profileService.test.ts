import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAppUserFromAuthSessionFallback,
  createDefaultProfile,
  updateUserProfile,
} from '../profileService';

vi.mock('../../supabase/info', () => ({
  projectId: 'test-project-id',
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../authService', () => ({
  getCurrentUserWithMetadata: vi.fn().mockResolvedValue(null),
  mapSupabaseUserToMetadataSnapshot: vi.fn().mockReturnValue(null),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ============================================================================
// buildAppUserFromAuthSessionFallback
// ============================================================================

describe('buildAppUserFromAuthSessionFallback', () => {
  it('returns personnel AppUser when role is admin', () => {
    const result = buildAppUserFromAuthSessionFallback('u-001', 'admin@firm.co', {
      user_metadata: { role: 'admin' },
    });
    expect(result.id).toBe('u-001');
    expect(result.email).toBe('admin@firm.co');
    expect(result.role).toBe('admin');
    expect(result.accountStatus).toBe('approved');
    expect(result.suspended).toBe(false);
    expect(result.adviserAssigned).toBe(true);
  });

  it('returns personnel AppUser when role is adviser', () => {
    const result = buildAppUserFromAuthSessionFallback('u-002', 'adviser@firm.co', {
      user_metadata: { role: 'adviser' },
    });
    expect(result.role).toBe('adviser');
    expect(result.accountStatus).toBe('approved');
  });

  it('returns personnel AppUser when invited flag is set', () => {
    const result = buildAppUserFromAuthSessionFallback('u-003', 'invited@firm.co', {
      user_metadata: {},
      app_metadata: { invited: true },
    });
    expect(result.accountStatus).toBe('approved');
    expect(result.adviserAssigned).toBe(true);
  });

  it('returns client AppUser with default role when no personnel role', () => {
    const result = buildAppUserFromAuthSessionFallback('u-004', 'client@example.com', {
      user_metadata: {},
    });
    expect(result.role).toBe('client');
    expect(result.accountStatus).not.toBe('approved');
    expect(result.adviserAssigned).toBe(false);
  });

  it('returns super_admin AppUser for super admin email', () => {
    const result = buildAppUserFromAuthSessionFallback(
      'u-super',
      'shawn@navigatewealth.co',
      undefined,
    );
    expect(result.role).toBe('super_admin');
    expect(result.accountStatus).toBe('approved');
    expect(result.adviserAssigned).toBe(true);
  });

  it('handles missing sessionUser gracefully', () => {
    const result = buildAppUserFromAuthSessionFallback('u-005', 'unknown@test.com');
    expect(result.id).toBe('u-005');
    expect(result.email).toBe('unknown@test.com');
    expect(result.suspended).toBe(false);
  });

  it('uses admin as fallback role when personnel but no metaRole', () => {
    const result = buildAppUserFromAuthSessionFallback('u-006', 'noRole@firm.co', {
      user_metadata: {},
      app_metadata: { invited: true },
    });
    expect(result.role).toBe('admin');
  });

  it('returns personnel for super_admin role', () => {
    const result = buildAppUserFromAuthSessionFallback('u-007', 'sa@firm.co', {
      user_metadata: { role: 'super_admin' },
    });
    expect(result.role).toBe('super_admin');
    expect(result.accountStatus).toBe('approved');
  });

  it('returns personnel for compliance role', () => {
    const result = buildAppUserFromAuthSessionFallback('u-008', 'comp@firm.co', {
      user_metadata: { role: 'compliance' },
    });
    expect(result.accountStatus).toBe('approved');
  });
});

// ============================================================================
// createDefaultProfile
// ============================================================================

describe('createDefaultProfile', () => {
  it('posts to create-default endpoint on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await createDefaultProfile('u-001', 'user@test.com', 'John', 'access-token');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/create-default'),
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.userId).toBe('u-001');
    expect(body.email).toBe('user@test.com');
    expect(body.displayName).toBe('John');
  });

  it('defaults displayName to empty string when not provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await createDefaultProfile('u-001', 'user@test.com', '', 'access-token');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.displayName).toBe('');
  });

  it('logs error but does not throw when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => 'Internal Server Error',
    });
    await expect(
      createDefaultProfile('u-001', 'user@test.com', '', 'access-token'),
    ).resolves.toBeUndefined();
  });

  it('throws when fetch itself throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(
      createDefaultProfile('u-001', 'user@test.com', '', 'access-token'),
    ).rejects.toThrow();
  });

  it('logs error when response is HTML error page', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: async () => '<!DOCTYPE html><html><body>Error</body></html>',
    });
    await expect(
      createDefaultProfile('u-001', 'user@test.com', '', 'access-token'),
    ).resolves.toBeUndefined();
  });
});

// ============================================================================
// updateUserProfile
// ============================================================================

describe('updateUserProfile', () => {
  it('posts profile update to personal-info endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    await updateUserProfile('u-001', { firstName: 'John' } as never, 'access-token');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/profile/personal-info'),
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.key).toContain('u-001');
    expect(body.data).toEqual({ firstName: 'John' });
  });

  it('throws when response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });
    await expect(updateUserProfile('u-001', {}, 'access-token')).rejects.toThrow(
      'Failed to update profile',
    );
  });

  it('throws when fetch itself throws', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));
    await expect(updateUserProfile('u-001', {}, 'access-token')).rejects.toThrow(
      'Connection refused',
    );
  });
});
