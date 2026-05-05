/**
 * Ensures sign-in hydration does not stack a redundant auth.getUser() (getCurrentUserWithMetadata)
 * when the session user is already available — a regression caused long logins and timeouts.
 *
 * @module utils/auth/__tests__/loadUserProfile.sessionHint.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import * as authService from '../authService';
import { loadUserProfile } from '../profileService';

const userId = '237f11af-71d5-4c74-80c1-ff7bd78eb03f';
const email = 'hydration-hint@test.local';

function mockFetchForHappyProfile() {
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/security/')) {
      return new Response(JSON.stringify({ status: { suspended: false } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/profile/personal-info')) {
      return new Response(
        JSON.stringify({
          data: {
            profileType: 'staff',
            userId,
            role: 'super_admin',
            accountStatus: 'approved',
            applicationStatus: 'approved',
            adviserAssigned: true,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
    return new Response('not found', { status: 404 });
  });
}

const sessionHint: SupabaseUser = {
  id: userId,
  email,
  app_metadata: {},
  user_metadata: { role: 'super_admin' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as SupabaseUser;

describe('loadUserProfile session user hint', () => {
  beforeEach(() => {
    mockFetchForHappyProfile();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call getCurrentUserWithMetadata when supabaseUserHint id matches userId', async () => {
    const spy = vi.spyOn(authService, 'getCurrentUserWithMetadata').mockResolvedValue({
      id: userId,
      email,
      emailConfirmed: true,
      createdAt: '',
    });

    await loadUserProfile(userId, email, sessionHint);

    expect(spy).not.toHaveBeenCalled();
  });

  it('calls getCurrentUserWithMetadata when hint is omitted (e.g. refreshUser)', async () => {
    const spy = vi.spyOn(authService, 'getCurrentUserWithMetadata').mockResolvedValue({
      id: userId,
      email,
      role: 'super_admin',
      emailConfirmed: true,
      createdAt: '',
    });

    await loadUserProfile(userId, email);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('calls getCurrentUserWithMetadata when hint user id mismatches userId (stale hint guard)', async () => {
    const spy = vi.spyOn(authService, 'getCurrentUserWithMetadata').mockResolvedValue({
      id: userId,
      email,
      role: 'super_admin',
      emailConfirmed: true,
      createdAt: '',
    });

    const wrongHint = { ...sessionHint, id: 'other-user-id' } as SupabaseUser;
    await loadUserProfile(userId, email, wrongHint);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
