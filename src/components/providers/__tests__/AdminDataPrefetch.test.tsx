/**
 * AdminDataPrefetch — behaviour tests.
 *
 * What is worth pinning is the shape of the optimisation, not its plumbing:
 * it must start the dashboard's fetches from the SESSION event (so they run
 * beside profile hydration rather than after it), must not spend the app's
 * heaviest requests on page loads that will not read them, and must never be
 * the thing that decides who is an admin.
 *
 * The two auth-lock rules in the component header get their own describe block
 * at the bottom, because breaking either one is silent in every other test:
 * the deadlock version returned exactly the same data, just never.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '../../../test/utils';

const mockUnsubscribe = vi.fn();
const mockPrefetchDashboardData = vi.fn();
const mockPreloadAdminModule = vi.fn();
let authCallback: ((authUser: unknown, meta: unknown) => unknown) | null = null;

vi.mock('../../../utils/auth', () => ({
  onAuthStateChange: (cb: (authUser: unknown, meta: unknown) => unknown) => {
    authCallback = cb;
    return { unsubscribe: mockUnsubscribe };
  },
}));

vi.mock('../../admin/modules/dashboard', () => ({
  prefetchDashboardData: (...args: unknown[]) => mockPrefetchDashboardData(...args),
}));

vi.mock('../../admin/moduleLoaders', () => ({
  preloadAdminModule: (...args: unknown[]) => mockPreloadAdminModule(...args),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { AdminDataPrefetch } from '../AdminDataPrefetch';

const ADMIN_SESSION_USER = { id: 'u-1', user_metadata: { role: 'admin' }, app_metadata: {} };
const CLIENT_SESSION_USER = { id: 'u-2', user_metadata: { role: 'client' }, app_metadata: {} };
const AUTH_USER = { id: 'u-1', email: 'admin@navigatewealth.co' };
const ACCESS_TOKEN = 'session-access-token';

/** The shape `onAuthStateChange` delivers for a signed-in admin. */
function adminEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'INITIAL_SESSION',
    supabaseUser: ADMIN_SESSION_USER,
    accessToken: ACCESS_TOKEN,
    ...overrides,
  };
}

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
  vi.useRealTimers();
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe('AdminDataPrefetch', () => {
  it('prefetches for an admin session as soon as the auth event arrives', async () => {
    const { queryClient } = renderPrefetch();
    authCallback?.(AUTH_USER, adminEvent());
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
    expect(mockPrefetchDashboardData).toHaveBeenCalledWith(queryClient, ACCESS_TOKEN);
  });

  it('prefetches for a super admin too', async () => {
    renderPrefetch();
    authCallback?.(
      AUTH_USER,
      adminEvent({
        event: 'SIGNED_IN',
        supabaseUser: { ...ADMIN_SESSION_USER, user_metadata: { role: 'super_admin' } },
      }),
    );
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
  });

  it('does not prefetch for a client session', async () => {
    renderPrefetch();
    authCallback?.(AUTH_USER, adminEvent({ supabaseUser: CLIENT_SESSION_USER }));
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
  });

  it('does not prefetch when there is no session', async () => {
    renderPrefetch();
    authCallback?.(null, { event: 'SIGNED_OUT' });
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
  });

  it('prefetches only once even if the session pipeline emits repeatedly', async () => {
    renderPrefetch();
    authCallback?.(AUTH_USER, adminEvent());
    authCallback?.(AUTH_USER, adminEvent({ event: 'SIGNED_IN' }));
    authCallback?.(AUTH_USER, adminEvent({ event: 'TOKEN_REFRESHED' }));
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
  });

  it('does not subscribe at all outside the admin route', () => {
    setLocation('/dashboard');
    renderPrefetch();
    expect(authCallback).toBeNull();
  });

  it('does not spend the dashboard requests when another module is deep-linked', () => {
    setLocation('/admin?module=clients');
    renderPrefetch();
    // No auth subscription at all: the dashboard's data is not wanted here.
    expect(authCallback).toBeNull();
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
  });

  it('still prefetches when the dashboard module is named explicitly', async () => {
    setLocation('/admin?module=dashboard');
    renderPrefetch();
    authCallback?.(AUTH_USER, adminEvent());
    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
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

// ── The auth-lock rules ───────────────────────────────────────────────────────
//
// auth-js holds its storage-key lock for the whole of every onAuthStateChange
// subscriber callback. Breaking either rule below produces no wrong data — it
// hangs the sign-in it was meant to speed up, which no other test would notice.

describe('AdminDataPrefetch — never blocks the auth callback', () => {
  it('returns synchronously, without awaiting the prefetch', () => {
    // The deadlock version awaited here: getSession() inside the prefetch
    // re-enters the held lock and queues behind the emit that is awaiting this
    // very callback. A callback that returns nothing awaitable cannot close
    // that cycle.
    //
    // Fake timers so the deferred prefetch this schedules is discarded with
    // them rather than firing into the next test.
    vi.useFakeTimers();
    renderPrefetch();

    const returned = authCallback?.(AUTH_USER, adminEvent());

    expect(returned).toBeUndefined();
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
    vi.clearAllTimers();
  });

  it('runs the prefetch on a later task than the auth callback', () => {
    vi.useFakeTimers();
    renderPrefetch();

    authCallback?.(AUTH_USER, adminEvent());
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();

    vi.runAllTimers();
    vi.useRealTimers();

    return waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
  });

  it('hands the prefetch the event access token, so it makes no auth call', async () => {
    // Asking for the session instead would queue behind AuthContext's
    // hydration — the exact work this is supposed to overlap with.
    renderPrefetch();
    authCallback?.(AUTH_USER, adminEvent());

    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
    expect(mockPrefetchDashboardData.mock.calls[0][1]).toBe(ACCESS_TOKEN);
  });

  it('skips the prefetch when the event carries no token rather than fetching one', async () => {
    renderPrefetch();
    authCallback?.(AUTH_USER, adminEvent({ accessToken: undefined }));

    await Promise.resolve();
    expect(mockPrefetchDashboardData).not.toHaveBeenCalled();
  });

  it('swallows a failed prefetch — the real queries still own error reporting', async () => {
    mockPrefetchDashboardData.mockRejectedValue(new Error('offline'));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    renderPrefetch();
    expect(() => authCallback?.(AUTH_USER, adminEvent())).not.toThrow();

    await waitFor(() => expect(mockPrefetchDashboardData).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });
});

// ── Chunk warming ────────────────────────────────────────────────────────────
//
// Data and chunk are different bets. Requesting `/admin/stats` for a page that
// renders Client Management is waste; downloading the chunk that page is about
// to render is not, and nothing about that download depends on auth.

describe('AdminDataPrefetch — module chunk warming', () => {
  it('warms the dashboard chunk on a bare /admin', () => {
    renderPrefetch();
    expect(mockPreloadAdminModule).toHaveBeenCalledWith('dashboard');
  });

  it('warms the deep-linked module’s chunk instead of bailing', () => {
    setLocation('/admin?module=clients');
    renderPrefetch();
    expect(mockPreloadAdminModule).toHaveBeenCalledWith('clients');
  });

  it('warms nothing outside the admin route', () => {
    setLocation('/dashboard');
    renderPrefetch();
    expect(mockPreloadAdminModule).not.toHaveBeenCalled();
  });

  it('does not wait for a session before warming', () => {
    // The chunk is needed whoever is signing in, so this must not sit behind
    // the auth event the way the data prefetch does.
    setLocation('/admin?module=reporting');
    renderPrefetch();
    expect(mockPreloadAdminModule).toHaveBeenCalledWith('reporting');
    expect(authCallback).toBeNull();
  });
});
