/**
 * Signer token address-bar handling — SECURITY-AUDIT S8 regression guard
 * ======================================================================
 *
 * The signer access token arrives as `/sign?token=<uuid>` and IS the
 * credential: presenting it is what authenticates a third-party signer to a
 * document. Left in the address bar it reaches browser history, the `Referer`
 * header of any outbound link, and anything that reads `location.href`.
 *
 * The risk in fixing this is the fix itself. The component reads the token on
 * mount and then uses it for OTP, KBA, submission and rejection; if clearing
 * the URL also cleared the value the component works from, a valid signer would
 * be bounced to the "expired" screen — a self-inflicted outage on the signing
 * path. Both properties are asserted here: the token LEAVES the URL, and the
 * component KEEPS working.
 *
 * Run: npx vitest run src/components/esign-signer/__tests__/SignerLandingPage.token.test.tsx
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const TOKEN = '3f0c8b6e-1a2d-4c5b-9e7f-0a1b2c3d4e5f';

let searchParams = new URLSearchParams(`token=${TOKEN}`);

vi.mock('react-router', () => ({
  useSearchParams: () => [searchParams, vi.fn()],
  useNavigate: () => vi.fn(),
}));

vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: { children?: React.ReactNode } & Record<string, unknown>) =>
        React.createElement('div', props, props.children),
    },
  ),
}));

vi.mock('../SigningWorkflow', () => ({ SigningWorkflow: () => null }));
vi.mock('../SigningCompletePage', () => ({ SigningCompletePage: () => null }));
vi.mock('../OtpVerificationStep', () => ({ OtpVerificationStep: () => null }));
vi.mock('../KbaVerificationStep', () => ({ KbaVerificationStep: () => null }));

/** Records the token the component actually authenticated with. */
const validateToken = vi.fn(async (token: string) => ({
  success: true,
  data: {
    envelope_id: 'env-1',
    envelope_title: 'Test Envelope',
    envelope_status: 'sent',
    signer_status: 'pending',
    is_turn: true,
    otp_required: false,
    page_count: 1,
    signer_email: 'signer@example.com',
    _tokenSeen: token,
  },
}));

vi.mock('../../esign-signer/hooks/useSignerSession', () => ({
  useSignerSession: () => ({
    sessionData: null,
    loading: false,
    error: null,
    validateToken,
    verifyOtp: vi.fn(),
    verifyKba: vi.fn(),
    submitSignature: vi.fn(),
    rejectDocument: vi.fn(),
    resendOtp: vi.fn(),
  }),
}));

import { SignerLandingPage } from '../SignerLandingPage';

beforeEach(() => {
  searchParams = new URLSearchParams(`token=${TOKEN}`);
  window.history.replaceState({}, '', `/sign?token=${TOKEN}`);
  validateToken.mockClear();
});

afterEach(cleanup);

describe('signer token in the address bar', () => {
  it('clears the token from the URL after reading it', async () => {
    render(<SignerLandingPage />);

    await waitFor(() => {
      expect(window.location.search).not.toContain(TOKEN);
    });
    expect(window.location.pathname).toBe('/sign');
  });

  it('still authenticates with the captured token', async () => {
    // The failure mode this guards: scrubbing the URL before the component has
    // a stable copy would send `null` here and expire a valid signing session.
    render(<SignerLandingPage />);

    await waitFor(() => expect(validateToken).toHaveBeenCalled());
    expect(validateToken).toHaveBeenCalledWith(TOKEN);
  });

  it('preserves any other query parameters on the signing link', async () => {
    searchParams = new URLSearchParams(`token=${TOKEN}&lang=en`);
    window.history.replaceState({}, '', `/sign?token=${TOKEN}&lang=en`);

    render(<SignerLandingPage />);

    await waitFor(() => expect(window.location.search).not.toContain(TOKEN));
    expect(window.location.search).toContain('lang=en');
  });

  it('does not rewrite the URL when there is no token to remove', async () => {
    searchParams = new URLSearchParams();
    window.history.replaceState({}, '', '/sign');

    render(<SignerLandingPage />);

    await waitFor(() => expect(window.location.pathname).toBe('/sign'));
    expect(validateToken).not.toHaveBeenCalled();
  });
});
