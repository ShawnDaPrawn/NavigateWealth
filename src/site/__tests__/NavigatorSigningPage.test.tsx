/**
 * The redesigned signing page (/sign), reached the way production reaches it:
 * SignerLandingPage with the design switch on lazy-loads NavigatorSigningPage.
 *
 * E-signing is legally significant, so the core of this file runs every path
 * through BOTH designs against the same fake server and asserts that the
 * Navigator page sends exactly the requests the live page sends — the same
 * endpoints, methods, headers and JSON bodies, in the same order: validate,
 * the emailed code and access code, resend, the KBA check, decline, pause,
 * the saved signature, the submitted signature data and the signed-copy
 * download. It also pins those payloads to what the signer service builds,
 * and checks each state's heading, words and links, and axe on the card
 * states.
 *
 * One harness note. The live flow's initial-validation effect lists
 * `validateToken` as a dependency, and useSignerSession recreates that
 * function on every render, so against an instant fake server the effect
 * re-runs after every response, without end. The harness below pins the
 * function's identity (it still calls the real one) so each path validates
 * once — identically for both designs, which share the flow hook.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import axe from 'axe-core';

vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

vi.mock('../../components/esign-signer/hooks/useSignerSession', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('../../components/esign-signer/hooks/useSignerSession')>();
  const { useCallback, useRef } = await import('react');
  return {
    useSignerSession: () => {
      const session = real.useSignerSession();
      const latest = useRef(session);
      latest.current = session;
      const validateToken = useCallback((token: string) => latest.current.validateToken(token), []);
      return { ...session, validateToken };
    },
  };
});

// The worker is never started (pdf.js itself is stubbed below); stubbing its
// URL import also keeps the file loadable where node_modules is a symlink.
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));
vi.mock('pdfjs-dist', () => {
  const page = {
    getViewport: () => ({ width: 595, height: 842, scale: 1 }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
    cleanup() {},
  };
  const pdf = { numPages: 1, getPage: async () => page, destroy() {}, cleanup() {} };
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    version: '4.0.0',
    getDocument: () => ({ promise: Promise.resolve(pdf), destroy() {} }),
  };
});

type Design = 'legacy' | 'navigator';

/** Loads the page component with the design switch set as given. */
async function loadPage(design: Design) {
  vi.resetModules();
  vi.doMock('../design', () => ({ SITE_DESIGN: design, resolveSiteDesign: () => design }));
  const { SignerLandingPage } = await import('../../components/esign-signer/SignerLandingPage');
  return SignerLandingPage;
}

const API = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/esign';
const TOKEN = 'tok-123';
const SIGNATURE_PNG = 'data:image/png;base64,U0lHTkFUVVJF';

const F = (id: string, type: string, x: number, y: number, w: number, h: number, extra = {}) => ({
  id,
  type,
  page: 1,
  x,
  y,
  width: w,
  height: h,
  required: true,
  signer_id: 's-1',
  ...extra,
});

function session(over: Record<string, unknown> = {}) {
  return {
    envelope_id: 'env-1',
    envelope_title: 'Record of Advice',
    envelope_status: 'sent',
    signer_id: 's-1',
    signer_name: 'Ann Example',
    signer_email: 'ann@example.co',
    signer_status: 'otp_verified',
    otp_required: false,
    document_url: 'https://docs.example/record.pdf',
    page_count: 1,
    expires_at: '2026-12-03T10:00:00Z',
    is_turn: true,
    fields: [
      F('f-sig', 'signature', 52, 56, 237, 54),
      F('f-init', 'initials', 8, 67, 110, 40),
      F('f-id', 'text', 8, 75, 237, 34, { metadata: { format: 'sa_id' } }),
      F('f-pick', 'dropdown', 52, 80, 160, 30, { metadata: { options: ['Option A', 'Option B'] } }),
      F('f-agree', 'checkbox', 9, 83, 16, 16),
    ],
    all_signers: [
      { order: 1, name: 'Your adviser', role: 'Adviser', status: 'signed', is_current: false },
      { order: 2, name: 'Ann Example', role: 'Client', status: 'pending', is_current: true },
      { order: 3, name: 'Co-signer', role: 'Client', status: 'pending', is_current: false },
    ],
    ...over,
  };
}

