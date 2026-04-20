/**
 * P8.8 — Accessibility regression tests for the signer landing page.
 *
 * These tests render the standalone, public-facing signer page in each of
 * its non-interactive visual states (loading, expired, rejected, waiting)
 * and run axe-core against the resulting DOM. We focus on these states
 * because:
 *  1. They are the routes a brand-new signer is most likely to land on.
 *  2. They render synchronously without depending on pdf.js / canvas /
 *     network — so axe can audit a stable, deterministic snapshot.
 *  3. The interactive `signing` step is exercised in the Playwright E2E
 *     suite (P8.9), which validates real keyboard + screen-reader paths.
 *
 * We mock the session hook + react-router primitives so the component can
 * mount inside Vitest's jsdom environment without a router or live API.
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';

// ── react-router stub ────────────────────────────────────────────────────
const navigateMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('react-router', () => ({
  useSearchParams: () => [searchParams, vi.fn()],
  useNavigate: () => navigateMock,
}));

// ── motion stub — keep it dependency-light so axe can audit a static DOM ─
vi.mock('motion/react', () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: { children?: React.ReactNode } & Record<string, unknown>) =>
        React.createElement('div', props, props.children),
    },
  ),
}));

// ── session hook stub — drives which state SignerLandingPage renders ────
type SessionResult = {
  step: 'loading' | 'expired' | 'rejected' | 'waiting';
  envelopeTitle?: string;
  signers?: Array<{ order: number; name: string; role?: string; status: string; is_current: boolean }>;
};

let scenario: SessionResult = { step: 'loading' };

// ── stub heavy interactive subtrees: they pull pdf.js / canvas which
// jsdom can't load. The a11y suite only audits the four lightweight
// states (loading/expired/rejected/waiting); the interactive 'signing'
// flow is covered by Playwright (P8.9).
vi.mock('../SigningWorkflow', () => ({ SigningWorkflow: () => null }));
vi.mock('../SigningCompletePage', () => ({ SigningCompletePage: () => null }));
vi.mock('../OtpVerificationStep', () => ({ OtpVerificationStep: () => null }));

vi.mock('../../esign-signer/hooks/useSignerSession', () => ({
  useSignerSession: () => {
    const session = scenarioSession();
    return {
      sessionData: session,
      loading: false,
      error: null,
      validateToken: vi.fn(async () => ({
        success: scenario.step !== 'expired',
        data: scenarioSession(),
        ...(scenario.step === 'expired' ? { error: 'expired-or-invalid-token' } : {}),
      })),
      verifyOtp: vi.fn(),
      submitSignature: vi.fn(),
      rejectDocument: vi.fn(),
      resendOtp: vi.fn(),
    };
  },
}));

function scenarioSession() {
  if (scenario.step === 'rejected' || scenario.step === 'waiting') {
    return {
      envelope_id: 'env-1',
      envelope_title: scenario.envelopeTitle ?? 'Test Envelope',
      envelope_status: 'sent',
      signer_status: scenario.step === 'rejected' ? 'rejected' : 'pending',
      is_turn: scenario.step !== 'waiting',
      otp_required: false,
      page_count: 1,
      signer_email: 'signer@example.com',
      all_signers: scenario.signers ?? [
        { order: 1, name: 'Alice', role: 'Client', status: 'signed', is_current: false },
        { order: 2, name: 'You', role: 'Spouse', status: 'pending', is_current: true },
        { order: 3, name: 'Bob', role: 'Witness', status: 'pending', is_current: false },
      ],
    };
  }
  return null;
}

import { SignerLandingPage } from '../SignerLandingPage';

afterEach(() => {
  cleanup();
  navigateMock.mockReset();
  searchParams = new URLSearchParams();
});

async function runAxe(): Promise<axe.AxeResults> {
  return axe.run(document, {
    runOnly: ['wcag2a', 'wcag2aa'],
    rules: {
      // Tailwind base styles aren't loaded in jsdom; skip pure colour checks
      // here. Real-world contrast is covered by the Playwright suite (P8.9)
      // which renders the full stylesheet.
      'color-contrast': { enabled: false },
      // jsdom doesn't have a real <html lang>; the production app sets it.
      'document-title': { enabled: false },
      'html-has-lang': { enabled: false },
      'landmark-one-main': { enabled: true },
    },
  });
}

describe('SignerLandingPage — accessibility (axe-core)', () => {
  it('loading state passes WCAG 2.1 AA', async () => {
    scenario = { step: 'loading' };
    render(<SignerLandingPage />);
    const result = await runAxe();
    expect(formatViolations(result)).toEqual([]);
  });

  it('expired state passes WCAG 2.1 AA', async () => {
    scenario = { step: 'expired' };
    searchParams = new URLSearchParams();
    render(<SignerLandingPage />);
    await flush();
    const result = await runAxe();
    expect(formatViolations(result)).toEqual([]);
  });

  it('rejected state passes WCAG 2.1 AA', async () => {
    scenario = { step: 'rejected', envelopeTitle: 'Account Opening' };
    searchParams = new URLSearchParams({ token: 'fake-token' });
    render(<SignerLandingPage />);
    await flush();
    const result = await runAxe();
    expect(formatViolations(result)).toEqual([]);
  });

  it('waiting state passes WCAG 2.1 AA', async () => {
    scenario = { step: 'waiting' };
    searchParams = new URLSearchParams({ token: 'fake-token' });
    render(<SignerLandingPage />);
    await flush();
    const result = await runAxe();
    expect(formatViolations(result)).toEqual([]);
  });
});

function formatViolations(result: axe.AxeResults) {
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.html).slice(0, 3),
  }));
}

async function flush() {
  // Allow the post-validate state transition to commit.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}
