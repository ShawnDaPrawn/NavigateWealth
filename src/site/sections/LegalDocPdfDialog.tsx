/**
 * LegalDocPdfDialog — "Download PDF" on a legal document: a preview of the
 * printed pages with zoom, print and download, drawn as the document board
 * draws it.
 *
 * Everything it does is the live preview's (components/shared/
 * LegalDocumentPdfDialog.tsx): the same page layout and renderer
 * (LegalDocumentPdfLayout), the same export to a file (exportPdfFromPreview
 * at the same image settings), the same print window (printPdfPreview), the
 * same zoom steps, the same messages. A finished download is confirmed in the
 * board's own notice; problems go to the site's toasts with the live wording.
 *
 * The pages are deliberately rendered outside `.nw-site`. They are what the
 * export captures, and the redesign's type rules (serif headings, balanced
 * and "pretty" line breaking) would otherwise reach them and change the
 * downloaded PDF. Only the header and the notice carry `.nw-site`; the frame
 * around the pages is styled by its own `nwld-pdf-` classes.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import {
  LegalDocumentPdfLayout,
  type LegalPdfDocumentData,
} from '../../components/shared/LegalDocumentPdf';
import {
  DEFAULT_LEGAL_PDF_CONFIG,
  LEGAL_PDF_EXPORT_IMAGE,
} from '../../components/shared/legalPdfPrintDocument';
import {
  resolveActiveLegalPdfRenderer,
  type LegalPdfRendererVersion,
} from '../../components/shared/legalPdfRendererConfig';
import {
  BASE_PDF_CSS,
  exportPdfFromPreview,
  printPdfPreview,
  resolvePdfExportPages,
} from '../../components/shared/pdf';
import {
  PDF_VIEWER_MAX_ZOOM,
  PDF_VIEWER_MIN_ZOOM,
  currentPageFromTops,
  stepZoom,
} from '../../components/shared/pdfViewerZoom';
import { LegalIcon } from './LegalIcons';
import { pdfMetaLine } from './legalDocumentModel';

type PagedRenderState = {
  ready: boolean;
  error: string | null;
  activeRenderer: LegalPdfRendererVersion;
};

type ZoomSetting = 'fit' | number;

/** The board fits a page to the width, up to 760px wide. */
const FIT_MAX_WIDTH = 760;
/** How long the board's "PDF downloaded" notice stays. */
const NOTICE_MS = 2600;

interface LegalDocPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LegalPdfDocumentData | null;
}

export function LegalDocPdfDialog({ open, onOpenChange, document }: LegalDocPdfDialogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root open={open && Boolean(document)} onOpenChange={onOpenChange}>
      {document ? (
        <Dialog.Portal>
          <Dialog.Overlay className="nwld-pdf-overlay">
            <Dialog.Content
              className="nwld-pdf-panel"
              // Focus the pages rather than the first toolbar button, so the
              // arrow keys scroll the document straight away (as live).
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                scrollRef.current?.focus({ preventScroll: true });
              }}
            >
              <PdfViewerBody document={document} scrollRef={scrollRef} />
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}

function horizontalPadding(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
}

