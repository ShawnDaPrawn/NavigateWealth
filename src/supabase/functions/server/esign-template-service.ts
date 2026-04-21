/**
 * E-Signature Template Service
 * CRUD operations for reusable envelope templates stored in KV.
 * Templates capture recipient configurations, source documents, field layouts,
 * signing mode, and message — enabling rapid envelope creation from saved
 * patterns without re-uploading a PDF every time.
 */

import * as kv from "./kv_store.tsx";
import { EsignKeys } from "./esign-keys.ts";
import { createModuleLogger } from "./stderr-logger.ts";
import { getEnvelopeDocuments } from "./esign-documents.ts";
import { applyManifest, type PageManifest } from "./esign-pdf-transform.ts";
import { calculateHash, downloadDocument, extractPageCount, uploadDocument } from "./esign-storage.ts";
import { createDocument } from "./esign-services.tsx";
import type {
  EsignDocument,
  EsignEnvelope,
  EsignEnvelopeDocumentRef,
  EsignField,
  EsignSigner,
} from "./esign-types.ts";

const log = createModuleLogger('esign-template-service');

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateRecipient {
  name: string;
  email: string;
  role?: string;
  order: number;
  otpRequired: boolean;
  accessCode?: string;
  kind?: 'signer' | 'witness' | 'cc';
}

export interface TemplateDocument {
  documentId: string;
  order: number;
  displayName: string;
  originalFilename: string;
  pageCount: number;
  storagePath: string;
}

export interface TemplateField {
  type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox' | 'attachment';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  /** Index into the recipients array (not a specific signer ID) */
  recipientIndex: number;
  /** Template-owned source document this field belongs to. */
  documentId?: string;
  metadata?: Record<string, unknown>;
}

export interface EsignTemplateRecord {
  id: string;
  name: string;
  description?: string;
  category?: string;
  signingMode: 'sequential' | 'parallel';
  defaultMessage?: string;
  defaultExpiryDays: number;
  recipients: TemplateRecipient[];
  documents: TemplateDocument[];
  fields: TemplateField[];
  /** Number of times this template has been used to create envelopes */
  usageCount: number;
  /**
   * Monotonically increasing template version. Starts at 1 on create.
   * Every substantive update snapshots the outgoing record into history
   * and bumps this number. Envelopes pin their `template_version` so the
   * exact snapshot stays retrievable even after later edits.
   */
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CREATE
// ============================================================================

export async function createTemplate(params: {
  name: string;
  description?: string;
  category?: string;
  signingMode?: 'sequential' | 'parallel';
  defaultMessage?: string;
  defaultExpiryDays?: number;
  recipients?: TemplateRecipient[];
  documents?: TemplateDocument[];
  fields?: TemplateField[];
  createdBy: string;
}): Promise<EsignTemplateRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const template: EsignTemplateRecord = {
    id,
    name: params.name.trim(),
    description: params.description?.trim(),
    category: params.category?.trim(),
    signingMode: params.signingMode || 'sequential',
    defaultMessage: params.defaultMessage?.trim(),
    defaultExpiryDays: params.defaultExpiryDays || 30,
    recipients: params.recipients || [],
    documents: params.documents || [],
    fields: params.fields || [],
    usageCount: 0,
    version: 1,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(EsignKeys.template(id), template);

  const listKey = EsignKeys.templatesList();
  const templateIds: string[] = (await kv.get(listKey)) || [];
  templateIds.push(id);
  await kv.set(listKey, templateIds);

  log.success(`Template created: "${template.name}" (${id})`);
  return template;
}

// ============================================================================
// READ
// ============================================================================

export async function getTemplate(templateId: string): Promise<EsignTemplateRecord | null> {
  try {
    const template = await kv.get(EsignKeys.template(templateId));
    if (!template) return null;

    const record = template as EsignTemplateRecord;
    if (typeof record.version !== 'number') record.version = 1;
    if (!Array.isArray(record.documents)) record.documents = [];
    if (!Array.isArray(record.recipients)) record.recipients = [];
    if (!Array.isArray(record.fields)) record.fields = [];
    return record;
  } catch (error) {
    log.error(`Failed to get template ${templateId}:`, error);
    return null;
  }
}

export async function listTemplates(): Promise<EsignTemplateRecord[]> {
  try {
    const listKey = EsignKeys.templatesList();
    const templateIds: string[] = (await kv.get(listKey)) || [];
    if (templateIds.length === 0) return [];

    const templates = await Promise.all(templateIds.map((id: string) => getTemplate(id)));
    return templates
      .filter((template): template is EsignTemplateRecord => Boolean(template))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    log.error('Failed to list templates:', error);
    return [];
  }
}

// ============================================================================
// UPDATE
// ============================================================================

const VERSIONED_KEYS = [
  'signingMode',
  'recipients',
  'documents',
  'fields',
  'defaultExpiryDays',
] as const;

function shouldBumpVersion(
  prev: EsignTemplateRecord,
  next: Partial<EsignTemplateRecord>,
): boolean {
  for (const key of VERSIONED_KEYS) {
    if (next[key] === undefined) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) return true;
  }
  return false;
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<EsignTemplateRecord, 'id' | 'createdAt' | 'createdBy' | 'usageCount' | 'version'>>,
): Promise<EsignTemplateRecord | null> {
  const existing = await getTemplate(templateId);
  if (!existing) {
    log.warn(`Template not found for update: ${templateId}`);
    return null;
  }

  const bump = shouldBumpVersion(existing, updates as Partial<EsignTemplateRecord>);
  if (bump) {
    try {
      await kv.set(EsignKeys.templateVersion(templateId, existing.version ?? 1), existing);
      const idxKey = EsignKeys.templateVersionsIndex(templateId);
      const idx = ((await kv.get(idxKey)) as number[] | null) ?? [];
      const priorVersion = existing.version ?? 1;
      if (!idx.includes(priorVersion)) idx.push(priorVersion);
      await kv.set(idxKey, idx);
    } catch (err) {
      log.warn(`Failed to snapshot template ${templateId} v${existing.version}:`, err);
    }
  }

  const updated: EsignTemplateRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    usageCount: existing.usageCount,
    version: bump ? (existing.version ?? 1) + 1 : (existing.version ?? 1),
    updatedAt: new Date().toISOString(),
  };

  await kv.set(EsignKeys.template(templateId), updated);
  log.success(
    `Template updated: "${updated.name}" (${templateId}) v${existing.version ?? 1}${bump ? ` -> v${updated.version}` : ' (no version bump)'}`,
  );
  return updated;
}

