/**
 * The Navigator login page must sign people in exactly as the live page does.
 *
 * Both pages run useLoginFlow, so these tests drive the Navigator markup
 * through the same server conversation the live suite pins
 * (src/components/pages/__tests__/LoginPage.twoFactor.test.tsx): the password
 * is checked without installing the session, a two-factor sign-in is held
 * until its code passes, closed / suspended accounts and an unreadable
 * security status are revoked, never installed. On top of that: the search-led
 * H1, the same link targets as the live page, field-level validation with
 * focus, the lockout copy and the password field's autocomplete/toggle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
}));

const PENDING = { userId: 'u-1', accessToken: 'access-1', refreshToken: 'refresh-1' };
const authenticateWithPassword = vi.fn();
const installSession = vi.fn();
const discardPendingSession = vi.fn();
const resendVerificationEmail = vi.fn();

vi.mock('../../utils/auth/authService', () => ({
  authenticateWithPassword: (...a: unknown[]) => authenticateWithPassword(...a),
  installSession: (...a: unknown[]) => installSession(...a),
  discardPendingSession: (...a: unknown[]) => discardPendingSession(...a),
  resendVerificationEmail: (...a: unknown[]) => resendVerificationEmail(...a),
}));

const authState = { isAuthenticated: false, user: null as null | { id: string } };
vi.mock('../../components/auth/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../components/auth/RouteGuards', () => ({
  getAuthenticatedRedirectPath: () => '/dashboard',
}));

// The real modal owns its code-entry UI; this stand-in exposes the outcomes.
vi.mock('../../components/auth/TwoFactorModal', () => ({
  TwoFactorModal: ({
    verifyCode,
    onVerified,
    onCancel,
  }: {
    verifyCode: (code: string) => Promise<{ success: boolean }>;
    onVerified: () => void;
    onCancel: () => void;
  }) => (
    <div>
      <button
        onClick={async () => {
          const result = await verifyCode('123456');
          if (result.success) onVerified();
        }}
      >
        submit code
      </button>
      <button onClick={onCancel}>cancel challenge</button>
    </div>
  ),
}));

const standalone = { value: false };
vi.mock('../../hooks/useIsStandalone', () => ({ useIsStandalone: () => standalone.value }));

const { AuthError } = await import('../../utils/auth/errorHandler');
const { NavigatorLoginPage } = await import('../pages/NavigatorLoginPage');

type Status = {
  twoFactorEnabled?: boolean;
  sessionTwoFactorVerified?: boolean;
  suspended?: boolean;
  deleted?: boolean;
};

function serverResponding(status: Status | 'error', { verifyOk = true } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/status')) {
      if (status === 'error') return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => ({ success: true, status }) };
    }
    if (url.endsWith('/2fa/send-code')) return { ok: true, json: async () => ({ success: true }) };
    if (url.endsWith('/2fa/verify-code')) {
      return verifyOk
        ? { ok: true, json: async () => ({ success: true }) }
        : { ok: false, json: async () => ({ success: false, error: 'Invalid code' }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof serverResponding>, suffix: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix)) as unknown as Array<
    [string, RequestInit]
  >;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <NavigatorLoginPage />
    </MemoryRouter>,
  );
}

async function submitCredentials(email = 'owner@example.com', password = 'correct horse battery') {
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  });
}

const hrefs = () => new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? ''));

beforeEach(() => {
  vi.clearAllMocks();
  authenticateWithPassword.mockResolvedValue(PENDING);
  installSession.mockResolvedValue({ user: { id: PENDING.userId }, session: {} });
  discardPendingSession.mockResolvedValue(undefined);
  sessionStorage.clear();
  standalone.value = false;
  authState.isAuthenticated = false;
  authState.user = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Navigator login — page', () => {
  it('is what /login serves when the design switch is on, with one search-led H1', async () => {
    const { LoginPage } = await import('../../app/publicPages');
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Suspense fallback={null}>
          <LoginPage />
        </Suspense>
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Log in to Navigate Wealth');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelector('.nw-site.nwx-account.nwx-login')).not.toBeNull();
  });

  it('links to the same places as the live page', async () => {
    renderPage();
    const navigator = hrefs();
    cleanup();
    const { LoginPage } = await import('../../components/pages/LoginPage');
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(navigator).toEqual(hrefs());
    expect(navigator).toEqual(new Set(['/forgot-password', '/signup']));
  });

  it('password field: current-password autocomplete, a labelled show/hide toggle, paste allowed', () => {
    renderPage();
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
    expect(input.getAttribute('onpaste')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });

  it('an invalid address is flagged on its field, focused, and nothing is sent', async () => {
    renderPage();
    await submitCredentials('not-an-email');
    const email = screen.getByLabelText('Email Address');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    const describedBy = email.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(describedBy)?.textContent).toBe(
      'Please enter a valid email address',
    );
    expect(document.activeElement).toBe(email);
    expect(authenticateWithPassword).not.toHaveBeenCalled();
  });

  it('a short password is flagged on the password field', async () => {
    renderPage();
    await submitCredentials('owner@example.com', 'short');
    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(password);
    expect(authenticateWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    [
      'rate_limited',
      'Too many login attempts. Navigate Wealth has temporarily blocked further attempts for security reasons. Please wait 5-10 minutes before trying again.',
    ],
    ['invalid_credentials', 'You entered the incorrect username or password.'],
  ])('shows the live %s message as a form alert', async (code, message) => {
    authenticateWithPassword.mockRejectedValue(new AuthError('x', code));
    renderPage();
    await submitCredentials();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(message);
    expect(installSession).not.toHaveBeenCalled();
  });

  it('offers the verification resend for an unverified address and sends it', async () => {
    authenticateWithPassword.mockRejectedValue(new AuthError('x', 'email_not_verified'));
    resendVerificationEmail.mockResolvedValue(undefined);
    renderPage();
    await submitCredentials();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Resend verification email' }));
    });
    expect(resendVerificationEmail).toHaveBeenCalledWith('owner@example.com');
    expect(
      await screen.findByText('Verification email sent! Please check your inbox.'),
    ).toBeTruthy();
  });

  it('in the installed app: the Sign In / Sign Up switch, no "Get started" line', () => {
    standalone.value = true;
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Sign in or sign up' });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Sign In');
    expect(screen.queryByText(/new to navigate wealth/i)).toBeNull();
  });

  it('shows the transition loader, not the form, once signed in', () => {
    authState.isAuthenticated = true;
    authState.user = { id: 'u-1' };
    renderPage();
    expect(screen.queryByLabelText('Email Address')).toBeNull();
    expect(screen.getByText('Plotting your course')).toBeTruthy();
  });
});

describe('Navigator login — two-factor sign-in', () => {
  it('does not install the session while the challenge is open', async () => {
    const fetchMock = serverResponding({ twoFactorEnabled: true });
    renderPage();
    await submitCredentials();

    await screen.findByRole('button', { name: /submit code/i });
    expect(installSession).not.toHaveBeenCalled();
    expect(authenticateWithPassword).toHaveBeenCalledWith(
      'owner@example.com',
      'correct horse battery',
    );
    const [status] = callsTo(fetchMock, '/status');
    expect(status[0]).toBe(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/security/u-1/status',
    );
    const [sendCode] = callsTo(fetchMock, '/2fa/send-code');
    expect(new Headers(sendCode[1].headers).get('Authorization')).toBe('Bearer access-1');
  });

  it('verifies with the held session, then installs exactly that session', async () => {
    const fetchMock = serverResponding({ twoFactorEnabled: true });
    renderPage();
    await submitCredentials();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /submit code/i }));
    });
    const [verify] = callsTo(fetchMock, '/2fa/verify-code');
    expect(new Headers(verify[1].headers).get('Authorization')).toBe('Bearer access-1');
    expect(verify[1].body).toBe(JSON.stringify({ code: '123456' }));
    await waitFor(() => expect(installSession).toHaveBeenCalledWith(PENDING));
    expect(discardPendingSession).not.toHaveBeenCalled();
  });

  it('a wrong code installs nothing', async () => {
    serverResponding({ twoFactorEnabled: true }, { verifyOk: false });
    renderPage();
    await submitCredentials();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /submit code/i }));
    });
    expect(installSession).not.toHaveBeenCalled();
  });

  it('cancelling the challenge revokes the held sign-in and installs nothing', async () => {
    serverResponding({ twoFactorEnabled: true });
    renderPage();
    await submitCredentials();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /cancel challenge/i }));
    });
    expect(discardPendingSession).toHaveBeenCalledWith(PENDING);
    expect(installSession).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(
      'Two-factor authentication is required',
    );
  });

  it('installs straight away when 2FA is off, and flags the dashboard prompt', async () => {
    const fetchMock = serverResponding({ twoFactorEnabled: false });
    renderPage();
    await submitCredentials();
    await waitFor(() => expect(installSession).toHaveBeenCalledWith(PENDING));
    expect(callsTo(fetchMock, '/2fa/send-code')).toHaveLength(0);
    expect(sessionStorage.getItem('nw_show_2fa_prompt')).toBe('true');
  });

  it.each([
    ['suspended', { suspended: true }, /has been suspended/i],
    ['closed', { deleted: true }, /has been closed/i],
  ] as const)('a %s account is revoked, not installed', async (_label, status, message) => {
    serverResponding(status);
    renderPage();
    await submitCredentials();
    expect((await screen.findByRole('alert')).textContent).toMatch(message);
    expect(discardPendingSession).toHaveBeenCalledWith(PENDING);
    expect(installSession).not.toHaveBeenCalled();
  });

  it('an unreadable security status fails closed: revoked, not installed', async () => {
    serverResponding('error');
    renderPage();
    await submitCredentials();
    expect((await screen.findByRole('alert')).textContent).toMatch(/unexpected error/i);
    expect(discardPendingSession).toHaveBeenCalledWith(PENDING);
    expect(installSession).not.toHaveBeenCalled();
  });
});
