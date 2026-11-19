/**
 * The redesigned verify-email page, reached the way production reaches it:
 * VerifyEmailPage with the design switch on lazy-loads
 * NavigatorVerifyEmailPage.
 *
 * Auth is safety-critical here, so most of this file renders the live page
 * and the redesign side by side, through the same switch, and drives both
 * through the same scenario: they must make the same session check, show the
 * same address from the same source, call resendVerificationEmail with the
 * same argument, show the same words for every outcome, and go to the same
 * place at the same moment. The rest covers what the redesign must not lose
 * (one H1, links only to routes that exist, the firm's details from
 * companyFacts, no SEO tags, as on the live page) and what it adds (the
 * account-setup progress, the inbox shortcuts, focus kept on the page after a
 * resend).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router';

const h = vi.hoisted(() => ({
  design: 'navigator' as 'legacy' | 'navigator',
  resendVerificationEmail: vi.fn(),
  getCurrentUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return h.design;
  },
  resolveSiteDesign: () => h.design,
}));
vi.mock('../../utils/auth', () => ({
  resendVerificationEmail: (...args: unknown[]) => h.resendVerificationEmail(...args),
  getCurrentUser: (...args: unknown[]) => h.getCurrentUser(...args),
  getSupabaseClient: () => ({ auth: { getSession: h.getSession } }),
}));

const { VerifyEmailPage } = await import('../../components/pages/VerifyEmailPage');
const { logger } = await import('../../utils/logger');
const { COMPANY } = await import('../../config/companyFacts');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
const liveSource = read('../../components/pages/VerifyEmailPage.tsx');
const navigatorSource = read('../pages/NavigatorVerifyEmailPage.tsx');

type Design = 'legacy' | 'navigator';
const DESIGNS: Design[] = ['legacy', 'navigator'];

const SENT = 'Verification email sent. Check your inbox, and your spam folder.';
const ALREADY_VERIFIED = 'Email already verified! Redirecting to dashboard...';
const NO_ADDRESS = 'Enter your email on the sign-in page to resend the link.';
const RESEND_FALLBACK = 'Could not resend the verification email.';

function deferred<T>() {
  let resolveIt!: (value: T) => void;
  let rejectIt!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolveIt = res;
    rejectIt = rej;
  });
  return { promise, resolve: resolveIt, reject: rejectIt };
}

function LocationProbe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <span data-testid="location" data-type={type}>
      {location.pathname}
    </span>
  );
}

const where = () => screen.getByTestId('location');

/** Renders /verify-email in the given design, with optional router state. */
async function renderPage(design: Design, state?: unknown) {
  h.design = design;
  render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-email', state }]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<p>Sign-in page</p>} />
        <Route path="/dashboard" element={<p>Dashboard page</p>} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  // Both designs start on the "check your email" view; the redesign arrives lazily.
  await screen.findByText('Check Your Email');
}

/** Lets the session check's awaited calls settle. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const resendButton = () => screen.getByRole('button', { name: /Resend verification email/ });
const backToSignIn = () => screen.getByText('Back to Sign In').closest('a, button') as HTMLElement;

/** What a scenario did, in terms both designs must agree on. */
function trace() {
  return {
    getSession: h.getSession.mock.calls,
    getCurrentUser: h.getCurrentUser.mock.calls,
    resendVerificationEmail: h.resendVerificationEmail.mock.calls,
    loggerInfo: vi.mocked(logger.info).mock.calls,
    location: where().textContent,
    navigationType: where().getAttribute('data-type'),
  };
}

function resetMocks() {
  h.resendVerificationEmail.mockReset();
  h.resendVerificationEmail.mockResolvedValue(undefined);
  h.getCurrentUser.mockReset();
  h.getCurrentUser.mockResolvedValue(null);
  h.getSession.mockReset();
  // The signup flow arrives here signed out, carrying the address in router state.
  h.getSession.mockResolvedValue({ data: { session: null } });
  vi.mocked(logger.info).mockClear();
}

/** Runs a scenario in both designs and returns each one's trace. */
async function inBothDesigns<T>(scenario: (design: Design) => Promise<T>) {
  const results = {} as Record<Design, T>;
  for (const design of DESIGNS) {
    resetMocks();
    results[design] = await scenario(design);
    cleanup();
    vi.useRealTimers();
  }
  return results;
}

beforeEach(() => {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  resetMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  h.design = 'navigator';
});

