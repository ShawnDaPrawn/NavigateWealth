/**
 * The legal-document PDF preview: what "Download PDF" on a public legal page
 * opens, and what the admin draft editor uses to proof a draft.
 *
 * It is built for phones first. A page is an A4 sheet about 794px wide. The
 * previous viewer (the resources module's PdfTemplateViewer) showed it at full
 * size in a row centred with `justify-center`, so on a 390px screen the left
 * half overflowed where no scrollbar reaches, and the header's zoom controls
 * and print button pushed its own close button off the edge. Here:
 *
 * - The sheet is scaled to fit the width by default, and the scaled size is
 *   given to the layout. A CSS transform alone keeps the unscaled box, which is
 *   what left dead space or clipped edges when zooming before.
 * - Phones get a full-screen sheet with the actions in a bottom bar; larger
 *   screens get a centred sheet with them in the header.
 * - "Download PDF" saves a file on every device. Print, which goes through the
 *   browser's print dialog, is offered where there is a desktop dialog to use.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Download, FileText, Loader2, Printer, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../ui/utils';
import { LegalDocumentPdfLayout, type LegalPdfDocumentData } from './LegalDocumentPdf';
import { DEFAULT_LEGAL_PDF_CONFIG, LEGAL_PDF_EXPORT_IMAGE } from './legalPdfPrintDocument';
import {
  resolveActiveLegalPdfRenderer,
  type LegalPdfRendererVersion,
} from './legalPdfRendererConfig';
import { BASE_PDF_CSS, exportPdfFromPreview, printPdfPreview, resolvePdfExportPages } from './pdf';
import {
  PDF_VIEWER_MAX_ZOOM,
  PDF_VIEWER_MIN_ZOOM,
  currentPageFromTops,
  fitToWidthScale,
  stepZoom,
} from './pdfViewerZoom';

type PagedRenderState = {
  ready: boolean;
  error: string | null;
  activeRenderer: LegalPdfRendererVersion;
};

type ZoomSetting = 'fit' | number;

// The paged preview ships a grey frame and padding of its own, made for the old
// viewer. Here the scroll area provides both, so they would double up. Scoped to
// this viewer, and outside the preview root so a print never picks it up.
const VIEWER_CSS = `
  .nw-legal-pdf-viewer .legal-paged-preview-root {
    background: transparent;
    padding: 0;
  }
  .nw-legal-pdf-viewer .legal-paged-preview-root .pagedjs_page {
    border: 0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08);
  }
  .nw-legal-pdf-viewer .pdf-viewport {
    background: transparent;
    padding: 0;
    min-height: 0;
  }
`;

const PRIMARY_BUTTON = 'bg-neutral-950 text-white hover:bg-neutral-800';

export function LegalDocumentPdfDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalPdfDocumentData | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // The Radix primitive rather than ui/DialogContent: that wrapper centres a
  // small card and adds its own close button and fallback title, where this
  // needs a full-screen sheet on phones with the title inside its header.
  return (
    <Dialog open={open && Boolean(document)} onOpenChange={onOpenChange}>
      {document && (
        <DialogPortal>
          <DialogOverlay className="bg-neutral-950/70" />
          <DialogPrimitive.Content
            // Focus the pages rather than the first toolbar button, so the arrow
            // keys scroll the document straight away.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              scrollRef.current?.focus({ preventScroll: true });
            }}
            className={cn(
              'nw-legal-pdf-viewer fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl outline-none',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200',
              // Phones: the whole screen.
              'inset-x-0 top-0 h-dvh w-full',
              // Larger screens: a large sheet centred over the page.
              'sm:top-1/2 sm:left-1/2 sm:h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-neutral-200 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
            )}
          >
            <style dangerouslySetInnerHTML={{ __html: VIEWER_CSS }} />
            <LegalPdfViewerBody document={document} scrollRef={scrollRef} />
          </DialogPrimitive.Content>
        </DialogPortal>
      )}
    </Dialog>
  );
}

function LegalPdfViewerBody({
  document,
  scrollRef,
}: {
  document: LegalPdfDocumentData;
  scrollRef: RefObject<HTMLDivElement>;
}) {
  const pdfConfig = document.pdfConfig || DEFAULT_LEGAL_PDF_CONFIG;
  const [rendererVersion] = useState(() => resolveActiveLegalPdfRenderer().effectiveVersion);
  const [renderState, setRenderState] = useState<PagedRenderState>(() => ({
    ready: rendererVersion !== 'paged',
    error: null,
    activeRenderer: rendererVersion,
  }));
  // A failed paged render reports itself ready on the legacy renderer.
  const previewReady = renderState.activeRenderer === 'paged' ? renderState.ready : true;
  const pageSelector = renderState.activeRenderer === 'paged' ? '.pagedjs_page' : '.pdf-page';

  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<ZoomSetting>('fit');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrolling, setScrolling] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

  // Width available to the pages.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setViewportWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  // The pages' natural size. offsetWidth/offsetHeight ignore the zoom
  // transform, which is exactly what is wanted here.
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const update = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setContentSize((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
      setPageCount(resolvePdfExportPages(element, pageSelector).length);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageSelector, previewReady]);

  // Scaling is held at 1 until the paged renderer has finished: it measures
  // the pages as it lays them out, and a transformed ancestor would skew that.
  const showPreview = previewReady && contentSize !== null && viewportWidth > 0;
  const fitScale = contentSize ? fitToWidthScale(contentSize.width, viewportWidth) : 1;
  const scale = showPreview ? (zoom === 'fit' ? fitScale : zoom) : 1;

  // Keep the point at the centre of the screen in place when the zoom changes.
  const previousScaleRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const previous = previousScaleRef.current;
    previousScaleRef.current = showPreview ? scale : null;
    if (!element || !showPreview || previous === null || previous === scale) return;
    const ratio = scale / previous;
    const centreX = element.scrollLeft + element.clientWidth / 2;
    const centreY = element.scrollTop + element.clientHeight / 2;
    element.scrollLeft = centreX * ratio - element.clientWidth / 2;
    element.scrollTop = centreY * ratio - element.clientHeight / 2;
  }, [scale, showPreview, scrollRef]);

  const updateCurrentPage = useCallback(() => {
    const element = scrollRef.current;
    const content = contentRef.current;
    if (!element || !content) return;
    const probe = element.getBoundingClientRect().top + element.clientHeight / 3;
    const pageTops = resolvePdfExportPages(content, pageSelector).map(
      (page) => page.getBoundingClientRect().top,
    );
    setCurrentPage(currentPageFromTops(pageTops, probe));
  }, [pageSelector, scrollRef]);

  const frameRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const handleScroll = () => {
    setScrolling(true);
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setScrolling(false), 1200);
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updateCurrentPage();
    });
  };
  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
    },
    [],
  );

  const handleZoom = (direction: 1 | -1) => setZoom(stepZoom(scale, direction));
  const handleToggleFit = () => setZoom((current) => (current === 'fit' ? 1 : 'fit'));

  const handleDownload = async () => {
    const root = contentRef.current;
    if (!previewReady || !root || exportProgress) return;
    setExportProgress({ done: 0, total: pageCount || 1 });
    try {
      await exportPdfFromPreview({
        root,
        title: document.title,
        pageSize: pdfConfig.pageSize,
        orientation: pdfConfig.orientation,
        pageSelector,
        onProgress: (done, total) => setExportProgress({ done, total }),
        ...LEGAL_PDF_EXPORT_IMAGE,
      });
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('[LegalDocumentPdfDialog] PDF export failed:', error);
      toast.error(
        error instanceof Error
          ? `PDF download failed: ${error.message}`
          : 'PDF download failed. Please try again.',
      );
    } finally {
      setExportProgress(null);
    }
  };

  const handlePrint = () => {
    if (!previewReady) return;
    const opened = printPdfPreview({
      root: contentRef.current,
      title: document.title,
      pageSize: pdfConfig.pageSize,
      orientation: pdfConfig.orientation,
      pageSelector,
      layoutCss: BASE_PDF_CSS,
    });
    if (!opened) {
      toast.error('The print view could not be opened.', {
        description: 'If your browser blocks pop-ups, allow them for this site and try again.',
      });
    }
  };

  const downloadLabel = exportProgress
    ? exportProgress.total > 1
      ? `Preparing ${Math.min(exportProgress.done + 1, exportProgress.total)} of ${exportProgress.total}…`
      : 'Preparing PDF…'
    : 'Download PDF';
  const downloadDisabled = !previewReady || exportProgress !== null;
  const downloadIcon = exportProgress ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Download className="h-4 w-4" />
  );

  const meta = [
    `Version ${document.version}`,
    previewReady && pageCount > 0
      ? `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
      : 'Preparing preview…',
    pdfConfig.pageSize,
  ].join(' · ');

  const zoomControls = (className?: string) => (
    <ZoomControls
      className={className}
      scale={scale}
      isFit={zoom === 'fit'}
      disabled={!showPreview}
      onZoomOut={() => handleZoom(-1)}
      onZoomIn={() => handleZoom(1)}
      onToggleFit={handleToggleFit}
    />
  );

  return (
    <>
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200 sm:flex">
          <FileText className="h-5 w-5 text-neutral-900" />
        </div>
        <div className="min-w-0 flex-1">
          <DialogTitle className="truncate text-base leading-tight font-semibold text-neutral-950 sm:text-lg">
            {document.title}
          </DialogTitle>
          <DialogDescription className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
            {meta}
          </DialogDescription>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          {zoomControls()}
          <div className="mx-1 h-6 w-px bg-neutral-200" aria-hidden="true" />
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            disabled={!previewReady}
            className="h-10 border-neutral-300 text-neutral-900"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            type="button"
            onClick={() => void handleDownload()}
            disabled={downloadDisabled}
            className={cn('h-10 min-w-[10rem]', PRIMARY_BUTTON)}
          >
            {downloadIcon}
            {downloadLabel}
          </Button>
        </div>

        <DialogClose
          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-none sm:mr-0"
          aria-label="Close preview"
        >
          <X className="h-5 w-5" />
        </DialogClose>
      </header>

      <div className="relative min-h-0 flex-1 bg-neutral-100">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label={`${document.title}, document pages`}
          className={cn(
            'absolute inset-0 overscroll-contain px-3 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-950 sm:px-8 sm:py-8',
            showPreview ? 'overflow-auto' : 'overflow-hidden',
          )}
        >
          <div
            className="mx-auto"
            style={
              showPreview && contentSize
                ? { width: contentSize.width * scale, height: contentSize.height * scale }
                : undefined
            }
          >
            <div
              ref={contentRef}
              className={cn('w-max origin-top-left', !showPreview && 'invisible')}
              style={showPreview && scale !== 1 ? { transform: `scale(${scale})` } : undefined}
            >
              <LegalDocumentPdfLayout
                document={document}
                rendererVersion={rendererVersion}
                onPagedRendererStateChange={setRenderState}
              />
            </div>
          </div>
        </div>

        {!showPreview && <PreviewLoading />}

        {showPreview && pageCount > 1 && (
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-neutral-950/85 px-3 py-1.5 text-xs font-medium text-white tabular-nums shadow-lg transition-opacity duration-300',
              scrolling ? 'opacity-100' : 'opacity-0',
            )}
          >
            Page {currentPage} of {pageCount}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-neutral-200 bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        {zoomControls('h-11')}
        <Button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloadDisabled}
          className={cn('h-11 flex-1', PRIMARY_BUTTON)}
        >
          {downloadIcon}
          {downloadLabel}
        </Button>
      </footer>
    </>
  );
}

function ZoomControls({
  className,
  scale,
  isFit,
  disabled,
  onZoomOut,
  onZoomIn,
  onToggleFit,
}: {
  className?: string;
  scale: number;
  isFit: boolean;
  disabled: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onToggleFit: () => void;
}) {
  const percent = `${Math.round(scale * 100)}%`;
  const stepButton =
    'flex h-full w-10 items-center justify-center text-neutral-700 transition-colors hover:bg-neutral-50 hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-40';

  return (
    <div
      role="group"
      aria-label="Zoom"
      className={cn(
        'flex h-10 shrink-0 items-center overflow-hidden rounded-lg border border-neutral-200 bg-white',
        className,
      )}
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={disabled || scale <= PDF_VIEWER_MIN_ZOOM}
        className={stepButton}
        aria-label="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleFit}
        disabled={disabled}
        className="h-full min-w-[3.75rem] border-x border-neutral-200 px-2 text-xs font-medium text-neutral-800 tabular-nums transition-colors hover:bg-neutral-50 disabled:opacity-50"
        title={isFit ? 'Show actual size' : 'Fit to width'}
        aria-label={
          isFit ? `${percent}, fitted to width. Show actual size` : `${percent}. Fit to width`
        }
      >
        {disabled ? '–' : percent}
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={disabled || scale >= PDF_VIEWER_MAX_ZOOM}
        className={stepButton}
        aria-label="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </button>
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="absolute inset-0 flex justify-center overflow-hidden px-3 py-3 sm:px-8 sm:py-8">
      <div
        className="aspect-[210/297] w-full max-w-[794px] rounded-sm bg-white p-6 shadow-sm sm:p-12"
        aria-hidden="true"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded bg-neutral-200" />
          <div className="h-3 w-1/2 rounded bg-neutral-100" />
          <div className="pt-6" />
          {[92, 100, 96, 88, 100, 72].map((width, index) => (
            <div
              key={index}
              className="h-2.5 rounded bg-neutral-100"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
      <div
        role="status"
        className="absolute top-1/3 flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white shadow-lg"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing your document…
      </div>
    </div>
  );
}
