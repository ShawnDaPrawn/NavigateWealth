/**
 * SigningWorkflow — render / characterization test (Phase 4 coverage push).
 *
 * The legally-significant signer experience (1,969-line god-file; a Phase 5/6
 * decomposition target). This locks the two-phase flow — READING (inert fields,
 * single "I'm ready to sign" CTA) crossing into SIGNING (the required-field CTA)
 * — plus the no-session guard, so a regression in the signing flow fails CI.
 *
 * pdf.js (canvas PDF rendering), SignatureCanvas, and the signer service are
 * stubbed; jsdom canvas/observer/scroll gaps the workflow relies on are shimmed.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/utils';
import type { SignerSessionData } from '../types';

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
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    rect() {},
    closePath() {},
    measureText: () => ({ width: 0 }),
    getImageData: () => ({ data: [] }),
    putImageData() {},
    createImageData: () => ({ data: [] }),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx2d,
  ) as unknown as HTMLCanvasElement['getContext'];
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  }
});

vi.mock('pdfjs-dist', () => {
  const page = {
    getViewport: () => ({ width: 595, height: 842, scale: 1 }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
    cleanup() {},
  };
  const pdf = { numPages: 1, getPage: vi.fn(async () => page), destroy() {}, cleanup() {} };
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    version: '4.0.0',
    getDocument: vi.fn(() => ({ promise: Promise.resolve(pdf), destroy() {} })),
  };
});

vi.mock('../SignatureCanvas', () => ({
  SignatureCanvas: () => <div data-testid="signature-canvas-stub" />,
}));
vi.mock('../FieldHighlight', () => ({
  FieldHighlight: () => <div data-testid="field-highlight-stub" />,
}));
vi.mock('../services/esignSignerService', () => ({
  esignSignerService: {
    saveSignerSignature: vi.fn(async () => ({ success: true })),
    pauseSigning: vi.fn(async () => ({ success: true })),
    downloadDocument: vi.fn(async () => null),
  },
  uploadAttachmentForSigner: vi.fn(),
}));

import { SigningWorkflow } from '../SigningWorkflow';

function makeSession(over: Partial<SignerSessionData> = {}): SignerSessionData {
  return {
    envelope_id: 'env-1',
    envelope_title: 'Test Agreement',
    signer_id: 'signer-1',
    signer_name: 'Ann Example',
    signer_email: 'ann@example.co',
    signer_status: 'otp_verified',
    otp_required: false,
    document_url: 'https://example.co/doc.pdf',
    page_count: 1,
    fields: [
      {
        id: 'f1',
        type: 'signature',
        page: 1,
        x: 100,
        y: 100,
        width: 150,
        height: 40,
        required: true,
        signer_id: 'signer-1',
      },
      {
        id: 'f2',
        type: 'text',
        page: 1,
        x: 100,
        y: 200,
        width: 150,
        height: 30,
        required: false,
        signer_id: 'signer-1',
      },
    ],
    ...over,
  } as SignerSessionData;
}

function renderWorkflow(over: Partial<SignerSessionData> = {}) {
  const onComplete = vi.fn();
  const onReject = vi.fn();
  const submitSignature = vi.fn(async () => ({ success: true }));
  render(
    <SigningWorkflow
      token="tok-1"
      sessionData={makeSession(over)}
      onComplete={onComplete}
      onReject={onReject}
      submitSignature={submitSignature}
    />,
  );
  return { onComplete, onReject, submitSignature };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('SigningWorkflow', () => {
  it('renders the reading phase with signer identity and the ready CTA', async () => {
    renderWorkflow();
    expect(await screen.findByText(/ann@example\.co/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ready to sign/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /decline/i })).toBeTruthy();
  });

  it('crosses into the signing phase, surfacing the required-field CTA', async () => {
    renderWorkflow();
    const ready = await screen.findByRole('button', { name: /ready to sign/i });
    fireEvent.click(ready);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /complete 1 required field/i })).toBeTruthy();
    });
  });

  it('renders a guard state (without throwing) when there is no session', () => {
    render(
      <SigningWorkflow
        token="tok"
        sessionData={null}
        onComplete={vi.fn()}
        onReject={vi.fn()}
        submitSignature={vi.fn(async () => ({ success: true }))}
      />,
    );
    expect(document.body.textContent).toBeTruthy();
  });
});
