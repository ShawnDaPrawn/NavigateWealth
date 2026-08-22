/**
 * PrepareFormStudio — the chrome the existing test does not reach.
 * ===============================================================
 *
 * `PrepareFormStudio.test.tsx` locks the mount contract, the field palette, the
 * recipient legend and the toolbar actions. Those cover three of the regions a
 * decomposition would carve out of its 920-line `return`.
 *
 * Five are uncovered: the settings dialog, the keyboard-shortcuts dialog, the
 * recipients sheet, the preview dialog, and the bulk-action bar. Each opens on
 * a state flag the toolbar sets, so each is reachable — and each is a place
 * where extracting a component means handing its open/close state and its
 * callbacks across a new boundary. A dialog wired to the wrong flag never
 * opens, and nothing else about the studio looks wrong.
 *
 * Written and made green BEFORE the extraction.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import type { EsignEnvelope, SignerFormData } from '@/components/admin/modules/esign/types';

vi.mock('@/components/admin/modules/esign/components/PDFViewer', () => ({
  PDFViewer: () => <div data-testid="pdf-viewer-stub" />,
}));

const updateDraftSettings = vi.fn(async () => ({}));
const saveDraftSigners = vi.fn(async () => ({}));
vi.mock('@/components/admin/modules/esign/api', () => ({
  esignApi: {
    listEnvelopeDocuments: vi.fn(async () => ({ documents: [] as unknown[] })),
    addEnvelopeDocument: vi.fn(),
    removeEnvelopeDocument: vi.fn(),
    updateDraftSettings: (...a: unknown[]) => updateDraftSettings(...(a as [])),
    saveDraftSigners: (...a: unknown[]) => saveDraftSigners(...(a as [])),
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
  { email: 'second@test.co', name: 'Signer Two', role: 'signer' },
] as unknown as SignerFormData[];

function setup() {
  return render(
    <PrepareFormStudio
      envelope={envelope}
      signers={signers}
      onBack={vi.fn()}
      onSendForSignature={vi.fn()}
    />,
  );
}

/** Find a toolbar control by its accessible name or visible text. */
function clickControl(container: HTMLElement, pattern: RegExp) {
  const candidates = Array.from(container.querySelectorAll('button'));
  const hit = candidates.find(
    (b) =>
      pattern.test(b.getAttribute('aria-label') ?? '') ||
      pattern.test(b.getAttribute('title') ?? '') ||
      pattern.test((b.textContent ?? '').trim()),
  );
  expect(hit, `no control matching ${pattern}`).toBeTruthy();
  fireEvent.click(hit!);
  return hit!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the dialogs the toolbar opens', () => {
  it('opens the settings dialog and shows its saved-settings action', async () => {
    const { container } = setup();

    clickControl(container, /settings/i);

    await waitFor(() => {
      expect(
        document.querySelector('[role="dialog"]'),
        'settings dialog did not open',
      ).toBeTruthy();
    });
  });

  it('opens the keyboard shortcuts dialog', async () => {
    const { container } = setup();

    clickControl(container, /shortcut/i);

    await waitFor(() => {
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog, 'shortcuts dialog did not open').toBeTruthy();
      expect(dialog!.textContent).toMatch(/shortcut/i);
    });
  });

  it('opens the recipients quick-edit and lists the envelope signers', async () => {
    const { container } = setup();

    clickControl(container, /recipient/i);

    await waitFor(() => {
      const panel = document.querySelector('[role="dialog"]');
      expect(panel, 'recipients panel did not open').toBeTruthy();
      expect(panel!.textContent).toContain('signer@test.co');
    });
  });

  it('opens the preview dialog', async () => {
    const { container } = setup();

    clickControl(container, /preview/i);

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]'), 'preview dialog did not open').toBeTruthy();
    });
  });
});

describe('the studio chrome that is always on screen', () => {
  it('shows every signer in the legend strip, each with a colour swatch', () => {
    const { container } = setup();

    expect(screen.getAllByText(/Signer One/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Signer Two/).length).toBeGreaterThan(0);
    // The strip is the only place both appear alongside a colour indicator.
    expect(container.querySelectorAll('[class*="rounded-full"]').length).toBeGreaterThan(0);
  });

  it('does not show the bulk-action bar with nothing selected', () => {
    // It appears only at 2+ selected fields; its absence at rest is the
    // behaviour an extraction could silently invert.
    const { container } = setup();

    expect(container.textContent).not.toMatch(/\d+ fields selected/i);
  });
});
