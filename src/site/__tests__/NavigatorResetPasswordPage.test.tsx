/**
 * The redesigned reset-password page, reached the way production reaches it:
 * ResetPasswordPage with the design switch on lazy-loads
 * NavigatorResetPasswordPage.
 *
 * Auth is safety-critical, so most of this file runs the SAME scenario through
 * both designs — the switch is flipped between runs — and requires the same
 * Supabase auth calls with the same arguments, in the same order, the same
 * clean-up of the address bar, the same updatePassword call, the same words
 * and the same redirect from each: a PKCE ?code= link (accepted, refused,
 * throwing), implicit-flow tokens for a recovery and an invite, an error in
 * the link, a link with nothing in it, the router's fromInvite state, and the
 * update's success and failures (same password, rate limit, network). A source
 * check also holds the Navigator page's logic to a verbatim copy of the live
 * page's, so the two cannot drift.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

/** The design switch, flipped per run so one file can drive both designs. */
const design = vi.hoisted(() => ({ current: 'navigator' as 'navigator' | 'legacy' }));
vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return design.current;
  },
  resolveSiteDesign: () => design.current,
}));

/** The Supabase client both pages get from getSupabaseClient(). */
const client = vi.hoisted(() => ({ auth: {} as Record<string, unknown> }));
vi.mock('../../utils/supabase/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/client')>()),
  getSupabaseClient: () => client,
  createClient: () => client,
}));
vi.mock('../../utils/auth/authService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/auth/authService')>()),
  updatePassword: vi.fn(),
}));

const { ResetPasswordPage } = await import('../../components/pages/ResetPasswordPage');
const authService = await import('../../utils/auth/authService');
const { AuthError } = await import('../../utils/auth/errorHandler');
const { validatePassword, getPasswordStrengthLabel } =
  await import('../../utils/auth/passwordValidation');
const { COMPANY } = await import('../../config/companyFacts');

const updatePassword = vi.mocked(authService.updatePassword);

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');

type Design = 'navigator' | 'legacy';
type Result = { data: { session: unknown }; error: { message: string } | null };

const SESSION = { user: { id: 'u1', user_metadata: {} } };
const INVITED_SESSION = { user: { id: 'u2', user_metadata: { invited: true } } };
const ok = (session: unknown = SESSION): Result => ({ data: { session }, error: null });
const refused = (message = 'invalid'): Result => ({ data: { session: null }, error: { message } });