export async function getTemplateVersion(
  templateId: string,
  version: number,
): Promise<EsignTemplateRecord | null> {
  const live = await getTemplate(templateId);
  if (live && (live.version ?? 1) === version) return live;
  try {
    const snap = await kv.get(EsignKeys.templateVersion(templateId, version));
    return (snap as EsignTemplateRecord | null) ?? null;
  } catch (err) {
    log.error(`Failed to load template ${templateId} v${version}:`, err);
    return null;
  }
}

export async function listTemplateVersions(
  templateId: string,
): Promise<{ version: number; isLive: boolean; record: EsignTemplateRecord | null }[]> {
  const live = await getTemplate(templateId);
  const idxKey = EsignKeys.templateVersionsIndex(templateId);
  const idx = ((await kv.get(idxKey)) as number[] | null) ?? [];
  const versions = new Set<number>(idx);
  if (live) versions.add(live.version ?? 1);
  const ordered = Array.from(versions).sort((a, b) => a - b);
  return Promise.all(
    ordered.map(async (v) => ({
      version: v,
      isLive: !!live && (live.version ?? 1) === v,
      record: await getTemplateVersion(templateId, v),
    })),
  );
}

export async function incrementUsageCount(templateId: string): Promise<void> {
  const existing = await getTemplate(templateId);
  if (!existing) return;

  existing.usageCount = (existing.usageCount || 0) + 1;
  existing.updatedAt = new Date().toISOString();
  await kv.set(EsignKeys.template(templateId), existing);
}

// ============================================================================
// DELETE
// ============================================================================

