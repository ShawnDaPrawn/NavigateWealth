/**
 * The redesigned forgot-password page, reached the way production reaches it:
 * ForgotPasswordPage with the design switch on lazy-loads
 * NavigatorForgotPasswordPage.
 *
 * Auth is safety-critical, so most of this file runs the SAME scenario through
 * both designs — the switch is flipped between runs — and requires the same
 * calls to sendPasswordResetEmail with the same arguments, and the same words
 * on screen, from each: the success path, both client-side checks, a refused
 * request, a network failure and a rate limit. The real sendPasswordResetEmail
 * runs underneath (with fetch stubbed), so the endpoint and payload are the
 * live ones too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

/** The design switch, flipped per run so one file can drive both designs. */
const design = vi.hoisted(() => ({ current: 'navigator' as 'navigator' | 'legacy' }));
vi.mock('../design', () => ({
  get SITE_DESIGN() {
    return design.current;
  },
  resolveSiteDesign: () => design.current,
}));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
// The real function, wrapped so every call (and its arguments) is recorded.
vi.mock('../../utils/auth/authService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/auth/authService')>();
  return { ...actual, sendPasswordResetEmail: vi.fn(actual.sendPasswordResetEmail) };
});

const { ForgotPasswordPage } = await import('../../components/pages/ForgotPasswordPage');
const authService = await import('../../utils/auth/authService');
const { AuthError } = await import('../../utils/auth/errorHandler');
const { COMPANY } = await import('../../config/companyFacts');

const sendReset = vi.mocked(authService.sendPasswordResetEmail);
const ENDPOINT = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/auth/password-reset';

type Design = 'navigator' | 'legacy';

function stubFetch(response: { ok: boolean; status?: number } | Error = { ok: true }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (response instanceof Error) throw response;
      return { ok: response.ok, status: response.status ?? 200, json: async () => ({}) };
    }),
  );
}

async function renderPage(which: Design = 'navigator') {
  design.current = which;
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/signup" element={<p>Signup page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return (await screen.findByLabelText('Email Address')) as HTMLInputElement;
}

/**
 * Types an address and submits the form. The form element is submitted
 * directly so both designs run their own checks (the live page's `required`
 * would otherwise stop an empty field in a real browser before its handler).
 */
async function request(which: Design, email: string) {
  const input = await renderPage(which);
  fireEvent.change(input, { target: { value: email } });
  fireEvent.submit(input.closest('form')!);
}

/** What a run leaves behind: the calls made and the words on screen. */
async function outcome(expectSent: boolean) {
  if (expectSent) {
    await screen.findByText('Check Your Email');
  } else {
    await waitFor(() =>
      expect(document.body.textContent).toMatch(/Please|We could|Unable|Too many|Network/),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Sending Reset Link/ })).toBeNull(),
    );
  }
  const shown = expectSent
    ? screen.getByText(/We've sent a password reset link to/).textContent
    : [...document.querySelectorAll('[role="alert"]')].map((el) => el.textContent?.trim()).join('');
  return { calls: sendReset.mock.calls.map((c) => [...c]), shown };
}

/** Runs one scenario through each design and returns both outcomes. */
async function both(email: string, expectSent: boolean, arrange: () => void) {
  const results: Record<Design, Awaited<ReturnType<typeof outcome>>> = {} as never;
  for (const which of ['legacy', 'navigator'] as const) {
    sendReset.mockClear();
    arrange();
    await request(which, email);
    // Each run really is the design it names.
    expect(document.querySelector('.nw-site') !== null).toBe(which === 'navigator');
    results[which] = await outcome(expectSent);
    cleanup();
  }
  return results;
}

beforeEach(() => {
  design.current = 'navigator';
  stubFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sendReset.mockClear();
});

