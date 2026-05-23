/**
 * Attach filled PDF templates to client document records.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('form-template-document');

const BUCKET_NAME = 'make-91ed8379-documents';
const TEMPLATE_STORAGE_PREFIX = 'form-templates';

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

export async function storeTemplatePdfBytes(
  templateId: string,
  fileName: string,
  pdfBytes: Uint8Array,
): Promise<string> {
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${TEMPLATE_STORAGE_PREFIX}/${templateId}/${sanitized}`;

  const { error } = await getSupabase().storage.from(BUCKET_NAME).upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (error) {
    log.error('Template PDF storage upload failed', error);
    throw new Error(error.message);
  }

  return storagePath;
}

export async function loadTemplatePdfBytes(
  templateId: string,
  storagePath?: string,
): Promise<Uint8Array | null> {
  const path = storagePath || `${TEMPLATE_STORAGE_PREFIX}/${templateId}/template.pdf`;
  const { data, error } = await getSupabase().storage.from(BUCKET_NAME).download(path);

  if (error || !data) {
    log.warn('Template PDF storage download failed', { templateId, path, error });
    return null;
  }

  const buffer = await data.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function attachFilledPdfToClientDocuments(options: {
  clientId: string;
  uploadedBy: string;
  fileName: string;
  pdfBytes: Uint8Array;
  templateName: string;
}): Promise<{ documentId: string; filePath: string }> {
  const timestamp = Date.now();
  const sanitizedFileName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${options.clientId}/${timestamp}_${sanitizedFileName}`;

  const { error: uploadError } = await getSupabase().storage
    .from(BUCKET_NAME)
    .upload(filePath, options.pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    log.error('Filled PDF storage upload failed', uploadError);
    throw new Error(uploadError.message);
  }

  const documentId = `doc_${timestamp}`;
  const metadata = {
    id: documentId,
    userId: options.clientId,
    type: 'document',
    title: `Filled form — ${options.templateName}`,
    fileName: options.fileName,
    fileSize: options.pdfBytes.length,
    filePath,
    uploadDate: new Date().toISOString(),
    productCategory: 'General',
    policyNumber: '',
    status: 'new',
    isFavourite: false,
    uploadedBy: options.uploadedBy,
    subcategory: 'Filled external form',
  };

  await kv.set(`document:${options.clientId}:${documentId}`, metadata);

  return { documentId, filePath };
}