export async function deleteTemplate(templateId: string): Promise<boolean> {
  try {
    const existing = await getTemplate(templateId);
    if (!existing) return false;

    await kv.del(EsignKeys.template(templateId));

    const listKey = EsignKeys.templatesList();
    const templateIds: string[] = (await kv.get(listKey)) || [];
    await kv.set(listKey, templateIds.filter((id: string) => id !== templateId));

    log.success(`Template deleted: "${existing.name}" (${templateId})`);
    return true;
  } catch (error) {
    log.error(`Failed to delete template ${templateId}:`, error);
    return false;
  }
}

// ============================================================================
// ENVELOPE -> TEMPLATE SNAPSHOT HELPERS
// ============================================================================

async function loadEnvelopeFields(envelopeId: string): Promise<EsignField[]> {
  const rawFieldList = (await kv.get(EsignKeys.envelopeFields(envelopeId))) || [];
  if (!Array.isArray(rawFieldList)) return [];

  const fieldIds = rawFieldList.filter((item: unknown) => typeof item === 'string') as string[];
  const legacyFields = rawFieldList.filter(
    (item: unknown) => typeof item === 'object' && item !== null && (item as EsignField).id,
  ) as EsignField[];
  const fetched = await Promise.all(fieldIds.map((id: string) => kv.get(EsignKeys.field(id))));
  return [...fetched.filter(Boolean), ...legacyFields] as EsignField[];
}

function deriveTemplateExpiryDays(envelope: EsignEnvelope): number {
  const createdAt = envelope.created_at ? new Date(envelope.created_at).getTime() : Number.NaN;
  const expiresAt = envelope.expires_at ? new Date(envelope.expires_at).getTime() : Number.NaN;
  if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
    return 30;
  }
  const diffDays = Math.round((expiresAt - createdAt) / (24 * 60 * 60 * 1000));
  return Math.max(1, diffDays || 30);
}