interface Call {
  url: string;
  method: string;
  headers: unknown;
  body: unknown;
}

interface Server {
  /** The session the first validate returns. */
  validate: () => { status: number; body: unknown };
  /** What a re-validate (after a challenge) returns; defaults to `validate`. */
  revalidate?: () => { status: number; body: unknown };
  verifyOtp?: () => { status: number; body: unknown };
  kba?: () => { status: number; body: unknown };
}

let calls: Call[] = [];

function startServer(server: Server) {
  calls = [];
  let validates = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: init.headers ?? null,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : (init.body ?? null),
    });
    const reply = (status: number, body: unknown) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      blob: async () => new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    });
    const ep = url.split('/esign/signer/')[1] ?? '';
    if (ep === 'validate') {
      validates += 1;
      const r = validates > 1 && server.revalidate ? server.revalidate() : server.validate();
      return reply(r.status, r.body);
    }
    if (ep === 'verify-otp') {
      const r = server.verifyOtp?.() ?? { status: 200, body: { success: true } };
      return reply(r.status, r.body);
    }
    if (ep === 'kba') {
      const r = server.kba?.() ?? { status: 200, body: { success: true, status: 'passed' } };
      return reply(r.status, r.body);
    }
    return reply(200, { success: true });
  });
  vi.stubGlobal('fetch', fetchMock);
}

async function renderPage(design: Design, search = `?token=${TOKEN}`) {
  const SignerLandingPage = await loadPage(design);
  window.history.replaceState({}, '', `/sign${search}`);
  const utils = render(
    <MemoryRouter initialEntries={[`/sign${search}`]}>
      <Routes>
        <Route path="/sign" element={<SignerLandingPage />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return utils;
}

/** Waits for the state's heading and checks it is the page's only H1. */
async function heading(name: string | RegExp) {
  const h1 = await screen.findByRole('heading', { level: 1, name }, { timeout: 4000 });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  return h1;
}

/** A copy of the requests a run made, in order. */
function requests() {
  return calls.map((c) => ({ ...c }));
}

beforeAll(() => {
  const ctx2d = {
    clearRect() {},
    fillRect() {},
    scale() {},
    drawImage() {},
    save() {},
    restore() {},
    translate() {},
    fillText() {},
    setTransform() {},
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    rect() {},
    closePath() {},
    measureText: () => ({ width: 0 }),
    // One inked pixel, so the crop-to-ink finds something to keep.
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(Math.max(1, w * h) * 4);
      data[3] = 255;
      return { data };
    },
    putImageData() {},
    createImageData: () => ({ data: [] }),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx2d,
  ) as unknown as HTMLCanvasElement['getContext'];
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => SIGNATURE_PNG);
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
  URL.createObjectURL = vi.fn(() => 'blob:signed');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'open').mockImplementation(() => null);
  vi.spyOn(window, 'close').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty('--esign-accent');
});

// ── Drivers: the same steps, through each design's controls ────────────────

async function readyToSign() {
  fireEvent.click(
    await screen.findByRole('button', { name: /i'm ready to sign/i }, { timeout: 4000 }),
  );
  await screen.findByRole('button', { name: /complete \d+ required field/i });
}

async function openField(name: string) {
  fireEvent.click(await screen.findByRole('button', { name }));
}

async function adoptTyped() {
  const dialog = await screen.findByRole('dialog');
  const typeTab = within(dialog).getByRole('tab', { name: /type/i });
  // The live pad's tabs switch on mouse-down; the redesign's on click.
  fireEvent.mouseDown(typeTab);
  fireEvent.click(typeTab);
  await within(dialog).findByLabelText(/type your/i);
  // Live: "Adopt Signature"; the board: "Adopt signature".
  const adopt = within(dialog).getByRole('button', { name: /^adopt (signature|initials)$/i });
  fireEvent.click(adopt);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

async function enterSaId(design: Design, value: string) {
  await openField('text field, required');
  const input = await screen.findByLabelText('Value');
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: design === 'legacy' ? /save/i : 'Confirm' }));
}

