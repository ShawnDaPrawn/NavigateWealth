/**
 * The Navigator verification-success page sends people where the live page
 * does (useVerificationRedirect): /login when signed out; for a signed-in
 * person with an incomplete application /account-type or /application; else
 * /dashboard — by the button now, or automatically after five seconds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

type User = { applicationStatus?: string; accountType?: string } | null;
const authState: { isAuthenticated: boolean; user: User } = { isAuthenticated: false, user: null };
vi.mock('../../components/auth/AuthContext', () => ({ useAuth: () => authState }));

const { NavigatorVerificationSuccessPage } =
  await import('../pages/NavigatorVerificationSuccessPage');
const LiveModule = await import('../../components/pages/VerificationSuccessPage');
const LiveVerificationSuccessPage = LiveModule.default;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/verification-success']}>
      <NavigatorVerificationSuccessPage />
    </MemoryRouter>,
  );
}

const hrefs = () => new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? ''));

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = false;
  authState.user = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Navigator verification success', () => {
  it('is what /verification-success serves when the design switch is on', async () => {
    const { VerificationSuccessPage } = await import('../../app/publicPages');
    render(
      <MemoryRouter initialEntries={['/verification-success']}>
        <Suspense fallback={null}>
          <VerificationSuccessPage />
        </Suspense>
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Email Verified Successfully!',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('links to exactly what the live page links to', () => {
    render(
      <MemoryRouter>
        <LiveVerificationSuccessPage />
      </MemoryRouter>,
    );
    const live = hrefs();
    cleanup();
    renderPage();
    expect(hrefs()).toEqual(live);
    expect(hrefs()).toEqual(new Set(['/', '/login', '/contact']));
  });

  it.each([
    [false, null, '/login', 'Continue to Login'],
    [true, { applicationStatus: 'incomplete' }, '/account-type', 'Continue to Application'],
    [
      true,
      { applicationStatus: 'incomplete', accountType: 'individual' },
      '/application',
      'Continue to Application',
    ],
    [true, { applicationStatus: 'approved' }, '/dashboard', 'Continue to Application'],
  ] as const)(
    'signed in %s, user %j → the button goes to %s',
    (isAuthenticated, user, path, label) => {
      authState.isAuthenticated = isAuthenticated;
      authState.user = user;
      renderPage();
      expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(path);
    },
  );

  it('counts down and redirects with replace after five seconds', () => {
    vi.useFakeTimers();
    renderPage();
    expect(screen.getByText('Redirecting automatically in 5 seconds...')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('Redirecting automatically in 1 second...')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
