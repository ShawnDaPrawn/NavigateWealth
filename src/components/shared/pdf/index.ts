/**
 * Shared PDF primitives.
 *
 * BasePdfLayout is the page shell every printed document in the app is built
 * on — FNA reports, will documents, calendar exports, risk profiles, legal
 * documents. It used to sit inside the resources module, which meant six
 * separate features reached across a module boundary to print anything, and
 * the legal-document renderer in shared/ ended up coupled both ways with
 * resources. It depends on nothing but React, so the shared layer is its
 * natural home.
 */
export { BasePdfLayout, BASE_PDF_CSS, getPdfDimensions } from './BasePdfLayout';
export type { PdfOrientation, PdfPageSize } from './BasePdfLayout';
export {
  exportPdfFromPreview,
  resolvePdfExportPages,
  resolvePdfPreviewContainer,
} from './pdfExport';