async function pickOption() {
  await openField('dropdown field, required');
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Option B' }));
  fireEvent.click(within(dialog).getByRole('button', { name: /confirm/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

async function signEverything(design: Design) {
  await readyToSign();
  await openField('signature field, required');
  await adoptTyped();
  await openField('initials field, required');
  await adoptTyped();
  await enterSaId(design, '8001015009087');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await pickOption();
  await openField('checkbox field, required');
  await screen.findByRole('button', { name: /submit signed document/i });
}

async function submitWithConsent() {
  fireEvent.click(screen.getByRole('button', { name: /submit signed document/i }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('checkbox'));
  fireEvent.click(within(dialog).getByRole('button', { name: /submit signature/i }));
}

async function declineWith(reason: string) {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Decline to sign' }, { timeout: 4000 }),
  );
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole('button', { name: /decline document/i }));
}

/** Runs one path through a design and returns the requests it made. */
async function run(design: Design, server: Server, path: (d: Design) => Promise<void>) {
  startServer(server);
  await renderPage(design);
  await path(design);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
  const made = requests();
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  return made;
}

const ok = (body: unknown) => () => ({ status: 200, body });

describe('the Navigator signing page sends exactly what the live page sends', () => {
  it('opens the document: validate with the token, nothing else', async () => {
    const path = async () => {
      await screen.findByRole('button', { name: /i'm ready to sign/i }, { timeout: 4000 });
    };
    const live = await run('legacy', { validate: ok(session()) }, path);
    const nav = await run('navigator', { validate: ok(session()) }, path);
    expect(nav).toEqual(live);
    expect(nav).toEqual([
      {
        url: `${API}/signer/validate`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
        body: { access_token: TOKEN },
      },
    ]);
  });

  it('signs: the saved signature and initials, then the same signature data', async () => {
    const path = async (d: Design) => {
      await signEverything(d);
      await submitWithConsent();
      await screen.findByRole('heading', { level: 1, name: 'Document Signed Successfully' });
      fireEvent.click(screen.getByRole('button', { name: /download copy/i }));
      await waitFor(() =>
        expect(calls.some((c) => c.url.includes('/signer/download/'))).toBe(true),
      );
    };
    const live = await run('legacy', { validate: ok(session()) }, path);
    const nav = await run('navigator', { validate: ok(session()) }, path);
    expect(nav).toEqual(live);

    const byEndpoint = (ep: string) => nav.filter((c) => c.url.endsWith(`/signer/${ep}`));
    expect(byEndpoint('saved-signature').map((c) => c.body)).toEqual([
      { access_token: TOKEN, signature: SIGNATURE_PNG, initials: null },
      { access_token: TOKEN, signature: null, initials: SIGNATURE_PNG },
    ]);
    const [submit] = byEndpoint('submit');
    expect(submit.method).toBe('POST');
    expect(submit.body).toEqual({
      access_token: TOKEN,
      signature_data: [
        { field_id: 'f-sig', type: 'signature', value: SIGNATURE_PNG },
        { field_id: 'f-init', type: 'initials', value: SIGNATURE_PNG },
        { field_id: 'f-id', type: 'text', value: '800101 5009 0 87' },
        { field_id: 'f-pick', type: 'dropdown', value: 'Option B' },
        { field_id: 'f-agree', type: 'checkbox', value: 'true' },
      ],
      field_values: [
        { field_id: 'f-sig', value: SIGNATURE_PNG },
        { field_id: 'f-init', value: SIGNATURE_PNG },
        { field_id: 'f-id', value: '800101 5009 0 87' },
        { field_id: 'f-pick', value: 'Option B' },
        { field_id: 'f-agree', value: 'true' },
      ],
    });
    const download = nav.find((c) => c.url.includes('/signer/download/'))!;
    expect(download).toEqual({
      url: `${API}/signer/download/${TOKEN}`,
      method: 'GET',
      headers: { Authorization: 'Bearer anon' },
      body: null,
    });
  });

  it('rejects an invalid SA ID number with the live message, sending nothing', async () => {
    for (const design of ['legacy', 'navigator'] as const) {
      startServer({ validate: ok(session()) });
      await renderPage(design);
      await readyToSign();
      await enterSaId(design, '1234567890123');
      expect(
        await screen.findAllByText('Please enter a valid 13-digit South African ID number.'),
      ).not.toHaveLength(0);
      expect(calls.map((c) => c.url)).toEqual([`${API}/signer/validate`]);
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('declines with the reason', async () => {
    const path = async () => {
      await readyToSign();
      await declineWith('The fees are not what we agreed.');
      // The live card's heading is an h2; the redesign's is the page's h1.
      await screen.findByRole('heading', { name: 'Document Declined' });
    };
    const live = await run('legacy', { validate: ok(session()) }, path);
    const nav = await run('navigator', { validate: ok(session()) }, path);
    expect(nav).toEqual(live);
    expect(nav[1]).toEqual({
      url: `${API}/signer/reject`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
      body: { access_token: TOKEN, reason: 'The fees are not what we agreed.' },
    });
  });

  it('saves for later with the progress', async () => {
    const path = async () => {
      await readyToSign();
      fireEvent.click(screen.getByRole('button', { name: 'Save and finish later' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /save & exit/i }));
      await waitFor(() => expect(calls.some((c) => c.url.endsWith('/signer/pause'))).toBe(true));
    };
    const live = await run('legacy', { validate: ok(session()) }, path);
    const nav = await run('navigator', { validate: ok(session()) }, path);
    expect(nav).toEqual(live);
    expect(nav[1].body).toEqual({ access_token: TOKEN, completed_count: 0, required_count: 5 });
  });

  it('verifies the emailed code, then validates again', async () => {
    const server: Server = {
      validate: ok(
        session({ otp_required: true, signer_status: 'pending', missing_factors: ['otp'] }),
      ),
      revalidate: ok(session()),
    };
    const path = async (d: Design) => {
      await heading('Verify Your Identity');
      if (d === 'legacy') {
        const boxes = screen.getAllByRole('textbox');
        '482913'
          .split('')
          .forEach((digit, i) => fireEvent.change(boxes[i], { target: { value: digit } }));
      } else {
        fireEvent.change(screen.getByLabelText('Enter Verification Code'), {
          target: { value: '482913' },
        });
      }
      await screen.findByRole('button', { name: /i'm ready to sign/i }, { timeout: 4000 });
    };
    const live = await run('legacy', server, path);
    const nav = await run('navigator', server, path);
    expect(nav).toEqual(live);
    // The live step's auto-submit runs again when the re-validated session
    // lands, so a second verify (and validate) follows; both designs do it.
    expect(nav.map((c) => c.url.split('/signer/')[1]).slice(0, 3)).toEqual([
      'validate',
      'verify-otp',
      'validate',
    ]);
    expect(nav[1].body).toEqual({ access_token: TOKEN, otp: '482913' });
  });

  it('shows a refused code with the live words and sends a resend', async () => {
    const server: Server = {
      validate: ok(
        session({ otp_required: true, signer_status: 'pending', missing_factors: ['otp'] }),
      ),
      verifyOtp: () => ({ status: 400, body: { error: 'Invalid OTP code' } }),
    };
    const path = async (d: Design) => {
      await heading('Verify Your Identity');
      if (d === 'legacy') {
        const boxes = screen.getAllByRole('textbox');
        '111111'
          .split('')
          .forEach((digit, i) => fireEvent.change(boxes[i], { target: { value: digit } }));
      } else {
        fireEvent.change(screen.getByLabelText('Enter Verification Code'), {
          target: { value: '111111' },
        });
      }
      expect(await screen.findByText('Invalid OTP code')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
      expect(await screen.findByText('A new code has been sent to your email.')).toBeTruthy();
      expect(screen.getByText(/Resend in 60s/)).toBeTruthy();
    };
    const live = await run('legacy', server, path);
    const nav = await run('navigator', server, path);
    expect(nav).toEqual(live);
    expect(nav.map((c) => c.url.split('/signer/')[1])).toEqual([
      'validate',
      'verify-otp',
      'resend-otp',
    ]);
    expect(nav[2].body).toEqual({ access_token: TOKEN });
  });

  it('verifies a document access code', async () => {
    const server: Server = {
      validate: ok(
        session({
          access_code_required: true,
          signer_status: 'pending',
          missing_factors: ['access_code'],
        }),
      ),
      revalidate: ok(session()),
    };
    const path = async () => {
      await heading('Verify Your Identity');
      // The live field's label is not tied to it; both are the one password field.
      const code = document.querySelector('input[type="password"]') as HTMLInputElement;
      fireEvent.change(code, { target: { value: 'NW-2026' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify & Continue' }));
      await screen.findByRole('button', { name: /i'm ready to sign/i }, { timeout: 4000 });
    };
    const live = await run('legacy', server, path);
    const nav = await run('navigator', server, path);
    expect(nav).toEqual(live);
    expect(nav[1].body).toEqual({ access_token: TOKEN, otp: '', access_code: 'NW-2026' });
  });

  it('runs the identity check (KBA) and keeps the live refusal', async () => {
    const kbaSession = session({
      signer_status: 'pending',
      challenge_required: true,
      missing_factors: ['kba'],
    });
    const passes: Server = { validate: ok(kbaSession), revalidate: ok(session()) };
    const path = async () => {
      await heading('Verify your identity');
      fireEvent.change(screen.getByLabelText('South African ID or passport number'), {
        target: { value: '8001015009087' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
      await screen.findByRole('button', { name: /i'm ready to sign/i }, { timeout: 4000 });
    };
    const live = await run('legacy', passes, path);
    const nav = await run('navigator', passes, path);
    expect(nav).toEqual(live);
    expect(nav[1]).toEqual({
      url: `${API}/signer/kba`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer anon' },
      body: { access_token: TOKEN, id_number: '8001015009087' },
    });

    const skipped: Server = {
      validate: ok(kbaSession),
      kba: () => ({ status: 200, body: { success: true, status: 'skipped' } }),
    };
    startServer(skipped);
    await renderPage('navigator');
    await heading('Verify your identity');
    fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
    expect(
      await screen.findByText(
        'Identity verification is not currently available. Please contact the sender.',
      ),
    ).toBeTruthy();
  });
});

describe('each state, as the board draws it, with the live words', () => {
  it('loads with the live words while the link is checked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    await renderPage('navigator');
    await heading('Loading Document');
    expect(screen.getByText('Please wait while we verify your access...')).toBeTruthy();
    expect(screen.getByText('Secure connection verified')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('clears the token from the address bar and authenticates with it', async () => {
    startServer({ validate: ok(session()) });
    await renderPage('navigator', `?token=${TOKEN}&lang=en`);
    await waitFor(() => expect(window.location.search).not.toContain(TOKEN));
    expect(window.location.search).toContain('lang=en');
    await waitFor(() => expect(calls[0]?.body).toEqual({ access_token: TOKEN }));
  });

  it('shows a link without a token as unavailable, sending nothing', async () => {
    startServer({ validate: ok(session()) });
    await renderPage('navigator', '');
    await heading('Link Unavailable');
    expect(
      screen.getByText(
        'This signing link has expired or is no longer valid. Please contact the sender for a new link.',
      ),
    ).toBeTruthy();
    const home = screen.getByRole('link', { name: 'Return to Home' });
    expect(home.getAttribute('href')).toBe('/');
    fireEvent.click(home);
    expect(await screen.findByText('Home page')).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("shows the server's refusal and a voided document in the live words", async () => {
    startServer({ validate: () => ({ status: 400, body: { error: 'Invalid or expired token' } }) });
    await renderPage('navigator');
    await heading('Link Unavailable');
    expect(screen.getByText('Invalid or expired token')).toBeTruthy();
    cleanup();

    startServer({ validate: ok(session({ envelope_status: 'voided' })) });
    await renderPage('navigator');
    await heading('Link Unavailable');
    expect(screen.getByText('This document has been voided by the sender.')).toBeTruthy();
  });

  it('shows the help line with the firm address and the "Powered by" line', async () => {
    startServer({ validate: ok(session({ signer_status: 'rejected' })) });
    await renderPage('navigator');
    await heading('Document Declined');
    expect(screen.getByText('Need help? Contact info@navigatewealth.co')).toBeTruthy();
    expect(screen.getByText('Powered by Navigate Wealth')).toBeTruthy();
    expect(
      screen.getByText('You have declined to sign Record of Advice. The sender has been notified.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Close' }).getAttribute('href')).toBe('/');
  });

  it("speaks the signer's language", async () => {
    startServer({ validate: ok(session({ signer_status: 'rejected', signer_language: 'af' })) });
    await renderPage('navigator');
    await heading('Dokument Geweier');
    expect(screen.getByText('Hulp nodig? Kontak info@navigatewealth.co')).toBeTruthy();
    expect(screen.getByText('Aangedryf deur Navigate Wealth')).toBeTruthy();
  });

  it('waits for earlier signers, listing the order', async () => {
    startServer({ validate: ok(session({ is_turn: false, signer_status: 'pending' })) });
    await renderPage('navigator');
    await heading('Waiting for Previous Signers');
    expect(screen.getByRole('heading', { level: 2, name: 'Signing Order' })).toBeTruthy();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      '1Your adviserAdviserSigned',
      '2Ann Example (You)ClientWaiting',
      '3Co-signerClientQueued',
    ]);
    expect(screen.getByText('ann@example.co').closest('div')?.textContent).toBe(
      'You will be notified by email at ann@example.co when it is your turn to sign.',
    );
  });

  it('draws the workspace: the document, the signer, reading then signing', async () => {
    startServer({ validate: ok(session()) });
    await renderPage('navigator');
    await heading('Record of Advice');
    expect(screen.getByText('Ann Example • ann@example.co')).toBeTruthy();
    expect(await screen.findByText('Review the document, then tap below when ready')).toBeTruthy();
    expect(screen.getByRole('main', { name: 'Document' })).toBeTruthy();
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
    // Reading: the fields are shown but inert.
    expect(
      (screen.getByRole('button', { name: 'signature field, required' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await readyToSign();
    expect(screen.queryByText('Review the document, then tap below when ready')).toBeNull();
    expect(screen.getByText('0/5 done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Complete 5 required fields' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save and finish later' })).toBeTruthy();
    // Zoom steps as live: 10 points at a time.
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('110%')).toBeTruthy();
  });

  it('shows the consent word for word', async () => {
    startServer({ validate: ok(session()) });
    await renderPage('navigator');
    await signEverything('navigator');
    fireEvent.click(screen.getByRole('button', { name: /submit signed document/i }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm your signature' });
    expect(dialog.textContent).toContain(
      'By checking the box below and clicking "Submit Signature", I confirm and agree that:',
    );
    for (const line of [
      'I have reviewed the document in its entirety and understand its contents.',
      'I intend my electronic signature to have the same legal effect as a handwritten signature, in accordance with the Electronic Communications and Transactions Act 25 of 2002 (ECTA) of South Africa.',
      'I consent to conducting this transaction electronically and acknowledge that my signature is legally binding.',
      'I understand that a record of this signing, including timestamp, IP address, and device information, will be maintained for audit purposes.',
    ]) {
      expect(within(dialog).getByText(line)).toBeTruthy();
    }
    expect(
      within(dialog).getByLabelText(
        'I have read and agree to the above. I confirm this is my signature and I intend to electronically sign this document.',
      ),
    ).toBeTruthy();
    const submit = within(dialog).getByRole('button', { name: 'Submit signature' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText('5 of 5')).toBeTruthy();
  });

  it('completes with the live words and the signer', async () => {
    startServer({ validate: ok(session({ signer_status: 'signed' })) });
    await renderPage('navigator');
    await heading('Document Signed Successfully');
    expect(screen.getByText('Ann Example')).toBeTruthy();
    expect(screen.getByText('Email Confirmation')).toBeTruthy();
    expect(
      screen.getByText('Your e-signature is legally binding under the ECTA and securely stored.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Close' }).getAttribute('href')).toBe('/');
  });
});

describe('accessibility (axe-core, WCAG 2.1 AA)', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['waiting', { is_turn: false, signer_status: 'pending' }, 'Waiting for Previous Signers'],
    ['declined', { signer_status: 'rejected' }, 'Document Declined'],
    [
      'code',
      { otp_required: true, signer_status: 'pending', missing_factors: ['otp'] },
      'Verify Your Identity',
    ],
    [
      'identity check',
      { signer_status: 'pending', challenge_required: true, missing_factors: ['kba'] },
      'Verify your identity',
    ],
    ['completed', { signer_status: 'signed' }, 'Document Signed Successfully'],
    ['workspace', {}, 'Record of Advice'],
  ];
  it.each(cases)('%s', async (_name, over, title) => {
    startServer({ validate: ok(session(over)) });
    await renderPage('navigator');
    await heading(title);
    const result = await axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa'],
      rules: {
        'color-contrast': { enabled: false },
        'document-title': { enabled: false },
        'html-has-lang': { enabled: false },
      },
    });
    expect(
      result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`),
    ).toEqual([]);
  });
});
