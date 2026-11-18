/**
 * The Navigator forgot-password page requests the reset link exactly as the
 * live page does (useForgotPasswordForm → sendPasswordResetEmail with the
 * address as typed), validates the same way, and keeps the live page's two
 * states and links. Focus follows the swap between the states.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const sendPasswordResetEmail = vi.fn();
vi.mock('../../utils/auth/authService', () => ({
  sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
}));
const standalone = { value: false };
vi.mock('../../hooks/useIsStandalone', () => ({ useIsStandalone: () => standalone.value }));

const { NavigatorForgotPasswordPage } = await import('../pages/NavigatorForgotPasswordPage');
const { ForgotPasswordPage } = await import('../../components/pages/ForgotPasswordPage');
const { getUserErrorMessage } = await import('../../utils/errorUtils');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <NavigatorForgotPasswordPage />
    </MemoryRouter>,
  );
}

async function request(email: string) {
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: email } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
  });
}

const hrefs = () => new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? ''));

beforeEach(() => {
  vi.clearAllMocks();
  standalone.value = false;
  sendPasswordResetEmail.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe('Navigator forgot password', () => {
  it('is what /forgot-password serves when the design switch is on', async () => {
    const { ForgotPasswordPage: Routed } = await import('../../app/publicPages');
    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Suspense fallback={null}>
          <Routed />
        </Suspense>
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe(
      'Reset your password',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('links where the live page links or navigates (/signup, and /login as a link)', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    const live = hrefs();
    cleanup();
    renderPage();
    const navigator = hrefs();
    for (const href of live) expect(navigator.has(href)).toBe(true);
    expect(navigator).toEqual(new Set(['/login', '/signup']));
  });

  it.each([
    ['', 'Please enter your email address.'],
    ['owner@example', 'Please enter a valid email address.'],
  ])('flags "%s" on the field, focuses it and sends nothing', async (value, message) => {
    renderPage();
    await request(value);
    const email = screen.getByLabelText('Email Address');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(email.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      message,
    );
    expect(document.activeElement).toBe(email);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends the link to the address, confirms it, and comes back with the address kept', async () => {
    renderPage();
    await request('owner@example.com');
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('owner@example.com');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Check Your Email' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('owner@example.com').tagName).toBe('STRONG');
    expect(screen.getByText('Reset link sent')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Send Another Link' }));
    const email = screen.getByLabelText('Email Address') as HTMLInputElement;
    expect(email.value).toBe('owner@example.com');
    expect(document.activeElement).toBe(email);
  });

  it('shows a failed request as a form alert with the live message', async () => {
    const failure = new Error('Email rate limit exceeded');
    sendPasswordResetEmail.mockRejectedValue(failure);
    renderPage();
    await request('owner@example.com');
    expect((await screen.findByRole('alert')).textContent).toBe(getUserErrorMessage(failure));
    expect(screen.getByLabelText('Email Address').getAttribute('aria-invalid')).toBeNull();
  });

  it('uses the app frame in the installed app', () => {
    standalone.value = true;
    renderPage();
    expect(document.querySelector('.nwac-app')).not.toBeNull();
    expect(screen.getByText('Client Portal')).toBeTruthy();
  });
});
