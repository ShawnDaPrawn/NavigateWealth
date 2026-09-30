import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html2canvasMock = vi.fn();
const addImage = vi.fn();
const addPage = vi.fn();

vi.mock('html2canvas', () => ({ default: (...args: unknown[]) => html2canvasMock(...args) }));
vi.mock('jspdf', () => ({
  default: class {
    addImage = addImage;
    addPage = addPage;
    output() {
      return new Blob(['%PDF']);
    }
  },
}));

import { exportPdfFromPreview, resolvePageCounterContent } from '../pdfExport';

function fakeCanvas() {
  return { toDataURL: vi.fn((type: string) => `data:${type};base64,AAAA`) };
}

/**
 * A preview holding `count` pages that report their layout size through
 * offsetWidth/offsetHeight and a zoomed-out size through getBoundingClientRect,
 * the way a page does inside the scaled viewer.
 */
function buildScaledPreview(count: number) {
  const root = document.createElement('div');
  const container = document.createElement('div');
  container.setAttribute('data-pdf-export-root', 'true');
  root.appendChild(container);

  for (let index = 0; index < count; index += 1) {
    const page = document.createElement('div');
    page.className = 'pagedjs_page';
    Object.defineProperty(page, 'offsetWidth', { configurable: true, value: 794 });
    Object.defineProperty(page, 'offsetHeight', { configurable: true, value: 1123 });
    page.getBoundingClientRect = () =>
      ({ width: 365, height: 516, top: 0, left: 0, right: 365, bottom: 516 }) as DOMRect;
    container.appendChild(page);
  }

  document.body.appendChild(root);
  return root;
}

beforeEach(() => {
  html2canvasMock.mockReset();
  html2canvasMock.mockImplementation(async () => fakeCanvas());
  addImage.mockReset();
  addPage.mockReset();
  vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:pdf');
  vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('exportPdfFromPreview', () => {
  it('captures each page at its layout size, not its zoomed on-screen size', async () => {
    const root = buildScaledPreview(1);

    await exportPdfFromPreview({
      root,
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      pageSelector: '.pagedjs_page',
    });

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(html2canvasMock.mock.calls[0][1]).toMatchObject({ width: 794, height: 1123 });
  });

  it('reports progress before each page and once when done', async () => {
    const root = buildScaledPreview(3);
    const onProgress = vi.fn();

    await exportPdfFromPreview({
      root,
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      pageSelector: '.pagedjs_page',
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(addPage).toHaveBeenCalledTimes(2);
  });

  it('keeps the lossless 300 DPI PNG default', async () => {
    const root = buildScaledPreview(1);

    await exportPdfFromPreview({
      root,
      title: 'Form',
      pageSize: 'A4',
      orientation: 'portrait',
    });

    expect(html2canvasMock.mock.calls[0][1]).toMatchObject({ scale: 300 / 96 });
    expect(addImage.mock.calls[0][1]).toBe('PNG');
    expect(addImage.mock.calls[0][7]).toBe('SLOW');
  });

  it('embeds JPEG pages at the requested resolution when asked', async () => {
    const root = buildScaledPreview(1);

    await exportPdfFromPreview({
      root,
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      imageFormat: 'JPEG',
      dpi: 250,
    });

    expect(html2canvasMock.mock.calls[0][1]).toMatchObject({ scale: 250 / 96 });
    expect(addImage.mock.calls[0][0]).toMatch(/^data:image\/jpeg/);
    expect(addImage.mock.calls[0][1]).toBe('JPEG');
  });

  it('freezes each page footer onto the clone before capture', async () => {
    const root = buildScaledPreview(2);
    for (const page of root.querySelectorAll('.pagedjs_page')) {
      const margin = document.createElement('div');
      margin.className = 'pagedjs_margin-bottom';
      page.appendChild(margin);
    }

    const realGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = realGetComputedStyle(element, pseudo);
      if (
        pseudo === '::after' &&
        element instanceof HTMLElement &&
        element.classList.contains('pagedjs_margin-bottom')
      ) {
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'content') return '"Page " counter(page) " of " counter(pages)';
            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
      }
      return style;
    });

    const seenDisablingStyles: string[] = [];
    html2canvasMock.mockImplementation(async (node: HTMLElement) => {
      const host = node.parentElement?.parentElement;
      seenDisablingStyles.push(host?.querySelector('style')?.textContent ?? '');
      return fakeCanvas();
    });

    await exportPdfFromPreview({
      root,
      title: 'PAIA Manual',
      pageSize: 'A4',
      orientation: 'portrait',
      pageSelector: '.pagedjs_page',
    });

    const captured = html2canvasMock.mock.calls.map((call) => call[0] as HTMLElement);
    expect(
      captured.map((page) => page.querySelector('[data-pdf-frozen-counter-after]')?.textContent),
    ).toEqual(['Page 1 of 2', 'Page 2 of 2']);
    expect(seenDisablingStyles).toEqual([
      '[data-pdf-frozen-counter-before]::before, [data-pdf-frozen-counter-after]::after { content: none !important; }',
      '[data-pdf-frozen-counter-before]::before, [data-pdf-frozen-counter-after]::after { content: none !important; }',
    ]);
  });
});

describe('resolvePageCounterContent', () => {
  it('resolves the legal footer to the page and page count', () => {
    expect(resolvePageCounterContent('"Page " counter(page) " of " counter(pages)', 3, 18)).toBe(
      'Page 3 of 18',
    );
  });

  it('accepts a counter style argument', () => {
    expect(resolvePageCounterContent('counter(page, decimal)', 7, 9)).toBe('7');
  });

  it('unescapes quoted strings', () => {
    expect(resolvePageCounterContent('"\\"" counter(page) "\\""', 2, 4)).toBe('"2"');
  });

  it('leaves content without page counters alone', () => {
    expect(resolvePageCounterContent('none', 1, 1)).toBeNull();
    expect(resolvePageCounterContent('"Confidential"', 1, 1)).toBeNull();
  });

  it('leaves content using any other counter alone', () => {
    expect(resolvePageCounterContent('counter(footnote) ". "', 1, 1)).toBeNull();
    expect(resolvePageCounterContent('"Page " counter(page) attr(data-x)', 1, 1)).toBeNull();
  });
});
