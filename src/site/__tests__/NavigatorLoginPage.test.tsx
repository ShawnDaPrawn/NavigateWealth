/**
 * The redesigned log-in page, reached the way production reaches it:
 * LoginPage with the design switch on lazy-loads NavigatorLoginPage.
 *
 * Sign-in is safety-critical, so most of this file runs each scenario twice,
 * once through the legacy page and once through the Navigator page, records
 * every call each one makes (authService, then the edge function's security
 * routes, in order, with their arguments and headers) and requires the two
 * records to be identical, as well as equal to what LoginPage's flow is known
 * to send. That covers success, the two-factor challenge (verify, resend,
 * cancel, a suspension mid-challenge), the closed and suspended accounts, an
 * unreadable security status, every AuthError code the live page words, the
 * resend-verification hand-off, the pre-submit checks and the redirect after
 * sign-in, `returnUrl` included.
 *
 * Then what the redesign adds: one H1 with the board's words, real links, the
 * refused field marked invalid and focused, statuses in a polite region.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

type Design = 'legacy' | 'navigator';
const state = vi.hoisted(() => ({
  design: 'navigator' as 'legacy' | 'navigator',
  standalone: false,
  auth: { isAuthenticated: false, user: null as null | { id: string } },
  calls: [] as unknown[][],
}));

vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return state.design;
  },
  resolveSiteDesign: () => state.design,
}));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const authService = vi.hoisted(() => ({
  authenticateWithPassword: vi.fn(),
  installSession: vi.fn(),
  discardPendingSession: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));
vi.mock('../../utils/auth/authService', () => {
  const recorded =
    (name: keyof typeof authService) =>
    (...args: unknown[]) => {
      state.calls.push([name, ...args]);
      return authService[name](...args);
    };
  return {
    authenticateWithPassword: recorded('authenticateWithPassword'),
    installSession: recorded('installSession'),
    discardPendingSession: recorded('discardPendingSession'),
    resendVerificationEmail: recorded('resendVerificationEmail'),
  };
});

vi.mock('../../components/auth/AuthContext', () => ({ useAuth: () => state.auth }));
const getAuthenticatedRedirectPath = vi.hoisted(() => vi.fn(() => '/dashboard'));
vi.mock('../../components/auth/RouteGuards', () => ({ getAuthenticatedRedirectPath }));
vi.mock('../../hooks/useIsStandalone', () => ({ useIsStandalone: () => state.standalone }));

// The real challenge owns its own code-entry UI, the same in both designs; this
// stand-in exposes what the page hands it.
vi.mock('../../components/auth/TwoFactorModal', () => ({
  TwoFactorModal: ({
    email,
    verifyCode,
    resendCode,
    onVerified,
    onCancel,
  }: {
    email: string;
    verifyCode: (code: string) => Promise<{ success: boolean }>;
    resendCode: () => Promise<{ success: boolean }>;
    onVerified: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="two-factor" data-email={email}>
      <button
        onClick={async () => {
          const result = await verifyCode('123456');
          if (result.success) onVerified();
        }}
      >
        submit code
      </button>
      <button onClick={() => void resendCode()}>resend code</button>
      <button onClick={onCancel}>cancel challenge</button>
    </div>
  ),
}));

const { LoginPage } = await import('../../components/pages/LoginPage');
const { AuthError } = await import('../../utils/auth/errorHandler');
const { LOGIN_BRAND_FEATURES } = await import('../../components/pages/auth/authConstants');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');

const FN = 'https://proj.supabase.co/functions/v1/make-server-91ed8379';
const PENDING = { userId: 'u-1', accessToken: 'access-1', refreshToken: 'refresh-1' };
const EMAIL = 'owner@example.com';
const PASSWORD = 'correct horse battery';

type Status = {
  twoFactorEnabled?: boolean;
  sessionTwoFactorVerified?: boolean;
  suspended?: boolean;
  deleted?: boolean;
};
interface Server {
  status?: Status | 'error';
  verify?: 'ok' | 'wrong' | 'suspended';
}

/** The edge function's security routes; every request is recorded, in order. */
function serve({ status = {}, verify = 'ok' }: Server = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      state.calls.push([
        'fetch',
        url,
        init.method ?? 'GET',
        Object.fromEntries(new Headers(init.headers).entries()),
        init.body ?? null,
      ]);
      if (url.endsWith('/status')) {
        if (status === 'error') return { ok: false, json: async () => ({}) };
        return { ok: true, json: async () => ({ success: true, status }) };
      }
      if (url.endsWith('/2fa/send-code'))
        return { ok: true, json: async () => ({ success: true }) };
      if (url.endsWith('/2fa/verify-code')) {
        if (verify === 'ok') return { ok: true, json: async () => ({ success: true }) };
        if (verify === 'suspended') {
          return {
            ok: false,
            json: async () => ({ success: false, suspended: true, error: 'Too many attempts.' }),
          };
        }
        return { ok: false, json: async () => ({ success: false, error: 'Invalid code' }) };
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

async function renderLogin(
  design: Design,
  entry: string | { pathname: string; state: unknown } = '/login',
) {
  state.design = design;
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LoginPage />
    </MemoryRouter>,
  );
  return screen.findByRole('button', { name: /log in/i });
}

async function submit(email = EMAIL, password = PASSWORD) {
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
  });
}

