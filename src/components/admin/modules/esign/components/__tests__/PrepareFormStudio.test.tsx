/**
 * PrepareFormStudio — Render / Characterization Test (Phase 4)
 * ============================================================
 *
 * Locks the mount + document-load contract AND the editor chrome (field
 * palette, recipient legend, toolbar actions) of PrepareFormStudio — a Phase 6
 * decomposition target (the "42-state-variable blob" being pulled into composed
 * hooks) — so a regression during extraction fails CI.
 *
 * Notes:
 *   • PDFViewer is stubbed — it drives pdfjs/canvas rendering jsdom does not
 *     implement. It renders unconditionally, so the stub doubles as the
 *     "studio mounted" anchor.
 *   • esignApi is mocked; the studio calls listEnvelopeDocuments(envelope.id)
 *     on mount (failure there is non-fatal by design).
 *   • Imports RTL helpers from the shared `@/test/utils` module.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';
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
    // 1,800-line component mounted without throwing.
    expect(screen.getByTestId('pdf-viewer-stub')).toBeTruthy();

    await waitFor(() => {
      expect(listEnvelopeDocuments).toHaveBeenCalledWith('env-1');
    });
  });

  it('renders without throwing when there are no signers', () => {
    render(<PrepareFormStudio envelope={envelope} signers={[]} />);
    expect(screen.getByTestId('pdf-viewer-stub')).toBeTruthy();
  });

  it('renders the field palette with the placeable field types', () => {
    render(<PrepareFormStudio envelope={envelope} signers={signers} />);

    expect(screen.getAllByText('Signature').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Date').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Checkbox').length).toBeGreaterThan(0);
  });

  it('lists the envelope signers in the recipient legend', () => {
    render(<PrepareFormStudio envelope={envelope} signers={signers} />);
    expect(screen.getAllByText('Signer One').length).toBeGreaterThan(0);
  });

  it('labels the send action from the sendActionLabel prop', () => {
    render(
      <PrepareFormStudio
        envelope={envelope}
        signers={signers}
        sendActionLabel="Send for Signature"
      />,
    );
    expect(screen.getByText('Send for Signature')).toBeTruthy();
  });

  it('starts with undo and redo disabled (empty history)', () => {
    render(<PrepareFormStudio envelope={envelope} signers={signers} />);

    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('PrepareFormStudio interactions', () => {
  it('Save button is disabled on initial mount (no unsaved changes)', () => {
    render(<PrepareFormStudio envelope={envelope} signers={signers} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSendForSignature when the Send button is clicked with pre-loaded fields', async () => {
    const onSendForSignature = vi.fn(async () => {});
    const envelopeWithField = {
      ...envelope,
      fields: [
        {
          id: 'field-1',
          envelope_id: 'env-1',
          type: 'signature',
          page: 1,
          x: 100,
          y: 200,
          width: 100,
          height: 50,
          required: true,
          metadata: {},
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    } as unknown as EsignEnvelope;

    render(
      <PrepareFormStudio
        envelope={envelopeWithField}
        signers={signers}
        sendActionLabel="Send for Signature"
        onSendForSignature={onSendForSignature}
      />,
    );

    screen.getByRole('button', { name: /send for signature/i }).click();

    await waitFor(() => {
      expect(onSendForSignature).toHaveBeenCalled();
    });
  });
});
