/**
 * Newsletter Studio — the PDF as an email attachment.
 *
 * Built ONCE per campaign per tick and shared by reference across every
 * recipient in the tick; the provider request is where the copies happen
 * (see `deliveryBatchSize`).
 */

import { downloadNewsletterPdf, encodePdfBase64 } from './newsletter-studio-storage.ts';
import type { NewsletterPdf } from './newsletter-studio-types.ts';

/** The attachment shape `sendEmail` accepts on both the SendGrid and SES paths. */
export interface PdfAttachment {
  content: string;
  filename: string;
  type: 'application/pdf';
  disposition: 'attachment';
}

export async function buildPdfAttachment(pdf: NewsletterPdf): Promise<PdfAttachment> {
  const bytes = await downloadNewsletterPdf(pdf.storagePath);
  return {
    content: encodePdfBase64(bytes),
    filename: pdf.fileName,
    type: 'application/pdf',
    disposition: 'attachment',
  };
}

/** Upper bound on concurrent sends without an attachment (the article engine's value). */
export const DELIVERY_BATCH_SIZE = 20;
/** Never fewer than this in flight, however large the PDF. */
export const MIN_DELIVERY_BATCH_SIZE = 2;
/**
 * Budget for base64 in flight per batch. On the SendGrid path `JSON.stringify`
 * plus the fetch body encoding hold two full copies of the attachment per
 * request; on SES it is four to five (MIME assembly, wrap76, SigV4 hashing).
 * 24 MB of base64 × ~5 copies keeps a batch well inside the Edge isolate's
 * memory; at the old fixed 20-wide batch a 5 MB PDF would have been 130 MB
 * of base64 before any copies.
 */
export const ATTACHMENT_BATCH_BUDGET_BYTES = 24 * 1024 * 1024;

/**
 * How many recipients to send to concurrently, given the encoded attachment
 * length: ~3–5 for a 5 MB PDF, up to 20 for a tiny one.
 */
export function deliveryBatchSize(attachmentBase64Length: number): number {
  if (attachmentBase64Length <= 0) return DELIVERY_BATCH_SIZE;
  const fits = Math.floor(ATTACHMENT_BATCH_BUDGET_BYTES / attachmentBase64Length);
  return Math.max(MIN_DELIVERY_BATCH_SIZE, Math.min(DELIVERY_BATCH_SIZE, fits));
}