async function click(name: RegExp) {
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name }));
  });
}

const STATUS_TEXTS = ['Verification email sent! Please check your inbox.'];

/**
 * What the visitor is left looking at: the error, the challenge, the 2FA
 * prompt flag. The legacy page's ui/Alert is role="alert" even for its "sent"
 * status (the Navigator page puts that in a polite region), so statuses are
 * left out of the error.
 */
function outcome() {
  const errors = screen
    .queryAllByRole('alert')
    .map((el) => el.textContent?.trim() ?? '')
    .filter((text) => !STATUS_TEXTS.includes(text));
  return {
    alert: errors.length ? errors.join(' | ') : null,
    challenge: screen.queryByTestId('two-factor')?.dataset.email ?? null,
    prompt: sessionStorage.getItem('nw_show_2fa_prompt'),
  };
}

/**
 * Runs one scenario through a design and returns everything it called, in
 * order, and what it left on screen.
 */
async function run(design: Design, scenario: () => Promise<void>, server: Server = {}) {
  cleanup();
  state.calls = [];
  sessionStorage.clear();
  serve(server);
  await renderLogin(design);
  // Each half of the comparison really is its own design.
  expect(document.querySelector('.nwli') !== null).toBe(design === 'navigator');
  await scenario();
  await act(async () => {});
  return { calls: state.calls, ...outcome() };
}

/** The same scenario through both designs; they must not differ in anything. */
async function both(scenario: () => Promise<void>, server: Server = {}) {
  const legacy = await run('legacy', scenario, server);
  const navigator = await run('navigator', scenario, server);
  expect(navigator).toEqual(legacy);
  return navigator;
}

const signIn = () => submit();

// What LoginPage's flow sends, step by step.
const AUTHENTICATE = ['authenticateWithPassword', EMAIL, PASSWORD];
const STATUS = [
  'fetch',
  `${FN}/security/u-1/status`,
  'GET',
  { authorization: 'Bearer access-1' },
  null,
];
const SEND_CODE = [
  'fetch',
  `${FN}/security/u-1/2fa/send-code`,
  'POST',
  { authorization: 'Bearer access-1', 'content-type': 'application/json' },
  '{}',
];
const VERIFY_CODE = [
  'fetch',
  `${FN}/security/u-1/2fa/verify-code`,
  'POST',
  { authorization: 'Bearer access-1', 'content-type': 'application/json' },
  JSON.stringify({ code: '123456' }),
];
const INSTALL = ['installSession', PENDING];
const DISCARD = ['discardPendingSession', PENDING];

