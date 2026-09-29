import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LegalPdfDocumentData } from '../LegalDocumentPdf';

const mockExport = vi.fn();
const mockPrint = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
let layoutReportsReady = true;

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('../pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../pdf')>()),
  exportPdfFromPreview: (...args: unknown[]) => mockExport(...args),
  printPdfPreview: (...args: unknown[]) => mockPrint(...args),
}));

// The real layout runs paged.js, which needs a layout engine. This stand-in
// renders two pages and reports ready, as the paged renderer does when done.
vi.mock('../LegalDocumentPdf', async () => {
  const { useEffect } = await import('react');
  return {
    LegalDocumentPdfLayout: ({
      onPagedRendererStateChange,
    }: {
      onPagedRendererStateChange?: (state: {
        ready: boolean;
        error: string | null;
        activeRenderer: 'paged' | 'legacy';
      }) => void;
    }) => {
      useEffect(() => {
        if (layoutReportsReady) {
          onPagedRendererStateChange?.({ ready: true, error: null, activeRenderer: 'paged' });
        }
      }, [onPagedRendererStateChange]);
      return (
        <div data-pdf-export-root="true">
          <div className="pagedjs_page">Page one</div>
          <div className="pagedjs_page">Page two</div>
        </div>
      );
    },
  };
});

import { LegalDocumentPdfDialog } from '../LegalDocumentPdfDialog';
import { LEGAL_PDF_EXPORT_IMAGE } from '../legalPdfPrintDocument';
import { BASE_PDF_CSS } from '../pdf';

const DOCUMENT: LegalPdfDocumentData = {
  title: 'PAIA Manual',
  version: '1.2',
  html: '<p>Body</p>',
  pdfConfig: { pageSize: 'A4', orientation: 'portrait' },
};

function renderDialog(onOpenChange = vi.fn()) {
  render(<LegalDocumentPdfDialog open onOpenChange={onOpenChange} document={DOCUMENT} />);
  return { onOpenChange };
}

beforeEach(() => {
  layoutReportsReady = true;
  mockExport.mockReset();
  mockExport.mockResolvedValue(undefined);
  mockPrint.mockReset();
  mockPrint.mockReturnValue(true);
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
});

describe('LegalDocumentPdfDialog', () => {
  it('renders nothing without a document', () => {
    render(<LegalDocumentPdfDialog open onOpenChange={vi.fn()} document={null} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the dialog after the document and counts its pages once ready', async () => {
    renderDialog();

    expect(await screen.findByRole('dialog', { name: 'PAIA Manual' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Version 1.2 · 2 pages · A4')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeTruthy();
  });

  it('holds the download until the preview has rendered', async () => {
    layoutReportsReady = false;
    renderDialog();

    await screen.findByRole('dialog');
    screen.getAllByRole('button', { name: /download pdf/i }).forEach((button) => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
    expect(screen.getByText('Version 1.2 · Preparing preview… · A4')).toBeTruthy();
  });

  it('downloads a PDF file with the legal export settings', async () => {
    renderDialog();

    const [download] = await screen.findAllByRole('button', { name: /download pdf/i });
    await waitFor(() => expect((download as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(download);

    await waitFor(() => expect(mockExport).toHaveBeenCalledTimes(1));
    expect(mockExport.mock.calls[0][0]).toMatchObject({
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      pageSelector: '.pagedjs_page',
      ...LEGAL_PDF_EXPORT_IMAGE,
    });
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith('PDF downloaded'));
  });

  it('says so when the download fails', async () => {
    mockExport.mockRejectedValue(new Error('canvas too large'));
    renderDialog();

    const [download] = await screen.findAllByRole('button', { name: /download pdf/i });
    await waitFor(() => expect((download as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(download);

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('PDF download failed: canvas too large'),
    );
  });

  it('prints through the browser with the base page CSS', async () => {
    renderDialog();

    const print = await screen.findByRole('button', { name: /print/i });
    await waitFor(() => expect((print as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(print);

    expect(mockPrint).toHaveBeenCalledTimes(1);
    expect(mockPrint.mock.calls[0][0]).toMatchObject({
      title: 'PAIA Manual',
      pageSelector: '.pagedjs_page',
      layoutCss: BASE_PDF_CSS,
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('explains a blocked print window', async () => {
    mockPrint.mockReturnValue(false);
    renderDialog();

    const print = await screen.findByRole('button', { name: /print/i });
    await waitFor(() => expect((print as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(print);

    expect(mockToastError).toHaveBeenCalledWith(
      'The print view could not be opened.',
      expect.objectContaining({ description: expect.stringMatching(/pop-ups/) }),
    );
  });

  it('closes on Escape and from the close button', async () => {
    const { onOpenChange } = renderDialog();

    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
