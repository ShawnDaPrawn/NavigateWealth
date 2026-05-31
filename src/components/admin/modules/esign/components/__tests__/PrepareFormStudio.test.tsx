/**
 * PrepareFormStudio — Render / Characterization Test (Phase 4)
 * ============================================================
 *
 * Locks the baseline mount + document-load contract of PrepareFormStudio
 * (2,064 lines, a Phase 6 decomposition target — the "42-state-variable blob")
 * so a regression during its extraction into composed hooks fails CI.
 *
 * Notes:
 *   • PDFViewer is stubbed — it drives pdfjs/canvas rendering which jsdom does
 *     not implement. It's rendered unconditionally by the studio, so the stub
 *     doubles as the "studio mounted" anchor.
 *   • esignApi is mocked; the studio calls listEnvelopeDocuments(envelope.id)
 *     on mount (failure there is non-fatal by design).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { EsignEnvelope, SignerFormData } from '@/components/admin/modules/esign/types';

vi.mock('@/components/admin/modules/esign/components/PDFViewer', () => ({
  PDFViewer: () => <div data-testid="pdf-viewer-stub" />,
}));

const listEnvelopeDocuments = vi.fn(async (..._args: unknown[]) => ({
  documents: [] as unknown[],
}));
vi.mock('@/components/admin/modules/esign/api', () => ({
  esignApi: {
    listEnvelopeDocuments: (...args: unknown[]) => listEnvelopeDocuments(...args),
    addEnvelopeDocument: vi.fn(),
    removeEnvelopeDocument: vi.fn(),
    updateDraftSettings: vi.fn(),
    saveDraftSigners: vi.fn(),
  },
}));

import { PrepareFormStudio } from '@/components/admin/modules/esign/components/PrepareFormStudio';

const envelope = {
  id: 'env-1',
  status: 'draft',
  title: 'Test Envelope',
  fields: [],
} as unknown as EsignEnvelope;

const signers = [
  { email: 'signer@test.co', name: 'Signer One', role: 'signer' },
] as unknown as SignerFormData[];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrepareFormStudio', () => {
  it('mounts the studio (PDF surface) and loads envelope documents on mount', async () => {
    render(<PrepareFormStudio envelope={envelope} signers={signers} />);

    // The studio always renders the PDF surface — its presence proves the
    // 2,064-line component mounted without throwing.
    expect(screen.getByTestId('pdf-viewer-stub')).toBeTruthy();

    await waitFor(() => {
      expect(listEnvelopeDocuments).toHaveBeenCalledWith('env-1');
    });
  });

  it('renders without throwing when there are no signers', () => {
    render(<PrepareFormStudio envelope={envelope} signers={[]} />);
    expect(screen.getByTestId('pdf-viewer-stub')).toBeTruthy();
  });
});
