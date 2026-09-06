/**
 * AdminDataPrefetch — behaviour tests.
 *
 * What is worth pinning is the shape of the optimisation, not its plumbing:
 * it must start the dashboard's fetches from the SESSION event (so they run
 * beside profile hydration rather than after it), must not spend the app's
 * heaviest requests on page loads that will not read them, and must never be
 * the thing that decides who is an admin.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '../../../test/utils';

const mockUnsubscribe = vi.fn();
const mockPrefetchDashboardData = vi.fn();
let authCallback: ((authUser: unknown, meta: unknown) => void | Promise<void>) | null = null;

vi.mock('../../../utils/auth', () => ({
  onAuthStateChange: (cb: (authUser: unknown, meta: unknown) => void | Promise<void>) => {
    authCallback = cb;
    return { unsubscribe: mockUnsubscribe };
  },
}));

vi.mock('../../admin/modules/dashboard', () => ({
  prefetchDashboardData: (...args: unknown[]) => mockPrefetchDashboardData(...args),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AdminDataPrefetch } from '../AdminDataPrefetch';

const ADMIN_SESSION_USER = { id: 'u-1', user_metadata: { role: 'admin' }, app_metadata: {} };
const CLIENT_SESSION_USER = { id: 'u-2', user_metadata: { role: 'client' }, app_metadata: {} };
const AUTH_USER = { id: 'u-1', email: 'admin@navigatewealth.co' };

function setLocation(url: string) {
  const { pathname, search } = new URL(url, 'https://app.test');
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, search },
    writable: true,
    configurable: true,
  });
}

function renderPrefetch() {
  const queryClient = makeTestQueryClient();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AdminDataPrefetch />
    </QueryClientProvider>,
  );
  return { queryClient, ...result };
}

const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  authCallback = null;
  mockPrefetchDashboardData.mockResolvedValue(undefined);
  setLocation('/admin');
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe('AdminDataPrefetch', () => {
  it('prefetches for an admin session as soon as the auth event arrives', async () => {
    const { queryClient } = renderPrefetch();
    await authCallback?.(AUTH_USER, { event: 'INITIAL_SESSION', supabaseUser: ADMIN_SESSION_USER });
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
    expect(mockPrefetchDashboardData).toHaveBeenCalledWith(queryClient);
  });

  it('prefetches for a super admin too', async () => {
    renderPrefetch();
    await authCallback?.(AUTH_USER, {
      event: 'SIGNED_IN',
      supabaseUser: { ...ADMIN_SESSION_USER, user_metadata: { role: 'super_admin' } },
    });
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
  });

  it('does not prefetch for a client session', async () => {
    renderPrefetch();
    await authCallback?.(AUTH_USER, {
      event: 'INITIAL_SESSION',
      supabaseUser: CLIENT_SESSION_USER,
    });
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
  });

  it('does not prefetch when there is no session', async () => {
    renderPrefetch();
    await authCallback?.(null, { event: 'SIGNED_OUT' });
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
  });

  it('prefetches only once even if the session pipeline emits repeatedly', async () => {
    renderPrefetch();
    const meta = { event: 'INITIAL_SESSION', supabaseUser: ADMIN_SESSION_USER };
    await authCallback?.(AUTH_USER, meta);
    await authCallback?.(AUTH_USER, { ...meta, event: 'SIGNED_IN' });
    await authCallback?.(AUTH_USER, { ...meta, event: 'TOKEN_REFRESHED' });
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
  });

  it('does not subscribe at all outside the admin route', () => {
    setLocation('/dashboard');
    renderPrefetch();
    expect(authCallback).toBeNull();
  });

  it('does not spend the requests when another admin module is deep-linked', () => {
    setLocation('/admin?module=clients');
    renderPrefetch();
    expect(authCallback).toBeNull();
  });

  it('still prefetches when the dashboard module is named explicitly', async () => {
    setLocation('/admin?module=dashboard');
    renderPrefetch();
    await authCallback?.(AUTH_USER, { event: 'INITIAL_SESSION', supabaseUser: ADMIN_SESSION_USER });
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
  });

  it('swallows a failed prefetch — the real queries still own error reporting', async () => {
    mockPrefetchDashboardData.mockRejectedValue(new Error('offline'));
    renderPrefetch();
    await expect(
      authCallback?.(AUTH_USER, { event: 'INITIAL_SESSION', supabaseUser: ADMIN_SESSION_USER }),
    ).resolves.not.toThrow();
  });

  it('unsubscribes from the auth pipeline on unmount', () => {
    const { unmount } = renderPrefetch();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it('renders nothing', () => {
    const { container } = renderPrefetch();
    expect(container.innerHTML).toBe('');
  });
});
