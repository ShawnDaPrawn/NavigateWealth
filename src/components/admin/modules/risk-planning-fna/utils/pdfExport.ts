/**
 * PDF Export Utilities
 * Handles PDF generation from React components
 */

import { createRoot } from 'react-dom/client';
import { withNavigateWealthPrintTitle } from '../../../../../utils/pdfPrintTitle';

export interface PdfExportOptions {
  /** Legacy; used as fallback for print title when printTitle is omitted */
  filename?: string;
  /** Text after "Navigate Wealth - " for browser Save-as-PDF filename */
  printTitle?: string;
}

function resolvePrintTitleSuffix(options: PdfExportOptions): string {
  const explicit = options.printTitle?.trim();
  if (explicit) return explicit;
  const fn = options.filename?.trim();
  if (fn && !/^document\.pdf$/i.test(fn)) {
    return fn.replace(/\.pdf$/i, '').replace(/_/g, ' ');
  }
  return 'Document';
}

export async function exportComponentToPdf(
  component: React.ReactElement,
  options: PdfExportOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary container
      const printContainer = document.createElement('div');
      printContainer.style.position = 'fixed';
      printContainer.style.top = '0';
      printContainer.style.left = '0';
      printContainer.style.width = '100%';
      printContainer.style.height = '100%';
      printContainer.style.zIndex = '9999';
      printContainer.style.backgroundColor = 'white';
      printContainer.style.overflow = 'visible'; // Changed from 'auto' to 'visible' to prevent scrollbars
      
      document.body.appendChild(printContainer);

      // Render the React component
      const root = createRoot(printContainer);
      root.render(component);

      const titleSuffix = resolvePrintTitleSuffix(options);

      // Wait for rendering to complete (longer timeout for complex documents)
      setTimeout(() => {
        withNavigateWealthPrintTitle(titleSuffix, () => window.print(), 1200);

        // Cleanup after print
        setTimeout(() => {
          root.unmount();
          document.body.removeChild(printContainer);
          resolve();
        }, 500);
      }, 1500); // Increased from 1000ms to 1500ms for better rendering
    } catch (error) {
      reject(new Error('Failed to generate PDF'));
    }
  });
}