describe('Navigator verify-email page: the same behaviour as the live page', () => {
  it('shows the address from router state when signed out, and resends to it', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      await renderPage(design, { email: 'thandi@example.com', message: 'Please check' });
      await screen.findByText('thandi@example.com');
      await act(async () => {
        fireEvent.click(resendButton());
      });
      await screen.findByText(SENT);
      return trace();
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.resendVerificationEmail).toEqual([['thandi@example.com']]);
    expect(navigator.getSession).toHaveLength(1);
    expect(navigator.getCurrentUser).toHaveLength(0);
  });

  it("prefers the signed-in user's address over router state", async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
      h.getCurrentUser.mockResolvedValue({
        id: 'u1',
        email: 'sipho@example.com',
        emailConfirmed: false,
        createdAt: '',
      });
      await renderPage(design, { email: 'thandi@example.com' });
      await screen.findByText('sipho@example.com');
      expect(screen.queryByText('thandi@example.com')).toBeNull();
      await act(async () => {
        fireEvent.click(resendButton());
      });
      await screen.findByText(SENT);
      return trace();
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.resendVerificationEmail).toEqual([['sipho@example.com']]);
    expect(navigator.getCurrentUser).toEqual([[]]);
  });

  it('ignores router state when a session exists but no user comes back', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
      await renderPage(design, { email: 'thandi@example.com' });
      await settle();
      expect(screen.getByText('your email address')).toBeTruthy();
      fireEvent.click(resendButton());
      await screen.findByText(NO_ADDRESS);
      return trace();
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.resendVerificationEmail).toEqual([]);
  });

  it('sends an already-verified user to /dashboard two seconds later, not sooner', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      const session = deferred<unknown>();
      h.getSession.mockReturnValue(session.promise);
      h.getCurrentUser.mockResolvedValue({
        id: 'u1',
        email: 'sipho@example.com',
        emailConfirmed: true,
        createdAt: '',
      });
      await renderPage(design, { email: 'thandi@example.com' });
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      session.resolve({ data: { session: { access_token: 't' } } });
      await settle();

      const status = screen.getByText(ALREADY_VERIFIED);
      expect(screen.queryByText('Check Your Email')).toBeNull();
      expect(screen.queryByText('The verification link will expire in 24 hours')).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(1999);
      });
      const before = where().textContent;
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      return { ...trace(), before, statusInLiveRegion: !!status.closest('[role="status"]') };
    });
    expect(navigator.location).toBe('/dashboard');
    expect(navigator.before).toBe('/verify-email');
    expect(navigator.navigationType).toBe('PUSH');
    expect(navigator.loggerInfo).toContainEqual([
      'Email already verified, redirecting to dashboard',
    ]);
    expect(navigator.statusInLiveRegion).toBe(true);
    const { statusInLiveRegion: _n, ...nav } = navigator;
    const { statusInLiveRegion: _l, ...live } = legacy;
    expect(nav).toEqual(live);
  });

  it('shows "Sending…" on a disabled button while the resend is in flight', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      const send = deferred<void>();
      h.resendVerificationEmail.mockReturnValue(send.promise);
      await renderPage(design, { email: 'thandi@example.com' });
      await screen.findByText('thandi@example.com');
      fireEvent.click(resendButton());
      const button = screen.getByRole('button', { name: /Sending…/ }) as HTMLButtonElement;
      const disabled = button.disabled;
      fireEvent.click(button);
      await act(async () => {
        send.resolve();
      });
      await screen.findByText(SENT);
      return { ...trace(), disabled };
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.disabled).toBe(true);
    expect(navigator.resendVerificationEmail).toEqual([['thandi@example.com']]);
  });

  it("shows the service's own message when the resend fails, and offers it again", async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      h.resendVerificationEmail.mockRejectedValue(new Error('Email rate limit exceeded'));
      await renderPage(design, { email: 'thandi@example.com' });
      await screen.findByText('thandi@example.com');
      await act(async () => {
        fireEvent.click(resendButton());
      });
      const alert = await screen.findByRole('alert');
      return {
        ...trace(),
        alert: alert.textContent,
        again: !!screen.queryByRole('button', { name: /Resend verification email/ }),
      };
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.alert).toBe('Email rate limit exceeded');
    expect(navigator.again).toBe(true);
  });

  it('falls back to the live wording when the failure is not an Error', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      h.resendVerificationEmail.mockRejectedValue('offline');
      await renderPage(design, { email: 'thandi@example.com' });
      await screen.findByText('thandi@example.com');
      await act(async () => {
        fireEvent.click(resendButton());
      });
      return { ...trace(), alert: (await screen.findByRole('alert')).textContent };
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.alert).toBe(RESEND_FALLBACK);
  });

  it('does not call the service when no address is known', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      await renderPage(design);
      await settle();
      expect(screen.getByText('your email address')).toBeTruthy();
      fireEvent.click(resendButton());
      return { ...trace(), alert: (await screen.findByRole('alert')).textContent };
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.resendVerificationEmail).toEqual([]);
    expect(navigator.alert).toBe(NO_ADDRESS);
  });

  it('logs a failed session check and carries on, as the live page does', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      const failure = new Error('network down');
      h.getSession.mockRejectedValue(failure);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      await renderPage(design, { email: 'thandi@example.com' });
      await settle();
      const logged = consoleError.mock.calls.filter(([m]) => m === 'Error checking auth status:');
      consoleError.mockRestore();
      return { ...trace(), logged, shown: !!screen.queryByText('your email address') };
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.logged).toHaveLength(1);
    expect(navigator.shown).toBe(true);
  });

  it('"Back to Sign In" goes to /login', async () => {
    const { legacy, navigator } = await inBothDesigns(async (design) => {
      await renderPage(design, { email: 'thandi@example.com' });
      await screen.findByText('thandi@example.com');
      fireEvent.click(backToSignIn());
      await screen.findByText('Sign-in page');
      return trace();
    });
    expect(navigator).toEqual(legacy);
    expect(navigator.location).toBe('/login');
    expect(navigator.navigationType).toBe('PUSH');
  });

  it('keeps the live page’s session calls and strings in its source', () => {
    for (const line of [
      'await supabase.auth.getSession();',
      'const user = await getCurrentUser();',
      'setEmail(user.email);',
      'setIsVerified(user.emailConfirmed);',
      "navigate('/dashboard');",
      '}, 2000);',
      'setEmail(location.state.email);',
      '}, [location, navigate]);',
      'await resendVerificationEmail(email);',
      `setResendError('${NO_ADDRESS}');`,
      `'${RESEND_FALLBACK}'`,
      `setSuccess('${ALREADY_VERIFIED}');`,
    ]) {
      expect(liveSource).toContain(line);
      expect(navigatorSource).toContain(line);
    }
  });
});

