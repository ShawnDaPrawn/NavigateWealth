/**
 * LoginPage — a two-factor sign-in is not installed until its code passes.
 * ======================================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The server records 2FA per sign-in (per GoTrue `session_id`) and refuses
 * every ordinary API call from a session that has not passed its factor. The
 * login page used to install the session as soon as the password checked out.
 * That fires `onAuthStateChange`; AuthContext hydrates the profile with the
 * session, the server refuses it with `TWO_FACTOR_REQUIRED`, and AuthContext
 * answers that by signing out — revoking the session while the page is still
 * using it to verify the code. Every 2FA sign-in would fail.
 *
 * So the page checks the password (`authenticateWithPassword`), runs the
 * account checks and the challenge with the tokens it holds, and calls
 * `installSession` only once nothing is left to pass. These tests pin that
 * order, and that a sign-in which will never be installed is revoked rather
 * than left live.
 *
 * Run: npx vitest run src/components/pages/__tests__/LoginPage.twoFactor.test.tsx
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const PENDING = { userId: 'u-1', accessToken: 'access-1', refreshToken: 'refresh-1' };

const authenticateWithPassword = vi.fn();
const installSession = vi.fn();
const discardPendingSession = vi.fn();

vi.mock('../../../utils/auth/authService', () => ({
  authenticateWithPassword: (...a: unknown[]) => authenticateWithPassword(...a),
  installSession: (...a: unknown[]) => installSession(...a),
  discardPendingSession: (...a: unknown[]) => discardPendingSession(...a),
  resendVerificationEmail: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock('../../auth/RouteGuards', () => ({ getAuthenticatedRedirectPath: () => '/dashboard' }));

// The real modal owns its own code-entry UI; this stand-in exposes the two
// outcomes the page has to handle.
vi.mock('../../auth/TwoFactorModal', () => ({
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

vi.mock('../../../hooks/useIsStandalone', () => ({ useIsStandalone: () => false }));
vi.mock('../auth/AuthBrandPanel', () => ({ AuthBrandPanel: () => null }));
vi.mock('../auth/AuthPaperBackground', () => ({ AuthPaperBackground: () => null }));
vi.mock('../auth/AuthTrustBar', () => ({ AuthTrustBar: () => null }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ state: null }),
    Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

import { LoginPage } from '../LoginPage';

type Status = {
  twoFactorEnabled?: boolean;
  sessionTwoFactorVerified?: boolean;
  suspended?: boolean;
  deleted?: boolean;
};

/** Route the page's three server calls; record what each one was sent. */
function serverResponding(status: Status | 'error', { verifyOk = true } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/status')) {
      if (status === 'error') return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => ({ success: true, status }) };
    }
    if (url.endsWith('/2fa/send-code')) {
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url.endsWith('/2fa/verify-code')) {
      return verifyOk
        ? { ok: true, json: async () => ({ success: true }) }
        : { ok: false, json: async () => ({ success: false, error: 'Invalid code' }) };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof serverResponding>, suffix: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix)) as unknown as Array<
    [string, RequestInit]
  >;

async function submitCredentials() {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'owner@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: 'correct horse battery' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticateWithPassword.mockResolvedValue(PENDING);
  installSession.mockResolvedValue({ user: { id: PENDING.userId }, session: {} });
  discardPendingSession.mockResolvedValue(undefined);
  sessionStorage.clear();
});

describe('LoginPage — two-factor sign-in', () => {
  it('does not install the session while the challenge is open', async () => {
    const fetchMock = serverResponding({ twoFactorEnabled: true });
    render(<LoginPage />);
    await submitCredentials();

    await screen.findByRole('button', { name: /submit code/i });
    // The regression this file exists for: installing here lets AuthContext
    // hydrate with an unverified session and sign it out mid-challenge.
    expect(installSession).not.toHaveBeenCalled();

    // The challenge runs on the tokens the page holds.
    const [sendCode] = callsTo(fetchMock, '/2fa/send-code');
    expect(sendCode[0]).toContain(`/security/${PENDING.userId}/2fa/send-code`);
    expect(new Headers(sendCode[1].headers).get('Authorization')).toBe(
      `Bearer ${PENDING.accessToken}`,
    );
  });

  it('verifies with the held session, then installs exactly that session', async () => {
    const fetchMock = serverResponding({ twoFactorEnabled: true });
    render(<LoginPage />);
    await submitCredentials();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /submit code/i }));
    });

    const [verify] = callsTo(fetchMock, '/2fa/verify-code');
    expect(new Headers(verify[1].headers).get('Authorization')).toBe(
      `Bearer ${PENDING.accessToken}`,
    );
    await waitFor(() => expect(installSession).toHaveBeenCalledWith(PENDING));
    expect(discardPendingSession).not.toHaveBeenCalled();
  });

  it('a wrong code installs nothing', async () => {
    serverResponding({ twoFactorEnabled: true }, { verifyOk: false });
    render(<LoginPage />);
    await submitCredentials();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /submit code/i }));
    });

    expect(installSession).not.toHaveBeenCalled();
  });

  it('cancelling the challenge revokes the held sign-in and installs nothing', async () => {
    serverResponding({ twoFactorEnabled: true });
    render(<LoginPage />);
    await submitCredentials();

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /cancel challenge/i }));
    });

    expect(discardPendingSession).toHaveBeenCalledWith(PENDING);
    expect(installSession).not.toHaveBeenCalled();
    expect(screen.getByText(/two-factor authentication is required/i)).toBeDefined();
  });
});

describe('LoginPage — sign-ins with nothing left to pass', () => {
  it('installs the session straight away when 2FA is off', async () => {
    const fetchMock = serverResponding({ twoFactorEnabled: false });
    render(<LoginPage />);
    await submitCredentials();

    await waitFor(() => expect(installSession).toHaveBeenCalledWith(PENDING));
    expect(callsTo(fetchMock, '/2fa/send-code')).toHaveLength(0);
    expect(sessionStorage.getItem('nw_show_2fa_prompt')).toBe('true');
  });
});

describe('LoginPage — sign-ins that must never be installed', () => {
  it.each([
    ['suspended', { suspended: true }, /has been suspended/i],
    ['closed', { deleted: true }, /has been closed/i],
  ] as const)('a %s account is revoked, not installed', async (_label, status, message) => {
    serverResponding(status);
    render(<LoginPage />);
    await submitCredentials();

    await screen.findByText(message);
    expect(discardPendingSession).toHaveBeenCalledWith(PENDING);
    expect(installSession).not.toHaveBeenCalled();
  });

  it('an unreadable security status fails closed: revoked, not installed', async () => {
    serverResponding('error');
    render(<LoginPage />);
    await submitCredentials();

    await screen.findByText(/unexpected error/i);
    expect(discardPendingSession).toHaveBeenCalledWith(PENDING);
    expect(installSession).not.toHaveBeenCalled();
  });
});