interface Script {
  exchange?: (code: string) => Result | Promise<Result>;
  setSession?: () => Result;
  /** One answer per getSession call; the last repeats. */
  getSession?: Result[];
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

/** Arrives at /reset-password from `url` in one design; returns once the link is checked. */
async function arrive(which: Design, url: string, script: Script = {}, state?: unknown) {
  design.current = which;
  window.history.replaceState(null, '', url);
  const log: unknown[][] = [];
  const sessions = script.getSession ?? [ok(null)];
  let n = 0;
  client.auth = {
    exchangeCodeForSession: vi.fn(async (code: string) => {
      log.push(['exchangeCodeForSession', code]);
      return script.exchange ? script.exchange(code) : refused();
    }),
    setSession: vi.fn(async (tokens: unknown) => {
      log.push(['setSession', tokens]);
      return script.setSession ? script.setSession() : ok();
    }),
    getSession: vi.fn(async () => {
      log.push(['getSession']);
      return sessions[Math.min(n++, sessions.length - 1)];
    }),
  };
  const replace = vi
    .spyOn(window.history, 'replaceState')
    .mockImplementation((...args: unknown[]) => {
      log.push(['replaceState', ...args]);
    });
  render(
    <MemoryRouter initialEntries={[{ pathname: '/reset-password', state }]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/admin" element={<p>Admin page</p>} />
        <Route path="/forgot-password" element={<p>Forgot page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  // Done once the card shows a result (a link with an error in it never shows
  // the verifying state long enough to be seen).
  await waitFor(
    () =>
      expect(document.body.textContent).toMatch(
        /Reset Link Expired|Set new password|Set up your account/,
      ),
    { timeout: 5000 },
  );
  replace.mockRestore();
  // Each run really is the design it names.
  expect(document.querySelector('.nw-site') !== null).toBe(which === 'navigator');
  const text = document.body.textContent ?? '';
  const view = text.includes('Reset Link Expired')
    ? 'expired'
    : text.includes('Set up your account')
      ? 'invite'
      : text.includes('Set new password')
        ? 'reset'
        : 'unknown';
  return { log, view };
}

/** The same arrival through both designs. */
async function arriveBoth(url: string, script: Script = {}, state?: unknown) {
  const out = {} as Record<Design, Awaited<ReturnType<typeof arrive>>>;
  for (const which of ['legacy', 'navigator'] as const) {
    out[which] = await arrive(which, url, script, state);
    cleanup();
  }
  return out;
}

function typePasswords(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: confirm } });
}

const STRONG = 'Tropical#Sun88x';

/** Arrives with a good link, sets a password, and reports what followed. */
async function submit(which: Design, opts: { invite?: boolean; fail?: unknown } = {}) {
  await arrive(which, `/reset-password?code=c-1${opts.invite ? '&type=invite' : ''}`, {
    exchange: () => ok(),
  });
  updatePassword.mockReset();
  if (opts.fail) updatePassword.mockRejectedValueOnce(opts.fail);
  else updatePassword.mockResolvedValueOnce(undefined);
  typePasswords(STRONG);
  fireEvent.click(
    screen.getByRole('button', { name: opts.invite ? 'Create Account' : 'Reset password' }),
  );
  await waitFor(() => expect(updatePassword).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: /Resetting password|Setting up account/ }),
    ).toBeNull(),
  );
  return { calls: updatePassword.mock.calls.map((c) => [...c]) };
}

