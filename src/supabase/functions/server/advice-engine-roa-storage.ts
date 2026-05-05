/**
 * Supabase Storage-backed blobs for RoA evidence and generated artefacts.
 * Objects live in the same private bucket as general client documents (`make-91ed8379-documents`).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { NotFoundError } from './error.middleware.ts';

const log = createModuleLogger('advice-engine-roa-storage');

export const ROA_DOCUMENTS_BUCKET = 'make-91ed8379-documents';

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

let bucketReady = false;

export async function ensureRoADocumentsBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    const supabase = getSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === ROA_DOCUMENTS_BUCKET);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(ROA_DOCUMENTS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'image/jpeg',
          'image/png',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
      });
      if (error && !String(error.message || '').includes('already exists')) {
        log.warn('RoA bucket creation note', { message: error.message });
      }
    }
    bucketReady = true;
  } catch (error) {
    const msg = getErrMsg(error);
    if (msg.includes('already exists')) {
      bucketReady = true;
      return;
    }
    log.warn('RoA bucket initialization (non-fatal)', { error: msg });
  }
}

function safeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function roaEvidenceBlobPath(
  clientId: string | undefined,
  draftId: string,
  evidenceId: string,
  mimeType: string | undefined,
): string {
  const ext = mimeTypeToExtension(mimeType);
  const c = safeSegment(clientId || 'no_client');
  const d = safeSegment(draftId);
  const e = safeSegment(evidenceId);
  return `roa/evidence/${c}/${d}/${e}${ext}`;
}

export function roaGeneratedBlobPath(
  clientId: string | undefined,
  draftId: string,
  documentId: string,
  format: 'pdf' | 'docx',
): string {
  const c = safeSegment(clientId || 'no_client');
  const d = safeSegment(draftId);
  const doc = safeSegment(documentId);
  return `roa/generated/${c}/${d}/${doc}.${format}`;
}

function mimeTypeToExtension(mimeType: string | undefined): string {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('spreadsheet')) return '.xlsx';
  if (m.includes('png')) return '.png';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  return '.bin';
}

export async function uploadRoABlob(objectPath: string, bytes: Uint8Array, contentType: string): Promise<void> {
  await ensureRoADocumentsBucket();
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(ROA_DOCUMENTS_BUCKET).upload(objectPath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`RoA storage upload failed: ${error.message}`);
  }
}

export async function downloadRoABlob(objectPath: string): Promise<Uint8Array> {
  await ensureRoADocumentsBucket();
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(ROA_DOCUMENTS_BUCKET).download(objectPath);
  if (error || !data) {
    throw new NotFoundError(error?.message || 'RoA object not found in storage');
  }
  return new Uint8Array(await data.arrayBuffer());
}
