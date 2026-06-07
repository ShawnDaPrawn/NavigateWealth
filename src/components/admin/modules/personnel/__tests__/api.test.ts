import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPersonnel,
  fetchPersonnelById,
  invitePersonnel,
  createPersonnelAccount,
  resendPersonnelInvite,
  cancelPersonnelInvite,
  updatePersonnel,
  deletePersonnel,
  fetchPersonnelClients,
  addPersonnelDocument,
  fetchSuperAdminProfile,
  fetchPermissions,
  updatePermissions,
  fetchMyPermissions,
  fetchAllPermissions,
  fetchPermissionAudit,
  backfillAuthRoles,
  personnelApi,
} from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
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

const MOCK_PERSONNEL = {
  id: 'per-001',
  name: 'Alice Adviser',
  firstName: 'Alice',
  lastName: 'Adviser',
  email: 'alice@nw.com',
  phone: '0821234567',
  role: 'adviser',
  status: 'active',
  branch: 'Cape Town',
  commissionSplit: 50,
  updatedAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchPersonnel', () => {
  it('returns normalised personnel list', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_PERSONNEL] });
    const result = await fetchPersonnel();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice Adviser');
    expect(mockApiGet).toHaveBeenCalledWith('personnel/list');
  });

  it('returns empty array on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const result = await fetchPersonnel();
    expect(result).toEqual([]);
  });

  it('filters by role client-side', async () => {
    const adviser = { ...MOCK_PERSONNEL, role: 'adviser' };
    const admin = { ...MOCK_PERSONNEL, id: 'per-002', role: 'admin' };
    mockApiGet.mockResolvedValue({ data: [adviser, admin] });
    const result = await fetchPersonnel({ roles: ['adviser'] });
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('adviser');
  });

  it('filters by status client-side', async () => {
    const active = { ...MOCK_PERSONNEL, status: 'active' };
    const suspended = { ...MOCK_PERSONNEL, id: 'per-002', status: 'suspended' };
    mockApiGet.mockResolvedValue({ data: [active, suspended] });
    const result = await fetchPersonnel({ statuses: ['active'] });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
  });

  it('normalises name from firstName+lastName when name absent', async () => {
    const raw = {
      id: 'p1',
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@nw.com',
      role: 'admin',
      status: 'active',
      commissionSplit: 0,
    };
    mockApiGet.mockResolvedValue({ data: [raw] });
    const result = await fetchPersonnel();
    expect(result[0].name).toBe('Bob Smith');
  });

  it('falls back to email as name when no name fields', async () => {
    const raw = {
      id: 'p1',
      email: 'anon@nw.com',
      role: 'admin',
      status: 'active',
      commissionSplit: 0,
    };
    mockApiGet.mockResolvedValue({ data: [raw] });
    const result = await fetchPersonnel();
    expect(result[0].name).toBe('anon@nw.com');
  });
});

describe('fetchPersonnelById', () => {
  it('returns personnel member when found', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_PERSONNEL] });
    const result = await fetchPersonnelById('per-001');
    expect(result?.id).toBe('per-001');
  });

  it('returns null when not found', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_PERSONNEL] });
    const result = await fetchPersonnelById('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const result = await fetchPersonnelById('per-001');
    expect(result).toBeNull();
  });
});

describe('invitePersonnel', () => {
  it('posts invite and returns new personnel', async () => {
    mockApiPost.mockResolvedValue({ data: MOCK_PERSONNEL });
    const result = await invitePersonnel({ email: 'alice@nw.com', role: 'adviser' } as never);
    expect(result).toEqual(MOCK_PERSONNEL);
    expect(mockApiPost).toHaveBeenCalledWith('personnel/invite', expect.any(Object));
  });

  it('throws on API error', async () => {
    mockApiPost.mockRejectedValue(new Error('Invite failed'));
    await expect(invitePersonnel({ email: 'x@nw.com' } as never)).rejects.toThrow('Invite failed');
  });
});

describe('createPersonnelAccount', () => {
  it('posts and returns profile with recoveryLink', async () => {
    const profile = { ...MOCK_PERSONNEL };
    mockApiPost.mockResolvedValue({ data: { profile, recoveryLink: 'https://reset.link' } });
    const result = await createPersonnelAccount({
      email: 'alice@nw.com',
      role: 'adviser',
    } as never);
    expect(result.profile.id).toBe('per-001');
    expect(result.recoveryLink).toBe('https://reset.link');
  });

  it('throws on API error', async () => {
    mockApiPost.mockRejectedValue(new Error('Create failed'));
    await expect(createPersonnelAccount({ email: 'x@nw.com' } as never)).rejects.toThrow(
      'Create failed',
    );
  });
});

