import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApplicationStatusGuard } from '../ApplicationStatusGuard';
import { SUPER_ADMIN_EMAIL } from '../../../utils/auth/constants';

const mockUser = {
  id: 'super-admin-id',
  email: SUPER_ADMIN_EMAIL,
  firstName: 'Shawn',
  lastName: 'Francisco',
  role: 'super_admin',
  accountStatus: 'approved',
};

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

// The guard resolves the session JWT via the central API client
// (SECURITY-AUDIT C-8) — stub it so no real Supabase client is constructed.
vi.mock('../../../utils/api/client', () => ({
  api: {
    getAccessToken: vi.fn().mockResolvedValue('test-session-token'),
  },
}));

describe('ApplicationStatusGuard', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/profile/personal-info')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                personalClientEnabled: true,
                accountStatus: 'approved',
              },
            }),
            { status: 200 },
          );
        }

        if (url.includes('/applications/')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { status: 'approved' },
            }),
            { status: 200 },
          );
        }

        if (url.includes('/integrations/policies')) {
          return new Response(JSON.stringify({ policies: [] }), { status: 200 });
        }

        return new Response('Not found', { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('allows super admin personal client view when personalClientEnabled is true', async () => {
    render(
      <ApplicationStatusGuard requireApproved>
        <div>Dashboard content</div>
      </ApplicationStatusGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard content')).toBeTruthy();
    });
  });

  it('blocks super admin when personal client profile is not enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/profile/personal-info')) {
          return new Response(JSON.stringify({ success: true, data: { role: 'super_admin' } }), {
            status: 200,
          });
        }

        if (url.includes('/applications/')) {
          return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
        }

        return new Response('Not found', { status: 404 });
      }),
    );

    render(
      <ApplicationStatusGuard requireApproved>
        <div>Dashboard content</div>
      </ApplicationStatusGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText('Personal Client Profile Not Enabled')).toBeTruthy();
    });
    expect(screen.queryByText('Dashboard content')).toBeNull();
  });
});
