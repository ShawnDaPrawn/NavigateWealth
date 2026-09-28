/**
 * PersonnelService.inviteUser — an invited staff member keeps their role.
 * =====================================================================
 *
 * An invite's `data` lands in user_metadata, and resolveTrustedRole stopped
 * reading user_metadata (it is client-editable). Nothing else set
 * app_metadata.role on an invite, so an invited compliance officer,
 * paraplanner or viewer resolved to `client` everywhere. createAccount already
 * set it; inviteUser now does too, and updateProfile keeps it in step when a
 * role changes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const auth = vi.hoisted(() => ({
  inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null })),
  updateUserById: vi.fn(async () => ({ data: {}, error: null as unknown })),
  deleteUser: vi.fn(async () => ({ data: {}, error: null })),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: auth } }),
}));
vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../email-service.tsx', () => ({ sendEmail: vi.fn(async () => true) }));

const { kvStore } = await import('./helpers/contract-harness.ts');
const { PersonnelService } = await import('../client-management-personnel-service.ts');

const payload = {
  email: 'new.staff@navigatewealth.co',
  firstName: 'New',
  lastName: 'Staff',
  role: 'compliance',
} as Parameters<typeof PersonnelService.inviteUser>[1];

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('inviteUser', () => {
  it('writes the role to app_metadata, where the server reads it', async () => {
    await PersonnelService.inviteUser('super_admin', payload);
    expect(auth.updateUserById).toHaveBeenCalledWith('new-user', {
      app_metadata: { role: 'compliance' },
    });
  });

  it('undoes the invite when the role cannot be recorded', async () => {
    auth.updateUserById.mockResolvedValueOnce({ data: {}, error: new Error('auth down') });
    await expect(PersonnelService.inviteUser('admin', payload)).rejects.toThrow('auth down');
    expect([...kvStore.keys()].some((k) => k.startsWith('personnel:profile:'))).toBe(false);
    // Otherwise the admin could neither resend nor cancel it, and a retry
    // would hit "already registered".
    expect(auth.deleteUser).toHaveBeenCalledWith('new-user');
  });
});

describe('updateProfile keeps the trusted role in step', () => {
  const seed = (role: string) =>
    kvStore.set('personnel:profile:staff-1', { id: 'staff-1', email: 's@x.co', role });

  // Guards read app_metadata.role, so a demotion that only touched the
  // personnel record left an invited admin authorising as admin.
  it('writes a role change to app_metadata', async () => {
    seed('admin');
    await PersonnelService.updateProfile('super_admin', 'staff-1', { role: 'adviser' });
    expect(auth.updateUserById).toHaveBeenCalledWith('staff-1', {
      app_metadata: { role: 'adviser' },
    });
    expect((kvStore.get('personnel:profile:staff-1') as { role: string }).role).toBe('adviser');
  });

  it('refuses a role change from compliance, which could otherwise promote itself', async () => {
    seed('compliance');
    await expect(
      PersonnelService.updateProfile('compliance', 'staff-1', { role: 'admin' }),
    ).rejects.toThrow('Only admins can change a role');
    expect(auth.updateUserById).not.toHaveBeenCalled();
    expect((kvStore.get('personnel:profile:staff-1') as { role: string }).role).toBe('compliance');
  });

  it("refuses a plain admin changing a super admin's role", async () => {
    seed('super_admin');
    await expect(
      PersonnelService.updateProfile('admin', 'staff-1', { role: 'viewer' }),
    ).rejects.toThrow('Cannot change a super_admin role');
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it('leaves app_metadata alone when the role is unchanged or absent', async () => {
    seed('admin');
    await PersonnelService.updateProfile('compliance', 'staff-1', { role: 'admin' });
    await PersonnelService.updateProfile('compliance', 'staff-1', {
      phone: '0100000000',
    } as never);
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it('does not save the profile when the role write fails', async () => {
    seed('admin');
    auth.updateUserById.mockResolvedValueOnce({ data: {}, error: new Error('auth down') });
    await expect(
      PersonnelService.updateProfile('admin', 'staff-1', { role: 'viewer' }),
    ).rejects.toThrow('auth down');
    expect((kvStore.get('personnel:profile:staff-1') as { role: string }).role).toBe('admin');
  });
});