describe('Navigator verify-email page: the board', () => {
  it('is the redesign when the switch is on, and the live page when it is off', async () => {
    await renderPage('navigator', { email: 'thandi@example.com' });
    expect(document.querySelector('.nw-site.nwve')).not.toBeNull();
    cleanup();
    await renderPage('legacy', { email: 'thandi@example.com' });
    expect(document.querySelector('.nwve')).toBeNull();
  });

  it("has one H1, the board's headline", async () => {
    await renderPage('navigator', { email: 'thandi@example.com' });
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1.map((h) => h.textContent)).toEqual(['Check Your Email']);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('keeps one (visually hidden) H1 once the address is verified', async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    h.getCurrentUser.mockResolvedValue({
      id: 'u1',
      email: 'sipho@example.com',
      emailConfirmed: true,
      createdAt: '',
    });
    await renderPage('navigator');
    await screen.findByText(ALREADY_VERIFIED);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].className).toContain('nw-sr-only');
  });

  it('links only to routes the site serves, the two inboxes and the mailbox', async () => {
    await renderPage('navigator', { email: 'thandi@example.com' });
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/',
      'https://mail.google.com',
      'https://outlook.live.com',
      '/login',
      `mailto:${COMPANY.email}`,
    ]);
    // The live page's support address, which is the firm's only public mailbox.
    expect(liveSource).toContain(`href="mailto:${COMPANY.email}"`);
    expect(screen.getByRole('link', { name: 'Navigate Wealth home' })).toBeTruthy();
    for (const img of document.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('draws the account-setup progress with this step current', async () => {
    await renderPage('navigator', { email: 'thandi@example.com' });
    const steps = screen.getByRole('list', { name: 'Account setup progress' });
    const items = [...steps.querySelectorAll('li:not([aria-hidden])')];
    expect(items.map((li) => li.textContent)).toEqual([
      'Account created',
      '2Verify email',
      '3Application',
    ]);
    expect(items[1].getAttribute('aria-current')).toBe('step');
  });

  it('says the link expires in 24 hours and names the FSP from companyFacts', async () => {
    await renderPage('navigator', { email: 'thandi@example.com' });
    expect(screen.getByText('The verification link will expire in 24 hours')).toBeTruthy();
    expect(liveSource).toContain('The verification link will expire in 24 hours');
    expect(screen.getByText(`Proudly South African · FSP No. ${COMPANY.fspNumber}`)).toBeTruthy();
  });

  it('moves focus to the confirmation that replaces the resend button', async () => {
    await renderPage('navigator', { email: 'thandi@example.com' });
    await screen.findByText('thandi@example.com');
    resendButton().focus();
    await act(async () => {
      fireEvent.click(resendButton());
    });
    const sent = (await screen.findByText(SENT)).closest('[role="status"]');
    expect(sent).not.toBeNull();
    expect(document.activeElement).toBe(sent);
  });

  it('sets no SEO tags, as the live page sets none', async () => {
    const title = document.title;
    await renderPage('navigator', { email: 'thandi@example.com' });
    expect(liveSource).not.toMatch(/<SEO\b/);
    expect(navigatorSource).not.toMatch(/<SEO\b/);
    expect(document.title).toBe(title);
  });
});
