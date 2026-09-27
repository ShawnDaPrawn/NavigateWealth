/**
 * PersonnelService.inviteUser — an invited staff member keeps their role.
 * =====================================================================
 *
 * An invite's `data` lands in user_metadata, and resolveTrustedRole stopped
 * reading user_metadata (it is client-editable). Nothing else set
 * app_metadata.role on an invite, so an invited compliance officer,
 * paraplanner or viewer resolved to `client` everywhere. createAccount already
 * set it; inviteUser now does too.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const auth = vi.hoisted(() => ({
  inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: 'new-user' } }, error: null })),
  updateUserById: vi.fn(async () => ({ data: {}, error: null as unknown })),
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

  it('does not save a personnel profile when the role cannot be recorded', async () => {
    auth.updateUserById.mockResolvedValueOnce({ data: {}, error: new Error('auth down') });
    await expect(PersonnelService.inviteUser('admin', payload)).rejects.toThrow('auth down');
    expect([...kvStore.keys()].some((k) => k.startsWith('personnel:profile:'))).toBe(false);
  });
});
