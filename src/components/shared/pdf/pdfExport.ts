/**
 * Rendering a PDF from an on-screen preview.
 *
 * This is the export half of PdfTemplateViewer, and it depends on nothing but
 * the DOM and the shared page dimensions. It lived inside the resources module,
 * which is why the legal-document download surface in shared/ had to reach
 * across a module boundary to save a file. Moved here verbatim.
 */
import { getPdfDimensions, type PdfOrientation, type PdfPageSize } from './BasePdfLayout';
import { navigateWealthPdfSaveFileName } from '../../../utils/pdfPrintTitle';

const CANVAS_COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'text-decoration-color',
  'caret-color',
] as const;

const CSS_PIXELS_PER_INCH = 96;
const PDF_EXPORT_TARGET_DPI = 300;
const PDF_EXPORT_JPEG_QUALITY = 0.9;
const DEFAULT_EXPORT_PAGE_SELECTORS = ['.pagedjs_page', '.pdf-page', '.letter-page'];

function fallbackCanvasColor(property: string) {
  if (property === 'background-color') return '#ffffff';
  if (property.includes('border') || property === 'text-decoration-color') return '#e5e7eb';
  return '#111827';
}

function normalizeCanvasUnsupportedColors(root: HTMLElement) {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

  elements.forEach((element) => {
    const computed = window.getComputedStyle(element);
    CANVAS_COLOR_PROPS.forEach((property) => {
      const value = computed.getPropertyValue(property);
      if (value.includes('oklch(') || value.includes('lab(') || value.includes('lch(')) {
        element.style.setProperty(property, fallbackCanvasColor(property), 'important');
      }
    });
  });
}

const COUNTER_CONTENT_TOKEN = /"((?:[^"\\]|\\.)*)"|counter\(\s*([\w-]+)\s*(?:,[^)]*)?\)/g;
const FROZEN_COUNTER_ATTRIBUTE = 'data-pdf-frozen-counter';
const COPIED_PSEUDO_TEXT_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'color',
  'line-height',
  'letter-spacing',
  'text-transform',
  'white-space',
] as const;

/**
 * The text a CSS `content` value produces when its only counters are `page`
 * and `pages`, e.g. `"Page " counter(page) " of " counter(pages)`. Null for
 * anything else, which is then left for html2canvas to draw as it would have.
 */
export function resolvePageCounterContent(
  content: string,
  pageNumber: number,
  pageCount: number,
): string | null {
  if (!content.includes('counter(')) return null;

  let text = '';
  let consumed = 0;
  for (const match of content.matchAll(COUNTER_CONTENT_TOKEN)) {
    if (content.slice(consumed, match.index).trim()) return null;
    consumed = (match.index ?? 0) + match[0].length;

    if (match[1] !== undefined) {
      text += match[1].replace(/\\(.)/g, '$1');
    } else if (match[2] === 'page') {
      text += String(pageNumber);
    } else if (match[2] === 'pages') {
      text += String(pageCount);
    } else {
      return null;
    }
  }

  return content.slice(consumed).trim() ? null : text;
}

/**
 * Writes page counters into a cloned page as plain text.
 *
 * html2canvas works CSS counters out for itself, walking only the element it
 * draws. A paged.js page cloned out of its page list loses the list's
 * `counter-reset: pages N`, so the legal PDF footer read "Page 2 of 1" on
 * every downloaded page. Each pseudo-element whose content uses the page
 * counters gets a real span with the resolved text, and is itself switched off.
 */
function freezePageCounters(
  original: HTMLElement,
  clone: HTMLElement,
  pageNumber: number,
  pageCount: number,
) {
  const originals = [original, ...Array.from(original.querySelectorAll<HTMLElement>('*'))];
  const clones = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
  if (originals.length !== clones.length) return;

  originals.forEach((element, index) => {
    (['before', 'after'] as const).forEach((pseudo) => {
      const style = window.getComputedStyle(element, `::${pseudo}`);
      const text = resolvePageCounterContent(style.content || '', pageNumber, pageCount);
      if (text === null) return;

      const span = document.createElement('span');
      span.textContent = text;
      COPIED_PSEUDO_TEXT_PROPS.forEach((property) => {
        span.style.setProperty(property, style.getPropertyValue(property));
      });

      const target = clones[index];
      target.setAttribute(`${FROZEN_COUNTER_ATTRIBUTE}-${pseudo}`, '');
      if (pseudo === 'before') target.prepend(span);
      else target.append(span);
    });
  });
}

export function resolvePdfExportPages(container: ParentNode, pageSelector?: string) {
  const selectors = [pageSelector, ...DEFAULT_EXPORT_PAGE_SELECTORS].filter(
    (value): value is string => Boolean(value),
  );

  for (const selector of selectors) {
    const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (nodes.length > 0) {
      return nodes;
    }
  }

  return [] as HTMLElement[];
}

