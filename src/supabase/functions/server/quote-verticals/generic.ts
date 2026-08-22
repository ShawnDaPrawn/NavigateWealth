/**
 * The fallback rendering for a submission that matches no vertical.
 *
 * Kept alongside the six verticals because it is the seventh branch of the same
 * two dispatches — a flat camelCase-to-Title-Case walk over whatever the
 * payload happens to carry. Moved verbatim.
 */
import type { QuoteProductDetails, QuotePdfField } from './types.ts';

export function genericPdfFields(productDetails: QuoteProductDetails): QuotePdfField[] {
  const pdfFields: QuotePdfField[] = [];

  // Standard flat product details
  for (const [key, value] of Object.entries(productDetails)) {
    if (value) {
      // Format the key for display: camelCase → Title Case
      const displayKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s: string) => s.toUpperCase())
        .trim();
      pdfFields.push({ label: displayKey, value: String(value) });
    }
  }

  return pdfFields;
}

export function genericHtml(productDetails: QuoteProductDetails): string {
  // Standard flat entries
  const entries = Object.entries(productDetails).filter(([, v]) => v);
  if (entries.length === 0) return '';

  return entries
    .map(([key, value]) => {
      const displayKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s: string) => s.toUpperCase())
        .trim();
      return `<p style="margin: 8px 0;"><strong>${displayKey}:</strong> ${String(value)}</p>`;
    })
    .join('');
}
