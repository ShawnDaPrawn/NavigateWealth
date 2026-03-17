/**
 * PDF Export Utilities
 * Handles PDF generation from React components
 */

import { createRoot } from 'react-dom/client';

export interface PdfExportOptions {
  filename?: string;
}

/**
 * Export a React component to PDF using browser print
 */
export async function exportComponentToPdf(
  component: React.ReactElement,
  options: PdfExportOptions = {}
): Promise<void> {
  const {
    filename = 'document.pdf',
  } = options;

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

      // Wait for rendering to complete (longer timeout for complex documents)
      setTimeout(() => {
        // Trigger print dialog
        window.print();

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