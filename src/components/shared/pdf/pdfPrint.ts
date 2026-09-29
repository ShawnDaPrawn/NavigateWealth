/**
 * Printing an on-screen PDF preview through the browser's print dialog.
 *
 * The print half of PdfTemplateViewer, moved here so the legal-document viewer
 * in shared/ can print without reaching into the resources module. The page CSS
 * is a parameter because letters print with LETTER_CSS, which lives with the
 * letterhead template in that module.
 *
 * Unlike exportPdfFromPreview, which rasterises each page into a file, this
 * hands the markup to the browser, so the printed (or "Save as PDF") output
 * keeps real, selectable text.
 */
import { getPdfDimensions, type PdfOrientation, type PdfPageSize } from './BasePdfLayout';
import { resolvePdfPreviewContainer } from './pdfExport';
import { escapeHtmlText, navigateWealthPdfDocumentTitle } from '../../../utils/pdfPrintTitle';

/**
 * Opens the preview in a new window and prints it. Returns false when there
 * was nothing to print or the browser refused the window.
 */
export function printPdfPreview({
  root,
  title,
  pageSize,
  orientation,
  pageSelector,
  layoutCss,
  isLetter = false,
}: {
  root: HTMLElement | null;
  title: string;
  pageSize: PdfPageSize;
  orientation: PdfOrientation;
  pageSelector?: string;
  /** Page CSS for the print window: BASE_PDF_CSS for forms, LETTER_CSS for letters. */
  layoutCss: string;
  isLetter?: boolean;
}): boolean {
  // Get the preview container content
  const previewContainer = resolvePdfPreviewContainer(root, pageSelector);
  if (!previewContainer) {
    console.error('Preview container not found');
    return false;
  }

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    console.error('Print window could not be opened');
    return false;
  }

  const contentMarkup = previewContainer.outerHTML;
  const inlinePrintStyles = Array.from(root?.querySelectorAll('style') || [])
    .map((style) => style.textContent || '')
    .join('\n');
  const isPagedLegalPreview = Boolean(
    previewContainer.matches('.legal-paged-preview-root, [data-legal-pdf-renderer="paged"]') ||
    previewContainer.querySelector('.pagedjs_page'),
  );

  const pageDimensions = getPdfDimensions(pageSize, orientation);

  // Print overrides differ for letter vs form pages
  const letterPrintOverrides = `
      /* Letter-specific print overrides */
      .letter-page {
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        width: ${pageDimensions.widthMm}mm !important;
        height: ${pageDimensions.heightMm}mm !important;
        position: relative !important;
        overflow: visible !important;
        page-break-after: always !important;
        break-after: page !important;
      }

      .letter-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      .letter-content {
        height: ${pageDimensions.heightMm}mm !important;
        padding: var(--margin-top) var(--margin-right) var(--margin-bottom-with-footer) var(--margin-left) !important;
        position: relative !important;
      }

      .letter-content.subsequent-page {
        padding-top: 15mm !important;
      }

      .letterhead-block {
        display: flex !important;
      }

      .letter-footer {
        position: absolute !important;
        bottom: var(--margin-bottom) !important;
        left: var(--margin-left) !important;
        right: var(--margin-right) !important;
        height: var(--footer-height) !important;
        display: block !important;
      }

      .letter-closing {
        display: block !important;
      }

      .closing-signatories {
        display: flex !important;
      }
    `;

  const formPrintOverrides = `
      /* Form-specific print overrides */
      .pdf-page {
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        width: ${pageDimensions.widthMm}mm !important;
        height: ${pageDimensions.heightMm}mm !important;
        position: relative !important;
        overflow: hidden !important;
        page-break-after: always !important;
        break-after: page !important;
      }

      .pdf-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }

      .pdf-content {
        padding: var(--margin-top) var(--margin-right) var(--margin-bottom-with-footer) var(--margin-left) !important;
        height: 100% !important;
      }

      .pdf-footer {
        position: absolute !important;
        bottom: var(--margin-bottom) !important;
        left: var(--margin-left) !important;
        right: var(--margin-right) !important;
        width: auto !important;
      }
    `;

  const pagedLegalPrintOverrides = `
      /* Paged legal document print overrides */
      .legal-paged-preview-root {
        background: #ffffff !important;
        padding: 0 !important;
      }

      .legal-paged-preview-root .pagedjs_pages {
        display: block !important;
        gap: 0 !important;
      }

      .legal-paged-preview-root .pagedjs_page {
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        width: ${pageDimensions.widthMm}mm !important;
        height: ${pageDimensions.heightMm}mm !important;
        page-break-after: always !important;
        break-after: page !important;
      }

      .legal-paged-preview-root .pagedjs_page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    `;

  printWindow.document.open();
  printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtmlText(navigateWealthPdfDocumentTitle(title))}</title>
          <style>
            /* Layout styles */
            ${layoutCss}
            ${inlinePrintStyles}

            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Overrides for exact printing with no browser margins */
            @media print {
              @page {
                size: ${pageSize} ${orientation};
                margin: 0 !important;
              }

              html, body {
                width: ${pageDimensions.widthMm}mm;
                margin: 0 !important;
                padding: 0 !important;
                background: white;
              }

              /* Reset the viewport/page wrappers for print */
              .pdf-preview-container {
                display: block !important;
              }

              .pdf-viewport {
                display: block !important;
                background: none !important;
                padding: 0 !important;
                height: auto !important;
                min-height: 0 !important;
              }

              ${isLetter ? letterPrintOverrides : formPrintOverrides}
              ${isPagedLegalPreview ? pagedLegalPrintOverrides : ''}
            }
          </style>
        </head>
        <body>
          ${contentMarkup}
        </body>
      </html>
    `);
  printWindow.document.close();

  // On a desktop browser print() blocks until the dialog is dismissed, so
  // closing the window a second later tidies up after it. On a phone or tablet
  // print() returns at once and the system print sheet is still reading the
  // page, so closing it would cancel the job: there the tab is left open.
  const printReturnsImmediately =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const triggerPrint = async () => {
    try {
      if (printWindow.document.fonts?.ready) {
        await printWindow.document.fonts.ready;
      }
    } catch (error) {
      console.warn('[printPdfPreview] Waiting for print fonts failed', error);
    }

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      if (!printReturnsImmediately) {
        window.setTimeout(() => {
          printWindow.close();
        }, 1000);
      }
    }, 300);
  };

  void triggerPrint();
  return true;
}