const originalLocation = window.location;
function setLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://app.test', search, href: `https://app.test/login${search}` },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.design = 'navigator';
  state.standalone = false;
  state.auth = { isAuthenticated: false, user: null };
  authService.authenticateWithPassword.mockResolvedValue(PENDING);
  authService.installSession.mockResolvedValue({ user: { id: 'u-1' }, session: {} });
  authService.discardPendingSession.mockResolvedValue(undefined);
  authService.resendVerificationEmail.mockResolvedValue(undefined);
  serve();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

describe('Navigator log-in page: the same sign-in as the live page', () => {
  it('signs in without two-factor: password, status, install, the 2FA prompt flag', async () => {
    const result = await both(signIn, { status: { twoFactorEnabled: false } });
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, INSTALL]);
    expect(result.prompt).toBe('true');
    expect(result.alert).toBeNull();
  });

  it('a session that already passed its factor is installed without a challenge', async () => {
    const result = await both(signIn, {
      status: { twoFactorEnabled: true, sessionTwoFactorVerified: true },
    });
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, INSTALL]);
    expect(result.prompt).toBeNull();
  });

  it('holds the session through the challenge: nothing is installed while it is open', async () => {
    const result = await both(signIn, { status: { twoFactorEnabled: true } });
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, SEND_CODE]);
    expect(result.challenge).toBe(EMAIL);
  });

  it('a passed challenge verifies with the held tokens, then installs that session', async () => {
    const result = await both(
      async () => {
        await signIn();
        await click(/submit code/i);
      },
      { status: { twoFactorEnabled: true } },
    );
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, SEND_CODE, VERIFY_CODE, INSTALL]);
    expect(result.challenge).toBeNull();
  });

  it('a wrong code installs nothing and keeps the challenge open', async () => {
    const result = await both(
      async () => {
        await signIn();
        await click(/submit code/i);
      },
      { status: { twoFactorEnabled: true }, verify: 'wrong' },
    );
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, SEND_CODE, VERIFY_CODE]);
    expect(result.challenge).toBe(EMAIL);
  });

  it('resending the code calls send-code again with the held tokens', async () => {
    const result = await both(
      async () => {
        await signIn();
        await click(/resend code/i);
      },
      { status: { twoFactorEnabled: true } },
    );
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, SEND_CODE, SEND_CODE]);
  });

  it('cancelling the challenge revokes the held sign-in, with the live message', async () => {
    const result = await both(
      async () => {
        await signIn();
        await click(/cancel challenge/i);
      },
      { status: { twoFactorEnabled: true } },
    );
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, SEND_CODE, DISCARD]);
    expect(result.alert).toBe('Login cancelled. Two-factor authentication is required.');
  });

  it('a suspension during the challenge revokes the sign-in and shows the server message', async () => {
    const result = await both(
      async () => {
        await signIn();
        await click(/submit code/i);
      },
      { status: { twoFactorEnabled: true }, verify: 'suspended' },
    );
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, SEND_CODE, VERIFY_CODE, DISCARD]);
    expect(result.alert).toBe('Too many attempts.');
    expect(result.challenge).toBeNull();
  });

  it.each([
    [
      'closed',
      { deleted: true },
      'Your account has been closed. If you believe this is an error, please contact Navigate Wealth support.',
    ],
    [
      'suspended',
      { suspended: true },
      'Your account has been suspended. Please contact Navigate Wealth support for assistance.',
    ],
  ] as const)('a %s account is revoked, never installed', async (_label, status, message) => {
    const result = await both(signIn, { status });
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, DISCARD]);
    expect(result.alert).toBe(message);
  });

  it('an unreadable security status fails closed: revoked, not installed', async () => {
    const result = await both(signIn, { status: 'error' });
    expect(result.calls).toEqual([AUTHENTICATE, STATUS, DISCARD]);
    expect(result.alert).toBe('An unexpected error occurred. Please try again.');
  });

  it.each([
    [
      'rate_limited',
      'Too many login attempts. Navigate Wealth has temporarily blocked further attempts for security reasons. Please wait 5-10 minutes before trying again.',
    ],
    [
      'email_not_verified',
      'Please verify your email address before signing in. Check your inbox for the verification link.Resend verification email',
    ],
    ['invalid_credentials', 'You entered the incorrect username or password.'],
    [
      'network_error',
      'Unable to connect to the authentication server. This may be a temporary issue — please wait a moment and try again. If the problem persists, contact support.',
    ],
    ['unknown', 'Something the server said.'],
  ])('an AuthError %s is worded as the live page words it', async (code, message) => {
    authService.authenticateWithPassword.mockRejectedValue(
      new AuthError('Something the server said.', code as never),
    );
    const result = await both(signIn);
    expect(result.calls).toEqual([AUTHENTICATE]);
    expect(result.alert).toBe(message);
  });

  it('an unverified email can ask for the verification email again', async () => {
    authService.authenticateWithPassword.mockRejectedValue(
      new AuthError('unverified', 'email_not_verified'),
    );
    const result = await both(async () => {
      await signIn();
      await click(/resend verification email/i);
      await screen.findByText('Verification email sent! Please check your inbox.');
    });
    expect(result.calls).toEqual([AUTHENTICATE, ['resendVerificationEmail', EMAIL]]);
    // In the redesign the confirmation is a polite status, not an alert.
    const sent = screen.getByText('Verification email sent! Please check your inbox.');
    expect(sent.closest('[aria-live="polite"]')).not.toBeNull();
    expect(sent.closest('[role="alert"]')).toBeNull();
  });

  it.each([
    [
      'an email without a domain ending',
      'owner@example',
      PASSWORD,
      'Please enter a valid email address',
    ],
    ['a password under 8 characters', EMAIL, 'short', 'Password must be at least 8 characters'],
  ])('%s is refused before anything is sent', async (_label, email, password, message) => {
    const result = await both(() => submit(email, password));
    expect(result.calls).toEqual([]);
    expect(result.alert).toBe(message);
  });

  it('"Keep me signed in" is held, as on the live page, and not sent', async () => {
    const result = await both(async () => {
      fireEvent.click(screen.getByLabelText('Keep me signed in'));
      await signIn();
    });
    expect(result.calls[0]).toEqual(AUTHENTICATE);
  });
});

