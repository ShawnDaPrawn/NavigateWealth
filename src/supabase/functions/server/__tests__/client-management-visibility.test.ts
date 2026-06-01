import { describe, expect, it } from 'vitest';

import {
  isPersonnelAuthUser,
  isRejectedClientStatus,
  shouldIncludeInClientManagement,
  shouldLoadClientManagementProfile,
} from '../client-management-visibility.ts';

const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';

describe('client-management visibility rules', () => {
  it('keeps invited client accounts visible when they are not personnel', () => {
    const personnelIds = new Set<string>();
    const user = {
      id: 'client-1',
      user_metadata: {
        firstName: 'Jane',
        invited: true,
        accountStatus: 'invited',
      },
    };

    expect(isPersonnelAuthUser(user, personnelIds)).toBe(false);
    expect(
      shouldIncludeInClientManagement({
        user,
        personnelIds,
        profile: {
          role: 'client',
          accountStatus: 'invited',
        },
        applicationStatus: 'invited',
      }),
    ).toBe(true);
  });

  it('excludes personnel accounts by role or personnel profile id', () => {
    expect(
      isPersonnelAuthUser(
        {
          id: 'staff-1',
          user_metadata: { role: 'admin' },
        },
        new Set(),
      ),
    ).toBe(true);

    expect(
      isPersonnelAuthUser(
        {
          id: 'staff-2',
          user_metadata: {},
        },
        new Set(['staff-2']),
      ),
    ).toBe(true);
  });

  it('includes super admin when personal client testing is enabled', () => {
    const personnelIds = new Set(['super-admin-id']);
    const user = {
      id: 'super-admin-id',
      email: SUPER_ADMIN_EMAIL,
      user_metadata: { role: 'super_admin' },
    };

    expect(
      shouldIncludeInClientManagement({
        user,
        personnelIds,
        profile: {
          role: 'super_admin',
          personalClientEnabled: true,
          accountStatus: 'approved',
        },
        applicationStatus: 'approved',
      }),
    ).toBe(true);
  });

  it('still excludes super admin without personalClientEnabled flag', () => {
    const personnelIds = new Set(['super-admin-id']);
    const user = {
      id: 'super-admin-id',
      email: SUPER_ADMIN_EMAIL,
      user_metadata: { role: 'super_admin' },
    };

    expect(
      shouldIncludeInClientManagement({
        user,
        personnelIds,
        profile: {
          role: 'super_admin',
          accountStatus: 'approved',
        },
        applicationStatus: 'approved',
      }),
    ).toBe(false);
  });

  it('loads super admin profile KV even when marked personnel', () => {
    const personnelIds = new Set(['super-admin-id']);
    const user = {
      id: 'super-admin-id',
      email: SUPER_ADMIN_EMAIL,
      user_metadata: { role: 'super_admin' },
    };

    expect(shouldLoadClientManagementProfile(user, personnelIds)).toBe(true);
    expect(
      shouldLoadClientManagementProfile(
        {
          id: 'staff-1',
          email: 'adviser@test.com',
          user_metadata: { role: 'adviser' },
        },
        personnelIds,
      ),
    ).toBe(false);
  });

  it('treats declined and rejected statuses as ineligible for client management', () => {
    const personnelIds = new Set<string>();
    const user = {
      id: 'client-2',
      user_metadata: {
        accountStatus: 'declined',
      },
    };

    expect(isRejectedClientStatus('declined')).toBe(true);
    expect(isRejectedClientStatus('rejected')).toBe(true);
    expect(
      shouldIncludeInClientManagement({
        user,
        personnelIds,
        profile: {
          role: 'client',
          accountStatus: 'declined',
        },
        applicationStatus: 'declined',
      }),
    ).toBe(false);
  });
});
