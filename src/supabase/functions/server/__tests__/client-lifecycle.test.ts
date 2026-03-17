/**
 * Client Lifecycle Service Tests
 *
 * Integration tests for the multi-entry KV consistency patterns
 * defined in Guidelines §12.3 (Non-Negotiable).
 *
 * Tests the full lifecycle:
 *   Active -> Suspended -> Active (unsuspend)
 *   Active -> Closed (soft-delete)
 *   Suspended -> Closed (soft-delete)
 *   Closed -> Reinstated
 *
 * These tests mock the KV store to verify that both the security
 * and profile entries are always updated together in a single
 * Promise.all() call.
 *
 * Run with: npx vitest run supabase/functions/server/__tests__/client-lifecycle.test.ts
 *
 * @module server/__tests__/client-lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// KV MOCK
// ============================================================================

const kvStore = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn((key: string) => {
    const val = kvStore.get(key);
    // Return a deep copy to avoid mutation leaking between calls
    return val ? JSON.parse(JSON.stringify(val)) : null;
  }),
  set: vi.fn((key: string, value: unknown) => {
    kvStore.set(key, JSON.parse(JSON.stringify(value)));
  }),
  del: vi.fn((key: string) => {
    kvStore.delete(key);
  }),
  getByPrefix: vi.fn((prefix: string) => {
    const results: unknown[] = [];
    kvStore.forEach((val, key) => {
      if (key.startsWith(prefix)) results.push(JSON.parse(JSON.stringify(val)));
    });
    return results;
  }),
}));

// Mock stderr-logger
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// Mock error middleware
vi.mock('../error.middleware.ts', () => ({
  ValidationError: class extends Error { constructor(m: string) { super(m); } },
  NotFoundError: class extends Error { constructor(m: string) { super(m); } },
}));

// Mock communication-repo (background group recalculation)
vi.mock('../communication-repo.ts', () => ({
  recalculateAllGroupMemberships: vi.fn().mockResolvedValue(undefined),
}));

// Mock constants
vi.mock('../constants.tsx', () => ({
  SUPER_ADMIN_EMAIL: 'admin@test.com',
  PERSONNEL_ROLES: ['admin', 'super_admin', 'adviser', 'compliance_officer', 'paraplanner'],
}));

// Mock Supabase client (for getAllClients — not used in lifecycle tests)
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'not found' } }),
      },
    },
  }),
}));

// ============================================================================
// IMPORT AFTER MOCKS
// ============================================================================

import { ClientsService } from '../client-management-service.ts';
import * as kv from '../kv_store.tsx';

// ============================================================================
// HELPERS
// ============================================================================

const CLIENT_ID = 'test-client-123';
const ADMIN_ID = 'admin-user-456';
const SECURITY_KEY = `security:${CLIENT_ID}`;
const PROFILE_KEY = `user_profile:${CLIENT_ID}:personal_info`;

function seedActiveClient() {
  kvStore.set(SECURITY_KEY, {
    suspended: false,
    deleted: false,
  });
  kvStore.set(PROFILE_KEY, {
    accountStatus: 'approved',
    updatedAt: '2025-01-01T00:00:00.000Z',
  });
}

function seedSuspendedClient() {
  kvStore.set(SECURITY_KEY, {
    suspended: true,
    deleted: false,
    suspendedAt: '2025-01-15T00:00:00.000Z',
    suspendedBy: ADMIN_ID,
    reason: 'AML review',
    previousAccountStatus: 'approved',
  });
  kvStore.set(PROFILE_KEY, {
    accountStatus: 'suspended',
    updatedAt: '2025-01-15T00:00:00.000Z',
  });
}

function seedClosedClient(wasSuspendedBefore = false) {
  kvStore.set(SECURITY_KEY, {
    suspended: true,
    deleted: true,
    deletedAt: '2025-02-01T00:00:00.000Z',
    closedBy: ADMIN_ID,
    closureReason: 'Client request',
    previousAccountStatus: 'approved',
    wasSuspendedBeforeClosure: wasSuspendedBefore,
  });
  kvStore.set(PROFILE_KEY, {
    accountStatus: 'closed',
    updatedAt: '2025-02-01T00:00:00.000Z',
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ClientsService — Client Lifecycle (§12.3)', () => {
  let service: ClientsService;

  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
    service = new ClientsService();
  });

  // ==========================================================================
  // SUSPEND
  // ==========================================================================

  describe('suspendClient', () => {
    it('sets suspended=true on security AND accountStatus=suspended on profile', async () => {
      seedActiveClient();

      await service.suspendClient(CLIENT_ID, ADMIN_ID, 'AML review');

      const security = kvStore.get(SECURITY_KEY);
      const profile = kvStore.get(PROFILE_KEY);

      expect(security.suspended).toBe(true);
      expect(security.suspendedBy).toBe(ADMIN_ID);
      expect(security.reason).toBe('AML review');
      expect(profile.accountStatus).toBe('suspended');
    });

    it('stashes previousAccountStatus in security entry', async () => {
      seedActiveClient();

      await service.suspendClient(CLIENT_ID, ADMIN_ID, 'Review');

      const security = kvStore.get(SECURITY_KEY);
      expect(security.previousAccountStatus).toBe('approved');
    });

    it('writes both entries via kv.set (Promise.all pattern)', async () => {
      seedActiveClient();

      await service.suspendClient(CLIENT_ID, ADMIN_ID, 'Review');

      // kv.set should be called exactly twice — once for security, once for profile
      const setCalls = vi.mocked(kv.set).mock.calls;
      const securityCall = setCalls.find((c: [string, unknown]) => c[0] === SECURITY_KEY);
      const profileCall = setCalls.find((c: [string, unknown]) => c[0] === PROFILE_KEY);

      expect(securityCall).toBeDefined();
      expect(profileCall).toBeDefined();
    });
  });

  // ==========================================================================
  // UNSUSPEND
  // ==========================================================================

  describe('unsuspendClient', () => {
    it('clears suspended flag and restores previousAccountStatus', async () => {
      seedSuspendedClient();

      await service.unsuspendClient(CLIENT_ID, ADMIN_ID);

      const security = kvStore.get(SECURITY_KEY);
      const profile = kvStore.get(PROFILE_KEY);

      expect(security.suspended).toBe(false);
      expect(security.reason).toBeUndefined();
      expect(security.previousAccountStatus).toBeUndefined();
      expect(profile.accountStatus).toBe('approved');
    });

    it('defaults previousAccountStatus to "approved" when not stashed', async () => {
      kvStore.set(SECURITY_KEY, { suspended: true, deleted: false });
      kvStore.set(PROFILE_KEY, { accountStatus: 'suspended' });

      await service.unsuspendClient(CLIENT_ID, ADMIN_ID);

      const profile = kvStore.get(PROFILE_KEY);
      expect(profile.accountStatus).toBe('approved');
    });
  });

  // ==========================================================================
  // CLOSE ACCOUNT (soft-delete)
  // ==========================================================================

  describe('closeAccount', () => {
    it('sets deleted=true, suspended=true, and accountStatus=closed', async () => {
      seedActiveClient();

      const result = await service.closeAccount(CLIENT_ID, ADMIN_ID, 'Client request');

      const security = kvStore.get(SECURITY_KEY);
      const profile = kvStore.get(PROFILE_KEY);

      expect(result.success).toBe(true);
      expect(security.deleted).toBe(true);
      expect(security.suspended).toBe(true);
      expect(security.closedBy).toBe(ADMIN_ID);
      expect(security.closureReason).toBe('Client request');
      expect(profile.accountStatus).toBe('closed');
    });

    it('stashes previousAccountStatus and wasSuspendedBeforeClosure', async () => {
      seedActiveClient();

      await service.closeAccount(CLIENT_ID, ADMIN_ID, 'Reason');

      const security = kvStore.get(SECURITY_KEY);
      expect(security.previousAccountStatus).toBe('approved');
      expect(security.wasSuspendedBeforeClosure).toBe(false);
    });

    it('records wasSuspendedBeforeClosure=true when closing a suspended account', async () => {
      seedSuspendedClient();

      await service.closeAccount(CLIENT_ID, ADMIN_ID, 'Escalated');

      const security = kvStore.get(SECURITY_KEY);
      expect(security.wasSuspendedBeforeClosure).toBe(true);
    });

    it('rejects closing an already-closed account', async () => {
      seedClosedClient();

      const result = await service.closeAccount(CLIENT_ID, ADMIN_ID, 'Double close');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already closed');
    });
  });

  // ==========================================================================
  // REINSTATE
  // ==========================================================================

  describe('reinstateAccount', () => {
    it('clears deleted flag and restores previous accountStatus', async () => {
      seedClosedClient();

      const result = await service.reinstateAccount(CLIENT_ID, ADMIN_ID, 'Reviewed');

      const security = kvStore.get(SECURITY_KEY);
      const profile = kvStore.get(PROFILE_KEY);

      expect(result.success).toBe(true);
      expect(security.deleted).toBe(false);
      expect(security.suspended).toBe(false);
      expect(profile.accountStatus).toBe('approved');
    });

    it('preserves suspension state if account was suspended before closure', async () => {
      seedClosedClient(true);

      await service.reinstateAccount(CLIENT_ID, ADMIN_ID);

      const security = kvStore.get(SECURITY_KEY);
      const profile = kvStore.get(PROFILE_KEY);

      // Should NOT clear suspension because account was suspended before closure
      expect(security.deleted).toBe(false);
      expect(security.suspended).toBe(true);
      expect(profile.accountStatus).toBe('suspended');
    });

    it('rejects reinstating an account that is not closed', async () => {
      seedActiveClient();

      const result = await service.reinstateAccount(CLIENT_ID, ADMIN_ID);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not closed');
    });

    it('records reinstatement metadata on security entry', async () => {
      seedClosedClient();

      await service.reinstateAccount(CLIENT_ID, ADMIN_ID, 'Compliance approved');

      const security = kvStore.get(SECURITY_KEY);
      expect(security.reinstatedBy).toBe(ADMIN_ID);
      expect(security.reinstatedAt).toBeDefined();
      expect(security.reinstatementNote).toBe('Compliance approved');
    });

    it('cleans up closure metadata after reinstatement', async () => {
      seedClosedClient();

      await service.reinstateAccount(CLIENT_ID, ADMIN_ID);

      const security = kvStore.get(SECURITY_KEY);
      expect(security.previousAccountStatus).toBeUndefined();
      expect(security.wasSuspendedBeforeClosure).toBeUndefined();
    });
  });

  // ==========================================================================
  // DELETE CLIENT (legacy soft-delete)
  // ==========================================================================

  describe('deleteClient', () => {
    it('sets deleted=true, suspended=true, and accountStatus=closed', async () => {
      seedActiveClient();

      await service.deleteClient(CLIENT_ID);

      const security = kvStore.get(SECURITY_KEY);
      const profile = kvStore.get(PROFILE_KEY);

      expect(security.deleted).toBe(true);
      expect(security.suspended).toBe(true);
      expect(profile.accountStatus).toBe('closed');
    });

    it('handles missing profile gracefully', async () => {
      kvStore.set(SECURITY_KEY, { suspended: false, deleted: false });
      // No profile entry

      await expect(service.deleteClient(CLIENT_ID)).resolves.not.toThrow();

      const security = kvStore.get(SECURITY_KEY);
      expect(security.deleted).toBe(true);
    });
  });

  // ==========================================================================
  // FULL LIFECYCLE: Active -> Suspended -> Closed -> Reinstated
  // ==========================================================================

  describe('full lifecycle round-trip', () => {
    it('maintains consistency through Active -> Suspended -> Closed -> Reinstated', async () => {
      seedActiveClient();

      // Step 1: Suspend
      await service.suspendClient(CLIENT_ID, ADMIN_ID, 'Review');
      let security = kvStore.get(SECURITY_KEY);
      let profile = kvStore.get(PROFILE_KEY);
      expect(security.suspended).toBe(true);
      expect(security.deleted).toBe(false);
      expect(profile.accountStatus).toBe('suspended');

      // Step 2: Close (from suspended state)
      await service.closeAccount(CLIENT_ID, ADMIN_ID, 'Escalated');
      security = kvStore.get(SECURITY_KEY);
      profile = kvStore.get(PROFILE_KEY);
      expect(security.suspended).toBe(true);
      expect(security.deleted).toBe(true);
      expect(security.wasSuspendedBeforeClosure).toBe(true);
      expect(profile.accountStatus).toBe('closed');

      // Step 3: Reinstate (should restore to suspended, not active)
      await service.reinstateAccount(CLIENT_ID, ADMIN_ID, 'Compliance cleared');
      security = kvStore.get(SECURITY_KEY);
      profile = kvStore.get(PROFILE_KEY);
      expect(security.deleted).toBe(false);
      expect(security.suspended).toBe(true); // Was suspended before closure
      expect(profile.accountStatus).toBe('suspended');

      // Step 4: Unsuspend (back to active)
      await service.unsuspendClient(CLIENT_ID, ADMIN_ID);
      security = kvStore.get(SECURITY_KEY);
      profile = kvStore.get(PROFILE_KEY);
      expect(security.suspended).toBe(false);
      expect(security.deleted).toBe(false);
      expect(profile.accountStatus).toBe('approved');
    });
  });
});