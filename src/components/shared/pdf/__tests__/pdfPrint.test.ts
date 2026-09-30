import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printPdfPreview } from '../pdfPrint';

interface FakePrintWindow {
  document: {
    open: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    fonts?: { ready: Promise<unknown> };
  };
  focus: ReturnType<typeof vi.fn>;
  print: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function installPrintWindow() {
  const written: string[] = [];
  const printWindow: FakePrintWindow = {
    document: {
      open: vi.fn(),
      write: vi.fn((markup: string) => {
        written.push(markup);
      }),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
  };
  vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);
  return { printWindow, html: () => written.join('') };
}

function setCoarsePointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function previewRoot({
  pageClass,
  containerClass = 'pdf-preview-container',
  text = 'Clause 1',
  inlineCss,
}: {
  pageClass: string;
  containerClass?: string;
  text?: string;
  inlineCss?: string;
}) {
  const root = document.createElement('div');
  if (inlineCss) {
    const style = document.createElement('style');
    style.textContent = inlineCss;
    root.appendChild(style);
  }
  const container = document.createElement('div');
  container.className = containerClass;
  container.setAttribute('data-pdf-export-root', 'true');
  const page = document.createElement('div');
  page.className = pageClass;
  page.textContent = text;
  container.appendChild(page);
  root.appendChild(container);
  document.body.appendChild(root);
  return root;
}

const printArgs = {
  title: 'PAIA & <POPIA>',
  pageSize: 'A4' as const,
  orientation: 'portrait' as const,
  layoutCss: '/* layout-marker */',
};

beforeEach(() => {
  vi.useFakeTimers();
  setCoarsePointer(false);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('printPdfPreview', () => {
  it('returns false without opening a window when the preview is missing', () => {
    const open = vi.spyOn(window, 'open');
    const root = document.createElement('div');
    document.body.appendChild(root);

    expect(printPdfPreview({ root, ...printArgs })).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Preview container not found');
  });

  it('returns false when the browser blocks the print window', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const root = previewRoot({ pageClass: 'pdf-page' });

    expect(printPdfPreview({ root, ...printArgs })).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Print window could not be opened');
  });

  it('prints a form with the escaped title, layout CSS, and inline styles', async () => {
    const { printWindow, html } = installPrintWindow();
    const root = previewRoot({
      pageClass: 'pdf-page',
      inlineCss: '.pdf-page{color:#111}',
      text: 'Form body',
    });

    expect(printPdfPreview({ root, ...printArgs })).toBe(true);
    expect(window.open).toHaveBeenCalledWith('', '_blank', 'width=1200,height=900');

    const markup = html();
    expect(markup).toContain('<title>Navigate Wealth - PAIA &amp; &lt;POPIA&gt;</title>');
    expect(markup).toContain('/* layout-marker */');
    expect(markup).toContain('.pdf-page{color:#111}');
    expect(markup).toContain('Form body');
    expect(markup).toContain('@page');
    expect(markup).toContain('size: A4 portrait');
    expect(markup).toContain('width: 210mm');
    expect(markup).toContain('.pdf-page {');
    expect(markup).not.toContain('.letter-page {');
    expect(markup).not.toContain('.legal-paged-preview-root .pagedjs_page');

    await vi.advanceTimersByTimeAsync(300);
    expect(printWindow.focus).toHaveBeenCalledTimes(1);
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(printWindow.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(999);
    expect(printWindow.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(printWindow.close).toHaveBeenCalledTimes(1);
  });

  it('uses letter overrides and landscape dimensions when asked', () => {
    const { html } = installPrintWindow();
    const root = previewRoot({ pageClass: 'letter-page', text: 'Dear client' });

    expect(
      printPdfPreview({
        root,
        ...printArgs,
        pageSize: 'A3',
        orientation: 'landscape',
        isLetter: true,
      }),
    ).toBe(true);

    const markup = html();
    expect(markup).toContain('Dear client');
    expect(markup).toContain('size: A3 landscape');
    expect(markup).toContain('width: 420mm');
    expect(markup).toContain('height: 297mm');
    expect(markup).toContain('.letter-page {');
    expect(markup).toContain('.letter-closing');
    expect(markup).not.toContain('.pdf-footer');
  });

  it('adds paged-legal overrides when the preview is a paged.js document', () => {
    const { html } = installPrintWindow();
    const root = previewRoot({
      pageClass: 'pagedjs_page',
      containerClass: 'legal-paged-preview-root',
      text: 'Section 4',
    });

    expect(printPdfPreview({ root, ...printArgs })).toBe(true);

    const markup = html();
    expect(markup).toContain('Section 4');
    expect(markup).toContain('.legal-paged-preview-root .pagedjs_page');
    expect(markup).toContain('.pagedjs_page:last-child');
  });

  it('leaves the print window open on a touch device', async () => {
    setCoarsePointer(true);
    const { printWindow } = installPrintWindow();
    const root = previewRoot({
      pageClass: 'pagedjs_page',
      containerClass: 'legal-paged-preview-root',
    });

    expect(printPdfPreview({ root, ...printArgs })).toBe(true);

    await vi.advanceTimersByTimeAsync(5000);
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(printWindow.close).not.toHaveBeenCalled();
  });

  it('still prints when the print window fonts fail to load', async () => {
    const { printWindow } = installPrintWindow();
    let rejectReady: (reason: Error) => void = () => undefined;
    printWindow.document.fonts = {
      ready: new Promise((_resolve, reject) => {
        rejectReady = reject;
      }),
    };
    const root = previewRoot({ pageClass: 'pdf-page' });

    expect(printPdfPreview({ root, ...printArgs })).toBe(true);
    rejectReady(new Error('font load failed'));

    await vi.advanceTimersByTimeAsync(300);
    expect(printWindow.print).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '[printPdfPreview] Waiting for print fonts failed',
      expect.any(Error),
    );
  });
});