export function resolvePdfPreviewContainer(root: HTMLElement | null, pageSelector?: string) {
  if (!root) return null;

  const selectors = [
    '[data-pdf-export-root="true"]',
    '.pdf-preview-container',
    '.legal-paged-preview-root',
    '[data-legal-pdf-renderer="paged"]',
    '.pdf-viewport',
  ];

  for (const selector of selectors) {
    const match = root.querySelector<HTMLElement>(selector);
    if (match) {
      return match;
    }
  }

  if (resolvePdfExportPages(root, pageSelector).length > 0) {
    return root;
  }

  return null;
}

export async function exportPdfFromPreview({
  root,
  title,
  pageSize,
  orientation,
  pageSelector,
  onProgress,
  imageFormat = 'PNG',
  dpi = PDF_EXPORT_TARGET_DPI,
}: {
  root: HTMLElement;
  title: string;
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  pageSelector?: string;
  /** Called before each page is drawn, and once more when all are done. */
  onProgress?: (completedPages: number, totalPages: number) => void;
  /**
   * How each page image is stored. PNG (the default) is lossless but jsPDF
   * re-compresses it itself, which costs seconds a page; JPEG is embedded as-is.
   */
  imageFormat?: 'PNG' | 'JPEG';
  /** Resolution of each page image. Defaults to 300. */
  dpi?: number;
}) {
  const canvasScale = dpi / CSS_PIXELS_PER_INCH;

  const previewContainer = resolvePdfPreviewContainer(root, pageSelector);
  if (!previewContainer) {
    throw new Error('PDF preview is not ready yet. Please try again in a moment.');
  }

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const pageNodes = resolvePdfExportPages(previewContainer, pageSelector);
  if (pageNodes.length === 0) {
    throw new Error('No preview pages were found for PDF export');
  }

  const pageDimensions = getPdfDimensions(pageSize, orientation);
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize.toLowerCase() as 'a4' | 'a3',
    compress: true,
  });

  for (let index = 0; index < pageNodes.length; index += 1) {
    onProgress?.(index, pageNodes.length);
    const pageNode = pageNodes[index];
    const pageHost = document.createElement('div');
    pageHost.setAttribute('aria-hidden', 'true');
    pageHost.style.position = 'fixed';
    pageHost.style.left = '-100000px';
    pageHost.style.top = '0';
    pageHost.style.background = '#ffffff';
    pageHost.style.padding = '0';
    pageHost.style.margin = '0';
    pageHost.style.zIndex = '-1';

    const pageWrapper = document.createElement('div');
    pageWrapper.className = (previewContainer as HTMLElement).className || '';
    pageWrapper.style.transform = 'none';
    pageWrapper.style.margin = '0';
    pageWrapper.style.padding = '0';

    const pageClone = pageNode.cloneNode(true) as HTMLElement;
    pageClone.style.transform = 'none';
    pageClone.style.margin = '0';
    pageClone.style.boxShadow = 'none';
    freezePageCounters(pageNode, pageClone, index + 1, pageNodes.length);
    const frozenCounterStyle = document.createElement('style');
    frozenCounterStyle.textContent = `[${FROZEN_COUNTER_ATTRIBUTE}-before]::before, [${FROZEN_COUNTER_ATTRIBUTE}-after]::after { content: none !important; }`;
    pageHost.appendChild(frozenCounterStyle);
    pageWrapper.appendChild(pageClone);
    pageHost.appendChild(pageWrapper);
    document.body.appendChild(pageHost);
    normalizeCanvasUnsupportedColors(pageClone);

    let canvas;
    try {
      // Layout size, not getBoundingClientRect(): a preview zoomed with a CSS
      // transform reports its on-screen size there, and capturing a full-size
      // clone at that size cropped the page to the zoomed fraction.
      const pageWidth = Math.ceil(pageNode.offsetWidth || pageNode.scrollWidth);
      const pageHeight = Math.ceil(pageNode.offsetHeight || pageNode.scrollHeight);
      canvas = await html2canvas(pageClone, {
        backgroundColor: '#ffffff',
        scale: canvasScale,
        useCORS: true,
        logging: false,
        width: pageWidth,
        height: pageHeight,
        windowWidth: pageWidth,
        windowHeight: pageHeight,
      });
    } finally {
      document.body.removeChild(pageHost);
    }

    const imageData =
      imageFormat === 'JPEG'
        ? canvas.toDataURL('image/jpeg', PDF_EXPORT_JPEG_QUALITY)
        : canvas.toDataURL('image/png', 1);
    if (index > 0) {
      pdf.addPage(pageSize.toLowerCase() as 'a4' | 'a3', orientation);
    }
    pdf.addImage(
      imageData,
      imageFormat,
      0,
      0,
      pageDimensions.widthMm,
      pageDimensions.heightMm,
      undefined,
      imageFormat === 'PNG' ? 'SLOW' : undefined,
    );
  }

  onProgress?.(pageNodes.length, pageNodes.length);

  const blob = pdf.output('blob');
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = navigateWealthPdfSaveFileName(title);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
