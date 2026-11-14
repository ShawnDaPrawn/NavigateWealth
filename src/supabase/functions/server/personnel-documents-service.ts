/**
 * Staff compliance documents (Personnel › Compliance › Upload).
 *
 * Files go to a private Supabase Storage bucket the same way client documents
 * do (`client-management-documents-routes.ts`): one folder per person,
 * `{personnelId}/{timestamp}_{safeName}`, never public. The staff record keeps
 * the document entry with its storage `path`; a short-lived signed URL is
 * minted when someone opens it.
 */

import { createServiceClient } from './client-management-utils.ts';
import { PersonnelService } from './client-management-personnel-service.ts';
import { personnelProfiles } from './repositories/client-adviser-repository.ts';
import type { PersonnelDocument, UserRole } from './client-management-personnel-types.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('personnel-documents');

export const PERSONNEL_DOCUMENTS_BUCKET = 'make-91ed8379-personnel-documents';
export const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
/** How long an opened document's link works. */
const SIGNED_URL_SECONDS = 10 * 60;

export class PersonnelDocumentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 500,
  ) {
    super(message);
  }
}

const CAN_MANAGE: UserRole[] = ['super_admin', 'admin', 'compliance'];

function assertCanManage(role: UserRole) {
  if (!CAN_MANAGE.includes(role)) {
    throw new PersonnelDocumentError('Unauthorized to manage staff documents', 403);
  }
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-120);
  return cleaned || 'document';
}

export async function uploadPersonnelDocument(
  viewerRole: UserRole,
  personnelId: string,
  file: File,
  meta: { name: string; type: PersonnelDocument['type'] },
  now: Date = new Date(),
): Promise<PersonnelDocument> {
  assertCanManage(viewerRole);
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    throw new PersonnelDocumentError('Choose a PDF, JPG or PNG file', 400);
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new PersonnelDocumentError('The file is larger than 6 MB', 400);
  }
  const profile = await personnelProfiles.get(personnelId);
  if (!profile) throw new PersonnelDocumentError('Staff member not found', 404);

  const supabase = createServiceClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === PERSONNEL_DOCUMENTS_BUCKET)) {
    await supabase.storage.createBucket(PERSONNEL_DOCUMENTS_BUCKET, {
      public: false,
      fileSizeLimit: MAX_DOCUMENT_BYTES,
      allowedMimeTypes: ALLOWED_DOCUMENT_TYPES,
    });
  }

  const path = `${personnelId}/${now.getTime()}_${safeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(PERSONNEL_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    log.error('Upload failed', error);
    throw new PersonnelDocumentError('The file could not be stored', 500);
  }

  const doc: PersonnelDocument = {
    id: crypto.randomUUID(),
    name: meta.name,
    type: meta.type,
    url: '',
    path,
    uploadedAt: now.toISOString(),
  };
  await PersonnelService.addDocument(viewerRole, personnelId, doc);
  return doc;
}

/** A short-lived link to one of the person's stored documents. */
export async function personnelDocumentUrl(
  viewerRole: UserRole,
  personnelId: string,
  documentId: string,
): Promise<string> {
  assertCanManage(viewerRole);
  const profile = await personnelProfiles.get(personnelId);
  const doc = profile?.documents?.find((d) => d.id === documentId);
  if (!doc) throw new PersonnelDocumentError('Document not found', 404);
  // Documents recorded before uploads existed carry a plain URL.
  if (!doc.path) {
    if (doc.url) return doc.url;
    throw new PersonnelDocumentError('Document has no stored file', 404);
  }
  const { data, error } = await createServiceClient()
    .storage.from(PERSONNEL_DOCUMENTS_BUCKET)
    .createSignedUrl(doc.path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    log.error('Signed URL failed', error);
    throw new PersonnelDocumentError('The document could not be opened', 500);
  }
  return data.signedUrl;
}
