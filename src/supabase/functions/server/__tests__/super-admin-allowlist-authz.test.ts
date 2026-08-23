/**
 * Super-admin authorization uses the allowlist — SECURITY-AUDIT A10 guard
 * =======================================================================
 *
 * `SUPER_ADMIN_EMAILS` carries two recovery admins precisely so the platform
 * survives losing access to one account. But the authorization checks still
 * compared against the single deprecated `SUPER_ADMIN_EMAIL` const, so the
 * second recovery admin was refused everywhere that mattered — including, per
 * the audit, by the recovery route itself: it passed `requireSuperAdmin` (which
 * honours the allowlist) and was then denied by a second, narrower check inside
 * the same handler. Two copies of one rule, and the narrower copy won. That is
 * S12's failure mode, in the place designed to rescue the platform.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/super-admin-allowlist-authz.test.ts
 */
import { describe, it, expect } from 'vitest';

import { SUPER_ADMIN_EMAIL, isSuperAdminEmail } from '../constants.ts';
import { PermissionsService } from '../personnel-permissions-service.ts';
import {
  shouldLoadClientManagementProfile,
  shouldIncludeInClientManagement,
} from '../client-management-visibility.ts';

/** The second allowlisted account — the one every check used to refuse. */
const RECOVERY_ADMIN = 'shawn.africantreasures@gmail.com';

describe('the allowlist itself', () => {
  it('admits both recovery admins', () => {
    expect(isSuperAdminEmail(SUPER_ADMIN_EMAIL)).toBe(true);
    expect(isSuperAdminEmail(RECOVERY_ADMIN)).toBe(true);
  });

  it('is case- and whitespace-insensitive, and rejects everyone else', () => {
    expect(isSuperAdminEmail('  SHAWN.AfricanTreasures@GMAIL.com ')).toBe(true);
    expect(isSuperAdminEmail('attacker@example.com')).toBe(false);
    expect(isSuperAdminEmail('')).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
  });
});

describe('permission bypass', () => {
  it('grants the bypass to the recovery admin, not just the primary', () => {
    expect(PermissionsService.isSuperAdmin(SUPER_ADMIN_EMAIL)).toBe(true);
    expect(PermissionsService.isSuperAdmin(RECOVERY_ADMIN)).toBe(true);
  });

  it('still refuses a non-super-admin', () => {
    expect(PermissionsService.isSuperAdmin('adviser@navigatewealth.co')).toBe(false);
  });
});

describe('client-management visibility', () => {
  it('loads the dual personal-client profile for either recovery admin', () => {
    const personnelIds = new Set<string>(['someone-else']);

    expect(
      shouldLoadClientManagementProfile({ id: 'a', email: SUPER_ADMIN_EMAIL }, personnelIds),
    ).toBe(true);
    expect(
      shouldLoadClientManagementProfile({ id: 'b', email: RECOVERY_ADMIN }, personnelIds),
    ).toBe(true);
  });

  it('lets an allowlisted admin appear as a personal client despite being personnel', () => {
    // What this branch actually does is override the personnel exclusion below
    // it: without the branch, a super admin who is also personnel is filtered
    // out of Client Management. So the meaningful pairing is personnel + the
    // per-profile opt-in — the allowlist widened WHO qualifies, and the opt-in
    // still decides WHETHER they show up.
    const user = { id: 'b', email: RECOVERY_ADMIN };
    const base = { user, personnelIds: new Set<string>(['b']), applicationStatus: 'approved' };

    expect(
      shouldIncludeInClientManagement({ ...base, profile: { personalClientEnabled: true } }),
    ).toBe(true);

    expect(
      shouldIncludeInClientManagement({ ...base, profile: { personalClientEnabled: false } }),
    ).toBe(false);
  });
});

describe('login rate-limit exemption stays narrow, deliberately', () => {
  it('documents that the exemption is keyed on the single owner identity', () => {
    // auth-routes.ts intentionally does NOT use isSuperAdminEmail here: that
    // check runs pre-authentication on a body-supplied address and grants
    // exemption from login rate limiting, so widening it would hand unlimited
    // login attempts to more addresses — including anything the
    // SUPER_ADMIN_EMAILS env var happens to contain. This test exists so the
    // asymmetry reads as a decision rather than a missed call site.
    expect(SUPER_ADMIN_EMAIL).toBe('shawn@navigatewealth.co');
    expect(isSuperAdminEmail(RECOVERY_ADMIN)).toBe(true);
  });
});
