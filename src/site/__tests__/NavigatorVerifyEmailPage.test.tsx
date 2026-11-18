/**
 * The Navigator verify-email page runs the live page's flow
 * (useVerifyEmailFlow): the address from signup, the resend that is the
 * recovery path when the first mail never left, and the redirect for an
 * already-verified session. Mirrors src/components/pages/__tests__/
 * VerifyEmailPage.test.tsx against the new markup, plus links and headings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const resendVerificationEmail = vi.fn();
const getSession = vi.fn();
const getCurrentUser = vi.fn();
vi.mock('../../utils/auth', () => ({
  resendVerificationEmail: (...a: unknown[]) => resendVerificationEmail(...a),
  getCurrentUser: (...a: unknown[]) => getCurrentUser(...a),
  getSupabaseClient: () => ({ auth: { getSession } }),
}));

const navigate = vi.fn();
const mockLocation = { state: { email: 'thandi@example.com' } as { email?: string } | null };
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
  useLocation: () => mockLocation,
}));

const { NavigatorVerifyEmailPage } = await import('../pages/NavigatorVerifyEmailPage');
const { VerifyEmailPage } = await import('../../components/pages/VerifyEmailPage');

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/verify-email']}>
      <NavigatorVerifyEmailPage />
    </MemoryRouter>,
  );
}

const hrefs = () => new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? ''));

async function clickResend() {
  const button = await screen.findByRole('button', { name: /resend verification email/i });
  await act(async () => {
    fireEvent.click(button);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resendVerificationEmail.mockResolvedValue(undefined);
  getSession.mockResolvedValue({ data: { session: null } });
  getCurrentUser.mockResolvedValue(null);
  mockLocation.state = { email: 'thandi@example.com' };
});
afterEach(() => cleanup());

describe('Navigator verify email', () => {
  it('is what /verify-email serves when the design switch is on', async () => {
    const { VerifyEmailPage: Routed } = await import('../../app/publicPages');
    render(
      <MemoryRouter initialEntries={['/verify-email']}>
        <Suspense fallback={null}>
          <Routed />
        </Suspense>
      </MemoryRouter>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Check Your Email');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the live links: home, support mail, and sign-in as a link', async () => {
    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>,
    );
    const live = hrefs();
    cleanup();
    renderPage();
    await screen.findByText('thandi@example.com');
    const navigator = hrefs();
    for (const href of live) expect(navigator.has(href)).toBe(true);
    expect(navigator).toEqual(new Set(['/', 'mailto:info@navigatewealth.co', '/login']));
  });

  it('shows the address and where this step sits in setting up', async () => {
    renderPage();
    await screen.findByText('thandi@example.com');
    const steps = screen.getByRole('list', { name: 'Account setup progress' });
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toContain('Verify email');
  });

  it('resends to the address from signup and confirms it', async () => {
    renderPage();
    await screen.findByText('thandi@example.com');
    await clickResend();
    expect(resendVerificationEmail).toHaveBeenCalledWith('thandi@example.com');
    expect((await screen.findByRole('status')).textContent).toContain(
      'Verification email sent. Check your inbox, and your spam folder.',
    );
  });

  it('surfaces a failed resend as an alert', async () => {
    resendVerificationEmail.mockRejectedValue(new Error('Rate limit exceeded'));
    renderPage();
    await screen.findByText('thandi@example.com');
    await clickResend();
    expect((await screen.findByRole('alert')).textContent).toContain('Rate limit exceeded');
  });

  it('does not call the service when no address is known', async () => {
    mockLocation.state = null;
    renderPage();
    await screen.findByText('your email address');
    await clickResend();
    expect(resendVerificationEmail).not.toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Enter your email on the sign-in page to resend the link.',
    );
  });

  it('an already-verified session is told so and sent to the dashboard', async () => {
    getSession.mockResolvedValue({ data: { session: { user: {} } } });
    getCurrentUser.mockResolvedValue({ email: 'thandi@example.com', emailConfirmed: true });
    renderPage();
    expect((await screen.findByRole('status')).textContent).toContain(
      'Email already verified! Redirecting to dashboard...',
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'), { timeout: 3500 });
  });
});
