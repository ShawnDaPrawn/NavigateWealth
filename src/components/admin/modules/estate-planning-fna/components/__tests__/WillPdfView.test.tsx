/**
 * WillPdfView — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the closed-dialog guard (returns null when open is false), the dialog
 * title, Print / Download buttons, and the loading text for this 1,396-line
 * Phase 6 decomposition target.
 *
 * api.get and will-pdf-generator are mocked to prevent real HTTP calls and
 * jsPDF canvas usage (which jsdom does not implement).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));
vi.mock('@/utils/api', () => ({
  api: { get: mockApiGet },
}));

vi.mock('@/components/admin/modules/estate-planning-fna/utils/will-pdf-generator', () => ({
  downloadWillPdf: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { WillPdfView } from '../WillPdfView';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WillPdfView', () => {
  it('renders nothing (returns null) when open is false', () => {
    const { container } = render(
      <WillPdfView open={false} onClose={noop} willId="will-1" clientName="Test Client" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows the "Last Will and Testament" dialog title when open', () => {
    // Never resolves — will stays null, but the title is always rendered.
    mockApiGet.mockReturnValue(new Promise(() => {}));

    render(<WillPdfView open={true} onClose={noop} willId="will-1" clientName="Test Client" />);

    expect(screen.getByText(/Last Will and Testament/i)).toBeTruthy();
  });

  it('opens as a page with Will management back, Download PDF and Print', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();

    render(<WillPdfView open={true} onClose={onClose} willId="will-1" clientName="Test Client" />);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /^print$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /will management/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the loading text while the will document is being fetched', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));

    render(<WillPdfView open={true} onClose={noop} willId="will-1" clientName="Test Client" />);

    expect(screen.getByText('Loading will document...')).toBeTruthy();
  });
});