describe('Navigator forgot-password page', () => {
  it("has one H1, the board's: Reset Password", async () => {
    await renderPage();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1.map((h) => h.textContent)).toEqual(['Reset Password']);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Secure Account Recovery',
    ]);
    // The H1 comes first in the source, so the headings are in order.
    const order = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.tagName);
    expect(order).toEqual(['H1', 'H2', 'H3', 'H3', 'H3']);
  });

  it('links to the routes the live page links to, as real links', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: 'Back to Login' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe('/signup');
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/login',
      '/signup',
    ]);
  });

  it("carries the live page's words, and the FSP number from companyFacts", async () => {
    await renderPage();
    const text = document.body.textContent ?? '';
    for (const phrase of [
      "Enter your email address and we'll send you a link to reset your password",
      'Bank-Level Encryption',
      '256-bit SSL encryption protects your data and reset tokens at all times.',
      'Time-Limited Tokens',
      'Reset links expire after 15 minutes to prevent unauthorized access.',
      'Verified Access Only',
      'Only registered email addresses can receive password reset links.',
      'We take your security seriously with industry-leading protection measures.',
      "For security reasons, we'll only send reset links to registered email addresses",
    ]) {
      expect(text).toContain(phrase);
    }
    expect(text).toContain(`Proudly South African · FSP No. ${COMPANY.fspNumber}`);
  });

  it('adds no SEO tags, as the live page adds none', async () => {
    await renderPage();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.getElementById('seo-structured-data')).toBeNull();
  });

  it('asks for the link with the live endpoint and payload, and no anon-key bearer', async () => {
    await request('navigator', 'thandi@example.com');
    await screen.findByText('Check Your Email');
    expect(sendReset.mock.calls).toEqual([['thandi@example.com']]);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', apikey: 'anon' });
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'thandi@example.com',
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('shows the board while the request is in flight, and sends it only once', async () => {
    let release: () => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ ok: true, status: 200, json: async () => ({}) });
          }),
      ),
    );
    await request('navigator', 'thandi@example.com');
    const busy = await screen.findByRole('button', { name: 'Sending Reset Link...' });
    expect(busy.hasAttribute('disabled')).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect((screen.getByLabelText('Email Address') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(busy);
    expect(sendReset).toHaveBeenCalledTimes(1);
    release();
    await screen.findByText('Check Your Email');
  });

  it('marks the field and moves focus to it when a check fails', async () => {
    await request('navigator', '');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Please enter your email address.');
    const input = screen.getByLabelText('Email Address');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(document.activeElement).toBe(input);
  });

  it('does not mark the field when the server refuses', async () => {
    stubFetch({ ok: false, status: 500 });
    await request('navigator', 'thandi@example.com');
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Email Address').hasAttribute('aria-invalid')).toBe(false);
  });

  it('confirms in place, focuses the confirmation, and "Send Another Link" goes back', async () => {
    await request('navigator', 'thandi@example.com');
    const done = await screen.findByRole('heading', { level: 1, name: 'Check Your Email' });
    expect(document.activeElement).toBe(done);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('thandi@example.com').tagName).toBe('STRONG');
    expect(document.body.textContent).toContain(
      'The reset link will expire in 15 minutes for security reasons.',
    );
    expect(document.body.textContent).toContain('Reset link sent securely');
    expect(screen.getByRole('link', { name: 'Back to Login' }).getAttribute('href')).toBe('/login');

    fireEvent.click(screen.getByRole('button', { name: 'Send Another Link' }));
    const input = (await screen.findByLabelText('Email Address')) as HTMLInputElement;
    expect(input.value).toBe('thandi@example.com');
    expect(document.activeElement).toBe(input);
  });
});

describe('Navigator forgot-password page: same calls and words as the live page', () => {
  it('sends the address exactly as typed and shows the same confirmation', async () => {
    const r = await both('Thandi.vdM@Example.co.za', true, () => stubFetch());
    expect(r.navigator.calls).toEqual([['Thandi.vdM@Example.co.za']]);
    expect(r.legacy.calls).toEqual(r.navigator.calls);
    expect(r.navigator.shown).toBe("We've sent a password reset link to Thandi.vdM@Example.co.za");
    expect(r.legacy.shown).toBe(r.navigator.shown);
  });

  it('confirms the same way for any address the server accepts, revealing nothing', async () => {
    // The endpoint answers 200 whether or not an account uses the address.
    const known = await both('client@example.com', true, () => stubFetch());
    const unknown = await both('nobody@example.com', true, () => stubFetch());
    for (const r of [known, unknown]) expect(r.legacy.shown).toBe(r.navigator.shown);
    expect(unknown.navigator.shown?.replace('nobody', 'client')).toBe(known.navigator.shown);
  });

  it('refuses an empty address without a call, with the same message', async () => {
    const r = await both('', false, () => stubFetch());
    expect(r.navigator).toEqual({ calls: [], shown: 'Please enter your email address.' });
    expect(r.legacy).toEqual(r.navigator);
  });

  it('refuses a malformed address without a call, with the same message', async () => {
    for (const email of ['thandi@example', 'thandi example.com', 'thandi@@example.com']) {
      const r = await both(email, false, () => stubFetch());
      expect(r.navigator).toEqual({ calls: [], shown: 'Please enter a valid email address.' });
      expect(r.legacy).toEqual(r.navigator);
    }
  });

  it('shows the same message when the service refuses the request', async () => {
    const r = await both('thandi@example.com', false, () => stubFetch({ ok: false, status: 503 }));
    expect(r.navigator.calls).toEqual([['thandi@example.com']]);
    expect(r.navigator.shown).toBe(
      'We could not process that request right now. Please try again shortly.',
    );
    expect(r.legacy).toEqual(r.navigator);
  });

  it('shows the same message when the network fails', async () => {
    const r = await both('thandi@example.com', false, () =>
      stubFetch(new TypeError('Failed to fetch')),
    );
    expect(r.navigator.calls).toEqual([['thandi@example.com']]);
    expect(r.navigator.shown).toBe(
      'Unable to connect to the authentication server. This may be a temporary server issue — please try again in a moment.',
    );
    expect(r.legacy).toEqual(r.navigator);
  });

  it('shows the same rate-limit message', async () => {
    const limited = () =>
      sendReset.mockRejectedValueOnce(
        new AuthError(
          'Too many login attempts. Please wait 5-10 minutes before trying again.',
          'rate_limited',
        ),
      );
    const r = await both('thandi@example.com', false, limited);
    expect(r.navigator.calls).toEqual([['thandi@example.com']]);
    expect(r.navigator.shown).toBe(
      'Too many login attempts. Please wait 5-10 minutes before trying again.',
    );
    expect(r.legacy).toEqual(r.navigator);
  });

  it('maps an unexpected failure through the same getUserErrorMessage', async () => {
    const r = await both('thandi@example.com', false, () =>
      sendReset.mockRejectedValueOnce(new Error('network down')),
    );
    expect(r.navigator.shown).toBe(
      'Network connection issue. Please check your internet connection and try again.',
    );
    expect(r.legacy).toEqual(r.navigator);
  });
});