function normaliseTemplateRecipients(
  signers: EsignSigner[],
  draftSigners: Array<{
    name?: string;
    email?: string;
    role?: string;
    order?: number;
    otpRequired?: boolean;
    accessCode?: string;
    kind?: 'signer' | 'witness' | 'cc';
  }>,
): {
  recipients: TemplateRecipient[];
  recipientKeyToIndex: Map<string, number>;
} {
  const recipientKeyToIndex = new Map<string, number>();

  if (signers.length > 0) {
    const ordered = [...signers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const recipients = ordered.map((signer, index) => {
      recipientKeyToIndex.set(signer.id, index);
      recipientKeyToIndex.set(signer.email, index);
      return {
        name: signer.name || '',
        email: signer.email || '',
        role: signer.role || '',
        order: signer.order ?? index + 1,
        otpRequired: signer.requires_otp ?? false,
        accessCode: signer.access_code,
        kind: signer.kind,
      };
    });
    return { recipients, recipientKeyToIndex };
  }

  const orderedDrafts = [...draftSigners].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const recipients = orderedDrafts.map((signer, index) => {
    const email = signer.email?.trim() || '';
    if (email) recipientKeyToIndex.set(email, index);
    return {
      name: signer.name?.trim() || '',
      email,
      role: signer.role?.trim() || '',
      order: signer.order ?? index + 1,
      otpRequired: signer.otpRequired ?? false,
      accessCode: signer.accessCode,
      kind: signer.kind,
    };
  });
  return { recipients, recipientKeyToIndex };
}

async function cloneEnvelopeDocumentsToTemplate(params: {
  envelopeId: string;
  envelope: EsignEnvelope;
  firmId: string;
}): Promise<{
  documents: TemplateDocument[];
  documentIdMap: Map<string, string>;
}> {
  const sourceDocuments = await getEnvelopeDocuments(params.envelope);
  if (sourceDocuments.length === 0) {
    throw new Error('Cannot save a template without a source document.');
  }

  const documents: TemplateDocument[] = [];
  const documentIdMap = new Map<string, string>();
  const useSingleDocManifest = sourceDocuments.length <= 1;

  for (const sourceDoc of sourceDocuments) {
    const sourceRecord = (await kv.get(EsignKeys.PREFIX_DOCUMENT + sourceDoc.document_id)) as EsignDocument | null;
    const storagePath = sourceRecord?.storage_path || sourceDoc.storage_path;
    if (!storagePath) {
      throw new Error(`Template source document ${sourceDoc.document_id} is missing its storage path.`);
    }

    const sourceBuffer = await downloadDocument(storagePath);
    if (!sourceBuffer) {
      throw new Error(`Failed to download template source document ${sourceDoc.original_filename}.`);
    }

    let bufferToPersist = sourceBuffer;
    const manifestKey = useSingleDocManifest
      ? EsignKeys.envelopeManifest(params.envelopeId)
      : EsignKeys.envelopeDocumentManifest(params.envelopeId, sourceDoc.document_id);
    const manifest = (await kv.get(manifestKey)) as PageManifest | null;
    if (manifest) {
      bufferToPersist = (await applyManifest(sourceBuffer, manifest)).pdfBuffer;
    }

    const documentId = crypto.randomUUID();
    const { path, error } = await uploadDocument(
      params.firmId,
      documentId,
      bufferToPersist,
      sourceDoc.original_filename || sourceDoc.display_name || 'template.pdf',
      'application/pdf',
    );
    if (error || !path) {
      throw new Error(error || `Failed to clone ${sourceDoc.original_filename} into the template library.`);
    }

    const createdAt = new Date().toISOString();
    const pageCount = extractPageCount(bufferToPersist);
    await createDocument({
      id: documentId,
      firm_id: params.firmId,
      storage_path: path,
      original_filename: sourceDoc.original_filename || sourceDoc.display_name || 'template.pdf',
      page_count: pageCount,
      hash: await calculateHash(bufferToPersist),
      created_at: createdAt,
    });

    documents.push({
      documentId,
      order: sourceDoc.order,
      displayName: sourceDoc.display_name || sourceDoc.original_filename,
      originalFilename: sourceDoc.original_filename || sourceDoc.display_name || 'template.pdf',
      pageCount,
      storagePath: path,
    });
    documentIdMap.set(sourceDoc.document_id, documentId);
  }

  return {
    documents: documents.sort((a, b) => a.order - b.order),
    documentIdMap,
  };
}

async function buildTemplateSnapshotFromEnvelope(envelopeId: string): Promise<{
  recipients: TemplateRecipient[];
  documents: TemplateDocument[];
  fields: TemplateField[];
  signingMode: 'sequential' | 'parallel';
  defaultMessage?: string;
  defaultExpiryDays: number;
}> {
  const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as EsignEnvelope | null;
  if (!envelope) {
    throw new Error(`Envelope not found: ${envelopeId}`);
  }

  const signerIds: string[] = ((await kv.get(EsignKeys.envelopeSigners(envelopeId))) as string[] | null) ?? [];
  const signers = (
    await Promise.all(signerIds.map((id: string) => kv.get(EsignKeys.PREFIX_SIGNER + id)))
  ).filter(Boolean) as EsignSigner[];
  const draftSigners = (((envelope as EsignEnvelope & {
    draft_signers?: Array<{
      name?: string;
      email?: string;
      role?: string;
      order?: number;
      otpRequired?: boolean;
      accessCode?: string;
      kind?: 'signer' | 'witness' | 'cc';
    }>;
  }).draft_signers) ?? []);

  const { recipients, recipientKeyToIndex } = normaliseTemplateRecipients(signers, draftSigners);
  const { documents, documentIdMap } = await cloneEnvelopeDocumentsToTemplate({
    envelopeId,
    envelope,
    firmId: envelope.firm_id ?? 'standalone',
  });
  const primaryTemplateDocumentId = documents[0]?.documentId;

  const fields = (await loadEnvelopeFields(envelopeId)).map((field) => ({
    type: field.type,
    page: field.page,
    x: field.x,
    y: field.y,
    width: field.width,
    height: field.height,
    required: field.required ?? true,
    recipientIndex: field.signer_id ? (recipientKeyToIndex.get(field.signer_id) ?? 0) : 0,
    documentId: documentIdMap.get(field.document_id ?? envelope.document_id) ?? primaryTemplateDocumentId,
    metadata: field.metadata,
  }));

  return {
    recipients,
    documents,
    fields,
    signingMode: envelope.signing_mode || 'sequential',
    defaultMessage: envelope.message || undefined,
    defaultExpiryDays: deriveTemplateExpiryDays(envelope),
  };
}

// ============================================================================
// CREATE / SYNC FROM ENVELOPE
// ============================================================================

export async function createTemplateFromEnvelope(params: {
  envelopeId: string;
  name: string;
  description?: string;
  category?: string;
  createdBy: string;
}): Promise<EsignTemplateRecord | null> {
  try {
    const snapshot = await buildTemplateSnapshotFromEnvelope(params.envelopeId);
    return await createTemplate({
      name: params.name,
      description: params.description,
      category: params.category,
      signingMode: snapshot.signingMode,
      defaultMessage: snapshot.defaultMessage,
      defaultExpiryDays: snapshot.defaultExpiryDays,
      recipients: snapshot.recipients,
      documents: snapshot.documents,
      fields: snapshot.fields,
      createdBy: params.createdBy,
    });
  } catch (error) {
    log.error('Failed to create template from envelope:', error);
    return null;
  }
}

export async function syncTemplateFromEnvelope(params: {
  templateId: string;
  envelopeId: string;
  name?: string;
  description?: string;
  category?: string;
}): Promise<EsignTemplateRecord | null> {
  try {
    const existing = await getTemplate(params.templateId);
    if (!existing) return null;

    const snapshot = await buildTemplateSnapshotFromEnvelope(params.envelopeId);
    return await updateTemplate(params.templateId, {
      name: params.name?.trim() || existing.name,
      description: params.description?.trim() || existing.description,
      category: params.category?.trim() || existing.category,
      signingMode: snapshot.signingMode,
      defaultMessage: snapshot.defaultMessage,
      defaultExpiryDays: snapshot.defaultExpiryDays,
      recipients: snapshot.recipients,
      documents: snapshot.documents,
      fields: snapshot.fields,
    });
  } catch (error) {
    log.error(`Failed to sync template ${params.templateId} from envelope ${params.envelopeId}:`, error);
    return null;
  }
}

// ============================================================================
// TEMPLATE -> ENVELOPE DOCUMENT CLONING
// ============================================================================

export async function cloneTemplateDocumentsToEnvelope(params: {
  template: EsignTemplateRecord;
  firmId: string;
  addedByUserId?: string;
}): Promise<{
  primaryDocumentId: string;
  documents: EsignEnvelopeDocumentRef[];
  documentMap: Record<string, string>;
}> {
  const sortedDocs = [...(params.template.documents || [])].sort((a, b) => a.order - b.order);
  if (sortedDocs.length === 0) {
    throw new Error('This template does not have a saved source document yet.');
  }

  const documents: EsignEnvelopeDocumentRef[] = [];
  const documentMap: Record<string, string> = {};

  for (const templateDoc of sortedDocs) {
    const buffer = await downloadDocument(templateDoc.storagePath);
    if (!buffer) {
      throw new Error(`Failed to load template document ${templateDoc.originalFilename}.`);
    }

    const documentId = crypto.randomUUID();
    const { path, error } = await uploadDocument(
      params.firmId,
      documentId,
      buffer,
      templateDoc.originalFilename || templateDoc.displayName || 'template.pdf',
      'application/pdf',
    );
    if (error || !path) {
      throw new Error(error || `Failed to prepare ${templateDoc.originalFilename} for sending.`);
    }

    const createdAt = new Date().toISOString();
    const pageCount = templateDoc.pageCount || extractPageCount(buffer);
    await createDocument({
      id: documentId,
      firm_id: params.firmId,
      storage_path: path,
      original_filename: templateDoc.originalFilename || templateDoc.displayName || 'template.pdf',
      page_count: pageCount,
      hash: await calculateHash(buffer),
      created_at: createdAt,
    });

    documents.push({
      document_id: documentId,
      order: documents.length,
      display_name: templateDoc.displayName || templateDoc.originalFilename,
      original_filename: templateDoc.originalFilename || templateDoc.displayName || 'template.pdf',
      page_count: pageCount,
      storage_path: path,
      added_at: createdAt,
      added_by_user_id: params.addedByUserId,
    });
    documentMap[templateDoc.documentId] = documentId;
  }

  return {
    primaryDocumentId: documents[0].document_id,
    documents,
    documentMap,
  };
}