describe('Navigator log-in page: redirects', () => {
  it.each([
    ['?returnUrl=/dashboard/documents', '/dashboard/documents'],
    ['?returnUrl=//evil.example/steal', '/dashboard'],
    ['?returnUrl=https://evil.example', '/dashboard'],
    ['', '/dashboard'],
  ])('signed in with %s, both designs go to %s', async (search, destination) => {
    const user = { id: 'u-1' };
    for (const design of ['legacy', 'navigator'] as const) {
      cleanup();
      setLocation(search);
      state.auth = { isAuthenticated: true, user };
      state.design = design;
      render(
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>,
      );
      await waitFor(() => expect(window.location.href).toBe(destination));
      // The form gives way to the loader while the browser leaves.
      expect(screen.queryByRole('button', { name: /log in/i })).toBeNull();
    }
    if (destination === '/dashboard') {
      expect(getAuthenticatedRedirectPath).toHaveBeenCalledWith(user);
    }
  });

  it('the installed PWA gets the Navigator app shell around the same form', async () => {
    state.standalone = true;
    await renderLogin('navigator');
    expect(screen.getByRole('heading', { name: 'Log in' }).tagName).toBe('H1');
    expect(document.querySelector('.nwap')).not.toBeNull();
    // No website brand panel: the shell carries the mark, wordmark and switch.
    expect(
      screen.queryByRole('heading', { name: 'Welcome back to your wealth journey.' }),
    ).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Log in or create an account' });
    const here = within(nav).getByRole('link', { name: 'Log in' });
    expect(here.getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe('/signup');
    // The switch replaces the "Get started" line under the form.
    expect(screen.queryByRole('link', { name: 'Get started' })).toBeNull();
    expect(screen.getByText('FSP 54606')).toBeDefined();
  });

  it('the installed PWA keeps the legacy app shell when the legacy design is live', async () => {
    state.standalone = true;
    await renderLogin('legacy');
    expect(screen.getByRole('heading', { name: 'Log in' }).tagName).toBe('H2');
    expect(document.querySelector('.nwli')).toBeNull();
  });
});

describe('Navigator log-in page: the board', () => {
  it("has one H1, the board's, and the brand panel's headings after it", async () => {
    await renderLogin('navigator');
    const headings = screen.getAllByRole('heading').map((h) => [h.tagName, h.textContent]);
    expect(headings).toEqual([
      ['H1', 'Log in'],
      ['H2', 'Welcome back to your wealth journey.'],
      ...LOGIN_BRAND_FEATURES.map((f) => ['H3', f.title]),
    ]);
    expect(screen.getByText('Proudly South African · FSP No. 54606')).toBeDefined();
  });

  it('uses the live wording for the headline and line', () => {
    const live = read('../../components/pages/LoginPage.tsx');
    const page = read('../pages/NavigatorLoginPage.tsx');
    for (const text of [
      'Welcome back to your wealth journey.',
      'Sign in to manage your financial plan, documents and adviser communication.',
      'Enter your details to access your account.',
    ]) {
      expect(live).toContain(text);
    }
    expect(page).toContain('Welcome back to your wealth journey.');
  });

  it('links to the routes the live page links to, as real links', async () => {
    await renderLogin('navigator');
    expect(screen.getByRole('link', { name: 'Forgot?' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Get started' }).getAttribute('href')).toBe('/signup');
  });

  it('labels every control and keeps the live autocomplete hints', async () => {
    await renderLogin('navigator');
    const email = screen.getByLabelText('Email Address');
    const password = screen.getByLabelText('Password');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('name')).toBe('email');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(password.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeDefined();
  });

  it.each([
    ['owner@example', PASSWORD, 'Email Address'],
    [EMAIL, 'short', 'Password'],
  ])('marks the refused field invalid and moves focus to it', async (email, password, label) => {
    await renderLogin('navigator');
    await submit(email, password);
    const field = screen.getByLabelText(label);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('aria-describedby')).toBe('nwli-error');
    expect(document.getElementById('nwli-error')?.textContent).toBeTruthy();
  });

  it('shows a message handed over in the location state in a polite region', async () => {
    await renderLogin('navigator', {
      pathname: '/login',
      state: { message: 'Your email has been verified! Please sign in to continue.' },
    });
    const message = screen.getByText('Your email has been verified! Please sign in to continue.');
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('waits with the live wording and holds the fields while signing in', async () => {
    authService.authenticateWithPassword.mockReturnValue(new Promise(() => {}));
    await renderLogin('navigator');
    await submit();
    const button = screen.getByRole('button', { name: /signing in/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Email Address') as HTMLInputElement).disabled).toBe(true);
  });

  it("reaches sign-in only through useLoginForm, the live page's hook", () => {
    for (const file of ['../pages/NavigatorLoginPage.tsx', '../sections/LoginForm.tsx']) {
      const source = read(file);
      expect(source).not.toMatch(/authService|\bfetch\(|supabase/);
    }
    expect(read('../pages/NavigatorLoginPage.tsx')).toContain('useLoginForm()');
    expect(read('../../components/pages/LoginPage.tsx')).toContain('useLoginForm()');
  });

  it('draws the alerts inside the form card, under the heading', async () => {
    authService.authenticateWithPassword.mockRejectedValue(
      new AuthError('x', 'invalid_credentials'),
    );
    await renderLogin('navigator');
    await submit();
    const form = screen.getByRole('button', { name: /log in/i }).closest('form')!;
    expect(within(form).getByRole('alert').textContent).toBe(
      'You entered the incorrect username or password.',
    );
  });
});