function PdfViewerBody({
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
  const [available, setAvailable] = useState(0);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<ZoomSetting>('fit');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrolling, setScrolling] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  // Width available to the pages: the scroll area less its padding.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setAvailable(element.clientWidth - horizontalPadding(element));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  // The pages' natural size; offsetWidth/offsetHeight ignore the zoom transform.
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
  const showPreview =
    previewReady && contentSize !== null && contentSize.width > 0 && available > 0;
  const fitScale = contentSize
    ? Math.min(
        1,
        Math.max(
          PDF_VIEWER_MIN_ZOOM,
          Math.min(available, contentSize.width > 800 ? contentSize.width : FIT_MAX_WIDTH) /
            contentSize.width,
        ),
      )
    : 1;
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
  const noticeTimerRef = useRef<number | null>(null);
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
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  const flash = (text: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(text);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  };

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
      flash('PDF downloaded');
    } catch (error) {
      console.error('[LegalDocPdfDialog] PDF export failed:', error);
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
  const percent = `${Math.round(scale * 100)}%`;
  const isFit = zoom === 'fit';

  return (
    <>
      <div className="nw-site nwld-pdf-head">
        <div className="nwld-pdf-titles">
          <Dialog.Title className="nw-h nwld-pdf-title">{document.title}</Dialog.Title>
          <Dialog.Description className="nw-mono nwld-pdf-meta">
            {pdfMetaLine(pdfConfig, document.version)}
          </Dialog.Description>
        </div>
        <div className="nwld-pdf-tools">
          <div className="nwld-zoom" role="group" aria-label="Zoom">
            <button
              type="button"
              className="nwld-iconbtn nwld-zoom-step"
              aria-label="Zoom out"
              onClick={() => handleZoom(-1)}
              disabled={!showPreview || scale <= PDF_VIEWER_MIN_ZOOM}
            >
              <LegalIcon name="minus" size={16} strokeLinejoin={undefined} />
            </button>
            <button
              type="button"
              className="nwld-iconbtn nwld-zoom-fit"
              title={isFit ? 'Show actual size' : 'Fit to width'}
              aria-label={
                isFit ? `${percent}, fitted to width. Show actual size` : `${percent}. Fit to width`
              }
              onClick={handleToggleFit}
              disabled={!showPreview}
            >
              {!showPreview ? '–' : isFit ? 'Fit' : percent}
            </button>
            <button
              type="button"
              className="nwld-iconbtn nwld-zoom-step"
              aria-label="Zoom in"
              onClick={() => handleZoom(1)}
              disabled={!showPreview || scale >= PDF_VIEWER_MAX_ZOOM}
            >
              <LegalIcon name="plus" size={16} strokeLinejoin={undefined} />
            </button>
          </div>
          <button
            type="button"
            className="nw-outline nwld-pdf-action"
            onClick={handlePrint}
            disabled={!previewReady}
          >
            <LegalIcon name="printer" size={16} />
            Print
          </button>
          <button
            type="button"
            className="nw-btn nwld-pdf-action nwld-pdf-download"
            onClick={() => void handleDownload()}
            disabled={downloadDisabled}
          >
            <LegalIcon
              name={exportProgress ? 'spinner' : 'download'}
              size={16}
              className={exportProgress ? 'nwld-spin' : undefined}
            />
            {downloadLabel}
          </button>
          <Dialog.Close className="nwld-iconbtn nwld-pdf-close" aria-label="Close preview">
            <LegalIcon name="close" size={18} strokeLinejoin={undefined} />
          </Dialog.Close>
        </div>
      </div>

      <div className="nwld-pdf-body">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label={`${document.title}, document pages`}
          className={showPreview ? 'nwld-pdf-scroll' : 'nwld-pdf-scroll nwld-pdf-scroll--held'}
        >
          <div
            className="nwld-pdf-frame"
            style={
              showPreview && contentSize
                ? { width: contentSize.width * scale, height: contentSize.height * scale }
                : undefined
            }
          >
            <div
              ref={contentRef}
              className={
                showPreview ? 'nwld-pdf-content' : 'nwld-pdf-content nwld-pdf-content--hidden'
              }
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

        {!showPreview ? <PreviewLoading /> : null}

        {showPreview && pageCount > 1 ? (
          <div
            aria-hidden="true"
            className={scrolling ? 'nwld-pdf-pageno nwld-pdf-pageno--on' : 'nwld-pdf-pageno'}
          >
            Page {currentPage} of {pageCount}
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="nw-site nwld-toast" role="status" aria-live="polite">
          <LegalIcon name="check" size={16} stroke="#4ADE80" />
          {notice}
        </div>
      ) : null}
    </>
  );
}

function PreviewLoading() {
  return (
    <div className="nwld-pdf-loading">
      <div className="nwld-pdf-skeleton" aria-hidden="true">
        <div className="nwld-pdf-skel-line" style={{ width: '33%', height: 16 }} />
        <div className="nwld-pdf-skel-line nwld-pdf-skel-line--soft" style={{ width: '50%' }} />
        <div className="nwld-pdf-skel-gap" />
        {[92, 100, 96, 88, 100, 72].map((width, index) => (
          <div
            key={index}
            className="nwld-pdf-skel-line nwld-pdf-skel-line--soft"
            style={{ width: `${width}%`, height: 10 }}
          />
        ))}
      </div>
      <div className="nw-site nwld-pdf-preparing" role="status">
        <LegalIcon name="spinner" size={16} className="nwld-spin" />
        Preparing your document…
      </div>
    </div>
  );
}
