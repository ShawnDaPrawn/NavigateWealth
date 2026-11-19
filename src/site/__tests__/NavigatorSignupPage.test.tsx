/**
 * The redesigned sign-up page, reached the way production reaches it:
 * SignupPage with the design switch on lazy-loads NavigatorSignupPage.
 *
 * Account creation is safety-critical, so most of this file runs each
 * scenario twice, once through the legacy page and once through the Navigator
 * page, records every request (URL, method, headers, body) and every toast,
 * and where the page goes next, and requires the two records to be identical
 * as well as equal to what SignupPage's flow is known to send: success, a
 * different dialling code, the "already registered" answer (which must look
 * like success), a password the server refuses, a server error, a non-JSON
 * reply, a network failure, and the pre-submit email check. The submit button
 * waits in both until every field is filled and the password passes and
 * matches, and the Terms and Privacy links open the same document viewer.
 *
 * Then what the redesign adds: one H1 with the board's words, the strength
 * panel reading validatePassword, the refused field marked invalid and
 * focused, real links to the legal documents.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

type Design = 'legacy' | 'navigator';
const state = vi.hoisted(() => ({
  design: 'navigator' as 'legacy' | 'navigator',
  standalone: false,
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
vi.mock('../../hooks/useIsStandalone', () => ({ useIsStandalone: () => state.standalone }));
vi.mock('sonner', () => {
  const toast = Object.assign((...args: unknown[]) => state.calls.push(['toast', ...args]), {
    error: (...args: unknown[]) => state.calls.push(['toast.error', ...args]),
    info: (...args: unknown[]) => state.calls.push(['toast.info', ...args]),
    success: (...args: unknown[]) => state.calls.push(['toast.success', ...args]),
  });
  return { toast, Toaster: () => null };
});

const { SignupPage } = await import('../../components/pages/SignupPage');
const { SIGNUP_BRAND_FEATURES } = await import('../../components/pages/auth/authConstants');
const { getUserErrorMessage } = await import('../../utils/errorUtils');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');

const FN = 'https://proj.supabase.co/functions/v1/make-server-91ed8379';
const SIGNUP_URL = `${FN}/auth-signup/signup`;

type Reply =
  | { ok: boolean; status?: number; body: unknown }
  | { text: string; ok?: boolean; status?: number }
  | 'network'
  | 'hang';

/** The edge function; every request is recorded, in order. */
function serve(signup: Reply = { ok: true, body: { success: true } }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      state.calls.push([
        'fetch',
        url,
        init.method ?? 'GET',
        Object.fromEntries(new Headers(init.headers).entries()),
        typeof init.body === 'string' ? JSON.parse(init.body) : (init.body ?? null),
      ]);
      if (url === SIGNUP_URL) {
        if (signup === 'network') throw new TypeError('Failed to fetch');
        if (signup === 'hang') return new Promise(() => {});
        const text = 'text' in signup ? signup.text : JSON.stringify(signup.body);
        const ok = signup.ok ?? true;
        return {
          ok,
          status: signup.status ?? (ok ? 200 : 500),
          statusText: ok ? 'OK' : 'Internal Server Error',
          text: async () => text,
        };
      }
      if (url.includes('/resources/legal/')) {
        return { ok: true, json: async () => ({ available: false, slug: 'x' }) };
      }
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({ path: location.pathname, state: location.state ?? null })}
    </output>
  );
}

async function renderSignup(design: Design) {
  state.design = design;
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<p>Verify email page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  return screen.findByRole('button', { name: /create account/i });
}

const VALID = {
  'First Name': '  Thandi ',
  Surname: ' van der Merwe ',
  'Email Address': 'thandi@example.com',
  'Cellphone Number': ' 82 000 0000 ',
  Password: 'Tropical#Sun88',
  'Confirm Password': 'Tropical#Sun88',
};

function fill(values: Partial<Record<keyof typeof VALID, string>> = {}) {
  for (const [label, value] of Object.entries({ ...VALID, ...values })) {
    fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { value } });
  }
}

function submitButton() {
  return screen.getByRole('button', {
    name: /create account|creating account/i,
  }) as HTMLButtonElement;
}

