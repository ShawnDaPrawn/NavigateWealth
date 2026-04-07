/**
 * Consistent "Save as PDF" / print-dialog naming across the app.
 * Browsers typically suggest a filename from the printed document's <title>.
 */

/** Visible document title for HTML <title> (escape with escapeHtmlText before injecting). */
export function navigateWealthPdfDocumentTitle(documentTitle: string | null | undefined): string {
  const trimmed = (documentTitle ?? '').trim();
  const suffix = trimmed.length > 0 ? trimmed : 'Document';
  return `Navigate Wealth - ${suffix}`;
}

/** Safe for HTML text / <title> content. */
export function escapeHtmlText(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Windows/macOS filename body (no extension); keeps spaces, strips illegal characters. */
export function sanitizeWindowsFileName(name: string): string {
  const cleaned = String(name)
    .replace(/[/\\:*?"<>|]+/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.length > 0 ? cleaned : 'Document';
}

export function navigateWealthPdfSaveFileName(documentTitle: string | null | undefined): string {
  return `${sanitizeWindowsFileName(navigateWealthPdfDocumentTitle(documentTitle))}.pdf`;
}

/**
 * Sets document.title for the browser print / Save-as-PDF filename hint, runs printFn, then restores the previous title.
 */
export function withNavigateWealthPrintTitle(
  documentTitleSuffix: string | null | undefined,
  printFn: () => void,
  restoreAfterMs = 1000,
): void {
  const prev = document.title;
  document.title = navigateWealthPdfDocumentTitle(documentTitleSuffix);
  printFn();
  window.setTimeout(() => {
    document.title = prev;
  }, restoreAfterMs);
}