describe('resendPersonnelInvite', () => {
  it('posts resend-invite and returns result', async () => {
    mockApiPost.mockResolvedValue({ data: { success: true, email: 'alice@nw.com' } });
    const result = await resendPersonnelInvite('per-001');
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('personnel/resend-invite/per-001');
  });

  it('throws on API error', async () => {
    mockApiPost.mockRejectedValue(new Error('Failed'));
    await expect(resendPersonnelInvite('per-001')).rejects.toThrow('Failed');
  });
});

describe('cancelPersonnelInvite', () => {
  it('deletes invite and returns result', async () => {
    mockApiDelete.mockResolvedValue({ data: { success: true, email: 'alice@nw.com' } });
    const result = await cancelPersonnelInvite('per-001');
    expect(result.success).toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith('personnel/invite/per-001');
  });

  it('throws on API error', async () => {
    mockApiDelete.mockRejectedValue(new Error('Failed'));
    await expect(cancelPersonnelInvite('per-001')).rejects.toThrow('Failed');
  });
});

describe('updatePersonnel', () => {
  it('puts update and returns updated personnel', async () => {
    const updated = { ...MOCK_PERSONNEL, phone: '0999999999' };
    mockApiPut.mockResolvedValue({ data: updated });
    const result = await updatePersonnel('per-001', { phone: '0999999999' } as never);
    expect(result.phone).toBe('0999999999');
    expect(mockApiPut).toHaveBeenCalledWith('personnel/per-001', { phone: '0999999999' });
  });

  it('throws on API error', async () => {
    mockApiPut.mockRejectedValue(new Error('Update failed'));
    await expect(updatePersonnel('per-001', {})).rejects.toThrow('Update failed');
  });
});

describe('deletePersonnel', () => {
  it('puts suspended status as soft delete', async () => {
    mockApiPut.mockResolvedValue(undefined);
    await deletePersonnel('per-001');
    expect(mockApiPut).toHaveBeenCalledWith('personnel/per-001', { status: 'suspended' });
  });

  it('throws on API error', async () => {
    mockApiPut.mockRejectedValue(new Error('Delete failed'));
    await expect(deletePersonnel('per-001')).rejects.toThrow('Delete failed');
  });
});

describe('fetchPersonnelClients', () => {
  it('returns clients for personnel member', async () => {
    const clients = [{ id: 'c1', name: 'Client One' }];
    mockApiGet.mockResolvedValue({ data: clients });
    const result = await fetchPersonnelClients('per-001');
    expect(result).toEqual(clients);
    expect(mockApiGet).toHaveBeenCalledWith('personnel/per-001/clients');
  });

  it('returns empty array on API error', async () => {
    mockApiGet.mockRejectedValue(new Error('Not found'));
    const result = await fetchPersonnelClients('per-001');
    expect(result).toEqual([]);
  });
});

describe('addPersonnelDocument', () => {
  it('posts document and returns last document in array', async () => {
    const doc = {
      id: 'doc-001',
      name: 'Contract',
      type: 'contract',
      url: 'https://x.com/doc',
      uploadedAt: '2025-01-01',
    };
    mockApiPost.mockResolvedValue({ data: [doc] });
    const result = await addPersonnelDocument({
      personnelId: 'per-001',
      name: 'Contract',
      type: 'contract',
      url: 'https://x.com/doc',
    } as never);
    expect(result.id).toBe('doc-001');
  });

  it('returns generated doc when API returns empty array', async () => {
    mockApiPost.mockResolvedValue({ data: [] });
    const result = await addPersonnelDocument({
      personnelId: 'per-001',
      name: 'Cert',
      type: 'certificate',
      url: 'https://x.com/cert',
    } as never);
    expect(result.name).toBe('Cert');
  });

  it('throws on API error', async () => {
    mockApiPost.mockRejectedValue(new Error('Upload failed'));
    await expect(addPersonnelDocument({ personnelId: 'per-001' } as never)).rejects.toThrow(
      'Upload failed',
    );
  });
});

describe('fetchSuperAdminProfile', () => {
  it('returns super admin profile when found', async () => {
    const superAdmin = { ...MOCK_PERSONNEL, role: 'super_admin' };
    mockApiGet.mockResolvedValue({ data: [superAdmin] });
    const result = await fetchSuperAdminProfile();
    expect(result?.id).toBe('per-001');
    expect(result?.email).toBe('alice@nw.com');
  });

  it('returns null when no super admin exists', async () => {
    mockApiGet.mockResolvedValue({ data: [MOCK_PERSONNEL] });
    const result = await fetchSuperAdminProfile();
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Failed'));
    const result = await fetchSuperAdminProfile();
    expect(result).toBeNull();
  });
});

describe('fetchPermissions', () => {
  it('returns permissions for personnel', async () => {
    const perms = {
      personnelId: 'per-001',
      modules: { clients: true },
      updatedAt: '2025-01-01',
      updatedBy: 'admin',
    };
    mockApiGet.mockResolvedValue({ data: perms });
    const result = await fetchPermissions('per-001');
    expect(result.personnelId).toBe('per-001');
    expect(mockApiGet).toHaveBeenCalledWith('personnel/permissions/per-001');
  });

  it('returns default empty permissions on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Failed'));
    const result = await fetchPermissions('per-001');
    expect(result.personnelId).toBe('per-001');
    expect(result.modules).toEqual({});
  });
});