async function submit(values: Partial<Record<keyof typeof VALID, string>> = {}) {
  fill(values);
  await act(async () => {
    fireEvent.click(submitButton());
  });
}

/** Picks a dialling code the way each design offers it. */
async function chooseCountry(name: string) {
  const trigger =
    screen.queryByRole('combobox', { name: 'Select country code' }) ??
    screen.getByRole('button', { name: /^Country code:/ });
  await act(async () => {
    fireEvent.click(trigger);
  });
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^.*${name}`) }));
  });
}

function outcome() {
  const errors = screen.queryAllByRole('alert').map((el) => el.textContent?.trim() ?? '');
  return {
    error: errors.find((t) => !t.startsWith('Development Mode') && !t.startsWith('Thanks')) ?? null,
    success: screen.queryByText(/^Thanks — check your email to continue/)?.textContent ?? null,
    location: JSON.parse(screen.getByTestId('location').textContent!),
  };
}

async function run(design: Design, scenario: () => Promise<void>, reply?: Reply) {
  cleanup();
  state.calls = [];
  serve(reply);
  await renderSignup(design);
  // Each half of the comparison really is its own design.
  expect(document.querySelector('.nwsu') !== null).toBe(design === 'navigator');
  await scenario();
  await act(async () => {});
  return { calls: state.calls, ...outcome() };
}

async function both(scenario: () => Promise<void>, reply?: Reply) {
  const legacy = await run('legacy', scenario, reply);
  const navigator = await run('navigator', scenario, reply);
  expect(navigator).toEqual(legacy);
  return navigator;
}

/** What SignupPage's flow sends for VALID. */
const signupRequest = (countryCode = '+27') => [
  'fetch',
  SIGNUP_URL,
  'POST',
  { 'content-type': 'application/json', authorization: 'Bearer anon' },
  {
    email: 'thandi@example.com',
    password: 'Tropical#Sun88',
    firstName: 'Thandi',
    surname: 'van der Merwe',
    countryCode,
    phoneNumber: '82 000 0000',
  },
];

const VERIFY_EMAIL = {
  path: '/verify-email',
  state: { email: 'thandi@example.com', message: 'Please check your email to continue.' },
};

beforeEach(() => {
  state.design = 'navigator';
  state.standalone = false;
  state.calls = [];
  serve();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Navigator sign-up page: the same account creation as the live page', () => {
  it('sends the live request and hands off to /verify-email after the live pause', async () => {
    const result = await both(async () => {
      await submit();
      await screen.findByText('Thanks — check your email to continue. Redirecting...');
      await screen.findByText('Verify email page', undefined, { timeout: 3000 });
    });
    expect(result.calls).toEqual([signupRequest()]);
    expect(result.location).toEqual(VERIFY_EMAIL);
    expect(result.error).toBeNull();
  });

  it('sends the dialling code picked from the same list', async () => {
    const result = await both(async () => {
      await chooseCountry('Botswana');
      await submit();
      await screen.findByText('Thanks — check your email to continue. Redirecting...');
    });
    expect(result.calls).toEqual([signupRequest('+267')]);
  });

  it('"already registered" reads exactly like success, so the form is no enumeration oracle', async () => {
    const result = await both(
      async () => {
        await submit();
        await screen.findByText('Thanks — check your email to continue.');
        await screen.findByText('Verify email page', undefined, { timeout: 3000 });
      },
      { ok: false, status: 400, body: { error: 'User already registered' } },
    );
    expect(result.calls).toEqual([signupRequest()]);
    expect(result.error).toBeNull();
    expect(result.location).toEqual(VERIFY_EMAIL);
  });

  it('a password the server refuses gets the live message, in the form and a toast', async () => {
    const message = 'Password does not meet requirements. Please try a different password.';
    const result = await both(
      async () => {
        await submit();
        await screen.findByText(message);
      },
      { ok: false, status: 400, body: { error: 'Weak password: too common' } },
    );
    expect(result.calls).toEqual([signupRequest(), ['toast.error', message]]);
    expect(result.error).toBe(message);
    expect(result.location.path).toBe('/signup');
  });

  it.each([
    ['a server error', { ok: false, status: 500, body: { error: 'Database unavailable' } }],
    ['an unsuccessful reply', { ok: true, body: { success: false } }],
    ['a reply that is not JSON', { text: '<html>Bad gateway</html>', ok: false, status: 502 }],
    ['a network failure', 'network'],
  ] as const)('%s is worded as the live page words it', async (_label, reply) => {
    const result = await both(async () => {
      await submit();
      await waitFor(() => expect(outcome().error).toBeTruthy());
    }, reply as Reply);
    expect(result.calls[0]).toEqual(signupRequest());
    expect(result.error).toBeTruthy();
    expect(result.calls[1]).toEqual(['toast.error', result.error]);
    expect(result.location.path).toBe('/signup');
  });

  it('a server error message goes through getUserErrorMessage, as on the live page', async () => {
    const result = await both(
      async () => {
        await submit();
        await waitFor(() => expect(outcome().error).toBeTruthy());
      },
      { ok: false, status: 500, body: { error: 'Database unavailable' } },
    );
    expect(result.error).toBe(getUserErrorMessage('Database unavailable'));
  });

  it('an email without a domain ending is refused before anything is sent', async () => {
    const result = await both(() => submit({ 'Email Address': 'thandi@example' }));
    expect(result.calls).toEqual([]);
    expect(result.error).toBe('Please enter a valid email address');
  });

  it.each([
    ['nothing filled in', {}, true],
    ['a password that fails the rules', { Password: 'short', 'Confirm Password': 'short' }, true],
    ['passwords that differ', { 'Confirm Password': 'Tropical#Sun89' }, true],
    ['no cellphone', { 'Cellphone Number': '  ' }, true],
    ['every field filled and the password passing', null, false],
  ] as const)(
    'with %s, the submit button waits exactly as it does live',
    async (_l, values, disabled) => {
      for (const design of ['legacy', 'navigator'] as const) {
        cleanup();
        await renderSignup(design);
        if (values !== null && Object.keys(values).length === 0) {
          expect(submitButton().disabled).toBe(disabled);
          continue;
        }
        fill(values ?? {});
        expect(submitButton().disabled).toBe(disabled);
      }
    },
  );

  it.each([
    ['Terms of Service', 'terms-of-use'],
    ['Privacy Policy', 'privacy-notice'],
  ])('%s opens the same document viewer request', async (label, slug) => {
    const result = await both(async () => {
      await act(async () => {
        // A button on the legacy page, a link to the document on the redesign.
        fireEvent.click(
          screen.queryByRole('button', { name: label }) ??
            screen.getByRole('link', { name: label }),
        );
      });
      await waitFor(() => expect(state.calls.some((c) => c[0] === 'toast.info')).toBe(true));
    });
    expect(result.calls[0]).toEqual([
      'fetch',
      `${FN}/resources/legal/${slug}`,
      'GET',
      { authorization: 'Bearer anon' },
      null,
    ]);
  });
});

describe('Navigator sign-up page: the board', () => {
  it("has one H1, the board's, and the brand panel's headings after it", async () => {
    await renderSignup('navigator');
    const headings = screen.getAllByRole('heading').map((h) => [h.tagName, h.textContent]);
    expect(headings).toEqual([
      ['H1', 'Create your account'],
      ['H2', 'Start your wealth journey today.'],
      ...SIGNUP_BRAND_FEATURES.map((f) => ['H3', f.title]),
    ]);
    expect(screen.getByRole('group', { name: 'Personal Details' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Create Password' })).toBeDefined();
  });

  it('uses the live wording for the headline, line and consent', () => {
    const live = read('../../components/pages/SignupPage.tsx');
    for (const text of [
      'Start your wealth journey today.',
      'Create your account to begin your personalised financial plan with Navigate Wealth.',
      'Enter your details to start your wealth journey.',
      'Your data is protected under POPIA.',
    ]) {
      expect(live).toContain(text);
    }
  });

  it('links to the legal documents and the log-in page as real links', async () => {
    await renderSignup('navigator');
    expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe(
      '/legal/terms-of-use',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/legal/privacy-notice',
    );
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
  });

  it('a new-tab click on a legal link goes to the page, not the viewer', async () => {
    await renderSignup('navigator');
    const link = screen.getByRole('link', { name: 'Terms of Service' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(state.calls).toEqual([]);
  });

  it('labels every control with the live names and autocomplete hints', async () => {
    await renderSignup('navigator');
    const byLabel = (label: string) => screen.getByLabelText(label, { selector: 'input' });
    expect(byLabel('First Name').getAttribute('name')).toBe('firstName');
    expect(byLabel('Surname').getAttribute('name')).toBe('surname');
    expect(byLabel('Email Address').getAttribute('autocomplete')).toBe('email');
    expect(byLabel('Cellphone Number').getAttribute('type')).toBe('tel');
    expect(byLabel('Password').getAttribute('autocomplete')).toBe('new-password');
    expect(byLabel('Confirm Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByRole('button', { name: 'Country code: South Africa +27' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show password confirmation' }));
    expect(byLabel('Confirm Password').getAttribute('type')).toBe('text');
  });

  it('shows the strength panel on focus, reading validatePassword', async () => {
    await renderSignup('navigator');
    const password = screen.getByLabelText('Password', { selector: 'input' });
    expect(document.getElementById('nwsu-password-requirements')).toBeNull();
    fireEvent.focus(password);
    const panel = () => document.getElementById('nwsu-password-requirements')!;
    expect(within(panel()).getByText('Not set')).toBeDefined();
    expect(password.getAttribute('aria-describedby')).toBe('nwsu-password-requirements');

    // "Abcxyz": short, two kinds, and a sequence the live rules refuse.
    fireEvent.change(password, { target: { value: 'Abcxyz' } });
    expect(panel().dataset.tone).toBe('weak');
    expect(within(panel()).getByText('Weak')).toBeDefined();
    expect(panel().querySelectorAll('[data-ok="true"]')).toHaveLength(0);

    fireEvent.change(password, { target: { value: 'Tropical#Sun88' } });
    expect(within(panel()).getByText('Very Strong')).toBeDefined();
    expect(panel().querySelectorAll('[data-ok="true"]')).toHaveLength(3);
    expect(panel().querySelectorAll('[data-on="true"]')).toHaveLength(4);
  });

  it('says whether the passwords match, as the live page does', async () => {
    await renderSignup('navigator');
    fill({ 'Confirm Password': 'Tropical#Sun8' });
    expect(screen.getByText('Passwords do not match')).toBeDefined();
    fill();
    expect(screen.getByText('Passwords match')).toBeDefined();
  });

  it('marks a refused email invalid and moves focus to it', async () => {
    await renderSignup('navigator');
    await submit({ 'Email Address': 'thandi@example' });
    const email = screen.getByLabelText('Email Address', { selector: 'input' });
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email);
    expect(email.getAttribute('aria-describedby')).toBe('nwsu-error');
  });

  it('the error closes, as on the live page', async () => {
    await renderSignup('navigator');
    await submit({ 'Email Address': 'thandi@example' });
    fireEvent.click(screen.getByRole('button', { name: 'Close error message' }));
    expect(screen.queryByText('Please enter a valid email address')).toBeNull();
  });

  it('waits with the live wording and holds the fields while creating the account', async () => {
    cleanup();
    serve('hang');
    await renderSignup('navigator');
    await submit();
    expect(screen.getByRole('button', { name: /creating account/i })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByLabelText('First Name', { selector: 'input' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('puts the success message in a polite region', async () => {
    await renderSignup('navigator');
    await submit();
    const success = await screen.findByText(
      'Thanks — check your email to continue. Redirecting...',
    );
    expect(success.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('the installed PWA keeps its app shell whichever design is live', async () => {
    state.standalone = true;
    await renderSignup('navigator');
    expect(screen.getByRole('heading', { name: 'Create your account' }).tagName).toBe('H2');
    expect(document.querySelector('.nwsu')).toBeNull();
  });

  it("reaches account creation only through useSignupForm, the live page's hook", () => {
    for (const file of ['../pages/NavigatorSignupPage.tsx', '../sections/SignupForm.tsx']) {
      expect(read(file)).not.toMatch(/\bfetch\(|publicAnonKey|supabase\.co/);
    }
    expect(read('../pages/NavigatorSignupPage.tsx')).toContain('useSignupForm()');
    expect(read('../../components/pages/SignupPage.tsx')).toContain('useSignupForm()');
  });
});
