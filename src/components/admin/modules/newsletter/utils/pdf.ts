/**
 * Newsletter — client-side checks on a chosen PDF, so the admin hears about
 * a problem before the upload starts. The server checks the bytes again.
 */
import { MAX_PDF_BYTES, MAX_PDF_LABEL } from '../constants';

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Why a chosen file cannot be used, or null when it can. */
export function pdfFileProblem(file: File): string | null {
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) || file.type === '';
  if (!looksPdf) return 'Only PDF files can be sent as a newsletter.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_PDF_BYTES) {
    return `That PDF is ${formatFileSize(file.size)}; the limit is ${MAX_PDF_LABEL}.`;
  }
  return null;
}
