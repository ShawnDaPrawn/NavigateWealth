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
const PDF_EXPORT_CANVAS_SCALE = PDF_EXPORT_TARGET_DPI / CSS_PIXELS_PER_INCH;
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
}: {
  root: HTMLElement;
  title: string;
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  pageSelector?: string;
}) {
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
    pageWrapper.appendChild(pageClone);
    pageHost.appendChild(pageWrapper);
    document.body.appendChild(pageHost);
    normalizeCanvasUnsupportedColors(pageClone);

    let canvas;
    try {
      const rect = pageNode.getBoundingClientRect();
      canvas = await html2canvas(pageClone, {
        backgroundColor: '#ffffff',
        scale: PDF_EXPORT_CANVAS_SCALE,
        useCORS: true,
        logging: false,
        width: Math.ceil(rect.width || pageNode.scrollWidth),
        height: Math.ceil(rect.height || pageNode.scrollHeight),
        windowWidth: Math.ceil(rect.width || pageNode.scrollWidth),
        windowHeight: Math.ceil(rect.height || pageNode.scrollHeight),
      });
    } finally {
      document.body.removeChild(pageHost);
    }

    const imageData = canvas.toDataURL('image/png', 1);
    if (index > 0) {
      pdf.addPage(pageSize.toLowerCase() as 'a4' | 'a3', orientation);
    }
    pdf.addImage(
      imageData,
      'PNG',
      0,
      0,
      pageDimensions.widthMm,
      pageDimensions.heightMm,
      undefined,
      'SLOW',
    );
  }

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
