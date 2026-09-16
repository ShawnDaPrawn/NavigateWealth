/**
 * Newsletter Studio — the PRIVATE newsletters bucket.
 *
 * WHY A PRIVATE BUCKET AND SIGNED URLS
 * ------------------------------------
 * The newsletter PDF reaches recipients two ways: attached to the email, and
 * behind the "Read the newsletter" button. The button goes through the
 * click-through endpoint, which mints a fresh one-hour signed URL for the
 * campaign's own object at click time (newsletter-studio-engagement.ts). So
 * the object never needs to be world-readable, links in old emails never
 * expire, and every read is counted. A public bucket would give none of that.
 *
 * WHY 5 MB, NOT THE BUCKET-CONVENTIONAL 10 MB
 * -------------------------------------------
 * The PDF rides as a base64 attachment inside every provider request. On the
 * SendGrid path JSON.stringify plus the fetch body encoding hold two full
 * copies per in-flight request; on SES it is four to five. The processor
 * sizes its delivery batch from the encoded length (newsletter-studio-
 * processor.ts), but the cap here is what keeps a whole tick inside the Edge
 * isolate's memory. The UI and both intake paths state it up front.
 *
 * PDFs only, decided by the first bytes rather than the file name: a browser
 * sets `type` from the extension, so a renamed file arrives claiming to be a
 * PDF. Nothing sensitive is ever written here — only marketing newsletters.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import type { NewsletterPdf } from './newsletter-studio-types.ts';

const log = createModuleLogger('newsletter-studio-storage');

export const NEWSLETTER_PDF_BUCKET = 'make-91ed8379-newsletters';

/** The bucket's `fileSizeLimit`, checked here so callers get a 400, not a storage 413. */
export const MAX_NEWSLETTER_PDF_BYTES = 5 * 1024 * 1024;

/** Signed-URL lifetime for an admin preview or a recipient click-through. */
export const PDF_SIGNED_URL_TTL_SECONDS = 3600;

/** Lazy service-role client — never constructed at module top level. */
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

let bucketEnsured = false;

/** Create the private bucket once per isolate (idempotent against the API). */
export async function ensureNewsletterBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: { name: string }) => b.name === NEWSLETTER_PDF_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(NEWSLETTER_PDF_BUCKET, {
      public: false,
      fileSizeLimit: '5MB',
      allowedMimeTypes: ['application/pdf'],
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Failed to create newsletters bucket: ${error.message}`);
    }
    log.info('Created private newsletters bucket', { bucket: NEWSLETTER_PDF_BUCKET });
  }
  bucketEnsured = true;
}

/** Test hook. */
export function resetNewsletterBucketCache(): void {
  bucketEnsured = false;
}

/** Does the byte signature say PDF? (`%PDF-`) */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** `September Newsletter (final).PDF` → `September-Newsletter-final.pdf`; falls back to `newsletter.pdf`. */
export function safePdfFileName(filename: string): string {
  const stem = (filename || '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/[^A-Za-z0-9 _-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${stem || 'newsletter'}.pdf`;
}

export class NewsletterPdfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsletterPdfValidationError';
  }
}

/** Size and signature checks shared by the admin upload and both intake paths. */
export function assertValidPdf(bytes: Uint8Array): void {
  if (bytes.length === 0) {
    throw new NewsletterPdfValidationError('The PDF is empty.');
  }
  if (bytes.length > MAX_NEWSLETTER_PDF_BYTES) {
    const mb = (bytes.length / (1024 * 1024)).toFixed(1);
    throw new NewsletterPdfValidationError(
      `The PDF is ${mb} MB; the limit is ${MAX_NEWSLETTER_PDF_BYTES / (1024 * 1024)} MB.`,
    );
  }
  if (!isPdfBytes(bytes)) {
    throw new NewsletterPdfValidationError('The file is not a PDF.');
  }
}

/**
 * Store a validated PDF under a fresh path. A replaced PDF gets a new uuid,
 * so nothing an email already links to is ever overwritten in place —
 * `upsert: false` turns a collision into a loud failure rather than a
 * silent replacement.
 */
export async function storeNewsletterPdf(input: {
  campaignId: string;
  bytes: Uint8Array;
  fileName: string;
}): Promise<NewsletterPdf> {
  assertValidPdf(input.bytes);
  await ensureNewsletterBucket();
  const storagePath = `${input.campaignId}/${crypto.randomUUID()}.pdf`;
  const { error } = await getSupabase()
    .storage.from(NEWSLETTER_PDF_BUCKET)
    .upload(storagePath, input.bytes, { contentType: 'application/pdf', upsert: false });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return {
    storagePath,
    fileName: safePdfFileName(input.fileName),
    sizeBytes: input.bytes.length,
    uploadedAt: new Date().toISOString(),
  };
}

export async function signedNewsletterPdfUrl(
  storagePath: string,
  expiresSeconds = PDF_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(NEWSLETTER_PDF_BUCKET)
    .createSignedUrl(storagePath, expiresSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`Could not sign ${storagePath}: ${error?.message ?? 'no url'}`);
  }
  return data.signedUrl;
}

export async function downloadNewsletterPdf(storagePath: string): Promise<Uint8Array> {
  const { data, error } = await getSupabase()
    .storage.from(NEWSLETTER_PDF_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(`Could not read ${storagePath}: ${error?.message ?? 'no data'}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Remove one object; a missing object is not an error. */
export async function removeNewsletterPdf(storagePath: string): Promise<void> {
  const { error } = await getSupabase().storage.from(NEWSLETTER_PDF_BUCKET).remove([storagePath]);
  if (error) {
    log.warn('Could not remove newsletter PDF', { storagePath, error: error.message });
  }
}

/** Remove every object a campaign ever stored (its folder). */
export async function removeNewsletterPdfs(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(NEWSLETTER_PDF_BUCKET)
    .list(campaignId, { limit: 100 });
  if (error) {
    log.warn('Could not list newsletter PDFs for removal', { campaignId, error: error.message });
    return;
  }
  const paths = (data ?? []).map((o: { name: string }) => `${campaignId}/${o.name}`);
  if (paths.length === 0) return;
  const { error: removeError } = await supabase.storage.from(NEWSLETTER_PDF_BUCKET).remove(paths);
  if (removeError) {
    log.warn('Could not remove newsletter PDFs', { campaignId, error: removeError.message });
  }
}

/** Base64 of the PDF bytes, chunked so a 5 MB file never blows the argument list. */
export function encodePdfBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Inverse of {@link encodePdfBase64}; tolerant of whitespace and data-URL prefixes. */
export function decodePdfBase64(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