beforeEach(() => {
  design.current = 'navigator';
  updatePassword.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('Navigator reset-password page', () => {
  it('holds a verbatim copy of the live page’s logic', () => {
    const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
    const between = (src: string, start: string, end: string) => {
      const a = src.indexOf(start);
      const b = src.indexOf(end, a);
      expect(a).toBeGreaterThan(-1);
      expect(b).toBeGreaterThan(a);
      return collapse(src.slice(a, b));
    };
    const start = 'const locationState = location.state as';
    const live = between(
      read('../../components/pages/ResetPasswordPage.tsx'),
      start,
      '// Show loading state while verifying session',
    );
    const copy = between(
      read('../pages/NavigatorResetPasswordPage.tsx'),
      start,
      "// End of the live page's logic.",
    );
    expect(copy).toBe(live);
    // The calls the logic makes, named so a reader of this test can see them.
    for (const call of [
      'supabase.auth.exchangeCodeForSession(code)',
      'supabase.auth.setSession({',
      'supabase.auth.getSession()',
      'await updatePassword(newPassword)',
      "window.history.replaceState(null, '', window.location.pathname)",
      "const redirectTarget = isInviteFlow ? '/admin' : '/login'",
    ]) {
      expect(copy).toContain(call);
    }
  });

  it('has one H1 in every state, the board’s', async () => {
    design.current = 'navigator';
    let release: (r: Result) => void = () => {};
    window.history.replaceState(null, '', '/reset-password?code=slow');
    client.auth = {
      exchangeCodeForSession: vi.fn(() => new Promise<Result>((r) => (release = r))),
      getSession: vi.fn(async () => ok(null)),
    };
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    const verifying = await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
    expect(verifying.textContent).toBe('Verifying reset link...');
    expect(screen.getByRole('status', { name: 'Verifying reset link' })).toBeDefined();
    // The heading paints before the page's effect calls exchangeCodeForSession,
    // and `release` only exists once it has. Releasing earlier calls the no-op,
    // the exchange never settles, and the page stays on "Verifying" (failed CI
    // on main, 6fd6471, and 1 run in 12 locally under load).
    await waitFor(() => expect(client.auth.exchangeCodeForSession).toHaveBeenCalled());
    release(ok());
    await screen.findByRole('heading', { level: 1, name: 'Set new password' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    cleanup();

    await arrive('navigator', '/reset-password#error=access_denied');
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Reset Link Expired',
    ]);
  });

  it('links home and onward to routes the site serves', async () => {
    await arrive('navigator', '/reset-password#error=access_denied');
    expect(
      screen
        .getAllByRole('link')
        .map((a) => [a.textContent || a.getAttribute('aria-label'), a.getAttribute('href')]),
    ).toEqual([
      ['Navigate Wealth home', '/'],
      ['Request New Reset Link', '/forgot-password'],
      ['Back to Sign In', '/login'],
      ['Contact support', '/contact'],
    ]);
    // The logo is the link's picture; the link carries the name.
    expect(document.querySelector('.nwrp-logo')!.getAttribute('alt')).toBe('');
    cleanup();

    await arrive('navigator', '/reset-password?code=c', { exchange: () => ok() });
    expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it("carries the expired card's live words and the FSP number from companyFacts", async () => {
    await arrive('navigator', '/reset-password#error=access_denied');
    const text = document.body.textContent ?? '';
    for (const phrase of [
      'This password reset link has expired or has already been used.',
      'Password reset links expire after 24 hours for security reasons.',
      'Each link can only be used once and becomes invalid after:',
      '24 hours from when it was sent',
      'Being used to reset your password',
      'A new reset link is requested',
      'Need help?',
    ]) {
      expect(text).toContain(phrase);
    }
    expect(text).toContain(`Proudly South African · FSP No. ${COMPANY.fspNumber}`);
    // The operator's Supabase set-up box is left out, as the board leaves it out.
    expect(text).not.toContain('URLs Not Whitelisted');
  });

  it('adds no SEO tags, as the live page adds none', async () => {
    await arrive('navigator', '/reset-password?code=c', { exchange: () => ok() });
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.getElementById('seo-structured-data')).toBeNull();
  });

  it('labels the show/hide buttons and switches the field between hidden and shown', async () => {
    await arrive('navigator', '/reset-password?code=c', { exchange: () => ok() });
    const field = screen.getByLabelText('New Password') as HTMLInputElement;
    expect(field.type).toBe('password');
    expect(field.autocomplete).toBe('new-password');
    const [toggle] = screen.getAllByRole('button', { name: 'Show password' });
    fireEvent.click(toggle);
    expect(field.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
    expect((screen.getByLabelText('Confirm New Password') as HTMLInputElement).type).toBe(
      'password',
    );
  });

  it('reads "Not set" before anything is typed, then the live label', async () => {
    await arrive('navigator', '/reset-password?code=c', { exchange: () => ok() });
    expect(document.querySelector('.nwrp-meter-value')!.textContent).toBe('Not set');
    expect(document.querySelectorAll('.nwrp-meter-bar[data-tone]')).toHaveLength(0);
    typePasswords(STRONG, '');
    expect(document.querySelector('.nwrp-meter-value')!.textContent).toBe('Very Strong');
    expect(document.querySelectorAll('.nwrp-meter-bar[data-tone="success"]')).toHaveLength(4);
  });
});

describe('Navigator reset-password page: same link handling as the live page', () => {
  it('exchanges a PKCE ?code= and clears it from the address bar', async () => {
    const r = await arriveBoth('/reset-password?code=pkce-123', { exchange: () => ok() });
    expect(r.navigator.log).toEqual([
      ['exchangeCodeForSession', 'pkce-123'],
      ['replaceState', null, '', '/reset-password'],
    ]);
    expect(r.navigator.view).toBe('reset');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('falls back to getSession when the code was already used, as the live page does', async () => {
    const r = await arriveBoth('/reset-password?code=used', {
      exchange: () => refused('code already used'),
      getSession: [ok()],
    });
    expect(r.navigator.log).toEqual([['exchangeCodeForSession', 'used'], ['getSession']]);
    expect(r.navigator.view).toBe('reset');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('sets the session from implicit-flow recovery tokens in the hash', async () => {
    const r = await arriveBoth(
      '/reset-password#access_token=at-1&refresh_token=rt-1&expires_in=3600&type=recovery',
    );
    expect(r.navigator.log).toEqual([
      ['setSession', { access_token: 'at-1', refresh_token: 'rt-1' }],
      ['replaceState', null, '', '/reset-password'],
    ]);
    expect(r.navigator.view).toBe('reset');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('treats type=invite as an invite, with an empty refresh token when none is given', async () => {
    const r = await arriveBoth('/reset-password#access_token=at-2&type=invite');
    expect(r.navigator.log).toEqual([
      ['setSession', { access_token: 'at-2', refresh_token: '' }],
      ['replaceState', null, '', '/reset-password'],
    ]);
    expect(r.navigator.view).toBe('invite');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('shows the expired card when setSession refuses the tokens', async () => {
    const r = await arriveBoth('/reset-password#access_token=old&refresh_token=x&type=recovery', {
      setSession: () => refused('expired'),
    });
    expect(r.navigator.log).toEqual([['setSession', { access_token: 'old', refresh_token: 'x' }]]);
    expect(r.navigator.view).toBe('expired');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('shows the expired card, calling nothing, for an error in the link', async () => {
    for (const url of [
      '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      '/reset-password?error=server_error',
    ]) {
      const r = await arriveBoth(url, { exchange: () => ok() });
      expect(r.navigator).toEqual({ log: [], view: 'expired' });
      expect(r.legacy).toEqual(r.navigator);
    }
  });

  it('retries getSession four times for a bare link, then shows the expired card', async () => {
    const r = await arriveBoth('/reset-password');
    expect(r.navigator.log).toEqual([
      ['getSession'],
      ['getSession'],
      ['getSession'],
      ['getSession'],
    ]);
    expect(r.navigator.view).toBe('expired');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('uses a session another tab or detectSessionInUrl already made, invited or not', async () => {
    const plain = await arriveBoth('/reset-password', { getSession: [ok(null), ok()] });
    expect(plain.navigator).toEqual({ log: [['getSession'], ['getSession']], view: 'reset' });
    expect(plain.legacy).toEqual(plain.navigator);
    const invited = await arriveBoth('/reset-password', { getSession: [ok(INVITED_SESSION)] });
    expect(invited.navigator).toEqual({ log: [['getSession']], view: 'invite' });
    expect(invited.legacy).toEqual(invited.navigator);
  });

  it("takes the router's fromInvite state as an invite", async () => {
    const r = await arriveBoth(
      '/reset-password?code=c',
      { exchange: () => ok() },
      { fromInvite: true },
    );
    expect(r.navigator.view).toBe('invite');
    expect(r.legacy).toEqual(r.navigator);
  });

  it('shows the expired card when the exchange throws', async () => {
    const r = await arriveBoth('/reset-password?code=boom', {
      exchange: () => {
        throw new Error('boom');
      },
    });
    expect(r.navigator).toEqual({ log: [['exchangeCodeForSession', 'boom']], view: 'expired' });
    expect(r.legacy).toEqual(r.navigator);
  });
});

describe('Navigator reset-password page: same rules and update as the live page', () => {
  it('shows the same strength label and rule ticks for any password', async () => {
    const passwords = [
      'navigate',
      'abc',
      'abcdefghijkl',
      'Olympic$Rain',
      'Compass&Birch51',
      STRONG,
    ];
    const seen = {} as Record<Design, string[][]>;
    for (const which of ['legacy', 'navigator'] as const) {
      await arrive(which, '/reset-password?code=c', { exchange: () => ok() });
      seen[which] = passwords.map((pw) => {
        typePasswords(pw, '');
        const label = getPasswordStrengthLabel(validatePassword(pw).score);
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        const rules = [
          'At least 12 characters',
          'At least 3 of: uppercase, lowercase, numbers, special characters',
          'Not a common or predictable password',
        ].map((text) => {
          const li = screen.getByText(text).closest('li')!;
          const met =
            which === 'navigator'
              ? li.getAttribute('data-ok') === 'true'
              : li.className.includes('text-green-600');
          return met ? 'met' : 'unmet';
        });
        return [label, ...rules];
      });
      cleanup();
    }
    expect(seen.navigator).toEqual(seen.legacy);
    expect(seen.navigator[0][0]).toBe('Very Weak');
    expect(seen.navigator[5]).toEqual(['Very Strong', 'met', 'met', 'met']);
  });

  it('keeps the button disabled until the password is valid and confirmed, in both', async () => {
    for (const which of ['legacy', 'navigator'] as const) {
      await arrive(which, '/reset-password?code=c', { exchange: () => ok() });
      const button = () => screen.getByRole('button', { name: 'Reset password' });
      expect(button().hasAttribute('disabled')).toBe(true);
      typePasswords('navigate', 'navigate');
      expect(button().hasAttribute('disabled')).toBe(true);
      typePasswords(STRONG, `${STRONG}!`);
      expect(screen.getByText('Passwords do not match')).toBeDefined();
      expect(button().hasAttribute('disabled')).toBe(true);
      typePasswords(STRONG);
      expect(screen.getByText('Passwords match')).toBeDefined();
      expect(button().hasAttribute('disabled')).toBe(false);
      cleanup();
    }
  });

  it('calls updatePassword with the new password, confirms and goes to /login', async () => {
    for (const which of ['legacy', 'navigator'] as const) {
      const r = await submit(which);
      expect(r.calls).toEqual([[STRONG]]);
      expect(
        screen.getByText('Password reset successfully! Redirecting to sign in...'),
      ).toBeDefined();
      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/login'), {
        timeout: 3000,
      });
      cleanup();
    }
  });

  it('sends an invited colleague to /admin with the invite wording', async () => {
    for (const which of ['legacy', 'navigator'] as const) {
      const r = await submit(which, { invite: true });
      expect(r.calls).toEqual([[STRONG]]);
      expect(
        screen.getByText('Account set up successfully! Redirecting to the admin panel...'),
      ).toBeDefined();
      await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/admin'), {
        timeout: 3000,
      });
      cleanup();
    }
  });

  it('shows the same message for each way the update can fail, and stays put', async () => {
    const failures: [unknown, string][] = [
      [
        new AuthError('New password cannot be the same as your previous password', 'same_password'),
        'New password cannot be the same as your previous password',
      ],
      [
        new AuthError(
          'Too many login attempts. Please wait 5-10 minutes before trying again.',
          'rate_limited',
        ),
        'Too many login attempts. Please wait 5-10 minutes before trying again.',
      ],
      [
        new Error('NetworkError when attempting to fetch resource.'),
        'Network connection issue. Please check your internet connection and try again.',
      ],
    ];
    for (const [fail, message] of failures) {
      for (const which of ['legacy', 'navigator'] as const) {
        const r = await submit(which, { fail });
        expect(r.calls).toEqual([[STRONG]]);
        expect(screen.getByText(message)).toBeDefined();
        expect(screen.queryByText(/Redirecting/)).toBeNull();
        expect(screen.getByTestId('location').textContent).toBe('/reset-password');
        if (which === 'navigator') {
          expect(screen.getByRole('alert').textContent).toBe(message);
        }
        cleanup();
      }
    }
  });
});