describe('updatePermissions', () => {
  it('puts permissions and returns updated set', async () => {
    const perms = {
      personnelId: 'per-001',
      modules: { clients: true },
      updatedAt: '2025-01-01',
      updatedBy: 'admin',
    };
    mockApiPut.mockResolvedValue({ data: perms });
    const result = await updatePermissions({ personnelId: 'per-001', modules: { clients: true } });
    expect(result.personnelId).toBe('per-001');
    expect(mockApiPut).toHaveBeenCalledWith('personnel/permissions/per-001', {
      modules: { clients: true },
    });
  });

  it('throws on API error', async () => {
    mockApiPut.mockRejectedValue(new Error('Failed'));
    await expect(updatePermissions({ personnelId: 'per-001', modules: {} })).rejects.toThrow(
      'Failed',
    );
  });
});

describe('fetchMyPermissions', () => {
  it('returns current user permissions', async () => {
    const perms = {
      personnelId: 'per-001',
      modules: { admin: true },
      updatedAt: '2025-01-01',
      updatedBy: 'system',
      isSuperAdmin: true,
    };
    mockApiGet.mockResolvedValue({ data: perms });
    const result = await fetchMyPermissions();
    expect(result.isSuperAdmin).toBe(true);
    expect(mockApiGet).toHaveBeenCalledWith('personnel/permissions/me');
  });

  it('returns fail-open defaults on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Auth error'));
    const result = await fetchMyPermissions();
    expect(result.isSuperAdmin).toBe(false);
    expect(result.modules).toEqual({});
  });
});

describe('fetchAllPermissions', () => {
  it('returns all permission sets', async () => {
    const sets = [
      { personnelId: 'per-001', modules: {}, updatedAt: '2025-01-01', updatedBy: 'admin' },
    ];
    mockApiGet.mockResolvedValue({ data: sets });
    const result = await fetchAllPermissions();
    expect(result).toEqual(sets);
    expect(mockApiGet).toHaveBeenCalledWith('personnel/permissions/all');
  });

  it('returns empty array on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Failed'));
    const result = await fetchAllPermissions();
    expect(result).toEqual([]);
  });
});

describe('fetchPermissionAudit', () => {
  it('returns permission audit entries', async () => {
    const entries = [
      { id: 'audit-001', action: 'updated', changedBy: 'admin', changedAt: '2025-01-01' },
    ];
    mockApiGet.mockResolvedValue({ data: entries });
    const result = await fetchPermissionAudit('per-001');
    expect(result).toEqual(entries);
    expect(mockApiGet).toHaveBeenCalledWith('personnel/audit/permissions/per-001');
  });

  it('returns empty array on error', async () => {
    mockApiGet.mockRejectedValue(new Error('Failed'));
    const result = await fetchPermissionAudit('per-001');
    expect(result).toEqual([]);
  });
});

describe('backfillAuthRoles', () => {
  it('posts dry-run backfill by default', async () => {
    const result = {
      dryRun: true,
      totalPersonnel: 5,
      checked: 5,
      updated: 0,
      skipped: 5,
      errors: 0,
      details: [],
    };
    mockApiPost.mockResolvedValue(result);
    const res = await backfillAuthRoles();
    expect(res.dryRun).toBe(true);
    expect(mockApiPost).toHaveBeenCalledWith('personnel/maintenance/backfill-roles', {
      dryRun: true,
    });
  });

  it('posts live backfill when dryRun is false', async () => {
    const result = {
      dryRun: false,
      totalPersonnel: 5,
      checked: 5,
      updated: 2,
      skipped: 3,
      errors: 0,
      details: [],
    };
    mockApiPost.mockResolvedValue(result);
    const res = await backfillAuthRoles(false);
    expect(res.updated).toBe(2);
  });

  it('throws on API error', async () => {
    mockApiPost.mockRejectedValue(new Error('Maintenance failed'));
    await expect(backfillAuthRoles()).rejects.toThrow('Maintenance failed');
  });
});

describe('personnelApi object', () => {
  it('exposes all expected functions', () => {
    expect(typeof personnelApi.fetch).toBe('function');
    expect(typeof personnelApi.fetchById).toBe('function');
    expect(typeof personnelApi.invite).toBe('function');
    expect(typeof personnelApi.createAccount).toBe('function');
    expect(typeof personnelApi.update).toBe('function');
    expect(typeof personnelApi.delete).toBe('function');
    expect(typeof personnelApi.fetchPermissions).toBe('function');
    expect(typeof personnelApi.fetchMyPermissions).toBe('function');
    expect(typeof personnelApi.backfillAuthRoles).toBe('function');
  });
});
