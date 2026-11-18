/**
 * The Navigator signup page must create accounts exactly as the live page
 * does: the same request (URL, method, headers, body — compared byte for byte
 * with the live page filling the same form), the same password rules, the same
 * non-enumerating answer for an address that already has an account, and the
 * same hand-over to /verify-email. Plus what the redesign adds: a search-led
 * H1, field-level validation with focus, and real links to the Terms and the
 * Privacy Notice that still open the in-page viewer on a plain click.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../hooks/useIsStandalone', () => ({ useIsStandalone: () => false }));
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), info: vi.fn() },
}));

const { validatePassword } = await import('../../utils/auth/passwordValidation');
const { NavigatorSignupPage } = await import('../pages/NavigatorSignupPage');
const { SignupPage } = await import('../../components/pages/SignupPage');

const PW = 'Zebra!Quiet7Lamp';
const ENDPOINT = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/auth-signup/signup';

function respond(body: unknown, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    text: async () => JSON.stringify(body),
    json: async () => body,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderNavigator() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <NavigatorSignupPage />
    </MemoryRouter>,
  );
}

function fill({ email = 'thandi@example.com', password = PW, confirm = PW } = {}) {
  const set = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  set('First Name', '  Thandi ');
  set('Surname', ' Mokoena ');
  set('Email Address', email);
  set('Cellphone Number', ' 82 123 4567 ');
  set('Password', password);
  set('Confirm Password', confirm);
}

const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  });
};

const hrefs = () => new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? ''));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Navigator signup — page', () => {
  it('is what /signup serves when the design switch is on, with one search-led H1', async () => {
    const { SignupPage: Routed } = await import('../../app/publicPages');
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <Suspense fallback={null}>
          <Routed />
        </Suspense>
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Create your Navigate Wealth account');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps every live link and makes the Terms and Privacy Notice real links', () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    const live = hrefs();
    cleanup();
    renderNavigator();
    const navigator = hrefs();
    for (const href of live) expect(navigator.has(href)).toBe(true);
    expect(navigator).toEqual(new Set(['/login', '/legal/terms-of-use', '/legal/privacy-notice']));
  });

  it('labels and autocompletes every field', () => {
    renderNavigator();
    const ac = (label: string) => screen.getByLabelText(label).getAttribute('autocomplete');
    expect(ac('First Name')).toBe('given-name');
    expect(ac('Surname')).toBe('family-name');
    expect(ac('Email Address')).toBe('email');
    expect(ac('Cellphone Number')).toBe('tel-national');
    expect(ac('Password')).toBe('new-password');
    expect(ac('Confirm Password')).toBe('new-password');
    expect(screen.getByRole('combobox', { name: 'Select country code' })).toBeTruthy();
  });

  it('keeps submit disabled until the form is complete and the rules pass', () => {
    renderNavigator();
    const button = () => screen.getByRole('button', { name: /create account/i });
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    fill({ confirm: 'something-else' });
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: PW } });
    expect(screen.getByText('Passwords match')).toBeTruthy();
    expect((button() as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the live strength meter and checklist, driven by validatePassword', () => {
    expect(validatePassword(PW).isValid).toBe(true);
    renderNavigator();
    const password = screen.getByLabelText('Password');
    fireEvent.focus(password);
    expect(screen.getByText('Password Strength')).toBeTruthy();
    expect(screen.getByText('At least 12 characters').closest('li')?.className).not.toContain(
      'is-met',
    );
    fireEvent.change(password, { target: { value: PW } });
    for (const rule of [
      'At least 12 characters',
      'Mix of uppercase, lowercase, numbers & symbols',
      'Not a common or predictable password',
    ]) {
      expect(screen.getByText(rule).closest('li')?.className).toContain('is-met');
    }
    expect(password.getAttribute('aria-describedby')).toContain('nwac-su-requirements');
  });
});

describe('Navigator signup — the request', () => {
  it('sends byte-for-byte what the live page sends, to the same endpoint', async () => {
    const fetchMock = respond({ success: true });

    renderNavigator();
    fill();
    await submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    cleanup();

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    fill();
    await submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [navigatorCall, liveCall] = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    expect(navigatorCall[0]).toBe(ENDPOINT);
    expect(navigatorCall[0]).toBe(liveCall[0]);
    expect(navigatorCall[1]).toEqual(liveCall[1]);
    expect(navigatorCall[1].body).toBe(liveCall[1].body);
    expect(navigatorCall[1].method).toBe('POST');
    expect(navigatorCall[1].headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer anon',
    });
    expect(JSON.parse(String(navigatorCall[1].body))).toEqual({
      email: 'thandi@example.com',
      password: PW,
      firstName: 'Thandi',
      surname: 'Mokoena',
      countryCode: '+27',
      phoneNumber: '82 123 4567',
    });
  });

  it('confirms without saying whether the account is new, then goes to /verify-email', async () => {
    respond({ success: true });
    renderNavigator();
    fill();
    await submit();
    expect((await screen.findByRole('status')).textContent).toContain(
      'Thanks — check your email to continue. Redirecting...',
    );
    await waitFor(
      () =>
        expect(navigate).toHaveBeenCalledWith('/verify-email', {
          state: { email: 'thandi@example.com', message: 'Please check your email to continue.' },
        }),
      { timeout: 3000 },
    );
  });

  it('answers "already registered" the same way, so the form is no enumeration oracle', async () => {
    respond({ error: 'User already registered' }, { ok: false, status: 400 });
    renderNavigator();
    fill();
    await submit();
    expect((await screen.findByRole('status')).textContent).toContain(
      'Thanks — check your email to continue.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/already registered/i)).toBeNull();
  });

  it('shows a server failure as a dismissible alert and a toast', async () => {
    respond({ error: 'Signup is unavailable' }, { ok: false, status: 500 });
    renderNavigator();
    fill();
    await submit();
    const alert = await screen.findByRole('alert');
    expect(toastError).toHaveBeenCalledWith(alert.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Close error message' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('flags an invalid address on its field, focuses it and sends nothing', async () => {
    const fetchMock = respond({ success: true });
    renderNavigator();
    fill({ email: 'thandi@example' });
    await submit();
    const email = screen.getByLabelText('Email Address');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(email.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Please enter a valid email address',
    );
    expect(document.activeElement).toBe(email);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens the Terms in the in-page viewer on a plain click, keeping the form', async () => {
    const fetchMock = respond({ available: false });
    renderNavigator();
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Thandi' } });
    const terms = screen.getByRole('link', { name: 'Terms of Service' });
    expect(terms.getAttribute('href')).toBe('/legal/terms-of-use');
    await act(async () => {
      fireEvent.click(terms);
    });
    expect(String((fetchMock.mock.calls as unknown as Array<[string]>)[0]?.[0])).toContain(
      '/resources/legal/terms-of-use',
    );
    expect((screen.getByLabelText('First Name') as HTMLInputElement).value).toBe('Thandi');
  });
});
