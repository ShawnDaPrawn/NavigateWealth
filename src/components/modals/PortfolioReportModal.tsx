import React, { useRef } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { PDFPortfolioReport } from '../modules/portfolio/PDFPortfolioReport';
import { ClientPortfolioData } from '../../utils/pdfGenerator';
import { Download, X, Printer } from 'lucide-react';

interface PortfolioReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientData: ClientPortfolioData;
}

export function PortfolioReportModal({ isOpen, onClose, clientData }: PortfolioReportModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // Trigger browser print - the print styles will handle showing only the print version
    window.print();
  };

  const handleDownload = () => {
    // Same as print - users can "Save as PDF" in the print dialog
    window.print();
  };

  return (
    <div className="contents">
      <style>{`
        @media print {
          /* Hide everything except the print version */
          body * {
            visibility: hidden !important;
          }
          
          #pdf-print-content,
          #pdf-print-content * {
            visibility: visible !important;
          }
          
          #pdf-print-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          /* Ensure proper page breaks */
          .pdf-page {
            page-break-after: always !important;
            page-break-inside: avoid !important;
          }
          
          .pdf-page:last-child {
            page-break-after: auto !important;
          }
        }
        
        @media screen {
          /* Hide the default dialog close button */
          [data-slot="dialog-content"] > [data-slot="dialog-close"] {
            display: none !important;
          }
          
          /* Custom scrollbar for preview */
          .pdf-preview-scroll::-webkit-scrollbar {
            width: 8px;
          }
          
          .pdf-preview-scroll::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }
          
          .pdf-preview-scroll::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
          }
          
          .pdf-preview-scroll::-webkit-scrollbar-thumb:hover {
            background: #555;
          }
        }
      `}</style>
      
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-[1100px] max-h-[95vh] p-0 gap-0 overflow-hidden">
          {/* Header - no print */}
          <div className="no-print flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-xl text-gray-900">Portfolio Report Preview</h2>
              <p className="text-sm text-gray-600 mt-1">
                Review your comprehensive portfolio report before downloading
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-[#6d28d9] hover:bg-[#5b21b6] gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Preview Area with Scroll - scaled down to fit */}
          <div className="no-print overflow-y-auto bg-gray-100 pdf-preview-scroll" style={{ maxHeight: 'calc(95vh - 160px)' }}>
            <div className="flex justify-center py-8 px-4">
              <div style={{ transform: 'scale(0.75)', transformOrigin: 'top center' }}>
                <PDFPortfolioReport clientData={clientData} />
              </div>
            </div>
          </div>

          {/* Footer - no print */}
          <div className="no-print px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between sticky bottom-0 z-10">
            <p className="text-sm text-gray-600">
              Click "Download PDF" to save or "Print" to print directly
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Hidden print-only version at full scale - positioned outside modal */}
      <div 
        id="pdf-print-content"
        ref={printContentRef}
        style={{ 
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          zIndex: -1
        }}
      >
        <PDFPortfolioReport clientData={clientData} />
      </div>
    </div>
  );
}