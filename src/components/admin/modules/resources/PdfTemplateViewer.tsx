/* eslint-disable react-refresh/only-export-components */
import React, { useState, useRef } from 'react';
import { BASE_PDF_CSS, type PdfOrientation, type PdfPageSize } from '../../../shared/pdf';
import {
  exportPdfFromPreview,
  resolvePdfExportPages,
  resolvePdfPreviewContainer,
} from '../../../shared/pdf/pdfExport';
// Re-exported so existing importers of this file keep working; the canonical
// home is shared/pdf.
export { exportPdfFromPreview, resolvePdfExportPages, resolvePdfPreviewContainer };
import { printPdfPreview } from '../../../shared/pdf/pdfPrint';
import { LETTER_CSS } from './templates/LetterheadPdfLayout';
import type { LetterMeta } from './templates/LetterheadPdfLayout';
import type { FormBlock } from './builder/types';
import { ZoomIn, ZoomOut, Maximize, X, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PdfTemplateViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  pageSize?: PdfPageSize;
  orientation?: PdfOrientation;
  /** When true, uses LETTER_CSS instead of BASE_PDF_CSS for print */
  isLetter?: boolean;
  /** Letter metadata — required for Word export when isLetter is true */
  letterMeta?: LetterMeta;
  /** Letter body blocks — required for Word export when isLetter is true */
  letterBlocks?: FormBlock[];
  /** Generate a true PDF from the preview pages instead of opening browser print */
  renderPdfFromPreview?: boolean;
  primaryActionLabel?: string;
  pageSelector?: string;
  pdfExportReady?: boolean;
  pdfPreparingLabel?: string;
}

export const PdfTemplateViewer = ({
  open,
  onOpenChange,
  title = 'Client Consent Form',
  children,
  pageSize = 'A4',
  orientation = 'portrait',
  isLetter = false,
  letterMeta,
  letterBlocks,
  renderPdfFromPreview = false,
  primaryActionLabel,
  pageSelector,
  pdfExportReady = true,
  pdfPreparingLabel,
}: PdfTemplateViewerProps) => {
  const [scale, setScale] = useState(1);
  const [wordExporting, setWordExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setScale(1);

  const handleDownloadAsPdf = async () => {
    if (!pdfExportReady) {
      toast.info(pdfPreparingLabel || 'Preparing PDF preview...');
      return;
    }

    setPdfExporting(true);

    try {
      if (!contentRef.current) {
        throw new Error('PDF preview is not ready yet. Please try again in a moment.');
      }

      await exportPdfFromPreview({
        root: contentRef.current,
        title,
        pageSize,
        orientation,
        pageSelector,
      });
    } catch (error) {
      console.error('[PdfTemplateViewer] PDF export failed:', error);
      toast.error(
        error instanceof Error
          ? `PDF download failed: ${error.message}`
          : 'PDF download failed. Please try again.',
      );
    } finally {
      setPdfExporting(false);
    }
  };

  const handlePrintDownload = () => {
    // Use LETTER_CSS for letters (which already includes BASE_PDF_CSS),
    // or BASE_PDF_CSS for standard forms
    printPdfPreview({
      root: contentRef.current,
      title,
      pageSize,
      orientation,
      pageSelector,
      layoutCss: isLetter ? LETTER_CSS : BASE_PDF_CSS,
      isLetter,
    });
  };

  /** Download as Word (.docx) — letter mode only */
  const handleDownloadWord = async () => {
    if (!letterMeta || !letterBlocks) {
      console.error('[PdfTemplateViewer] Cannot export Word — missing letterMeta or letterBlocks');
      return;
    }
    setWordExporting(true);
    try {
      const { exportLetterAsDocx } = await import('./templates/letterDocxExport');
      await exportLetterAsDocx(letterBlocks, letterMeta, title);
    } catch (err) {
      console.error('[PdfTemplateViewer] Word export failed:', err);
    } finally {
      setWordExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in-0">
      <div className="relative w-full max-w-6xl h-[90vh] bg-background rounded-lg shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white z-10">
          <h2 className="text-xl font-semibold">{title}</h2>

          <div className="flex items-center gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-md p-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white rounded-sm text-gray-700 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white rounded-sm text-gray-700 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-white rounded-sm text-gray-700 transition-colors ml-1 border-l border-gray-200"
                title="Reset Zoom"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-200" />

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Word download — letter mode only */}
              {isLetter && letterMeta && letterBlocks && (
                <button
                  onClick={handleDownloadWord}
                  disabled={wordExporting}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-md hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  title="Download as Word document"
                >
                  {wordExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {wordExporting ? 'Generating...' : 'Download Word'}
                </button>
              )}

              <button
                onClick={() => {
                  void (renderPdfFromPreview ? handleDownloadAsPdf() : handlePrintDownload());
                }}
                disabled={pdfExporting || !pdfExportReady}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pdfExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {pdfExporting
                  ? 'Generating PDF...'
                  : !pdfExportReady
                    ? pdfPreparingLabel || 'Preparing PDF preview...'
                    : primaryActionLabel ||
                      (renderPdfFromPreview ? 'Download PDF' : 'Print / Save as PDF')}
              </button>
            </div>

            <button
              onClick={() => onOpenChange(false)}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-auto bg-gray-100/50 p-8 flex justify-center items-start">
          <div
            className="transition-transform duration-200 ease-out origin-top"
            style={{ transform: `scale(${scale})` }}
            ref={contentRef}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
