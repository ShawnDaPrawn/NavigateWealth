/**
 * The Navigator reset-password page establishes the recovery session and sets
 * the password exactly as the live page does (useResetPasswordFlow): PKCE code
 * exchange, implicit-flow tokens, or the existing session; updatePassword with
 * the new password; /login afterwards, /admin for invited staff. Expired and
 * failed links land on the expired state with the live recovery links.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const updatePassword = vi.fn();
vi.mock('../../utils/auth/authService', () => ({
  updatePassword: (...a: unknown[]) => updatePassword(...a),
}));

const getSession = vi.fn();
const exchangeCodeForSession = vi.fn();
const setSession = vi.fn();
vi.mock('../../utils/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: { getSession, exchangeCodeForSession, setSession } }),
}));
vi.mock('../../hooks/useIsStandalone', () => ({ useIsStandalone: () => false }));

const { NavigatorResetPasswordPage } = await import('../pages/NavigatorResetPasswordPage');

const PW = 'Zebra!Quiet7Lamp';
const session = (invited = false) => ({
  data: { session: { user: { user_metadata: invited ? { invited: true } : {} } } },
  error: null,
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <NavigatorResetPasswordPage />
    </MemoryRouter>,
  );
}

async function setPassword(password = PW, confirm = PW) {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: confirm } });
}

const hrefs = () => new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? ''));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/reset-password');
  getSession.mockResolvedValue(session());
  updatePassword.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('Navigator reset password', () => {
  it('is what /reset-password serves when the design switch is on', async () => {
    const { ResetPasswordPage } = await import('../../app/publicPages');
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Suspense fallback={null}>
          <ResetPasswordPage />
        </Suspense>
      </MemoryRouter>,
    );
    expect(
      (await screen.findByRole('heading', { level: 1, name: 'Set new password' })).textContent,
    ).toBe('Set new password');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('announces the link check while it runs', () => {
    getSession.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status', { name: 'Verifying reset link' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets the password with updatePassword and returns to /login', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Set new password' });
    const input = screen.getByLabelText('New Password');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('Confirm New Password').getAttribute('autocomplete')).toBe(
      'new-password',
    );
    const button = screen.getByRole('button', { name: 'Reset password' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await setPassword();
    expect(button.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(updatePassword).toHaveBeenCalledWith(PW);
    expect((await screen.findByRole('status')).textContent).toContain(
      'Password reset successfully! Redirecting to sign in...',
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'), { timeout: 3500 });
  });

  it('an invited member of staff sets up the account and goes to /admin', async () => {
    getSession.mockResolvedValue(session(true));
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Set up your account' });
    await setPassword();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    });
    expect(updatePassword).toHaveBeenCalledWith(PW);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin'), { timeout: 3500 });
  });

  it('exchanges a PKCE code for the recovery session', async () => {
    window.history.replaceState(null, '', '/reset-password?code=abc');
    exchangeCodeForSession.mockResolvedValue(session());
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Set new password' });
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('shows the live checklist and a failed update as a form alert', async () => {
    updatePassword.mockRejectedValue(new Error('New password should be different'));
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Set new password' });
    expect(screen.getByText('Password must have:')).toBeTruthy();
    expect(
      screen.getByText('At least 3 of: uppercase, lowercase, numbers, special characters'),
    ).toBeTruthy();
    await setPassword();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('an error in the link lands on the expired state with the live recovery links', async () => {
    window.history.replaceState(
      null,
      '',
      '/reset-password#error=access_denied&error_description=Email+link+is+invalid',
    );
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Reset Link Expired' });
    expect(getSession).not.toHaveBeenCalled();
    expect(hrefs()).toEqual(new Set(['/', '/forgot-password', '/login', '/contact']));
  });

  it('no session after the retries means expired', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Reset Link Expired' }, { timeout: 3000 });
    expect(getSession).toHaveBeenCalledTimes(4);
  });
});
