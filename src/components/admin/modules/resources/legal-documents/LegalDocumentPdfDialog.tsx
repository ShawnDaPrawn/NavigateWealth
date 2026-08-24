/**
 * The legal-document PDF preview dialog.
 *
 * The rest of the legal PDF renderer is layout and pagination logic with no
 * module dependencies, so it stays in shared/ where the public legal pages can
 * use it. This dialog is the one piece that wraps the resources module's
 * PdfTemplateViewer, so it lives here instead — which is also where its main
 * consumer is, the legal-document draft editor.
 *
 * Exported from the resources barrel for the public legal document page.
 */
import { useEffect, useState } from 'react';
import { PdfTemplateViewer } from '../PdfTemplateViewer';
import {
  LegalDocumentPdfLayout,
  type LegalPdfDocumentData,
} from '../../../../shared/LegalDocumentPdf';
import { DEFAULT_LEGAL_PDF_CONFIG } from '../../../../shared/legalPdfPrintDocument';
import {
  resolveActiveLegalPdfRenderer,
  type LegalPdfRendererVersion,
} from '../../../../shared/legalPdfRendererConfig';

export function LegalDocumentPdfDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalPdfDocumentData | null;
}) {
  const rendererResolution = resolveActiveLegalPdfRenderer();
  const [pagedRenderState, setPagedRenderState] = useState<{
    ready: boolean;
    error: string | null;
    activeRenderer: LegalPdfRendererVersion;
  }>({
    ready: rendererResolution.effectiveVersion !== 'paged',
    error: null,
    activeRenderer: rendererResolution.effectiveVersion,
  });

  useEffect(() => {
    setPagedRenderState({
      ready: rendererResolution.effectiveVersion !== 'paged',
      error: null,
      activeRenderer: rendererResolution.effectiveVersion,
    });
  }, [document, rendererResolution.effectiveVersion]);

  if (!document) return null;

  const pdfConfig = document.pdfConfig || DEFAULT_LEGAL_PDF_CONFIG;
  const activePageSelector =
    pagedRenderState.activeRenderer === 'paged' ? '.pagedjs_page' : '.pdf-page';

  return (
    <PdfTemplateViewer
      open={open}
      onOpenChange={onOpenChange}
      title={document.title}
      pageSize={pdfConfig.pageSize}
      orientation={pdfConfig.orientation}
      primaryActionLabel="Print / Save PDF"
      pageSelector={activePageSelector}
      pdfExportReady={
        rendererResolution.effectiveVersion === 'paged' ? pagedRenderState.ready : true
      }
      pdfPreparingLabel={
        pagedRenderState.error ? 'Falling back to legacy preview...' : 'Preparing paged preview...'
      }
    >
      <LegalDocumentPdfLayout
        document={document}
        rendererVersion={rendererResolution.effectiveVersion}
        onPagedRendererStateChange={setPagedRenderState}
      />
    </PdfTemplateViewer>
  );
}
