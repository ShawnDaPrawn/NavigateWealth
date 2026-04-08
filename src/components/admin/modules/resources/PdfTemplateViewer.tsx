import React, { useState, useRef } from 'react';
import { BASE_PDF_CSS, getPdfDimensions, type PdfOrientation, type PdfPageSize } from './templates/BasePdfLayout';
import { LETTER_CSS } from './templates/LetterheadPdfLayout';
import type { LetterMeta } from './templates/LetterheadPdfLayout';
import type { FormBlock } from './builder/types';
import { escapeHtmlText, navigateWealthPdfDocumentTitle } from '../../../../utils/pdfPrintTitle';
import { ZoomIn, ZoomOut, Maximize, X, Download, FileText, Loader2 } from 'lucide-react';

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
}

export const PdfTemplateViewer = ({ 
  open, 
  onOpenChange,
  title = "Client Consent Form",
  children,
  pageSize = 'A4',
  orientation = 'portrait',
  isLetter = false,
  letterMeta,
  letterBlocks,
}: PdfTemplateViewerProps) => {
  const [scale, setScale] = useState(1);
  const [wordExporting, setWordExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setScale(1);

  const handleDownload = () => {
    // Get the preview container content
    const previewContainer = contentRef.current?.querySelector('.pdf-preview-container');
    if (!previewContainer) {
      console.error('Preview container not found');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      console.error('Print window could not be opened');
      return;
    }

    const contentMarkup = previewContainer.outerHTML;

    // Use LETTER_CSS for letters (which already includes BASE_PDF_CSS),
    // or BASE_PDF_CSS for standard forms
    const layoutCSS = isLetter ? LETTER_CSS : BASE_PDF_CSS;
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
            ${layoutCSS}

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
            }
          </style>
        </head>
        <body>
          ${contentMarkup}
        </body>
      </html>
    `);
    printWindow.document.close();

    const triggerPrint = async () => {
      try {
        if (printWindow.document.fonts?.ready) {
          await printWindow.document.fonts.ready;
        }
      } catch (error) {
        console.warn('[PdfTemplateViewer] Waiting for print fonts failed', error);
      }

      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();

        window.setTimeout(() => {
          printWindow.close();
        }, 1000);
      }, 300);
    };

    void triggerPrint();
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
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Download className="w-4 h-4" />
                Print / Save as PDF
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
