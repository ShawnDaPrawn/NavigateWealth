/**
 * VerifyEmailPage — the resend path is the recovery route, not a convenience.
 * ==========================================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Signup creates an unconfirmed account (`email_confirm: false` in
 * auth-signup.ts), so the emailed link is the only thing that lets the new
 * account sign in. If that first send fails — SMTP hiccup, provider throttle —
 * the person lands on this page reading "check your email" for a message that
 * never left, and without a resend here they are stuck until a super-admin
 * intervenes.
 *
 * LoginPage.tsx has a resend button too, but it cannot be relied on: it renders
 * only when the sign-in error text contains "verify your email", which requires
 * Supabase to answer `Email not confirmed`. For an account created through
 * `admin.createUser` it can answer `Invalid login credentials` instead, which
 * errorHandler.ts maps to invalid_credentials — no button. That is precisely
 * the gap these tests close, so they assert the button exists here and actually
 * calls the resend service, not merely that the page renders.
 *
 * Run: npx vitest run src/components/pages/__tests__/VerifyEmailPage.test.tsx
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const resendVerificationEmail = vi.fn();
const getSession = vi.fn();

vi.mock('../../../utils/auth', () => ({
  resendVerificationEmail: (...args: unknown[]) => resendVerificationEmail(...args),
  getCurrentUser: vi.fn(async () => null),
  getSupabaseClient: () => ({ auth: { getSession } }),
}));

const mockLocation = { state: { email: 'thandi@example.com' } as { email?: string } | null };
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => mockLocation,
    Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

import { VerifyEmailPage } from '../VerifyEmailPage';

beforeEach(() => {
  resendVerificationEmail.mockReset();
  resendVerificationEmail.mockResolvedValue(undefined);
  getSession.mockReset();
  // No session: the signup flow arrives here unauthenticated, carrying the
  // address in router state.
  getSession.mockResolvedValue({ data: { session: null } });
  mockLocation.state = { email: 'thandi@example.com' };
});

describe('VerifyEmailPage', () => {
  it('renders the address the link was sent to', async () => {
    render(<VerifyEmailPage />);
    await waitFor(() => expect(screen.getByText('thandi@example.com')).toBeDefined());
  });

  it('offers a resend button — the recovery path when the first send failed', async () => {
    render(<VerifyEmailPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /resend verification email/i })).toBeDefined(),
    );
  });

  it('resends to the address from signup', async () => {
    render(<VerifyEmailPage />);
    // The address arrives from an async effect; clicking before it lands takes
    // the "no email" branch and never calls the resend. Wait for it first.
    await screen.findByText('thandi@example.com');
    const button = await screen.findByRole('button', { name: /resend verification email/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(resendVerificationEmail).toHaveBeenCalledWith('thandi@example.com'));
  });

  it('confirms the resend so the person knows to look again', async () => {
    render(<VerifyEmailPage />);
    // The address arrives from an async effect; clicking before it lands takes
    // the "no email" branch and never calls the resend. Wait for it first.
    await screen.findByText('thandi@example.com');
    const button = await screen.findByRole('button', { name: /resend verification email/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(screen.getByText(/verification email sent/i)).toBeDefined());
  });

  it('surfaces a failed resend instead of silently doing nothing', async () => {
    // A resend that fails silently is the same dead end as the original failed
    // send, one click further along.
    resendVerificationEmail.mockRejectedValue(new Error('Rate limit exceeded'));
    render(<VerifyEmailPage />);
    // The address arrives from an async effect; clicking before it lands takes
    // the "no email" branch and never calls the resend. Wait for it first.
    await screen.findByText('thandi@example.com');
    const button = await screen.findByRole('button', { name: /resend verification email/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => expect(screen.getByText(/rate limit exceeded/i)).toBeDefined());
  });

  it('does not call the service when no address is known', async () => {
    // Reached by opening /verify-email directly, with no router state and no
    // session. Sending to an empty string would be a confusing failure.
    mockLocation.state = null;
    render(<VerifyEmailPage />);
    const button = await screen.findByRole('button', { name: /resend verification email/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(resendVerificationEmail).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/enter your email/i)).toBeDefined());
  });
});
